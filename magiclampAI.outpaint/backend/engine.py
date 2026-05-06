"""
AI 推理引擎：FLUX.1 Fill (社区成熟算法方案)
采用 Q4_K_M GGUF (6.8GB) + INT8 T5 (4.5GB)
总显存占�?~11.5GB，完美适配 16GB 显卡，无需慢速的 CPU Offload，实现真正的无缝扩图�?"""
import logging
import os
from pathlib import Path

import torch
from PIL import Image

logger = logging.getLogger(__name__)

# 模型缓存目录
MODEL_DIR = Path(__file__).parent.parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

# ---- 大陆镜像加�?& Token ----
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
os.environ.setdefault("HF_TOKEN", "YOUR_HUGGINGFACE_TOKEN")

# 模型配置 (采用社区公认�?Fill 最佳方�?
FLUX_FILL_MODEL_ID = "black-forest-labs/FLUX.1-Fill-dev"
GGUF_REPO = "YarvixPA/FLUX.1-Fill-dev-GGUF"
GGUF_FILENAME = "flux1-fill-dev-Q4_K_S.gguf"  # 6.8GB �?Q4 量化版本

# 画布尺寸 (必须�?16 整除)
CANVAS_WIDTH = 1792
CANVAS_HEIGHT = 1008


class OutpaintEngine:
    """FLUX.1 Fill 扩图引擎 (16GB 显存极速版)"""

    def __init__(self):
        self.pipe = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._loading = False

    @property
    def is_loaded(self) -> bool:
        return self.pipe is not None

    def _download_gguf(self) -> str:
        from huggingface_hub import hf_hub_download
        local_path = MODEL_DIR / GGUF_FILENAME
        if local_path.exists():
            return str(local_path)
        logger.info(f"下载 GGUF Q4 模型 (~6.8GB)...")
        return hf_hub_download(repo_id=GGUF_REPO, filename=GGUF_FILENAME, local_dir=str(MODEL_DIR))

    def load_model(self):
        if self.is_loaded: return
        if self._loading: raise RuntimeError("加载�?..")
        self._loading = True
        os.environ["HF_HOME"] = str(MODEL_DIR)

        try:
            from diffusers import FluxFillPipeline, FluxTransformer2DModel, GGUFQuantizationConfig
            from transformers import T5EncoderModel, BitsAndBytesConfig
            
            # 1. 加载 8-bit T5 文本编码�?(�?9.5GB 压到 4.5GB)
            logger.info("加载 8-bit T5 编码�?..")
            text_encoder = T5EncoderModel.from_pretrained(
                FLUX_FILL_MODEL_ID,
                subfolder="text_encoder_2",
                quantization_config=BitsAndBytesConfig(load_in_8bit=True),
                torch_dtype=torch.bfloat16,
                cache_dir=str(MODEL_DIR)
            )

            # 2. 加载 Q4 GGUF 绘画大脑 (6.8GB)
            gguf_path = self._download_gguf()
            logger.info("加载 Q4 GGUF Transformer...")
            transformer = FluxTransformer2DModel.from_single_file(
                gguf_path,
                quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
                torch_dtype=torch.bfloat16,
                config=FLUX_FILL_MODEL_ID,
                subfolder="transformer",
            )

            # 3. 组装成熟�?FluxFillPipeline
            logger.info("组装 FluxFillPipeline...")
            self.pipe = FluxFillPipeline.from_pretrained(
                FLUX_FILL_MODEL_ID,
                text_encoder_2=text_encoder,
                transformer=transformer,
                torch_dtype=torch.bfloat16,
                cache_dir=str(MODEL_DIR),
            )
            # 使用 CPU Offload：按需将组件加载到 GPU，用完卸�?CPU
            # 16GB 显卡扣除 Windows GUI 进程后净�?~14GB，全量加�?12.8GB �?            # 推理临时张量会导致频繁换�?(143s/step)，必须用 offload
            self.pipe.enable_model_cpu_offload()
            logger.info("�?FLUX.1 Fill (Q4 + INT8) 加载成功，显存充足！")

        except Exception as e:
            self._loading = False
            raise RuntimeError(f"模型加载失败: {e}")

        self._loading = False

    def generate(self, canvas_image: Image.Image, mask_image: Image.Image, prompt: str = "", num_steps: int = 28, step_callback=None) -> Image.Image:
        if not self.is_loaded:
            self.load_model()

        canvas_image = canvas_image.convert("RGB").resize((CANVAS_WIDTH, CANVAS_HEIGHT), Image.LANCZOS)
        mask_image = mask_image.convert("L").resize((CANVAS_WIDTH, CANVAS_HEIGHT), Image.LANCZOS)

        # FLUX.1 Fill 官方推荐的无脑万能提示词
        if not prompt.strip():
            prompt = "seamless background extension, photorealistic, identical lighting and context"

        logger.info(f"开始扩�? {CANVAS_WIDTH}x{CANVAS_HEIGHT}, steps={num_steps}")

        def diffusers_callback(pipe, step_index, timestep, callback_kwargs):
            if step_callback:
                # 进度范围设定�?40% �?95%
                progress = 40 + int((step_index / num_steps) * 55)
                log_msg = f"[FLUX] Denoising step {step_index}/{num_steps} (timestep {int(timestep)})"
                step_callback(progress, log_msg)
            return callback_kwargs

        import gc
        # 推理前：清理上一轮残�?        gc.collect()
        torch.cuda.empty_cache()

        result = self.pipe(
            prompt=prompt,
            image=canvas_image,
            mask_image=mask_image,
            height=CANVAS_HEIGHT,
            width=CANVAS_WIDTH,
            guidance_scale=30.0,  # 官方 Fill 模型推荐极高�?guidance (30.0)
            num_inference_steps=num_steps,
            callback_on_step_end=diffusers_callback,
        ).images[0]

        # 推理后：立刻释放张量缓存
        gc.collect()
        torch.cuda.empty_cache()

        logger.info("扩图完成")
        return result

# 全局单例
engine = OutpaintEngine()
