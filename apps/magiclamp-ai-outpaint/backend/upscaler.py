import os
import torch
from PIL import Image
import numpy as np
from pathlib import Path
import logging
import gc

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / "models"
# 使用 HF 镜像加速下载 (修正 404 路径)
MODEL_URL = "https://hf-mirror.com/lllyasviel/Annotators/resolve/main/RealESRGAN_x4plus.pth"
MODEL_PATH = MODEL_DIR / "RealESRGAN_x4plus.pth"

class Upscaler:
    """
    独立的高清放大模块，使用 Spandrel 加载 RealESRGAN_x4plus。
    Spandrel 是 2024-2026 年处理 PyTorch 放大模型的最标准、最稳定库，显存占用极小（<3GB）。
    """
    def __init__(self):
        self.model = None

    def load_model(self):
        if self.model is not None:
            return
            
        import urllib.request
        try:
            from spandrel import ModelLoader
        except ImportError:
            raise RuntimeError("Spandrel 库未安装，请执行 pip install spandrel")
        
        if not MODEL_PATH.exists():
            logger.info("首次使用放大功能，正在从 HF 镜像下载 RealESRGAN_x4plus 模型 (约 64MB)...")
            req = urllib.request.Request(MODEL_URL, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(MODEL_PATH, 'wb') as out_file:
                out_file.write(response.read())
            logger.info("模型下载完成。")
            
        logger.info("加载超分辨率放大模型 (Spandrel / RealESRGAN_x4plus)...")
        self.model = ModelLoader().load_from_file(str(MODEL_PATH)).eval().to("cuda")
        logger.info("放大模型加载完毕。")

    def upscale(self, img: Image.Image, factor: int = 4) -> Image.Image:
        self.load_model()
        
        logger.info(f"开始放大图片，原尺寸: {img.size}")
        
    def _tile_process(self, img_tensor: torch.Tensor, tile_size: int = 512, tile_pad: int = 32) -> torch.Tensor:
        """分块推理机制：降低显存峰值，防止 720p 图像拉爆 16GB 显存"""
        b, c, h, w = img_tensor.shape
        scale = 4  # RealESRGAN_x4plus 默认倍率
        out_tensor = torch.zeros((b, c, h * scale, w * scale), device="cpu")
        
        for y in range(0, h, tile_size):
            for x in range(0, w, tile_size):
                y1 = max(0, y - tile_pad)
                x1 = max(0, x - tile_pad)
                y2 = min(h, y + tile_size + tile_pad)
                x2 = min(w, x + tile_size + tile_pad)
                
                in_tile = img_tensor[:, :, y1:y2, x1:x2].to("cuda")
                with torch.no_grad():
                    out_tile = self.model(in_tile).cpu()
                
                out_y1 = y * scale
                out_x1 = x * scale
                out_y2 = min(h * scale, (y + tile_size) * scale)
                out_x2 = min(w * scale, (x + tile_size) * scale)
                
                off_y = (y - y1) * scale
                off_x = (x - x1) * scale
                h_amount = out_y2 - out_y1
                w_amount = out_x2 - out_x1
                
                out_tensor[:, :, out_y1:out_y2, out_x1:out_x2] = out_tile[:, :, off_y:off_y + h_amount, off_x:off_x + w_amount]
                
        return out_tensor.to("cuda")

    def upscale(self, img: Image.Image, factor: int = 4) -> Image.Image:
        self.load_model()
        
        logger.info(f"开始分块放大图片，原尺寸: {img.size}")
        
        img_np = np.array(img.convert("RGB")).astype(np.float32) / 255.0
        # HWC to BCHW，存放在 CPU，防止占用过多显存
        img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).unsqueeze(0).to("cpu")
        
        # 采用分块推理
        output_tensor = self._tile_process(img_tensor, tile_size=400, tile_pad=32)
            
        output_np = output_tensor.squeeze(0).permute(1, 2, 0).cpu().numpy()
        output_np = np.clip(output_np, 0, 1) * 255.0
        
        result_img = Image.fromarray(output_np.astype(np.uint8))
        
        # 如果需要 2x 放大，则将 4x 的结果使用 Lanczos 降采样一半（画质最优）
        if int(factor) == 2:
            new_w = result_img.width // 2
            new_h = result_img.height // 2
            result_img = result_img.resize((new_w, new_h), Image.LANCZOS)
            
        logger.info(f"放大完成，新尺寸: {result_img.size}")
        
        # 用完即清，保证显存可以还给 FLUX
        del img_tensor, output_tensor
        torch.cuda.empty_cache()
        gc.collect()
        
        return result_img

# 单例
upscaler = Upscaler()
