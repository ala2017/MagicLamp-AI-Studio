#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MagicLamp AI Project Migration - Shadow Project Builder
影子工程构建器 (Module 1 物理隔离兜底)

When the target tool ignores ignore-files and force-scans everything, do NOT
hand over the polluted directory. Build a hard-link shadow project in a temp
dir with polluted/heavy paths physically excluded, then hand THAT over.

Hard links cost ~0 bytes and stay in sync for clean source files, while the
junk (caches, big logs, vector stores) is simply never linked.

Usage:
  python shadow_project.py --root <project_dir> [--dest <tmp_dir>] [--max-log-kb 64]
"""

import argparse
import os
import shutil
import sys
import tempfile
import time

EXCLUDE_DIRS = {
    "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
    ".next", ".turbo", ".chroma", ".qdrant", ".cursor", ".claude", ".idea",
    ".gradle", "target", ".mypy_cache", ".pytest_cache", ".aider.tags.cache.v3",
}
# NOTE: .git is intentionally PRESERVED so the shadow keeps branch/history and
# the target tool's Stereo-Clock plan A/C (git-based) stays functional.
# Lock files are PRESERVED so the dependency tree can be reproduced exactly.
EXCLUDE_FILE_SUFFIX = (".log", ".tmp", ".pyc", ".class", ".o", ".obj")


def is_excluded_dir(name):
    return name in EXCLUDE_DIRS or name.startswith(".aider")


def link_or_copy(src, dst):
    try:
        os.link(src, dst)          # hard link (zero-copy)
        return "link"
    except Exception:
        shutil.copy2(src, dst)     # cross-device fallback
        return "copy"


def build_shadow(root, dest, max_log_kb):
    root = os.path.abspath(root)
    if not dest:
        stamp = time.strftime("%Y%m%d_%H%M%S")
        dest = os.path.join(tempfile.gettempdir(),
                            f"magiclamp_shadow_{os.path.basename(root.rstrip(os.sep))}_{stamp}")
    dest = os.path.abspath(dest)
    if os.path.exists(dest) and os.path.abspath(dest) != root:
        shutil.rmtree(dest)
    os.makedirs(dest, exist_ok=True)

    stats = {"linked": 0, "copied": 0, "skipped_dir": 0, "skipped_file": 0, "skipped_biglog": 0}

    for dirpath, dirnames, filenames in os.walk(root):
        # Block infinite recursion when dest lives inside root (e.g. ./shadow_tmp).
        dirnames[:] = [
            d for d in dirnames
            if os.path.abspath(os.path.join(dirpath, d)) != dest
        ]
        pruned = [d for d in dirnames if is_excluded_dir(d)]
        stats["skipped_dir"] += len(pruned)
        dirnames[:] = [d for d in dirnames if not is_excluded_dir(d)]

        rel = os.path.relpath(dirpath, root)
        target_dir = dest if rel == "." else os.path.join(dest, rel)
        os.makedirs(target_dir, exist_ok=True)

        for fn in filenames:
            src = os.path.join(dirpath, fn)
            low = fn.lower()
            if low.endswith(EXCLUDE_FILE_SUFFIX):
                if low.endswith(".log"):
                    stats["skipped_biglog"] += 1
                else:
                    stats["skipped_file"] += 1
                continue
            try:
                if os.path.getsize(src) > max_log_kb * 1024 and low.endswith((".txt", ".out")):
                    stats["skipped_biglog"] += 1
                    continue
            except Exception:
                pass
            kind = link_or_copy(src, os.path.join(target_dir, fn))
            stats["linked" if kind == "link" else "copied"] += 1

    return dest, stats


def main():
    ap = argparse.ArgumentParser(description="MagicLamp Shadow Project Builder")
    ap.add_argument("--root", default=".", help="Source project root")
    ap.add_argument("--dest", default="", help="Shadow destination (default: system temp)")
    ap.add_argument("--max-log-kb", type=int, default=64,
                    help="Skip text/out files larger than this (KB)")
    args = ap.parse_args()

    if not os.path.isdir(args.root):
        print(f"ERROR: root not found: {args.root}", file=sys.stderr)
        sys.exit(2)

    dest, stats = build_shadow(args.root, args.dest, args.max_log_kb)
    print(f"[OK] shadow project: {dest}")
    print(f"[OK] linked={stats['linked']} copied={stats['copied']} "
          f"pruned_dirs={stats['skipped_dir']} skipped_files={stats['skipped_file']} "
          f"skipped_biglogs={stats['skipped_biglog']}")
    print("[NEXT] hand THIS directory to the target tool for initialization.")


if __name__ == "__main__":
    main()
