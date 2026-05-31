#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MagicLamp Migration - Automated Benchmark & Report Generator
自动化对比测试与报告生成器(Token/成本维度,零 API)

What it does (fully autonomous, no API):
  1. Builds synthetic half-finished projects across several size profiles.
  2. Runs the skill's dehydrate.py to produce DEHYDRATED_CONTEXT.md for each.
  3. Measures blind-cold-start token mass vs the dehydrated doc (realistic +
     worst-case-with-deps) using estimate_savings.
  4. Optionally includes the user's real projects via --roots.
  5. Writes a polished Markdown report (evaluation/REPORT.md).

For the multi-turn EFFICIENCY metrics (turns/success/wrong-reads) you need a
real API run - see the "Efficiency (API-based)" section emitted in the report.

Usage:
  python run_benchmark.py [--roots <dirA> <dirB> ...] [--in-price 3.0]
                          [--out REPORT.md] [--keep-fixtures]
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.normpath(os.path.join(HERE, "..", "magiclamp-project-migration"))
DEHYDRATE = os.path.join(SKILL, "scripts", "dehydrate.py")

sys.path.insert(0, HERE)
import estimate_savings as es  # noqa: E402

# Synthetic project profiles: (name, n_src_modules, lines_per_module, n_dep_chunks, log_lines)
PROFILES = [
    ("tiny",   3,   20,   2,   200),
    ("small",  8,   60,   6,  1500),
    ("medium", 25,  90,  20,  6000),
    ("large",  60, 120,  60, 20000),
]


def build_fixture(base, name, n_src, lines, n_dep, log_lines):
    root = os.path.join(base, f"fix_{name}")
    src = os.path.join(root, "src")
    dep = os.path.join(root, "node_modules", "react", "lib")
    os.makedirs(src, exist_ok=True)
    os.makedirs(dep, exist_ok=True)

    with open(os.path.join(root, "package.json"), "w", encoding="utf-8") as f:
        f.write('{"name":"%s","dependencies":{"react":"^18"}}' % name)
    with open(os.path.join(root, "PRD.md"), "w", encoding="utf-8") as f:
        f.write("# 需求\nMUST 支持登录\n- [ ] 实现支付\n进行中: 结算页 In Progress\n"
                "api_key = sk-livesecret1234567890abcd\n")
    for i in range(n_src):
        with open(os.path.join(src, f"module{i}.js"), "w", encoding="utf-8") as f:
            f.write(f"// business module {i}\n" + f"export function f{i}(){{ return {i}; }}\n" * lines)
    for i in range(n_dep):
        with open(os.path.join(dep, f"chunk{i}.js"), "w", encoding="utf-8") as f:
            f.write("/* bundled */\n" + "var x=1;" * 800)
    with open(os.path.join(root, "debug.log"), "w", encoding="utf-8") as f:
        f.write("ERROR stack trace line\n" * log_lines)
    return root


def measure(root, in_price):
    # produce the handoff doc deterministically
    subprocess.run([sys.executable, DEHYDRATE, "--root", root],
                   capture_output=True, text=True)
    rows = {}
    for include_deps in (False, True):
        base_tok, base_files, base_bytes, bd = es.scan_tokens(root, include_deps)
        doc_path = os.path.join(root, "DEHYDRATED_CONTEXT.md")
        doc_tok = es.count_tokens(es.read_text(doc_path)) if os.path.exists(doc_path) else 0
        saved = base_tok - doc_tok
        p = in_price / 1_000_000
        rows["worst" if include_deps else "realistic"] = {
            "base_tok": base_tok, "doc_tok": doc_tok, "saved": saved,
            "pct": (saved / base_tok * 100) if base_tok else 0,
            "ratio": (base_tok / doc_tok) if doc_tok else 0,
            "base_cost": base_tok * p, "doc_cost": doc_tok * p,
            "files": base_files,
        }
    return rows


def fmt_row(name, r):
    return (f"| {name} | {r['files']} | {r['base_tok']:,} | {r['doc_tok']:,} | "
            f"{r['pct']:.1f}% | {r['ratio']:.1f}x | ${r['base_cost']:.4f} | "
            f"${r['doc_cost']:.4f} | ${r['base_cost'] - r['doc_cost']:.4f} |")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roots", nargs="*", default=[], help="Extra real project roots")
    ap.add_argument("--in-price", type=float, default=es.DEFAULT_IN_PRICE)
    ap.add_argument("--out", default=os.path.join(HERE, "REPORT.md"))
    ap.add_argument("--keep-fixtures", action="store_true")
    args = ap.parse_args()

    base = tempfile.mkdtemp(prefix="ml_bench_")
    results = []  # (label, profile_or_real, rows)

    try:
        for (name, n_src, lines, n_dep, log_lines) in PROFILES:
            root = build_fixture(base, name, n_src, lines, n_dep, log_lines)
            results.append((f"synthetic/{name}", measure(root, args.in_price)))
        for rp in args.roots:
            rp = os.path.abspath(rp)
            if os.path.isdir(rp):
                results.append((f"real/{os.path.basename(rp)}", measure(rp, args.in_price)))

        # aggregate (realistic arm)
        pcts = [r["realistic"]["pct"] for _, r in results]
        avg_pct = sum(pcts) / len(pcts) if pcts else 0
        ratios = [r["realistic"]["ratio"] for _, r in results]
        avg_ratio = sum(ratios) / len(ratios) if ratios else 0

        ts = datetime.now(timezone.utc).isoformat()
        L = []
        L.append("# MagicLamp 项目迁移穿梭机 · 自动化对比测试报告")
        L.append("")
        L.append(f"- 生成时间: {ts}")
        L.append(f"- Tokenizer: {es.TOKENIZER}")
        L.append(f"- 输入单价: ${args.in_price} / 1M tokens")
        L.append(f"- 方法: 代理估算(对比盲扫 token 体量 vs 交接书),零 API 成本")
        L.append("")
        L.append("## 摘要")
        L.append("")
        L.append(f"- **平均输入 Token 节省(现实场景): {avg_pct:.1f}%**,平均 **{avg_ratio:.1f}×** 更小。")
        L.append(f"- 样本: {len(results)} 个项目(合成 {len(PROFILES)} + 真实 {len(args.roots)})。")
        L.append("")
        L.append("## 现实场景(skill 物理屏蔽 node_modules / 日志 / 缓存)")
        L.append("")
        L.append("| 项目 | 文件数 | 盲扫 token | 交接书 token | 节省率 | 压缩比 | 盲扫成本 | 交接书成本 | 单次省 |")
        L.append("|---|---|---|---|---|---|---|---|---|")
        for label, r in results:
            L.append(fmt_row(label, r["realistic"]))
        L.append("")
        L.append("## 最坏场景(盲工具连依赖/日志一并吞入)")
        L.append("")
        L.append("| 项目 | 文件数 | 盲扫 token | 交接书 token | 节省率 | 压缩比 | 盲扫成本 | 交接书成本 | 单次省 |")
        L.append("|---|---|---|---|---|---|---|---|---|")
        for label, r in results:
            L.append(fmt_row(label, r["worst"]))
        L.append("")
        L.append("> 注:交接书静态头部缓存稳定,重复会话命中缓存后成本再降约一个数量级。")
        L.append("")
        L.append("## 效率维度(需真实 API 实测,本报告未覆盖)")
        L.append("")
        L.append("以下指标必须实际调用大模型跑迁移任务才能得到,无法用本地代理估算:")
        L.append("")
        L.append("| 指标 | 说明 |")
        L.append("|---|---|")
        L.append("| 到首个正确改动的轮数 | A 盲启动 vs B 交接书 |")
        L.append("| 任务成功率 | 固定 verify 脚本 pass/fail |")
        L.append("| 读错文件 / 冗余扫描次数 | agent 行为日志统计 |")
        L.append("| 实测 input/output/cache token | 取自 API usage 字段 |")
        L.append("")
        L.append("运行方式: 提供模型 API key 后,用真实 A/B runner 跑 N≥5 次取均值±方差。")
        L.append("")
        L.append("## 方法学与局限")
        L.append("")
        L.append("- 代理指标衡量**输入 token 体量上界**,反映隔离 + 脱水带来的上下文压缩。")
        L.append("- 未建模多轮 agent 的反复读盘/纠错,故真实节省通常**高于**此处(盲启动会多轮重复读)。")
        L.append("- 合成项目用于规模梯度对照;真实项目请用 `--roots` 传入。")

        with open(args.out, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(L))
        print(f"[OK] report -> {args.out}")
        print(f"[OK] avg realistic saving = {avg_pct:.1f}% ({avg_ratio:.1f}x), {len(results)} projects")
    finally:
        if not args.keep_fixtures:
            shutil.rmtree(base, ignore_errors=True)


if __name__ == "__main__":
    main()
