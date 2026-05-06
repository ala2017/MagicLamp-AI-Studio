"""
Mask 生成器：根据前端传来的排版坐标，合成画布图并生成对应的 Mask。
"""
from PIL import Image
import numpy as np
from scipy.ndimage import gaussian_filter


def generate_canvas_and_mask(
    original_img: Image.Image,
    canvas_w: int,
    canvas_h: int,
    img_left: float,
    img_top: float,
    img_scale: float,
    feather_sigma: float = 10.0,
) -> tuple[Image.Image, Image.Image]:
    """
    将原图按排版坐标贴到画布上，并生成 Mask。

    Args:
        original_img: 用户上传的原图 (RGB)
        canvas_w: 画布宽度 (如 1920)
        canvas_h: 画布高度 (如 1080)
        img_left: 原图左上角在画布中的 X 坐标
        img_top: 原图左上角在画布中的 Y 坐标
        img_scale: 原图缩放比例 (1.0 = 原始尺寸)
        feather_sigma: Mask 边缘羽化的高斯模糊 sigma

    Returns:
        (canvas_image, mask_image)
        canvas_image: RGB 合成画布图
        mask_image: L 模式 Mask (白色=待填充, 黑色=原图区域)
    """
    original_img = original_img.convert("RGB")

    # 1. 创建底图（将原图拉伸并严重模糊，作为环境色背景，避免 VAE 编码时黑边渗入导致色差和接缝）
    from PIL import ImageFilter
    bg_img = original_img.resize((canvas_w, canvas_h), Image.LANCZOS)
    canvas = bg_img.filter(ImageFilter.GaussianBlur(radius=100)).convert("RGB")

    # 2. 缩放原图
    scaled_w = max(1, int(original_img.width * img_scale))
    scaled_h = max(1, int(original_img.height * img_scale))
    scaled_img = original_img.resize((scaled_w, scaled_h), Image.LANCZOS)

    # 3. 计算粘贴位置（处理负值和超出画布的情况）
    paste_x = int(round(img_left))
    paste_y = int(round(img_top))

    # 源图的裁剪区域（当粘贴位置为负数或超出画布时）
    src_x1 = max(0, -paste_x)
    src_y1 = max(0, -paste_y)
    src_x2 = min(scaled_w, canvas_w - paste_x)
    src_y2 = min(scaled_h, canvas_h - paste_y)

    # 画布上的粘贴区域
    dst_x1 = max(0, paste_x)
    dst_y1 = max(0, paste_y)
    dst_x2 = dst_x1 + (src_x2 - src_x1)
    dst_y2 = dst_y1 + (src_y2 - src_y1)

    # 检查是否有有效区域
    if src_x2 > src_x1 and src_y2 > src_y1:
        cropped = scaled_img.crop((src_x1, src_y1, src_x2, src_y2))
        canvas.paste(cropped, (dst_x1, dst_y1))

    # 4. 生成 Mask（全白 = 全部待填充）
    mask = np.ones((canvas_h, canvas_w), dtype=np.float32) * 255.0

    # 原图覆盖区域设为黑色
    if src_x2 > src_x1 and src_y2 > src_y1:
        mask[dst_y1:dst_y2, dst_x1:dst_x2] = 0.0

    # 5. 边缘羽化
    if feather_sigma > 0:
        mask = gaussian_filter(mask, sigma=feather_sigma)

    mask_image = Image.fromarray(mask.astype(np.uint8), mode="L")

    return canvas, mask_image
