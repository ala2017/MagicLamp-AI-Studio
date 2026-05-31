#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MagicLamp Migration - Real API A/B Runner (efficiency metrics)
真实 API 双臂对比 runner(轮数 / 成功率 / 实测 usage)

This is the rigorous half of the evaluation. It actually drives a model
through a "resume this half-finished project" task under two arms:

  Arm A (baseline/blind): no handoff doc. The agent must discover state by
         reading files with tools -> more turns, more input tokens.
  Arm B (MagicLamp): DEHYDRATED_CONTEXT.md is provided up front -> the agent
         should answer in fewer turns with far fewer input tokens.

Both arms get the SAME tools (list_dir, read_file) and the SAME question.
We log per-turn usage from the API `usage` field, count tool calls/turns,
and score success against an expected keyword. Repeats N times, reports
mean +/- spread, and writes evaluation/AB_REPORT.md.

Requires:  pip install anthropic   and   $env:ANTHROPIC_API_KEY
Usage:
  python ab_runner.py --root <PROJECT_ROOT> --expect "支付" \
                      --model claude-sonnet-4-5 --runs 5
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

TOOLS = [
    {"name": "list_dir", "description": "列出目录下的文件与子目录",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string", "description": "相对项目根的路径,根用 '.'"}},
         "required": ["path"]}},
    {"name": "read_file", "description": "读取文本文件内容",
     "input_schema": {"type": "object", "properties": {
         "path": {"type": "string"}}, "required": ["path"]}},
]

JUNK = {"node_modules", ".git", ".venv", "dist", "build", "__pycache__", ".next"}


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


def run_arm(client, model, root, arm, doc_text):
    """Returns dict with turns, tool_calls, in_tok, out_tok, ok, answer."""
    user_content = QUESTION
    if arm == "B" and doc_text:
        user_content = (f"<迁移交接书 DEHYDRATED_CONTEXT.md>\n{doc_text}\n"
                        f"</迁移交接书>\n\n{QUESTION}")
    messages = [{"role": "user", "content": user_content}]
    turns, tool_calls, in_tok, out_tok = 0, 0, 0, 0
    answer = ""
    for _ in range(12):  # max turns guard
        turns += 1
        resp = client.messages.create(
            model=model, max_tokens=1024, system=SYSTEM,
            tools=TOOLS, messages=messages)
        in_tok += resp.usage.input_tokens
        out_tok += resp.usage.output_tokens
        tool_results = []
        for block in resp.content:
            if block.type == "text":
                answer += block.text
            elif block.type == "tool_use":
                tool_calls += 1
                rel = block.input.get("path", ".")
                if block.name == "list_dir":
                    res = tool_list_dir(root, rel)
                else:
                    res = tool_read_file(root, rel)
                tool_results.append({"type": "tool_result",
                                     "tool_use_id": block.id, "content": res[:8000]})
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason == "tool_use":
            messages.append({"role": "user", "content": tool_results})
            continue
        break
    return {"turns": turns, "tool_calls": tool_calls,
            "in_tok": in_tok, "out_tok": out_tok, "answer": answer.strip()}


def agg(vals):
    return (statistics.mean(vals),
            statistics.pstdev(vals) if len(vals) > 1 else 0.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--expect", required=True,
                    help="success keyword expected in the answer (e.g. 支付)")
    ap.add_argument("--model", default="claude-sonnet-4-5")
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--in-price", type=float, default=3.0)
    ap.add_argument("--out", default=os.path.join(HERE, "AB_REPORT.md"))
    args = ap.parse_args()

    try:
        import anthropic
    except ImportError:
        sys.exit("[err] pip install anthropic")
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("[err] set $env:ANTHROPIC_API_KEY")
    client = anthropic.Anthropic(api_key=key)

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
            r = run_arm(client, args.model, root, arm, doc_text)
            r["ok"] = args.expect in r["answer"]
            data[arm].append(r)
            print(f"run {i+1} arm {arm}: turns={r['turns']} tools={r['tool_calls']} "
                  f"in={r['in_tok']} out={r['out_tok']} ok={r['ok']}")

    p = args.in_price / 1_000_000
    lines = ["# MagicLamp · 真实 API A/B 效率报告", "",
             f"- 时间: {datetime.now(timezone.utc).isoformat()}",
             f"- 模型: {args.model} | 重复: {args.runs} 次/臂 | 成功关键词: `{args.expect}`",
             f"- 输入单价: ${args.in_price}/1M", "",
             "| 指标 | A 盲启动 | B 交接书 | 改善 |", "|---|---|---|---|"]
    rows = [("到答轮数", "turns"), ("工具调用次数", "tool_calls"),
            ("输入 token", "in_tok"), ("输出 token", "out_tok")]
    for label, key_ in rows:
        am, asd = agg([d[key_] for d in data["A"]])
        bm, bsd = agg([d[key_] for d in data["B"]])
        imp = ((am - bm) / am * 100) if am else 0
        lines.append(f"| {label} | {am:.1f}±{asd:.1f} | {bm:.1f}±{bsd:.1f} | {imp:.1f}% |")
    a_ok = sum(d["ok"] for d in data["A"]) / args.runs * 100
    b_ok = sum(d["ok"] for d in data["B"]) / args.runs * 100
    lines.append(f"| 成功率 | {a_ok:.0f}% | {b_ok:.0f}% | {b_ok - a_ok:+.0f}pp |")
    a_cost = agg([d["in_tok"] for d in data["A"]])[0] * p
    b_cost = agg([d["in_tok"] for d in data["B"]])[0] * p
    lines.append(f"| 输入成本/任务 | ${a_cost:.4f} | ${b_cost:.4f} | "
                 f"{((a_cost - b_cost) / a_cost * 100) if a_cost else 0:.1f}% |")
    lines += ["", "## 原始数据", "```json",
              json.dumps(data, ensure_ascii=False, indent=2), "```"]

    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"[OK] -> {args.out}")


if __name__ == "__main__":
    main()
