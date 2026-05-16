"""
FastAPI 后端服务：提供扩图 API 和前端静态文件服务。
"""
import asyncio
import json
import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io

from backend.engine import engine, CANVAS_WIDTH, CANVAS_HEIGHT
from backend.mask_generator import generate_canvas_and_mask

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# 过滤 uvicorn 对 /api/status 轮询的访问日志（防止刷掉下载进度条）
class _StatusLogFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        if "/api/status/" in msg:
            return False
        return True


logging.getLogger("uvicorn.access").addFilter(_StatusLogFilter())

# 路径
BASE_DIR = Path(__file__).parent.parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
FRONTEND_DIR = BASE_DIR / "frontend"

# 任务状态存储
tasks: dict[str, dict] = {}

# FastAPI 应用
app = FastAPI(title="神灯AI·Outpaint", version="1.0.0")


# ---------- API 路由 ----------

@app.post("/api/generate")
async def api_generate(
    image: UploadFile = File(...),
    layout: str = Form(...),
):
    """
    接收原图和排版坐标，启动扩图任务。
    返回 task_id，前端通过轮询获取进度。
    """
    try:
        layout_data = json.loads(layout)
    except json.JSONDecodeError:
        raise HTTPException(400, "layout JSON 格式错误")

    # 读取上传的图片
    img_bytes = await image.read()
    try:
        original_img = Image.open(io.BytesIO(img_bytes))
    except Exception:
        raise HTTPException(400, "无法解析上传的图片文件")

    # 创建任务
    task_id = str(uuid.uuid4())[:8]
    tasks[task_id] = {"status": "processing", "progress": 0, "error": None, "logs": []}

    # 在后台线程执行推理（避免阻塞事件循环）
    asyncio.get_event_loop().run_in_executor(
        None, _run_generate_task, task_id, original_img, layout_data
    )

    return {"task_id": task_id, "status": "processing"}


def _run_generate_task(task_id: str, original_img: Image.Image, layout_data: dict):
    """后台执行扩图任务"""
    try:
        tasks[task_id]["progress"] = 5

        # 1. 加载模型（首次会自动下载）
        if not engine.is_loaded:
            tasks[task_id]["progress"] = 10
            tasks[task_id]["logs"].append("[SYSTEM] Cold start detected. Loading FLUX.1 Fill Dev...")
            tasks[task_id]["logs"].append("[SYSTEM] Allocating 11.3GB VRAM. This may take a while depending on disk speed.")
            logger.info("首次加载模型，请耐心等待...")
            engine.load_model()
            tasks[task_id]["logs"].append("[SYSTEM] Model weights loaded into VRAM successfully.")

        tasks[task_id]["progress"] = 30

        # 2. 生成画布和 Mask
        tasks[task_id]["logs"].append("[ENGINE] Generating latent masks and context base...")
        img_left = float(layout_data.get("img_left", 0))
        img_top = float(layout_data.get("img_top", 0))
        img_scale = float(layout_data.get("img_scale", 1.0))
        prompt = layout_data.get("prompt", "")

        canvas_img, mask_img = generate_canvas_and_mask(
            original_img=original_img,
            canvas_w=CANVAS_WIDTH,
            canvas_h=CANVAS_HEIGHT,
            img_left=img_left,
            img_top=img_top,
            img_scale=img_scale,
        )

        tasks[task_id]["progress"] = 40
        tasks[task_id]["logs"].append("[FLUX] Mask ready. Initializing transformer 2D model...")

        def update_progress(p, log_msg=None):
            tasks[task_id]["progress"] = p
            if log_msg:
                tasks[task_id]["logs"].append(log_msg)
                if len(tasks[task_id]["logs"]) > 5:
                    tasks[task_id]["logs"] = tasks[task_id]["logs"][-5:]

        # 3. AI 推理
        result = engine.generate(
            canvas_image=canvas_img,
            mask_image=mask_img,
            prompt=prompt,
            step_callback=update_progress,
        )

        tasks[task_id]["progress"] = 95
        tasks[task_id]["logs"].append("[FLUX] Generation complete. VAE decoding latents...")

        # 4. 保存结果
        output_path = OUTPUT_DIR / f"{task_id}.png"
        result.save(output_path, "PNG", quality=95)

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["logs"].append(f"[IO] Image saved to {output_path.name}. Task finished.")
        logger.info(f"任务 {task_id} 完成: {output_path}")

    except Exception as e:
        logger.error(f"任务 {task_id} 失败: {e}", exc_info=True)
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
        tasks[task_id]["logs"].append(f"[ERROR] {str(e)}")


@app.get("/api/status/{task_id}")
async def api_status(task_id: str):
    """查询任务状态"""
    if task_id not in tasks:
        raise HTTPException(404, "任务不存在")
    return tasks[task_id]


@app.get("/api/download/{task_id}")
async def api_download(task_id: str):
    """下载生成结果"""
    output_path = OUTPUT_DIR / f"{task_id}.png"
    if not output_path.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(output_path)


@app.get("/api/health")
async def api_health():
    """检查服务状态及显存监控"""
    import torch
    cuda_available = torch.cuda.is_available()
    vram_used = 0.0
    vram_total = 16.0
    gpu_name = None

    if cuda_available:
        gpu_name = torch.cuda.get_device_name(0)
        # 获取显存保留量 (更能反映真实的占用)
        vram_used = torch.cuda.memory_reserved(0) / (1024 ** 3)
        props = torch.cuda.get_device_properties(0)
        vram_total = props.total_memory / (1024 ** 3)

    return {
        "status": "ok",
        "cuda_available": cuda_available,
        "gpu_name": gpu_name,
        "vram_used": round(vram_used, 1),
        "vram_total": round(vram_total, 1),
        "model_loaded": engine.is_loaded,
    }


# ---------- 前端静态文件 ----------

# 根路径返回 index.html
@app.get("/")
async def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")


# 挂载静态文件目录
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
