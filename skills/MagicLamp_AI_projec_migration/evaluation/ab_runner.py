#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MagicLamp Migration - Real API A/B Runner (efficiency metrics)
真实 API 双臂对比 runner(轮数 / 成功率 / 实测 usage)

Drives a real model through a "resume this half-finished project" task
under two arms, same tools + same question, only difference = handoff doc:

  Arm A (blind):     no doc. Agent discovers state via tools -> more turns/tokens.
  Arm B (MagicLamp): DEHYDRATED_CONTEXT.md provided up front -> fewer turns/tokens.

Logs per-turn `usage`, counts turns/tool-calls, scores success vs a keyword,
repeats N times, writes evaluation/AB_REPORT.md with mean +/- spread.

Providers (--provider):
  deepseek   : OpenAI-compatible, base https://api.deepseek.com, model deepseek-chat
               -> needs `pip install openai` + $env:DEEPSEEK_API_KEY
  openai     : any OpenAI-compatible endpoint (--base-url to override)
               -> needs `pip install openai` + $env:OPENAI_API_KEY
  anthropic  : Claude. needs `pip install anthropic` + $env:ANTHROPIC_API_KEY

Usage:
  python ab_runner.py --root <PROJECT_ROOT> --expect "支付" \
                      --provider deepseek --runs 5
"""

import argparse
import json
import os
import statistics
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))

QUESTION = (
    "这是一个开发到一半的项目。请只回答两件事:"
    "(1) 当前还没完成、需要继续做的下一个任务是什么?"
    "(2) 该任务最相关的源码文件路径是哪个?"
    "回答尽量简短。"
)

SYSTEM = (
    "你是一个接手半成品项目的工程师。用提供的工具了解项目状态后回答问题。"
    "不要臆测;不确定就用工具查。"
)

# Provider defaults: (env_var, base_url, model, input_price_usd_per_1M)
PROVIDERS = {
    "deepseek": ("DEEPSEEK_API_KEY", "https://api.deepseek.com", "deepseek-chat", 0.27),
    "openai":   ("OPENAI_API_KEY", None, "gpt-4o-mini", 0.15),
    "anthropic": ("ANTHROPIC_API_KEY", None, "claude-sonnet-4-5", 3.0),
}

JUNK = {"node_modules", ".git", ".venv", "dist", "build", "__pycache__", ".next"}

# ---- tool schemas in both dialects -----------------------------------------
_PROPS = {"path": {"type": "string", "description": "相对项目根的路径,根用 '.'"}}
ANTHROPIC_TOOLS = [
    {"name": "list_dir", "description": "列出目录下的文件与子目录",
     "input_schema": {"type": "object", "properties": _PROPS, "required": ["path"]}},
    {"name": "read_file", "description": "读取文本文件内容",
     "input_schema": {"type": "object", "properties": {"path": {"type": "string"}},
                      "required": ["path"]}},
]
OPENAI_TOOLS = [
    {"type": "function", "function": {
        "name": "list_dir", "description": "列出目录下的文件与子目录",
        "parameters": {"type": "object", "properties": _PROPS, "required": ["path"]}}},
    {"type": "function", "function": {
        "name": "read_file", "description": "读取文本文件内容",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}},
                       "required": ["path"]}}},
]


def safe_join(root, rel):
    p = os.path.normpath(os.path.join(root, rel))
    if not p.startswith(os.path.abspath(root)):
        return None
    return p


def tool_list_dir(root, rel):
    p = safe_join(root, rel)
    if not p or not os.path.isdir(p):
        return f"[err] not a dir: {rel}"
    out = []
    for name in sorted(os.listdir(p)):
        if name in JUNK:
            out.append(f"{name}/ (skipped large dir)")
            continue
        full = os.path.join(p, name)
        out.append(f"{name}/" if os.path.isdir(full) else name)
    return "\n".join(out) or "(empty)"


def tool_read_file(root, rel):
    p = safe_join(root, rel)
    if not p or not os.path.isfile(p):
        return f"[err] not a file: {rel}"
    try:
        with open(p, "rb") as f:
            return f.read(60_000).decode("utf-8-sig", "replace")
    except Exception as e:
        return f"[err] {e}"


def dispatch_tool(name, args_obj, root):
    rel = (args_obj or {}).get("path", ".")
    if name == "list_dir":
        return tool_list_dir(root, rel)
    return tool_read_file(root, rel)


def build_user(arm, doc_text):
    if arm == "B" and doc_text:
        return (f"<迁移交接书 DEHYDRATED_CONTEXT.md>\n{doc_text}\n"
                f"</迁移交接书>\n\n{QUESTION}")
    return QUESTION


# ---- Anthropic arm ----------------------------------------------------------
def run_arm_anthropic(client, model, root, arm, doc_text):
    messages = [{"role": "user", "content": build_user(arm, doc_text)}]
    turns = tool_calls = in_tok = out_tok = cache_hit = 0
    answer = ""
    for _ in range(12):
        turns += 1
        resp = client.messages.create(model=model, max_tokens=1024,
                                       system=SYSTEM, tools=ANTHROPIC_TOOLS,
                                       messages=messages)
        in_tok += resp.usage.input_tokens
        out_tok += resp.usage.output_tokens
        cache_hit += getattr(resp.usage, "cache_read_input_tokens", 0) or 0
        results = []
        for block in resp.content:
            if block.type == "text":
                answer += block.text
            elif block.type == "tool_use":
                tool_calls += 1
                res = dispatch_tool(block.name, block.input, root)
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": res[:8000]})
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason == "tool_use":
            messages.append({"role": "user", "content": results})
            continue
        break
    return {"turns": turns, "tool_calls": tool_calls, "in_tok": in_tok,
            "out_tok": out_tok, "cache_hit": cache_hit, "answer": answer.strip()}


# ---- OpenAI-compatible arm (DeepSeek / OpenAI) ------------------------------
def run_arm_openai(client, model, root, arm, doc_text):
    messages = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": build_user(arm, doc_text)}]
    turns = tool_calls = in_tok = out_tok = cache_hit = 0
    answer = ""
    for _ in range(12):
        turns += 1
        resp = client.chat.completions.create(
            model=model, max_tokens=1024, tools=OPENAI_TOOLS, messages=messages)
        u = resp.usage
        in_tok += u.prompt_tokens
        out_tok += u.completion_tokens
        cache_hit += getattr(u, "prompt_cache_hit_tokens", 0) or 0
        msg = resp.choices[0].message
        if msg.content:
            answer += msg.content
        if msg.tool_calls:
            messages.append({"role": "assistant", "content": msg.content or "",
                             "tool_calls": [tc.model_dump() for tc in msg.tool_calls]})
            for tc in msg.tool_calls:
                tool_calls += 1
                try:
                    a = json.loads(tc.function.arguments or "{}")
                except Exception:
                    a = {}
                res = dispatch_tool(tc.function.name, a, root)
                messages.append({"role": "tool", "tool_call_id": tc.id,
                                 "content": res[:8000]})
            continue
        break
    return {"turns": turns, "tool_calls": tool_calls, "in_tok": in_tok,
            "out_tok": out_tok, "cache_hit": cache_hit, "answer": answer.strip()}


def make_client(provider, base_url):
    env_var, default_base, _, _ = PROVIDERS[provider]
    key = os.environ.get(env_var)
    if not key:
        sys.exit(f"[err] set $env:{env_var}")
    if provider == "anthropic":
        try:
            import anthropic
        except ImportError:
            sys.exit("[err] pip install anthropic")
        return anthropic.Anthropic(api_key=key), run_arm_anthropic
    try:
        from openai import OpenAI
    except ImportError:
        sys.exit("[err] pip install openai")
    return OpenAI(api_key=key, base_url=base_url or default_base), run_arm_openai


def agg(vals):
    return (statistics.mean(vals),
            statistics.pstdev(vals) if len(vals) > 1 else 0.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--expect", required=True, help="success keyword (e.g. 支付)")
    ap.add_argument("--provider", choices=list(PROVIDERS), default="deepseek")
    ap.add_argument("--model", default=None, help="override model name")
    ap.add_argument("--base-url", default=None, help="override OpenAI-compatible base url")
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--in-price", type=float, default=None, help="USD per 1M input tokens")
    ap.add_argument("--out", default=os.path.join(HERE, "AB_REPORT.md"))
    args = ap.parse_args()

    env_var, default_base, default_model, default_price = PROVIDERS[args.provider]
    model = args.model or default_model
    in_price = args.in_price if args.in_price is not None else default_price
    client, run_arm = make_client(args.provider, args.base_url)

    root = os.path.abspath(args.root)
    doc_path = os.path.join(root, "DEHYDRATED_CONTEXT.md")
    doc_text = ""
    if os.path.exists(doc_path):
        with open(doc_path, "rb") as f:
            doc_text = f.read().decode("utf-8-sig", "replace")
    else:
        print("[warn] no DEHYDRATED_CONTEXT.md; run dehydrate.py first for Arm B")

    data = {"A": [], "B": []}
    for i in range(args.runs):
        for arm in ("A", "B"):
            r = run_arm(client, model, root, arm, doc_text)
            r["ok"] = args.expect in r["answer"]
            data[arm].append(r)
            print(f"run {i+1} arm {arm}: turns={r['turns']} tools={r['tool_calls']} "
                  f"in={r['in_tok']} out={r['out_tok']} cache={r['cache_hit']} ok={r['ok']}")

    p = in_price / 1_000_000
    lines = ["# MagicLamp · 真实 API A/B 效率报告", "",
             f"- 时间: {datetime.now(timezone.utc).isoformat()}",
             f"- Provider: {args.provider} | 模型: {model} | 重复: {args.runs} 次/臂",
             f"- 成功关键词: `{args.expect}` | 输入单价: ${in_price}/1M", "",
             "| 指标 | A 盲启动 | B 交接书 | 改善 |", "|---|---|---|---|"]
    for label, key_ in [("到答轮数", "turns"), ("工具调用次数", "tool_calls"),
                        ("输入 token", "in_tok"), ("输出 token", "out_tok")]:
        am, asd = agg([d[key_] for d in data["A"]])
        bm, bsd = agg([d[key_] for d in data["B"]])
        imp = ((am - bm) / am * 100) if am else 0
        lines.append(f"| {label} | {am:.1f}±{asd:.1f} | {bm:.1f}±{bsd:.1f} | {imp:.1f}% |")
    a_ok = sum(d["ok"] for d in data["A"]) / args.runs * 100
    b_ok = sum(d["ok"] for d in data["B"]) / args.runs * 100
    lines.append(f"| 成功率 | {a_ok:.0f}% | {b_ok:.0f}% | {b_ok - a_ok:+.0f}pp |")
    a_cost = agg([d["in_tok"] for d in data["A"]])[0] * p
    b_cost = agg([d["in_tok"] for d in data["B"]])[0] * p
    lines.append(f"| 输入成本/任务 | ${a_cost:.5f} | ${b_cost:.5f} | "
                 f"{((a_cost - b_cost) / a_cost * 100) if a_cost else 0:.1f}% |")
    lines += ["", "## 原始数据", "```json",
              json.dumps(data, ensure_ascii=False, indent=2), "```"]

    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"[OK] -> {args.out}")


if __name__ == "__main__":
    main()
