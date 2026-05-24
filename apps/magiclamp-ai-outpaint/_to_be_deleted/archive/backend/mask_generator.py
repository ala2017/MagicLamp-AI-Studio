"""
Mask 生成器：根据前端传来的排版坐标，合成画布图并生成对应的 Mask。

v0.3.0 重构：
- 接口改为 paste_x/paste_y/paste_w/paste_h（由 main.py 从归一化坐标还原）
- 自适应留白算法：根据留白边数(1~4边)动态调整 feather_sigma
- 角落混合使用 NumPy 向量化（替代 Python for 循环），性能提升 ~100x

核心策略：从原图四条边缘采样背景色做渐变填充，
既给 FLUX 提供正确的色彩/光照上下文，又不泄漏人物信息。
"""
from PIL import Image, ImageFilter
import numpy as np
from scipy.ndimage import gaussian_filter
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).parent.parent / "output"


def _sample_edge_color(img_array: np.ndarray, edge: str, strip_width: int = 16) -> np.ndarray:
    """从图像的指定边缘采样平均颜色（RGB）"""
    h, w = img_array.shape[:2]
    if edge == "left":
        strip = img_array[:, :strip_width]
    elif edge == "right":
        strip = img_array[:, -strip_width:]
    elif edge == "top":
        strip = img_array[:strip_width, :]
    elif edge == "bottom":
        strip = img_array[-strip_width:, :]
    else:
        strip = img_array
    return strip.mean(axis=(0, 1)).astype(np.uint8)


def _count_exposed_edges(canvas_w, canvas_h, dst_x1, dst_y1, dst_x2, dst_y2) -> int:
    """计算有多少条边存在留白（0~4）"""
    count = 0
    if dst_x1 > 0:     count += 1  # 左侧有留白
    if dst_x2 < canvas_w: count += 1  # 右侧有留白
    if dst_y1 > 0:     count += 1  # 上方有留白
    if dst_y2 < canvas_h: count += 1  # 下方有留白
    return count


def _adaptive_feather_sigma(exposed_edges: int) -> float:
    """根据留白边数自适应调整 feather_sigma"""
    sigma_map = {
        0: 4.0,   # 无留白（兜底）
        1: 6.0,   # 1边留白：轻度羽化
        2: 10.0,  # 2边留白：中等羽化
        3: 14.0,  # 3边留白：较强羽化
        4: 18.0,  # 4边留白：最大化上下文扩散
    }
    return sigma_map.get(exposed_edges, 12.0)


def _blend_corner_vectorized(
    canvas: np.ndarray,
    y_start: int, y_end: int,
    x_start: int, x_end: int,
    color_v: np.ndarray, color_h: np.ndarray,
    v_origin: str, h_origin: str,
):
    """
    NumPy 向量化的角落距离加权混合。
    color_v: 纵向边缘色（top 或 bottom）
    color_h: 横向边缘色（left 或 right）
    v_origin: 'top' 或 'bottom'，表示纵向距离的参考方向
    h_origin: 'left' 或 'right'，表示横向距离的参考方向
    """
    h_range = y_end - y_start
    w_range = x_end - x_start
    if h_range <= 0 or w_range <= 0:
        return

    # 生成归一化距离网格 (0~1)
    if v_origin == "top":
        dy = np.linspace(0, 1, h_range, endpoint=False)
    else:  # bottom
        dy = np.linspace(1, 0, h_range, endpoint=False)

    if h_origin == "left":
        dx = np.linspace(0, 1, w_range, endpoint=False)
    else:  # right
        dx = np.linspace(1, 0, w_range, endpoint=False)

    # meshgrid: DY[y,x], DX[y,x]
    DY, DX = np.meshgrid(dy, dx, indexing='ij')

    # 权重: color_v 的权重 = DY / (DX + DY + epsilon)
    total = DX + DY + 1e-6
    wv = DY / total      # 纵向颜色权重
    wh = 1.0 - wv        # 横向颜色权重

    # 向量化混合: shape (h_range, w_range, 3)
    wv_3d = wv[:, :, np.newaxis]
    wh_3d = wh[:, :, np.newaxis]

    blended = (color_v.astype(np.float32) * wv_3d +
               color_h.astype(np.float32) * wh_3d)

    canvas[y_start:y_end, x_start:x_end] = blended.astype(np.uint8)


def _create_edge_gradient_bg(
    canvas_w: int, canvas_h: int,
    img_array: np.ndarray,
    dst_x1: int, dst_y1: int, dst_x2: int, dst_y2: int
) -> np.ndarray:
    """
    从原图贴入区域的四条边缘采样颜色，向外做渐变扩散。
    角落区域使用 NumPy 向量化距离加权混合。
    """
    canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)

    # 从贴入的图像区域的四条边采样颜色
    left_color = _sample_edge_color(img_array, "left")
    right_color = _sample_edge_color(img_array, "right")
    top_color = _sample_edge_color(img_array, "top")
    bottom_color = _sample_edge_color(img_array, "bottom")

    has_left   = dst_x1 > 0
    has_right  = dst_x2 < canvas_w
    has_top    = dst_y1 > 0
    has_bottom = dst_y2 < canvas_h

    # 先填充四条边的留白区域
    if has_left:
        canvas[:, :dst_x1] = left_color
    if has_right:
        canvas[:, dst_x2:] = right_color
    if has_top:
        canvas[:dst_y1, :] = top_color
    if has_bottom:
        canvas[dst_y2:, :] = bottom_color

    # 角落区域：NumPy 向量化距离加权混合
    if has_left and has_top:
        _blend_corner_vectorized(canvas, 0, dst_y1, 0, dst_x1,
                                 top_color, left_color, "top", "left")
    if has_right and has_top:
        _blend_corner_vectorized(canvas, 0, dst_y1, dst_x2, canvas_w,
                                 top_color, right_color, "top", "right")
    if has_left and has_bottom:
        _blend_corner_vectorized(canvas, dst_y2, canvas_h, 0, dst_x1,
                                 bottom_color, left_color, "bottom", "left")
    if has_right and has_bottom:
        _blend_corner_vectorized(canvas, dst_y2, canvas_h, dst_x2, canvas_w,
                                 bottom_color, right_color, "bottom", "right")

    # 整体做一次重模糊，让颜色过渡更自然
    canvas_img = Image.fromarray(canvas)
    canvas_img = canvas_img.filter(ImageFilter.GaussianBlur(radius=60))

    return np.array(canvas_img)


def generate_canvas_and_mask(
    original_img: Image.Image,
    canvas_w: int,
    canvas_h: int,
    paste_x: int,
    paste_y: int,
    paste_w: int,
    paste_h: int,
) -> tuple[Image.Image, Image.Image]:
    """
    将原图按排版坐标贴到画布上，并生成 Mask。

    v0.3.0 接口：
    - paste_x, paste_y: 原图在画布上的粘贴位置（左上角像素坐标）
    - paste_w, paste_h: 原图在画布上的目标尺寸（像素）
    - feather_sigma: 自动根据留白边数计算
    """
    original_img = original_img.copy().convert("RGB")

    # 1. 缩放原图到目标尺寸
    paste_w = max(1, paste_w)
    paste_h = max(1, paste_h)
    scaled_img = original_img.resize((paste_w, paste_h), Image.LANCZOS)

    # 2. 计算裁剪范围（处理超出画布边界的部分）
    src_x1 = max(0, -paste_x)
    src_y1 = max(0, -paste_y)
    src_x2 = min(paste_w, canvas_w - paste_x)
    src_y2 = min(paste_h, canvas_h - paste_y)

    dst_x1 = max(0, paste_x)
    dst_y1 = max(0, paste_y)
    dst_x2 = dst_x1 + (src_x2 - src_x1)
    dst_y2 = dst_y1 + (src_y2 - src_y1)

    # 3. 裁剪出实际要贴的图像块
    has_valid = src_x2 > src_x1 and src_y2 > src_y1
    if has_valid:
        cropped = scaled_img.crop((src_x1, src_y1, src_x2, src_y2))
        cropped_array = np.array(cropped)

        # 4. 用边缘色创建渐变底图
        bg_array = _create_edge_gradient_bg(
            canvas_w, canvas_h, cropped_array,
            dst_x1, dst_y1, dst_x2, dst_y2
        )
        canvas = Image.fromarray(bg_array)

        # 5. 把原图贴上去
        canvas.paste(cropped, (dst_x1, dst_y1))
    else:
        canvas = Image.new("RGB", (canvas_w, canvas_h), (0, 0, 0))

    # 6. 根据留白边数自适应计算 feather_sigma
    exposed_edges = _count_exposed_edges(canvas_w, canvas_h, dst_x1, dst_y1, dst_x2, dst_y2)
    feather_sigma = _adaptive_feather_sigma(exposed_edges)
    logger.info(f"[Mask] 留白边数={exposed_edges}, 自适应 feather_sigma={feather_sigma}")

    # 7. 生成 Mask
    mask = np.ones((canvas_h, canvas_w), dtype=np.float32) * 255.0
    if has_valid:
        mask[dst_y1:dst_y2, dst_x1:dst_x2] = 0.0

    # 8. 边缘羽化
    if feather_sigma > 0:
        mask = gaussian_filter(mask, sigma=feather_sigma)

    mask_image = Image.fromarray(mask.astype(np.uint8), mode="L")

    return canvas, mask_image
