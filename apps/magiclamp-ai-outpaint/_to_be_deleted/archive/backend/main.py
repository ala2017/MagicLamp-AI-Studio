"""
FastAPI 后端服务：提供扩图 API 和前端静态文件服务。
"""
import asyncio
import json
import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# 过滤 uvicorn 对 /api/status 轮询的访问日志
class _StatusLogFilter(logging.Filter):
    def filter(self, record):
        return "/api/status/" not in record.getMessage()


logging.getLogger("uvicorn.access").addFilter(_StatusLogFilter())

# 路径
BASE_DIR = Path(__file__).parent.parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
FRONTEND_DIR = BASE_DIR / "frontend"

# 任务状态存储
tasks: dict[str, dict] = {}

# FastAPI 应用
app = FastAPI(title="神灯AI·Outpaint", version="0.3.0")


# ---------- API 路由 ----------

@app.post("/api/generate")
async def api_generate(
    image: UploadFile = File(...),
    layout: str = Form(...),
):
    """接收原图和排版坐标，启动扩图任务，返回 task_id。"""
    try:
        layout_data = json.loads(layout)
    except json.JSONDecodeError:
        raise HTTPException(400, "layout JSON 格式错误")

    img_bytes = await image.read()
    try:
        original_img = Image.open(io.BytesIO(img_bytes))
        original_img.load()  # 强制立即加载图像数据，避免延迟加载导致的缓存问题
    except Exception:
        raise HTTPException(400, "无法解析上传的图片文件")

    task_id = str(uuid.uuid4())[:8]
    
    # 防止 task_id 碰撞：如果文件已存在，重新生成
    output_path = OUTPUT_DIR / f"{task_id}.png"
    retry_count = 0
    while output_path.exists() and retry_count < 10:
        task_id = str(uuid.uuid4())[:8]
        output_path = OUTPUT_DIR / f"{task_id}.png"
        retry_count += 1
    
    tasks[task_id] = {"status": "processing", "progress": 0, "error": None, "logs": []}

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run_generate_task, task_id, original_img, layout_data)

    return {"task_id": task_id, "status": "processing"}


def _run_generate_task(task_id: str, original_img: Image.Image, layout_data: dict):
    """后台执行扩图任务"""
    # 延迟导入重型模块（加速 uvicorn 启动）
    import torch
    from backend.engine import engine, CANVAS_WIDTH, CANVAS_HEIGHT
    from backend.mask_generator import generate_canvas_and_mask

    try:
        # 暴力清除所有缓存
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
        
        # ── 解析归一化坐标（v0.3.0 新坐标系）──
        # 同时兼容旧的 img_left/img_top/img_scale 格式
        if "norm_left" in layout_data:
            # 新格式：归一化坐标 0~1
            norm_left   = float(layout_data.get("norm_left", 0))
            norm_top    = float(layout_data.get("norm_top", 0))
            norm_width  = float(layout_data.get("norm_width", 1))
            norm_height = float(layout_data.get("norm_height", 1))
            
            # 还原到 1280×720 画布的像素坐标
            paste_x = int(round(norm_left * CANVAS_WIDTH))
            paste_y = int(round(norm_top * CANVAS_HEIGHT))
            paste_w = int(round(norm_width * CANVAS_WIDTH))
            paste_h = int(round(norm_height * CANVAS_HEIGHT))
            
            logger.info(f"[归一化坐标] norm=({norm_left:.3f}, {norm_top:.3f}, {norm_width:.3f}, {norm_height:.3f})")
            logger.info(f"[像素还原] paste=({paste_x}, {paste_y}), size=({paste_w}x{paste_h})")
        else:
            # 旧格式兼容：img_left/img_top/img_scale
            img_left  = float(layout_data.get("img_left", 0))
            img_top   = float(layout_data.get("img_top", 0))
            img_scale = float(layout_data.get("img_scale", 1.0))
            paste_x = int(round(img_left))
            paste_y = int(round(img_top))
            paste_w = int(round(original_img.width * img_scale))
            paste_h = int(round(original_img.height * img_scale))
            
            logger.info(f"[旧坐标兼容] left={img_left}, top={img_top}, scale={img_scale}")

        prompt    = layout_data.get("prompt", "")
        guidance_scale = float(layout_data.get("guidance_scale", 30.0))
        num_steps = int(layout_data.get("num_steps", 28))
        seed = int(layout_data.get("seed", -1))

        def set_progress(p, log_msg=None):
            tasks[task_id]["progress"] = p
            if log_msg:
                tasks[task_id]["logs"].append(log_msg)
                if len(tasks[task_id]["logs"]) > 8:
                    tasks[task_id]["logs"] = tasks[task_id]["logs"][-8:]

        # ── Step 1: 生成画布和 Mask（使用归一化还原的像素坐标）────────────
        set_progress(7, "[ENGINE] Generating canvas and mask...")
        
        # 用归一化还原的像素坐标生成 canvas
        canvas_img, mask_img = generate_canvas_and_mask(
            original_img=original_img,
            canvas_w=CANVAS_WIDTH,
            canvas_h=CANVAS_HEIGHT,
            paste_x=paste_x,
            paste_y=paste_y,
            paste_w=paste_w,
            paste_h=paste_h,
        )
        
        # 保存调试中间文件（canvas + mask）
        canvas_img.save(OUTPUT_DIR / f"{task_id}_02_canvas.png", "PNG")
        mask_img.save(OUTPUT_DIR / f"{task_id}_03_mask.png", "PNG")
        logger.info(f"[DEBUG] canvas/mask 已保存")
        
        set_progress(10, "[ENGINE] Canvas and mask ready.")

        # ── Step 2: 加载 FLUX 模型（首次冷启动）─────────────────────────────────
        if not engine.is_loaded:
            set_progress(12, "[SYSTEM] Cold start: Loading FLUX.1 Fill Dev (~11GB)...")
            logger.info("首次加载模型，请耐心等待...")
            engine.load_model(step_callback=set_progress)
            set_progress(38, "[SYSTEM] Model loaded successfully.")
        else:
            set_progress(38, "[SYSTEM] Model already loaded.")

        # ── Step 3: AI 推理 ───────────────────────────────────────────────────
        set_progress(40, "[FLUX] Starting inference loop...")
        
        # 暴力清除所有缓存
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
            step_callback=set_progress,
        )

        # 保存调试中间文件（FLUX 原始输出）
        result.save(OUTPUT_DIR / f"{task_id}_04_flux_output.png", "PNG")
        logger.info(f"[DEBUG] FLUX 输出已保存")

        # ── Step 4: 保存最终结果 + mask（供重绘使用）──────────────────────────────
        set_progress(97, "[IO] Saving output image...")
        output_path = OUTPUT_DIR / f"{task_id}.png"
        result.save(output_path, "PNG", quality=95)
        # 保存 mask 供重绘功能使用
        mask_img.save(OUTPUT_DIR / f"{task_id}_mask.png", "PNG")

        # 暴力清除所有缓存
        gc.collect()
        torch.cuda.empty_cache()
        
        # 清除所有中间变量
        del canvas_img, mask_img, result
        gc.collect()

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["logs"].append(f"[IO] Saved: {output_path.name}. Done.")
        logger.info(f"任务 {task_id} 完成: {output_path}")

    except Exception as e:
        logger.error(f"任务 {task_id} 失败: {e}", exc_info=True)
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
        tasks[task_id]["logs"].append(f"[ERROR] {str(e)}")
        
        # 失败时也清除缓存
        import gc
        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass


@app.post("/api/upscale")
async def api_upscale(task_id: str = Form(...), factor: int = Form(4)):
    """对已生成的图像进行独立的高清放大"""
    input_path = OUTPUT_DIR / f"{task_id}.png"
    if not input_path.exists():
        raise HTTPException(404, "原图不存在，无法放大")

    new_task_id = f"{task_id}_upscaled"
    tasks[new_task_id] = {"status": "processing", "progress": 0, "error": None, "logs": []}

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run_upscale_task, task_id, new_task_id, input_path, factor)

    return {"task_id": new_task_id, "status": "processing"}

def _run_upscale_task(base_task_id: str, task_id: str, input_path: Path, factor: int):
    try:
        def set_progress(p, log_msg=None):
            tasks[task_id]["progress"] = p
            if log_msg:
                tasks[task_id]["logs"].append(log_msg)
                if len(tasks[task_id]["logs"]) > 8:
                    tasks[task_id]["logs"] = tasks[task_id]["logs"][-8:]

        set_progress(10, "[UPSCALE] 初始化放大模型（采用低显存分块推理技术）...")
        from backend.upscaler import upscaler
        
        set_progress(30, f"[UPSCALE] 模型就绪，开始 {factor}x 放大计算...")
        img = Image.open(input_path).convert("RGB")
        result = upscaler.upscale(img, factor)
        
        set_progress(90, "[UPSCALE] 保存高清结果...")
        output_path = OUTPUT_DIR / f"{task_id}.png"
        result.save(output_path, "PNG", quality=95)
        
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["logs"].append(f"[IO] Saved: {output_path.name}. Done.")
        logger.info(f"放大任务 {task_id} 完成: {output_path}")

    except Exception as e:
        logger.error(f"放大任务 {task_id} 失败: {e}", exc_info=True)
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
        tasks[task_id]["logs"].append(f"[ERROR] {str(e)}")


@app.get("/api/status/{task_id}")
async def api_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(404, "任务不存在")
    return tasks[task_id]


@app.get("/api/download/{task_id}")
async def api_download(task_id: str):
    output_path = OUTPUT_DIR / f"{task_id}.png"
    if not output_path.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(output_path)



import time
last_health_check = 0

@app.get("/api/health")
async def api_health():
    global last_health_check
    last_health_check = time.time()
    import torch
    cuda_available = torch.cuda.is_available()
    vram_used, vram_total, gpu_name = 0.0, 16.0, None
    if cuda_available:
        gpu_name = torch.cuda.get_device_name(0)
        vram_used = torch.cuda.memory_reserved(0) / (1024 ** 3)
        vram_total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    
    # 延迟导入 engine 以检查模型状态
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
    global last_health_check
    # 如果过去 5 秒内收到过 health 请求，说明有浏览器连着
    return {"ui_connected": (time.time() - last_health_check) < 5.0}


# ---------- 前端静态文件 ----------

@app.get("/")
async def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
