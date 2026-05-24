"""
AI 推理引擎：FLUX.1 Fill (完整 Pipeline + CPU Offload 方案)
采用 GGUF Q4_K_S Transformer (6.8GB) + INT8 T5 (4.5GB)
通过 enable_model_cpu_offload() 自动管理 CPU↔GPU 调度
峰值 VRAM ~12-14GB，在 RTX 4060 Ti 16GB 内稳定运行

Prompt 策略：极简固定 prompt，让 FLUX Fill 从图像上下文自主理解背景。
FLUX Fill 是 inpainting 专用模型，图像上下文权重远大于 prompt，
过度复杂的 prompt 反而干扰模型判断。只需告知"禁止生成人物"即可。
"""
import gc
import logging
import os
from pathlib import Path

import torch
from PIL import Image

logger = logging.getLogger(__name__)

# 模型缓存目录
MODEL_DIR = Path(__file__).parent.parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

# ---- 大陆镜像加速 & Token ----
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
os.environ.setdefault("HF_TOKEN", "<YOUR_HF_TOKEN>")

# ---- 核心显存优化参数 ----
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

# 模型配置
FLUX_FILL_MODEL_ID = "black-forest-labs/FLUX.1-Fill-dev"
GGUF_FILENAME = "flux1-fill-dev-Q4_K_S.gguf"

# 画布尺寸 (必须被 16 整除，16:9，降维至 0.92 Megapixel 彻底防止复制人)
CANVAS_WIDTH = 1280
CANVAS_HEIGHT = 720

# 极简默认 prompt：强力禁止生成人物
DEFAULT_PROMPT = "seamless background extension, pure background only, absolutely no people, no person, no human, no face, no body, background elements only"


def _is_model_cached(model_id: str, cache_dir: Path) -> bool:
    """检测 HF 模型是否已完整缓存在本地"""
    cache_model_dir = cache_dir / f"models--{model_id.replace('/', '--')}"
    if not cache_model_dir.exists():
        return False
    # 检查是否有 snapshots 目录且非空
    snapshots_dir = cache_model_dir / "snapshots"
    if not snapshots_dir.exists():
        return False
    return any(snapshots_dir.iterdir())


class OutpaintEngine:
    """FLUX.1 Fill 扩图引擎 (完整 Pipeline + CPU Offload 版)"""

    def __init__(self):
        self.pipe = None
        self._loading = False

    @property
    def is_loaded(self) -> bool:
        return self.pipe is not None

    def load_model(self, step_callback=None):
        """一次性加载完整 FluxFillPipeline，启用 CPU offload"""
        if self.is_loaded:
            return
        if self._loading:
            raise RuntimeError("模型正在加载中，请稍候...")
        self._loading = True
        os.environ["HF_HOME"] = str(MODEL_DIR)

        try:
            from diffusers import (
                FluxFillPipeline,
                FluxTransformer2DModel,
                GGUFQuantizationConfig,
            )
            from transformers import T5EncoderModel, BitsAndBytesConfig

            # Step 1: 加载 GGUF Q4_K_S Transformer（从本地文件）
            gguf_path = MODEL_DIR / GGUF_FILENAME
            if not gguf_path.exists():
                raise FileNotFoundError(f"GGUF 文件不存在: {gguf_path}")

            logger.info("加载 GGUF Q4_K_S Transformer (~6.8GB)...")
            if step_callback:
                step_callback(10, "[FLUX] Loading GGUF Q4_K_S Transformer (~6.8GB)...")

            transformer = FluxTransformer2DModel.from_single_file(
                str(gguf_path),
                quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
                torch_dtype=torch.bfloat16,
                config=FLUX_FILL_MODEL_ID,
                subfolder="transformer",
            )

            # Step 2: 加载 T5 INT8（从 HF cache）
            logger.info("加载 T5 INT8 文本编码器 (~4.5GB)...")
            if step_callback:
                step_callback(20, "[FLUX] Loading T5 INT8 text encoder (~4.5GB)...")

            cached = _is_model_cached(FLUX_FILL_MODEL_ID, MODEL_DIR)
            if cached:
                logger.info("检测到本地缓存，强制离线加载（跳过网络检查）")
            else:
                logger.info("本地无缓存，需要从网络下载模型文件...")
                if step_callback:
                    step_callback(20, "[SYSTEM] 本地无模型缓存，正在从网络下载（首次需要几分钟）...")

            t5_encoder = T5EncoderModel.from_pretrained(
                FLUX_FILL_MODEL_ID,
                subfolder="text_encoder_2",
                quantization_config=BitsAndBytesConfig(load_in_8bit=True),
                torch_dtype=torch.bfloat16,
                cache_dir=str(MODEL_DIR),
                local_files_only=cached,
            )

            # Step 3: 组装完整 pipeline（CLIP/VAE/tokenizer 从 cache 自动加载）
            logger.info("组装完整 FluxFillPipeline...")
            if step_callback:
                step_callback(30, "[FLUX] Assembling complete FluxFillPipeline...")

            self.pipe = FluxFillPipeline.from_pretrained(
                FLUX_FILL_MODEL_ID,
                transformer=transformer,
                text_encoder_2=t5_encoder,
                torch_dtype=torch.bfloat16,
                cache_dir=str(MODEL_DIR),
                local_files_only=cached,
            )

            # Step 4: 启用 VAE 显存优化（1792×1008 必须开启）
            logger.info("启用 VAE tiling + slicing...")
            self.pipe.vae.enable_slicing()
            self.pipe.vae.enable_tiling()

            # Step 5: 启用 CPU offload（核心：accelerate 自动管理 CPU↔GPU 调度）
            logger.info("启用 CPU offload（accelerate 自动调度）...")
            if step_callback:
                step_callback(35, "[FLUX] Enabling CPU offload (accelerate auto-scheduling)...")
            self.pipe.enable_model_cpu_offload()

            logger.info("✅ FluxFillPipeline 加载完成（完整 pipeline + CPU offload 模式）")
            if step_callback:
                step_callback(38, "[FLUX] Model ready.")

        except Exception as e:
            self._loading = False
            self.pipe = None
            import traceback
            err_msg = traceback.format_exc()
            logger.error(f"模型加载失败:\n{err_msg}")
            raise RuntimeError(f"模型加载失败: {e}") from e

        self._loading = False

    def unload_model(self):
        """完全卸载模型，释放显存和内存，为其他任务（如高清放大）腾出空间"""
        if self.pipe is not None:
            logger.info("正在彻底卸载 FLUX 模型并释放显存...")
            del self.pipe
            self.pipe = None
            
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        logger.info("模型已卸载，显存已清空。")

    def generate(
        self,
        canvas_image: Image.Image,
        mask_image: Image.Image,
        prompt: str = "",
        num_steps: int = 28,
        guidance_scale: float = 30.0,
        seed: int = -1,
        step_callback=None,
        target_width: int = None,
        target_height: int = None,
    ) -> Image.Image:
        """
        执行扩图推理。
        
        target_width/target_height: 推理目标尺寸。
        - 如果提供，使用指定尺寸（必须是 16 的倍数）
        - 如果不提供，默认使用 CANVAS_WIDTH x CANVAS_HEIGHT (1280x720)
        """
        if not self.is_loaded:
            raise RuntimeError("模型未加载，请先调用 load_model()")

        # 确定推理尺寸
        infer_w = target_width if target_width else CANVAS_WIDTH
        infer_h = target_height if target_height else CANVAS_HEIGHT

        # 暴力清除所有缓存
        gc.collect()
        torch.cuda.empty_cache()
        torch.cuda.synchronize()

        # 强制复制并转换，resize 到推理尺寸
        canvas_image = canvas_image.copy().convert("RGB").resize(
            (infer_w, infer_h), Image.LANCZOS
        )
        mask_image = mask_image.copy().convert("L").resize(
            (infer_w, infer_h), Image.LANCZOS
        )

        # Prompt 策略：强力禁止生成人物
        base_prompt = "seamless background extension, pure background only, absolutely no people, no person, no human, no face, no body"
        
        if not prompt.strip():
            final_prompt = base_prompt
        else:
            final_prompt = f"{prompt.strip()}, {base_prompt}"

        logger.info(f"开始扩图: {infer_w}x{infer_h}, steps={num_steps}")
        logger.info(f"Prompt: {final_prompt}")
        logger.info(f"图片尺寸: {canvas_image.size}, Mask尺寸: {mask_image.size}")

        def diffusers_callback(pipe, step_index, timestep, callback_kwargs):
            if step_callback:
                progress = 40 + int((step_index / num_steps) * 55)
                log_msg = f"[FLUX] Denoising step {step_index}/{num_steps} (timestep {int(timestep)})"
                step_callback(progress, log_msg)
            logger.info(f"[FLUX] Step {step_index}/{num_steps} 完成, timestep={int(timestep)}")
            return callback_kwargs

        if step_callback:
            step_callback(40, f"[FLUX] Starting inference ({infer_w}x{infer_h})...")
        logger.info("[FLUX] 准备开始推理...")

        # 暴力清除 pipeline 内部缓存
        if hasattr(self.pipe, '_cached_inputs'):
            delattr(self.pipe, '_cached_inputs')
        if hasattr(self.pipe, 'cached_folder'):
            delattr(self.pipe, 'cached_folder')
        
        # 再次清理 CUDA 缓存
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
        
        # 随机种子
        generator = None
        if seed >= 0:
            generator = torch.Generator("cpu").manual_seed(seed)
            logger.info(f"使用固定种子: {seed}")

        logger.info(f"[FLUX] 开始调用 pipe.inference() ({infer_w}x{infer_h})...")
        try:
            result = self.pipe(
                prompt=final_prompt,
                image=canvas_image,
                mask_image=mask_image,
                height=infer_h,
                width=infer_w,
                guidance_scale=guidance_scale,
                num_inference_steps=num_steps,
                generator=generator,
                callback_on_step_end=diffusers_callback,
            ).images[0]
            logger.info("[FLUX] pipe.inference() 完成!")
        except Exception as e:
            logger.error(f"[FLUX] pipe.inference() 失败: {e}", exc_info=True)
            raise

        # 暴力清除所有缓存
        gc.collect()
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
        
        # 清除中间变量
        del canvas_image, mask_image
        gc.collect()

        logger.info("扩图完成")
        return result


# 全局单例
engine = OutpaintEngine()
