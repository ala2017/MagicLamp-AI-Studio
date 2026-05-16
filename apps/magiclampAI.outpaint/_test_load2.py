import os, sys, traceback
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["HF_TOKEN"] = "YOUR_HUGGINGFACE_TOKEN"
os.environ["HF_HOME"] = str(os.path.join(os.path.dirname(__file__), "models"))

import torch
print(f"PyTorch: {torch.__version__}, CUDA: {torch.cuda.is_available()}")

try:
    from diffusers import FluxTransformer2DModel, GGUFQuantizationConfig
    gguf_path = os.path.join(os.path.dirname(__file__), "models", "flux1-fill-dev-Q4_K_S.gguf")
    print(f"Step 2: Loading GGUF Transformer from {gguf_path}...")
    print(f"  File exists: {os.path.exists(gguf_path)}")
    print(f"  File size: {os.path.getsize(gguf_path) / (1024**3):.2f} GB")
    
    transformer = FluxTransformer2DModel.from_single_file(
        gguf_path,
        quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
        torch_dtype=torch.bfloat16,
        config="black-forest-labs/FLUX.1-Fill-dev",
        subfolder="transformer",
    )
    print("GGUF Transformer loaded OK!")
except Exception as e:
    print(f"GGUF FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)
