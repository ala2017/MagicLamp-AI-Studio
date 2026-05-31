#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MagicLamp Migration - Project Map Builder (ast-based, zero-token by default)
项目地图构建器:用 ast 把"真实文件树 + 每文件签名"抽干,补上文档地图的漏报与漂移。

Two tiers:
  FREE tier (default, 0 token): os.walk + ast -> real file tree + per-file module
      docstring (1 line) + top-level class/def names. 100% coverage, zero dead links.
  CHEAP-model tier (--describe, amortized once): feed ONLY the extracted signatures
      (never full file bodies) to the lowest-cost model for a one-line responsibility
      note each. Batched into a single call to minimize tokens.

Also exposes a coverage audit (--audit): omission% (real source files not named in
docs) and drift% (doc-referenced paths that no longer exist). Deterministic,
repo-grounded ground truth -> no circular dependency on the snapshot itself.

Usage:
  python build_project_map.py --root <proj>                 # print CODE_MAP (free)
  python build_project_map.py --root <proj> --audit         # coverage/drift numbers
  python build_project_map.py --root <proj> --describe       # + cheap-model one-liners
"""

import argparse
import ast
import glob
import json
import os
import re

CODE_EXT = {".py", ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs", ".go", ".rs",
            ".java", ".kt", ".rb", ".php", ".c", ".h", ".cpp", ".hpp", ".cs",
            ".swift", ".vue", ".svelte", ".scala", ".dart"}

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist",
             "build", ".next", ".turbo", ".chroma", ".qdrant", ".cursor",
             ".claude", ".idea", ".gradle", "target", ".mypy_cache",
             ".pytest_cache", "site-packages", "outputs", "reference_audio"}

# Vendored / model-weight / generated markers -> never part of "our source".
VENDOR_RE = re.compile(r"(models--|[\\/]snapshots[\\/]|transformers_modules|"
                       r"site-packages|\.egg-info|vendor[\\/]|third_party)", re.I)

# Doc extensions for the coverage audit.
DOC_EXT = ("*.md", "*.markdown", "*.txt", "*.rst")

DOCSTR_CAP = 80
MAX_DEFS = 6
MAX_CLASSES = 4


def _skip(path):
    parts = path.replace("\\", "/").split("/")
    if any(p in SKIP_DIRS for p in parts):
        return True
    if VENDOR_RE.search(path):
        return True
    return False


def significant_sources(root, max_files):
    found = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames
                       if d not in SKIP_DIRS and not d.startswith(".aider")]
        for fn in filenames:
            if os.path.splitext(fn)[1].lower() not in CODE_EXT:
                continue
            full = os.path.join(dirpath, fn)
            if _skip(full):
                continue
            found.append(full)
    # Prioritize shallow / central source over deep utility files.
    found.sort(key=lambda p: (p.replace("\\", "/").count("/"), p.lower()))
    return found[:max_files]


def _first_line(s):
    if not s:
        return ""
    line = s.strip().splitlines()[0].strip()
    return line[:DOCSTR_CAP]


def py_signature(path):
    try:
        src = open(path, encoding="utf-8-sig", errors="replace").read()
        tree = ast.parse(src)
    except Exception:
        return generic_signature(path)
    doc = _first_line(ast.get_docstring(tree) or "")
    defs, classes = [], []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            defs.append(node.name)
        elif isinstance(node, ast.ClassDef):
            classes.append(node.name)
    return {"doc": doc, "defs": defs[:MAX_DEFS], "classes": classes[:MAX_CLASSES]}


def generic_signature(path):
    """Lightweight, language-agnostic fallback for non-Python source."""
    try:
        src = open(path, encoding="utf-8-sig", errors="replace").read()
    except Exception:
        return {"doc": "", "defs": [], "classes": []}
    doc = ""
    for line in src.splitlines()[:8]:
        t = line.strip().lstrip("/*#- ").strip()
        if t and not t.startswith(("import", "use ", "package", "require")):
            doc = t[:DOCSTR_CAP]
            break
    names = re.findall(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)", src)
    names += re.findall(r"(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(", src)
    classes = re.findall(r"(?:export\s+)?class\s+(\w+)", src)
    return {"doc": doc, "defs": list(dict.fromkeys(names))[:MAX_DEFS],
            "classes": list(dict.fromkeys(classes))[:MAX_CLASSES]}


def build_map(root, max_files=120):
    entries = []
    for full in significant_sources(root, max_files):
        rel = os.path.relpath(full, root).replace("\\", "/")
        sig = (py_signature(full) if full.lower().endswith(".py")
               else generic_signature(full))
        entries.append({"rel": rel, **sig})
    return entries


def render_map_md(entries, descriptions=None):
    L = []
    for e in entries:
        bits = []
        note = (descriptions or {}).get(e["rel"]) or e["doc"]
        if note:
            bits.append(note)
        if e["classes"]:
            bits.append("class: " + ", ".join(e["classes"]))
        if e["defs"]:
            bits.append("def: " + ", ".join(e["defs"]))
        tail = (" — " + " | ".join(bits)) if bits else ""
        L.append(f"- `{e['rel']}`{tail}")
    return "\n".join(L)


# --------------------------------------------------------------------------- #
# Coverage audit (deterministic, repo-grounded ground truth)
# --------------------------------------------------------------------------- #


def _collect_doc_text(root):
    texts = []
    for ext in DOC_EXT:
        for f in glob.glob(os.path.join(root, "**", ext), recursive=True):
            if _skip(f):
                continue
            try:
                texts.append(open(f, encoding="utf-8-sig", errors="replace").read())
            except Exception:
                pass
    return "\n".join(texts)


def coverage_audit(root, max_files=10000):
    alltext = _collect_doc_text(root)
    srcs = significant_sources(root, max_files)
    # omission: real source basenames never named in any doc
    mentioned = unmentioned = 0
    miss_samples = []
    for f in srcs:
        base = os.path.basename(f)
        if base in ("__init__.py", "setup.py"):
            continue
        if re.search(r"(?<![\w])" + re.escape(base) + r"(?![\w])", alltext, re.A):
            mentioned += 1
        else:
            unmentioned += 1
            if len(miss_samples) < 12:
                miss_samples.append(os.path.relpath(f, root).replace("\\", "/"))
    total = mentioned + unmentioned
    omission = (unmentioned / total * 100) if total else 0.0
    # drift: doc-referenced code paths that resolve to nothing
    refs = set(re.findall(
        r"[`\"']?([\w./\\-]+\.(?:py|js|ts|tsx|jsx|go|rs|java|html|css|json|yaml|yml))[`\"']?",
        alltext))
    dead = []
    for rp in refs:
        cand = os.path.normpath(os.path.join(root, rp.replace("/", os.sep)))
        if os.path.exists(cand):
            continue
        if glob.glob(os.path.join(root, "**", os.path.basename(rp)), recursive=True):
            continue
        dead.append(rp)
    drift = (len(dead) / len(refs) * 100) if refs else 0.0
    has_struct = bool(re.search(
        r"(目录结构|项目结构|文件结构|代码结构|directory structure|project structure|"
        r"file tree|架构图)", alltext, re.I)) or bool(re.search(r"[├└│]\s*[─-]{2}", alltext))
    return {
        "real_source_files": total,
        "omission_pct": round(omission, 1),
        "drift_pct": round(drift, 1),
        "doc_has_structure_section": has_struct,
        "unmentioned_samples": miss_samples,
        "dead_ref_samples": dead[:12],
    }


# --------------------------------------------------------------------------- #
# Optional cheap-model description tier (signatures only, batched once)
# --------------------------------------------------------------------------- #


def describe_entries(entries, provider="deepseek", model=None):
    """One-line responsibility note per file from the cheapest model.
    Sends ONLY extracted signatures (never file bodies). Returns {rel: note}."""
    prov = {
        "deepseek": ("DEEPSEEK_API_KEY", "https://api.deepseek.com", "deepseek-chat"),
        "openai": ("OPENAI_API_KEY", None, "gpt-4o-mini"),
    }[provider]
    env_var, base, default_model = prov
    key = os.environ.get(env_var)
    if not key:
        print(f"[warn] --describe skipped: ${env_var} not set")
        return {}
    try:
        from openai import OpenAI
    except ImportError:
        print("[warn] --describe skipped: pip install openai")
        return {}
    client = OpenAI(api_key=key, base_url=base)
    payload = [{"rel": e["rel"], "doc": e["doc"],
                "classes": e["classes"], "defs": e["defs"]} for e in entries]
    prompt = (
        "下面是一个项目里每个源文件的签名(类名/函数名/首行docstring)。"
        "为每个文件写一句不超过20字的中文责任说明,只依据签名推断,不要臆造。"
        "严格输出 JSON 对象: {\"相对路径\": \"责任说明\"}。\n\n"
        + json.dumps(payload, ensure_ascii=False))
    try:
        resp = client.chat.completions.create(
            model=model or default_model, max_tokens=4000,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}])
        notes = json.loads(resp.choices[0].message.content)
        u = resp.usage
        print(f"[describe] {provider} usage in={u.prompt_tokens} out={u.completion_tokens}")
        return notes if isinstance(notes, dict) else {}
    except Exception as exc:
        print(f"[warn] --describe failed: {exc}")
        return {}


def main():
    ap = argparse.ArgumentParser(description="MagicLamp project map builder")
    ap.add_argument("--root", default=".")
    ap.add_argument("--max", type=int, default=120, help="max files in map")
    ap.add_argument("--audit", action="store_true", help="print coverage/drift JSON")
    ap.add_argument("--describe", action="store_true",
                    help="add cheap-model one-line notes (signatures only)")
    ap.add_argument("--provider", default="deepseek", choices=["deepseek", "openai"])
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    root = os.path.abspath(args.root)
    if args.audit:
        print(json.dumps(coverage_audit(root), ensure_ascii=False, indent=2))
        return
    entries = build_map(root, args.max)
    desc = describe_entries(entries, args.provider) if args.describe else None
    if args.json:
        print(json.dumps({"entries": entries, "descriptions": desc},
                         ensure_ascii=False, indent=2))
        return
    print(render_map_md(entries, desc))


if __name__ == "__main__":
    main()
