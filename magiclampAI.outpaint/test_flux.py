import torch
from diffusers import Flux2KleinInpaintPipeline
from PIL import Image, ImageDraw

model_id = "black-forest-labs/FLUX.2-klein-4B"
try:
    pipe = Flux2KleinInpaintPipeline.from_pretrained(model_id, torch_dtype=torch.bfloat16)
    pipe.enable_model_cpu_offload()

    canvas = Image.new("RGB", (512, 512), (255, 0, 0))
    mask = Image.new("L", (512, 512), 255)
    draw = ImageDraw.Draw(mask)
    draw.rectangle([128, 128, 384, 384], fill=0)

    result = pipe(
        prompt="a green meadow",
        image=canvas,
        mask_image=mask,
        num_inference_steps=4,
    ).images[0]
    result.save("test_out.png")
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
