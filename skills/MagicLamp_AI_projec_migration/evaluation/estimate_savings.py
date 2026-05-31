#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MagicLamp Migration - Token Savings Estimator (proxy, zero API cost)
迁移 Token 节省代理估算器

Compares the token mass a naive cold-start would ingest (full blind scan)
against the dehydrated handoff doc, and prints saving % + estimated $ cost.

This is a PROXY (upper-bound on input-token saving), not a full A/B. For the
rigorous experiment, run real A/B with API usage logging (see README).

Usage:
  python estimate_savings.py --root <PROJECT_ROOT> [--doc DEHYDRATED_CONTEXT.md]
                             [--include-deps] [--in-price 3.0] [--cache-discount 0.1]
"""

import argparse
import json
import os

# Token pricing defaults: USD per 1M input tokens (Claude Sonnet-ish). Override via CLI.
DEFAULT_IN_PRICE = 3.0
DEFAULT_CACHE_DISCOUNT = 0.1  # cached input tokens cost ~10% of fresh

TEXT_EXT = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java", ".kt", ".rb",
    ".php", ".c", ".h", ".cpp", ".hpp", ".cs", ".swift", ".dart", ".scala",
    ".md", ".txt", ".rst", ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".html", ".css", ".scss", ".vue", ".svelte", ".sql", ".sh", ".ps1", ".env",
    ".xml", ".gradle", ".lock", ".log",
}
# Dirs a blind tool *might* still scan; the skill physically blocks these.
JUNK_DIRS = {"node_modules", ".venv", "venv", "dist", "build", ".next",
             ".turbo", ".chroma", ".qdrant", "__pycache__", "target", ".git"}

try:
    import tiktoken
    _ENC = tiktoken.get_encoding("cl100k_base")

    def count_tokens(s):
        return len(_ENC.encode(s, disallowed_special=()))
    TOKENIZER = "tiktoken/cl100k_base (exact-ish)"
except Exception:
    def count_tokens(s):
        # Heuristic: CJK ~1 tok/char; other text ~4 chars/tok.
        cjk = sum(1 for ch in s if "\u4e00" <= ch <= "\u9fff")
        other = len(s) - cjk
        return int(cjk + other / 4)
    TOKENIZER = "builtin-heuristic (install tiktoken for exact counts)"


def read_text(path, limit=2_000_000):
    try:
        with open(path, "rb") as fh:
            return fh.read(limit).decode("utf-8-sig", "replace")
    except Exception:
        return ""


def scan_tokens(root, include_deps):
    total_tok, total_files, total_bytes = 0, 0, 0
    breakdown = {"source": 0, "junk": 0}
    for dirpath, dirnames, filenames in os.walk(root):
        in_junk = any(part in JUNK_DIRS for part in dirpath.replace("\\", "/").split("/"))
        if not include_deps:
            dirnames[:] = [d for d in dirnames if d not in JUNK_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext not in TEXT_EXT:
                continue
            p = os.path.join(dirpath, fn)
            txt = read_text(p)
            if not txt:
                continue
            tok = count_tokens(txt)
            total_tok += tok
            total_files += 1
            try:
                total_bytes += os.path.getsize(p)
            except Exception:
                pass
            breakdown["junk" if in_junk else "source"] += tok
    return total_tok, total_files, total_bytes, breakdown


def main():
    ap = argparse.ArgumentParser(description="MagicLamp token savings estimator")
    ap.add_argument("--root", default=".")
    ap.add_argument("--doc", default="DEHYDRATED_CONTEXT.md")
    ap.add_argument("--include-deps", action="store_true",
                    help="Count node_modules/.git/etc as the blind baseline (worst case)")
    ap.add_argument("--in-price", type=float, default=DEFAULT_IN_PRICE,
                    help="USD per 1M input tokens")
    ap.add_argument("--cache-discount", type=float, default=DEFAULT_CACHE_DISCOUNT,
                    help="Cached input token price multiplier (e.g. 0.1)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    root = os.path.abspath(args.root)
    base_tok, base_files, base_bytes, bd = scan_tokens(root, args.include_deps)

    doc_path = os.path.join(root, args.doc)
    doc_tok = count_tokens(read_text(doc_path)) if os.path.exists(doc_path) else 0

    saved = base_tok - doc_tok
    save_pct = (saved / base_tok * 100) if base_tok else 0.0

    p = args.in_price / 1_000_000
    base_cost = base_tok * p
    # Treatment: first session fresh, repeat sessions hit cache discount.
    doc_cost_fresh = doc_tok * p
    doc_cost_cached = doc_tok * p * args.cache_discount

    result = {
        "tokenizer": TOKENIZER,
        "baseline": {"tokens": base_tok, "files": base_files, "bytes": base_bytes,
                     "source_tokens": bd["source"], "junk_tokens": bd["junk"],
                     "include_deps": args.include_deps},
        "dehydrated": {"tokens": doc_tok, "exists": os.path.exists(doc_path)},
        "saving": {"tokens": saved, "percent": round(save_pct, 2)},
        "cost_usd": {
            "baseline_per_coldstart": round(base_cost, 4),
            "dehydrated_first": round(doc_cost_fresh, 4),
            "dehydrated_cached_repeat": round(doc_cost_cached, 6),
            "saved_per_coldstart": round(base_cost - doc_cost_fresh, 4),
        },
        "ratio": f"{(base_tok / doc_tok):.1f}x smaller" if doc_tok else "N/A",
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print(f"Tokenizer        : {TOKENIZER}")
    print(f"Baseline (blind) : {base_tok:>10,} tokens  ({base_files} files, "
          f"{base_bytes/1024:.0f} KB, include_deps={args.include_deps})")
    print(f"  - source       : {bd['source']:>10,} tokens")
    print(f"  - junk/deps     : {bd['junk']:>10,} tokens")
    print(f"Dehydrated doc   : {doc_tok:>10,} tokens  (exists={result['dehydrated']['exists']})")
    print(f"-> Token saving  : {saved:>10,} tokens  = {save_pct:.1f}%   ({result['ratio']})")
    print(f"-> Cost / coldstart @ ${args.in_price}/1M in:")
    print(f"     baseline     : ${base_cost:.4f}")
    print(f"     dehydrated   : ${doc_cost_fresh:.4f}  (cached repeat: ${doc_cost_cached:.6f})")
    print(f"     saved        : ${base_cost - doc_cost_fresh:.4f} per cold start")


if __name__ == "__main__":
    main()
