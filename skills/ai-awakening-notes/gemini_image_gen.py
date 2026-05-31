#!/usr/bin/env python3
"""
Gemini Image Generator - AI Awakening Notes
Uses generateContent API with image-capable models.
Deps: pip install google-genai
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types

ASPECT_MAP = {
    "cover": "16:9",
    "illustration": "3:2",
    "square": "1:1",
}

# Models available on this API key (all use generateContent)
DEFAULT_MODEL = "gemini-3.1-flash-image"


def generate_image(
    prompt: str,
    output_path: str,
    api_key: str,
    model: str = DEFAULT_MODEL,
    aspect_ratio: str = "16:9",
    seed: Optional[int] = None,
    image_size: str = "1K",
) -> str:
    client = genai.Client(api_key=api_key)

    config = types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
            image_size=image_size,
        ),
    )
    if seed is not None:
        config.seed = seed

    response = client.models.generate_content(
        model=model,
        contents=[prompt],
        config=config,
    )

    # Extract image from response
    image_bytes = None
    for part in response.candidates[0].content.parts:
        if hasattr(part, 'inline_data') and part.inline_data:
            image_bytes = part.inline_data.data
            break
        if hasattr(part, 'image') and part.image:
            img = part.image
            if hasattr(img, '_image_bytes'):
                image_bytes = img._image_bytes
                break
            if hasattr(img, 'data'):
                image_bytes = img.data
                break

    if not image_bytes:
        raise RuntimeError("No image found in response. Model may have returned text only.")

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(image_bytes)
    print(f"OK: {out} ({len(image_bytes) / 1024:.0f} KB)")
    return str(out)


def main():
    parser = argparse.ArgumentParser(description="Gemini Image Generator")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--type", choices=["cover", "illustration", "square"], default="cover")
    parser.add_argument("--aspect-ratio", default=None)
    parser.add_argument("--key", default=None)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()

    api_key = args.key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: Set GEMINI_API_KEY or use --key", file=sys.stderr)
        sys.exit(1)

    ratio = args.aspect_ratio or ASPECT_MAP.get(args.type, "16:9")

    path = generate_image(
        prompt=args.prompt,
        output_path=args.output,
        api_key=api_key,
        model=args.model,
        aspect_ratio=ratio,
        seed=args.seed,
    )
    print(path)


if __name__ == "__main__":
    main()
