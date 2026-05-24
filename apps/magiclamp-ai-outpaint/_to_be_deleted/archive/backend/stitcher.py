"""
Crop-and-Stitch 高清扩图模块

核心思路：不再把整张画布 resize 到 1280×720 推理，
而是只裁剪「需要 AI 填充的边缘条带」+ 少量原图上下文，
以更高的有效分辨率送入 FLUX 推理，最后缝合回原始尺寸画布。

同样 1280px 长边能覆盖一个窄条带而非整个画布，
AI 区域的有效分辨率提升 3~5 倍。
"""
import logging
from typing import Literal

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter

logger = logging.getLogger(__name__)

Direction = Literal["top", "bottom", "left", "right"]


def _align16(val: int) -> int:
    """对齐到 16 的倍数（FLUX 要求）"""
    return max(16, (val // 16) * 16)


def _compute_strips(
    orig_w: int,
    orig_h: int,
    canvas_w: int,
    canvas_h: int,
    paste_x: int,
    paste_y: int,
    paste_w: int,
    paste_h: int,
    context_ratio: float = 0.3,
    max_edge: int = 1280,
) -> list[dict]:
    """
    分析原图在画布上的位置，返回需要生成的条带列表。

    每个条带 dict 包含:
    - direction: 方向 ("top" | "bottom" | "left" | "right")
    - strip_region: (x1, y1, x2, y2) 在画布坐标系中的条带区域
    - context_region: (x1, y1, x2, y2) 在原图中用作上下文的区域
    - canvas_paste_offset: (x, y) 条带在最终画布上的粘贴偏移
    """
    strips = []

    # 计算原图在画布上占据的区域（裁剪到画布边界）
    img_x1 = max(0, paste_x)
    img_y1 = max(0, paste_y)
    img_x2 = min(canvas_w, paste_x + paste_w)
    img_y2 = min(canvas_h, paste_y + paste_h)

    # 四个方向的留白
    left_gap = img_x1
    right_gap = canvas_w - img_x2
    top_gap = img_y1
    bottom_gap = canvas_h - img_y2

    logger.info(
        f"[Stitch] 留白分析: left={left_gap}, right={right_gap}, "
        f"top={top_gap}, bottom={bottom_gap}"
    )

    # 为每个有留白的方向创建条带
    # context_px: 从原图中取多少像素作为上下文
    if top_gap > 0:
        context_px = min(int(paste_h * context_ratio), img_y2 - img_y1)
        strips.append({
            "direction": "top",
            "gap": top_gap,
            "context_px": context_px,
            # 条带覆盖的画布区域: 从 y=0 到 原图顶边 + context
            "strip_canvas_region": (img_x1, 0, img_x2, img_y1 + context_px),
            # 缝合时在最终画布上的位置
            "stitch_region": (img_x1, 0, img_x2, img_y1),
        })

    if bottom_gap > 0:
        context_px = min(int(paste_h * context_ratio), img_y2 - img_y1)
        strips.append({
            "direction": "bottom",
            "gap": bottom_gap,
            "context_px": context_px,
            "strip_canvas_region": (img_x1, img_y2 - context_px, img_x2, canvas_h),
            "stitch_region": (img_x1, img_y2, img_x2, canvas_h),
        })

    if left_gap > 0:
        context_px = min(int(paste_w * context_ratio), img_x2 - img_x1)
        strips.append({
            "direction": "left",
            "gap": left_gap,
            "context_px": context_px,
            "strip_canvas_region": (0, img_y1, img_x1 + context_px, img_y2),
            "stitch_region": (0, img_y1, img_x1, img_y2),
        })

    if right_gap > 0:
        context_px = min(int(paste_w * context_ratio), img_x2 - img_x1)
        strips.append({
            "direction": "right",
            "gap": right_gap,
            "context_px": context_px,
            "strip_canvas_region": (img_x2 - context_px, img_y1, canvas_w, img_y2),
            "stitch_region": (img_x2, img_y1, canvas_w, img_y2),
        })

    return strips


def prepare_strip_for_flux(
    original_img: Image.Image,
    canvas_w: int,
    canvas_h: int,
    paste_x: int,
    paste_y: int,
    paste_w: int,
    paste_h: int,
    strip_info: dict,
    max_edge: int = 1280,
) -> tuple[Image.Image, Image.Image, dict]:
    """
    为一个条带准备 FLUX 的输入 canvas 和 mask。

    返回: (strip_canvas, strip_mask, metadata)
    - strip_canvas: 缩放到 FLUX 兼容尺寸的条带画布
    - strip_mask: 对应的 mask (白=生成, 黑=保留)
    - metadata: 包含缩放信息，用于后续缝合
    """
    direction = strip_info["direction"]
    sx1, sy1, sx2, sy2 = strip_info["strip_canvas_region"]
    strip_w = sx2 - sx1
    strip_h = sy2 - sy1

    if strip_w <= 0 or strip_h <= 0:
        raise ValueError(f"条带尺寸无效: {strip_w}x{strip_h}")

    # 1. 创建条带画布（在原始分辨率下）
    # 先构建完整画布上的这一块区域
    scaled_img = original_img.copy().convert("RGB").resize(
        (paste_w, paste_h), Image.LANCZOS
    )

    strip_canvas = Image.new("RGB", (strip_w, strip_h), (128, 128, 128))

    # 计算原图在条带坐标系中的位置
    orig_in_strip_x = paste_x - sx1
    orig_in_strip_y = paste_y - sy1

    # 裁剪出原图中与条带重叠的部分
    src_x1 = max(0, sx1 - paste_x)
    src_y1 = max(0, sy1 - paste_y)
    src_x2 = min(paste_w, sx2 - paste_x)
    src_y2 = min(paste_h, sy2 - paste_y)

    if src_x2 > src_x1 and src_y2 > src_y1:
        cropped = scaled_img.crop((src_x1, src_y1, src_x2, src_y2))
        dst_x = max(0, orig_in_strip_x)
        dst_y = max(0, orig_in_strip_y)
        strip_canvas.paste(cropped, (dst_x, dst_y))

    # 2. 用边缘采样色填充空白区域
    strip_np = np.array(strip_canvas)
    # 从原图区域的边缘采样颜色
    if src_x2 > src_x1 and src_y2 > src_y1:
        cropped_np = np.array(cropped)
        fill_color = cropped_np.mean(axis=(0, 1)).astype(np.uint8)
    else:
        fill_color = np.array([128, 128, 128], dtype=np.uint8)

    # 3. 创建 mask
    mask_np = np.ones((strip_h, strip_w), dtype=np.float32) * 255.0

    # 原图区域设为黑色（保留）
    if src_x2 > src_x1 and src_y2 > src_y1:
        dst_x = max(0, orig_in_strip_x)
        dst_y = max(0, orig_in_strip_y)
        dst_x2_mask = dst_x + (src_x2 - src_x1)
        dst_y2_mask = dst_y + (src_y2 - src_y1)
        mask_np[dst_y:dst_y2_mask, dst_x:dst_x2_mask] = 0.0

    # 边缘羽化
    mask_np = gaussian_filter(mask_np, sigma=8.0)

    # 4. 用填充色替换空白区域，加模糊过渡
    mask_binary = mask_np > 128
    for c in range(3):
        strip_np[:, :, c] = np.where(
            mask_binary,
            fill_color[c],
            strip_np[:, :, c],
        )
    # 整体轻度模糊让过渡更自然
    strip_canvas = Image.fromarray(strip_np)
    strip_canvas = strip_canvas.filter(ImageFilter.GaussianBlur(radius=20))
    # 把原图区域贴回（不要被模糊影响）
    if src_x2 > src_x1 and src_y2 > src_y1:
        dst_x = max(0, orig_in_strip_x)
        dst_y = max(0, orig_in_strip_y)
        strip_canvas.paste(cropped, (dst_x, dst_y))

    # 5. 缩放到 FLUX 兼容尺寸（长边 ≤ max_edge，宽高对齐 16）
    scale_factor = min(max_edge / max(strip_w, strip_h), 1.0)
    flux_w = _align16(int(strip_w * scale_factor))
    flux_h = _align16(int(strip_h * scale_factor))

    # 确保不超过 max_edge
    if flux_w > max_edge:
        flux_w = _align16(max_edge)
    if flux_h > max_edge:
        flux_h = _align16(max_edge)

    strip_canvas_resized = strip_canvas.resize((flux_w, flux_h), Image.LANCZOS)
    mask_img = Image.fromarray(mask_np.astype(np.uint8), mode="L")
    mask_resized = mask_img.resize((flux_w, flux_h), Image.LANCZOS)

    metadata = {
        "direction": direction,
        "strip_canvas_region": (sx1, sy1, sx2, sy2),
        "stitch_region": strip_info["stitch_region"],
        "original_strip_size": (strip_w, strip_h),
        "flux_size": (flux_w, flux_h),
        "scale_factor": scale_factor,
    }

    logger.info(
        f"[Stitch] 条带 {direction}: "
        f"原始 {strip_w}x{strip_h} → FLUX {flux_w}x{flux_h} "
        f"(缩放 {scale_factor:.2f})"
    )

    return strip_canvas_resized, mask_resized, metadata


def stitch_strip(
    canvas: Image.Image,
    generated_strip: Image.Image,
    metadata: dict,
    feather_px: int = 50,
) -> Image.Image:
    """
    将 FLUX 生成的条带缝合到画布上。

    canvas: 当前画布（原始分辨率）
    generated_strip: FLUX 生成的条带结果（FLUX 输出尺寸）
    metadata: prepare_strip_for_flux 返回的元数据
    feather_px: 接缝处的羽化像素数
    """
    direction = metadata["direction"]
    sx1, sy1, sx2, sy2 = metadata["stitch_region"]
    strip_w = sx2 - sx1
    strip_h = sy2 - sy1

    if strip_w <= 0 or strip_h <= 0:
        logger.warning(f"[Stitch] 条带 {direction} 缝合区域为空，跳过")
        return canvas

    # 1. 将 FLUX 生成结果 resize 回原始条带覆盖区域大小
    orig_sw, orig_sh = metadata["original_strip_size"]
    strip_result = generated_strip.copy().convert("RGB").resize(
        (orig_sw, orig_sh), Image.LANCZOS
    )

    # 2. 从结果中裁剪出纯生成区域（stitch_region 相对于 strip_canvas_region 的偏移）
    scr_x1, scr_y1, scr_x2, scr_y2 = metadata["strip_canvas_region"]
    crop_x1 = sx1 - scr_x1
    crop_y1 = sy1 - scr_y1
    crop_x2 = crop_x1 + strip_w
    crop_y2 = crop_y1 + strip_h

    # 安全裁剪
    crop_x1 = max(0, min(crop_x1, orig_sw))
    crop_y1 = max(0, min(crop_y1, orig_sh))
    crop_x2 = max(crop_x1, min(crop_x2, orig_sw))
    crop_y2 = max(crop_y1, min(crop_y2, orig_sh))

    generated_region = strip_result.crop((crop_x1, crop_y1, crop_x2, crop_y2))

    actual_w = crop_x2 - crop_x1
    actual_h = crop_y2 - crop_y1

    if actual_w <= 0 or actual_h <= 0:
        logger.warning(f"[Stitch] 条带 {direction} 裁剪区域为空，跳过")
        return canvas

    # 如果裁剪后尺寸与目标不一致，resize 到目标
    if actual_w != strip_w or actual_h != strip_h:
        generated_region = generated_region.resize(
            (strip_w, strip_h), Image.LANCZOS
        )

    # 3. 创建方向性渐变 mask（在接缝处做软过渡）
    feather_mask = _make_directional_feather(
        strip_w, strip_h, direction, feather_px
    )

    # 4. 缝合到画布
    canvas.paste(generated_region, (sx1, sy1), feather_mask)

    logger.info(
        f"[Stitch] 条带 {direction} 已缝合到画布 ({sx1},{sy1})-({sx2},{sy2})"
    )
    return canvas


def _make_directional_feather(
    w: int,
    h: int,
    direction: str,
    feather_px: int,
) -> Image.Image:
    """
    创建方向性渐变 mask。
    在与原图接缝的边上做渐变（0→255），其他方向保持 255（完全使用生成像素）。
    """
    mask = np.ones((h, w), dtype=np.float32) * 255.0
    feather_px = min(feather_px, min(w, h) // 2)

    if feather_px <= 0:
        return Image.fromarray(mask.astype(np.uint8), mode="L")

    gradient = np.linspace(0, 255, feather_px).astype(np.float32)

    if direction == "top":
        # 底边与原图接壤 → 底部渐变
        for i in range(feather_px):
            mask[h - 1 - i, :] = gradient[i]
    elif direction == "bottom":
        # 顶边与原图接壤 → 顶部渐变
        for i in range(feather_px):
            mask[i, :] = gradient[i]
    elif direction == "left":
        # 右边与原图接壤 → 右部渐变
        for i in range(feather_px):
            mask[:, w - 1 - i] = gradient[i]
    elif direction == "right":
        # 左边与原图接壤 → 左部渐变
        for i in range(feather_px):
            mask[:, i] = gradient[i]

    return Image.fromarray(mask.astype(np.uint8), mode="L")


def compose_crop_and_stitch(
    original_img: Image.Image,
    canvas_w: int,
    canvas_h: int,
    paste_x: int,
    paste_y: int,
    paste_w: int,
    paste_h: int,
    generate_fn,
    step_callback=None,
) -> Image.Image:
    """
    Crop-and-Stitch 完整流程：
    1. 分析需要生成的条带
    2. 逐条带: 准备 → FLUX 推理 → 缝合
    3. 返回完成的画布

    generate_fn: 接受 (canvas_img, mask_img) 返回 Image 的推理函数
    """
    # 1. 创建初始画布，原图贴入
    scaled_img = original_img.copy().convert("RGB").resize(
        (paste_w, paste_h), Image.LANCZOS
    )
    final_canvas = Image.new("RGB", (canvas_w, canvas_h), (128, 128, 128))

    # 计算实际粘贴范围
    dst_x1 = max(0, paste_x)
    dst_y1 = max(0, paste_y)
    src_x1 = max(0, -paste_x)
    src_y1 = max(0, -paste_y)
    src_x2 = min(paste_w, canvas_w - paste_x)
    src_y2 = min(paste_h, canvas_h - paste_y)

    if src_x2 > src_x1 and src_y2 > src_y1:
        cropped = scaled_img.crop((src_x1, src_y1, src_x2, src_y2))
        final_canvas.paste(cropped, (dst_x1, dst_y1))

    # 2. 计算条带
    strips = _compute_strips(
        original_img.width, original_img.height,
        canvas_w, canvas_h,
        paste_x, paste_y, paste_w, paste_h,
    )

    if not strips:
        logger.info("[Stitch] 没有留白区域，无需生成")
        return final_canvas

    total_strips = len(strips)
    logger.info(f"[Stitch] 共 {total_strips} 个条带需要生成")

    # 3. 逐条带处理
    for i, strip_info in enumerate(strips):
        direction = strip_info["direction"]

        if step_callback:
            base_progress = 40 + int((i / total_strips) * 50)
            step_callback(
                base_progress,
                f"[STITCH] 生成条带 {i+1}/{total_strips} ({direction})..."
            )

        # 准备 FLUX 输入
        strip_canvas, strip_mask, metadata = prepare_strip_for_flux(
            original_img, canvas_w, canvas_h,
            paste_x, paste_y, paste_w, paste_h,
            strip_info,
        )

        # FLUX 推理
        def strip_step_cb(p, m):
            if step_callback:
                # 映射到总进度
                strip_base = 40 + int((i / total_strips) * 50)
                strip_end = 40 + int(((i + 1) / total_strips) * 50)
                mapped_p = strip_base + int((p - 40) / 55 * (strip_end - strip_base))
                step_callback(mapped_p, m)

        generated = generate_fn(strip_canvas, strip_mask, step_callback=strip_step_cb)

        # 缝合
        final_canvas = stitch_strip(final_canvas, generated, metadata)

    logger.info("[Stitch] 所有条带缝合完成")
    return final_canvas
