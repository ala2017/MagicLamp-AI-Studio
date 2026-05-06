import os, sys, traceback
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["HF_TOKEN"] = "YOUR_HUGGINGFACE_TOKEN"
os.environ["HF_HOME"] = str(os.path.join(os.path.dirname(__file__), "models"))

import torch
print(f"PyTorch: {torch.__version__}, CUDA: {torch.cuda.is_available()}")

try:
    from transformers import T5EncoderModel, BitsAndBytesConfig
    print("Step 1: Loading T5 with INT8...")
    t5 = T5EncoderModel.from_pretrained(
        "black-forest-labs/FLUX.1-Fill-dev",
        subfolder="text_encoder_2",
        quantization_config=BitsAndBytesConfig(load_in_8bit=True),
        torch_dtype=torch.bfloat16,
        cache_dir="models"
    )
    print("T5 loaded OK!")
except Exception as e:
    print(f"T5 FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)
