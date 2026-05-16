import os, sys, traceback, time
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["HF_TOKEN"] = "YOUR_HUGGINGFACE_TOKEN"
os.environ["HF_HOME"] = str(os.path.join(os.path.dirname(__file__), "models"))

import torch
print(f"PyTorch: {torch.__version__}, CUDA: {torch.cuda.is_available()}")

t0 = time.time()
try:
    from diffusers import FluxFillPipeline, FluxTransformer2DModel, GGUFQuantizationConfig
    from transformers import T5EncoderModel, BitsAndBytesConfig
    
    MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
    FLUX_FILL_MODEL_ID = "black-forest-labs/FLUX.1-Fill-dev"
    
    # Step 1: T5
    print(f"[{time.time()-t0:.1f}s] Loading INT8 T5...")
    t5 = T5EncoderModel.from_pretrained(
        FLUX_FILL_MODEL_ID,
        subfolder="text_encoder_2",
        quantization_config=BitsAndBytesConfig(load_in_8bit=True),
        torch_dtype=torch.bfloat16,
        cache_dir=MODEL_DIR
    )
    print(f"[{time.time()-t0:.1f}s] T5 OK. VRAM: {torch.cuda.memory_reserved(0)/(1024**3):.1f} GB")

    # Step 2: GGUF
    gguf_path = os.path.join(MODEL_DIR, "flux1-fill-dev-Q4_K_S.gguf")
    print(f"[{time.time()-t0:.1f}s] Loading GGUF Transformer...")
    transformer = FluxTransformer2DModel.from_single_file(
        gguf_path,
        quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
        torch_dtype=torch.bfloat16,
        config=FLUX_FILL_MODEL_ID,
        subfolder="transformer",
    )
    print(f"[{time.time()-t0:.1f}s] Transformer OK. VRAM: {torch.cuda.memory_reserved(0)/(1024**3):.1f} GB")

    # Step 3: Pipeline assembly
    print(f"[{time.time()-t0:.1f}s] Assembling FluxFillPipeline...")
    pipe = FluxFillPipeline.from_pretrained(
        FLUX_FILL_MODEL_ID,
        text_encoder_2=t5,
        transformer=transformer,
        torch_dtype=torch.bfloat16,
        cache_dir=MODEL_DIR,
    )
    print(f"[{time.time()-t0:.1f}s] Pipeline assembled. Moving to CUDA...")
    
    pipe.to("cuda")
    print(f"[{time.time()-t0:.1f}s] ALL DONE! VRAM: {torch.cuda.memory_reserved(0)/(1024**3):.1f} GB")

except Exception as e:
    print(f"\n[{time.time()-t0:.1f}s] FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)
