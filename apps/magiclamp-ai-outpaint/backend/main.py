"""
FastAPI 后端 v2 — 重构回归版：
- 回归 v1 成熟稳定的按需延迟同步加载大模型哲学，彻底消灭 startup 异步预加载多线程死锁
- 废除 Crop-and-Stitch 分块缝合方案，全量使用工业级黄金方案：
  低清全局 1280x720 推理 + RealESRGAN 4x 超分重建 + 原始物理像素 Paste-Back 高精无损贴回
- 极速擦除 (fast_erase) 支持 CPU/CV Telea 极速擦除，0 显存，0 模型依赖，进入网页秒级点亮可用
- 前端：v/frontend/
"""
import asyncio
import gc
import io
import json
import logging
import time
import uuid
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# 过滤 uvicorn 对 /api/status 轮询的访问日志，保持控制台清爽
class _StatusLogFilter(logging.Filter):
    def filter(self, record):
        return "/api/status/" not in record.getMessage()


logging.getLogger("uvicorn.access").addFilter(_StatusLogFilter())

BASE_DIR = Path(__file__).parent.parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
FRONTEND_DIR = BASE_DIR / "frontend"

tasks: dict[str, dict] = {}


# ============================================================
# FastAPI 实例 (唯一入口)
# ============================================================
app = FastAPI(title="神灯AI·Outpaint v0.87", version="0.87")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 工具函数
# ============================================================

def _resize_to_flux_compatible(img: Image.Image, max_edge: int = 1280) -> Image.Image:
    """缩放到 FLUX 兼容尺寸：长边≤max_edge，宽高均为 16 的倍数"""
    w, h = img.size
    if max(w, h) > max_edge:
        scale = max_edge / max(w, h)
        w = int(w * scale)
        h = int(h * scale)
    w = max((w // 16) * 16, 16)
    h = max((h // 16) * 16, 16)
    return img.resize((w, h), Image.LANCZOS)


def _make_feather_mask(w: int, h: int, feather_px: int = 16) -> Image.Image:
    """
    边缘渐变 Mask：
    中心区域 = 255 (完全使用原图像素)
    边缘 feather_px 范围内渐变到 0 (使用 AI 背景)
    """
    from scipy.ndimage import distance_transform_edt
    
    # 建立 solid 矩阵，将最外围一圈设为 0 作为距离基准面
    solid = np.ones((h, w), dtype=np.float32)
    solid[0, :] = 0
    solid[-1, :] = 0
    solid[:, 0] = 0
    solid[:, -1] = 0
    
    # 计算图像内部任一点到边缘（0像素）的距离
    dist = distance_transform_edt(solid)
    
    # 限制在 [0.0, 1.0]。边缘处渐变为 0，向内 feather_px 像素处达到 1.0
    alpha = np.clip(dist / feather_px, 0.0, 1.0)
    return Image.fromarray((alpha * 255).astype(np.uint8), mode="L")


def _compose_hires(
    original_img: Image.Image,
    flux_result: Image.Image,
    layout: dict,
) -> Image.Image:
    """
    黄金 Paste-Back 高清回贴:
    1. flux_result (1280×720) -> RealESRGAN 4x 超分 -> 5120×2880 作为背景底图
    2. 原始高清原图按归一化坐标缩放后，直接以 100% 原始高清像素物理贴回对应位置
    3. 边缘 16px feather 高斯羽化软过渡，避免任何硬接缝
    """
    from backend.upscaler import upscaler

    TARGET_W, TARGET_H = 5120, 2880

    # Step 1: AI 扩图背景超分放大
    logger.info("[Compose] RealESRGAN 4x 超清放大背景中...")
    bg = upscaler.upscale(flux_result, factor=4)  # -> 5120×2880

    # Step 2: 计算原图在 5K 画布上的位置
    px = int(layout.get("norm_left", 0) * TARGET_W)
    py = int(layout.get("norm_top", 0) * TARGET_H)
    pw = int(layout.get("norm_width", 1) * TARGET_W)
    ph = int(layout.get("norm_height", 1) * TARGET_H)
    pw = max(pw, 1)
    ph = max(ph, 1)

    # 裁剪到画布边界
    px = max(0, min(px, TARGET_W - 1))
    py = max(0, min(py, TARGET_H - 1))
    pw = min(pw, TARGET_W - px)
    ph = min(ph, TARGET_H - py)

    # Step 3: 原图从原始高清分辨率直接等比缩放到目标大小（不经过 720p 降质，保真 100%）
    orig_rgb = original_img.copy().convert("RGB")
    orig_resized = orig_rgb.resize((pw, ph), Image.LANCZOS)

    # Step 4: 边缘羽化 Mask
    feather_mask = _make_feather_mask(pw, ph, feather_px=16)

    # Step 5: 高清原图贴回 AI 背景
    bg.paste(orig_resized, (px, py), feather_mask)

    logger.info(f"[Compose] Paste-Back 物理级高清回贴完成，输出: {bg.size}")
    return bg


# ============================================================
# 任务帮助函数
# ============================================================

def _new_task() -> str:
    task_id = str(uuid.uuid4())[:8]
    output_path = OUTPUT_DIR / f"{task_id}.png"
    retry = 0
    while output_path.exists() and retry < 10:
        task_id = str(uuid.uuid4())[:8]
        output_path = OUTPUT_DIR / f"{task_id}.png"
        retry += 1
    tasks[task_id] = {"status": "processing", "progress": 0, "error": None, "logs": []}
    return task_id


def _set_progress(task_id: str, p: int, log_msg: str = None):
    tasks[task_id]["progress"] = p
    if log_msg:
        tasks[task_id]["logs"].append(log_msg)
        if len(tasks[task_id]["logs"]) > 8:
            tasks[task_id]["logs"] = tasks[task_id]["logs"][-8:]


# ============================================================
# API: 扩图 (100% 完美的黄金 standard 扩图方案)
# ============================================================

@app.post("/api/generate")
async def api_generate(
    image: UploadFile = File(...),
    layout: str = Form(...),
):
    try:
        layout_data = json.loads(layout)
    except json.JSONDecodeError:
        raise HTTPException(400, "layout JSON 格式错误")

    img_bytes = await image.read()
    try:
        original_img = Image.open(io.BytesIO(img_bytes))
        original_img.load()
    except Exception:
        raise HTTPException(400, "无法解析上传的图片文件")

    task_id = _new_task()
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run_generate_task, task_id, original_img, layout_data)
    return {"task_id": task_id, "status": "processing"}


def _run_generate_task(task_id: str, original_img: Image.Image, layout_data: dict):
    import torch
    from backend.engine import engine, CANVAS_WIDTH, CANVAS_HEIGHT
    from backend.mask_generator import generate_canvas_and_mask

    def sp(p, msg=None):
        _set_progress(task_id, p, msg)

    try:
        # 暴力清理显存
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()

        # 解析归一化坐标
        if "norm_left" in layout_data:
            norm_left = float(layout_data.get("norm_left", 0))
            norm_top = float(layout_data.get("norm_top", 0))
            norm_width = float(layout_data.get("norm_width", 1))
            norm_height = float(layout_data.get("norm_height", 1))
            paste_x = int(round(norm_left * CANVAS_WIDTH))
            paste_y = int(round(norm_top * CANVAS_HEIGHT))
            paste_w = int(round(norm_width * CANVAS_WIDTH))
            paste_h = int(round(norm_height * CANVAS_HEIGHT))
        else:
            img_left = float(layout_data.get("img_left", 0))
            img_top = float(layout_data.get("img_top", 0))
            img_scale = float(layout_data.get("img_scale", 1.0))
            paste_x = int(round(img_left))
            paste_y = int(round(img_top))
            paste_w = int(round(original_img.width * img_scale))
            paste_h = int(round(original_img.height * img_scale))

        prompt = layout_data.get("prompt", "")
        guidance_scale = float(layout_data.get("guidance_scale", 30.0))
        num_steps = int(layout_data.get("num_steps", 28))
        seed = int(layout_data.get("seed", -1))

        # 1. 生成画布与 Mask
        sp(5, "[ENGINE] Generating canvas and mask...")
        canvas_img, mask_img = generate_canvas_and_mask(
            original_img=original_img,
            canvas_w=CANVAS_WIDTH,
            canvas_h=CANVAS_HEIGHT,
            paste_x=paste_x,
            paste_y=paste_y,
            paste_w=paste_w,
            paste_h=paste_h,
        )
        sp(8, "[ENGINE] Canvas and mask ready.")

        # 保存调试中间文件，一秒排查错位
        canvas_img.save(OUTPUT_DIR / f"{task_id}_02_canvas.png", "PNG")
        mask_img.save(OUTPUT_DIR / f"{task_id}_03_mask.png", "PNG")

        # 2. 回归成熟稳定的按需延迟同步加载
        if not engine.is_loaded:
            sp(10, "[SYSTEM] Cold start: Loading FLUX.1 Fill Dev (~11GB)...")
            engine.load_model(step_callback=lambda p, m: sp(p, m))
        sp(38, "[SYSTEM] Model ready.")

        # 3. AI 推理 (40~85%)
        sp(40, "[FLUX] Starting inference loop...")
        gc.collect()
        torch.cuda.empty_cache()
        torch.cuda.synchronize()

        result = engine.generate(
            canvas_image=canvas_img,
            mask_image=mask_img,
            prompt=prompt,
            num_steps=num_steps,
            guidance_scale=guidance_scale,
            seed=seed,
            step_callback=lambda p, m: sp(p, m),
        )  # -> 1280x720 完美背景

        result.save(OUTPUT_DIR / f"{task_id}_04_flux_output.png", "PNG")

        del canvas_img, mask_img
        gc.collect()

        # 4. 物理级超分放大与 Paste-Back 高清回贴 (86~98%)
        sp(86, "[UPSCALE] RealESRGAN 4x 超清重建中...")
        final = _compose_hires(original_img, result, layout_data)
        
        # 顺带保存未回贴的纯超分大图 (供对比滑块使用)
        from backend.upscaler import upscaler
        raw_upscaled = upscaler.upscale(result, factor=4)
        raw_upscaled.save(OUTPUT_DIR / f"{task_id}_raw.png", "PNG")
        del result, raw_upscaled
        gc.collect()

        # 5. 保存最终成品 (5120x2880)
        sp(98, "[IO] Saving 5120x2880 high-fidelity wallpaper...")
        output_path = OUTPUT_DIR / f"{task_id}.png"
        final.save(output_path, "PNG", quality=95)
        del final
        gc.collect()
        torch.cuda.empty_cache()

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["logs"].append(f"[IO] Done: {output_path.name} (5120x2880)")
        logger.info(f"任务 {task_id} 完成: {output_path}")

    except Exception as e:
        logger.error(f"任务 {task_id} 失败: {e}", exc_info=True)
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
        tasks[task_id]["logs"].append(f"[ERROR] {str(e)}")
        gc.collect()
        try:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass


# ============================================================
# API: 预处理 (秒级离线擦除 / AI局部重绘)
# ============================================================

@app.post("/api/preprocess")
async def api_preprocess(
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
    tool: str = Form("watermark"),
):
    img_bytes = await image.read()
    mask_bytes = await mask.read()
    try:
        img = Image.open(io.BytesIO(img_bytes))
        img.load()
        mask_img = Image.open(io.BytesIO(mask_bytes))
        mask_img.load()
    except Exception:
        raise HTTPException(400, "无法解析图片或 Mask 文件")

    task_id = str(uuid.uuid4())[:8] + "_prep"
    tasks[task_id] = {"status": "processing", "progress": 0, "error": None, "logs": []}

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run_preprocess_task, task_id, img, mask_img, tool)
    return {"task_id": task_id, "status": "processing"}


def _run_preprocess_task(task_id: str, img: Image.Image, mask_img: Image.Image, tool: str):
    import torch
    from backend.engine import engine
    from scipy.ndimage import binary_dilation, gaussian_filter

    def sp(p, msg=None):
        _set_progress(task_id, p, msg)
        logger.info(f"[PREP-{task_id}] Progress: {p}% - {msg}")

    try:
        logger.info(f"[PREP-{task_id}] 开始预处理，tool={tool}")
        sp(5, "[PREP] 图像预处理中...")

        if tool == "fast_erase":
            # ── 离线 CPU/CV 擦除 (Telea 传统算法，秒级响应，0% 显存) ──
            sp(10, "[PREP] 执行极速 CV 擦除 (Telea)...")
            import cv2
            
            img_np = np.array(img.convert("RGB"))
            img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
            
            # 将 Hires 投影的 Mask 拉伸匹配原图
            mask_resized = mask_img.convert("L").resize(img.size, Image.LANCZOS)
            
            mask_np = np.array(mask_resized)
            mask_binary = mask_np > 128
            
            # 动态自适应膨胀
            max_dim = max(img.width, img.height)
            iters = max(3, min(15, int(max_dim / 300)))
            logger.info(f"[PREP-{task_id}] 尺寸: {img.size}, mask 动态膨胀迭代: {iters}")
            
            mask_dilated = binary_dilation(mask_binary, iterations=iters)
            mask_cv = (mask_dilated * 255).astype(np.uint8)
            
            sp(50, "[PREP] OpenCV 正在计算周围像素弥合...")
            result_cv = cv2.inpaint(img_cv, mask_cv, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
            
            result_rgb = cv2.cvtColor(result_cv, cv2.COLOR_BGR2RGB)
            result = Image.fromarray(result_rgb)
            
            sp(95, "[IO] 擦除完成，保存结果...")
            output_path = OUTPUT_DIR / f"{task_id}.png"
            result.save(output_path, "PNG")
            
            tasks[task_id]["status"] = "completed"
            tasks[task_id]["progress"] = 100
            tasks[task_id]["logs"].append(f"[IO] 极速擦除完成: {output_path.name}")
            logger.info(f"预处理任务 {task_id} 完成 (极速擦除)")
            return

        # ── AI 局部重绘 (FLUX Fill, 20步去噪甜点) ──
        img_resized = _resize_to_flux_compatible(img.convert("RGB"), max_edge=1280)
        logger.info(f"[PREP-{task_id}] 图片已缩放: {img.size} -> {img_resized.size}")
        mask_resized = mask_img.convert("L").resize(img_resized.size, Image.LANCZOS)

        # Mask 物理级膨胀与高斯轻度羽化
        mask_np = np.array(mask_resized)
        mask_binary = mask_np > 128
        mask_dilated = binary_dilation(mask_binary, iterations=3)
        mask_feathered = gaussian_filter(mask_dilated.astype(np.float32) * 255, sigma=3)
        mask_final = Image.fromarray(mask_feathered.astype(np.uint8), mode="L")

        sp(10, "[PREP] Mask 处理完成，开始 AI 修复...")

        if tool == "watermark":
            prompt = "clean background, seamless texture continuation, no text, no watermark, no logo"
        else:
            prompt = "fill with surrounding background, seamless blend, no artifacts, clean empty area"

        # 回归成熟稳定的按需延迟同步加载
        if not engine.is_loaded:
            sp(12, "[SYSTEM] Cold start: Loading FLUX.1 Fill Dev (~11GB)...")
            engine.load_model(step_callback=lambda p, m: sp(p, m))
        sp(35, "[FLUX] Starting inpaint...")

        # 20步去噪生图
        infer_w, infer_h = img_resized.size
        result = engine.generate(
            canvas_image=img_resized,
            mask_image=mask_final,
            prompt=prompt,
            num_steps=20,
            guidance_scale=30.0,
            seed=-1,
            step_callback=lambda p, m: sp(p, m),
            target_width=infer_w,
            target_height=infer_h,
        )

        sp(95, "[IO] 保存修复结果...")
        output_path = OUTPUT_DIR / f"{task_id}.png"
        result.save(output_path, "PNG")
        del result
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["logs"].append(f"[IO] 修复完成: {output_path.name}")
        logger.info(f"预处理任务 {task_id} 完成 (AI局部重绘)")

    except Exception as e:
        logger.error(f"预处理任务 {task_id} 失败: {e}", exc_info=True)
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
        tasks[task_id]["logs"].append(f"[ERROR] {str(e)}")
        gc.collect()
        try:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass


# ============================================================
# 标准 API (下载 / 状态 / 健康)
# ============================================================

@app.get("/api/status/{task_id}")
async def api_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(404, "任务不存在")
    return tasks[task_id]


@app.get("/api/download/{task_id}")
async def api_download(task_id: str, raw: bool = False):
    """下载生成结果
    - raw=false: 返回带回贴的最终版本（默认）
    - raw=true: 返回未回贴的纯 AI 扩图版本 (供对比滑块使用)
    """
    filename = f"{task_id}_raw.png" if raw else f"{task_id}.png"
    output_path = OUTPUT_DIR / filename
    if not output_path.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(output_path)


@app.get("/api/health")
async def api_health():
    import torch
    cuda_available = torch.cuda.is_available()
    vram_used, vram_total, gpu_name = 0.0, 16.0, None
    if cuda_available:
        gpu_name = torch.cuda.get_device_name(0)
        vram_used = torch.cuda.memory_reserved(0) / (1024 ** 3)
        vram_total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    from backend.engine import engine
    return {
        "status": "ok",
        "cuda_available": cuda_available,
        "gpu_name": gpu_name,
        "vram_used": round(vram_used, 1),
        "vram_total": round(vram_total, 1),
        "model_loaded": engine.is_loaded,
    }


@app.get("/api/ui_status")
async def api_ui_status():
    return {"ui_connected": True}


# ============================================================
# 前端静态文件挂载
# ============================================================

@app.get("/")
async def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
