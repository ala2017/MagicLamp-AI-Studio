#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MagicLamp AI Project Migration - Dehydration Engine
神灯AI·项目迁移穿梭机 - 零 Token 脱水引擎

Deterministic, LLM-free pipeline. The model NEVER reads raw files to compute
any of the signals below; this script does it locally with glob/git/regex.

Pipeline:
  M1  Shadow Ignorance     - stack detection + multi-eco AI ignore injection
  M2  Bilingual breakpoints + 立体时钟 (Stereo-Clock) conflict arbitration
  M3  DEHYDRATED_CONTEXT.md - secrets laundering + cache-stable static header

Usage:
  python dehydrate.py --root <project_dir> [--apply-ignores] [--out <file>]
  python dehydrate.py --root <project_dir> --signals-only   # JSON signals, no write
"""

import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

STACK_SIGNATURES = {
    "package.json": "Node.js / JavaScript",
    "pnpm-lock.yaml": "Node.js (pnpm)",
    "yarn.lock": "Node.js (yarn)",
    "requirements.txt": "Python",
    "pyproject.toml": "Python",
    "Pipfile": "Python (pipenv)",
    "go.mod": "Go",
    "Cargo.toml": "Rust",
    "pom.xml": "Java (Maven)",
    "build.gradle": "Java/Kotlin (Gradle)",
    "composer.json": "PHP",
    "Gemfile": "Ruby",
    "pubspec.yaml": "Dart/Flutter",
    "CMakeLists.txt": "C/C++ (CMake)",
    ".csproj": "C# / .NET",
}

# Patch block forcibly prepended to every ignore file (top-of-file mandate).
IGNORE_PATCH_HEADER = "# >>> MagicLamp Migration Shadow-Ignorance (auto, keep at top) >>>"
IGNORE_PATCH_FOOTER = "# <<< MagicLamp Migration Shadow-Ignorance <<<"
IGNORE_RULES = [
    ".aider*",
    ".cursor/",
    ".claude/",
    "*.log",
    ".chroma/",
    ".qdrant/",
    "**/__pycache__/",
    "node_modules/",
    ".venv/",
    "venv/",
    "dist/",
    "build/",
    ".next/",
    ".turbo/",
    "*.tmp",
]
# Files belonging to each ecosystem's ignore mechanism.
ECO_IGNORE_FILES = [".gitignore", ".cursorignore", ".aiderignore", ".claudeignore"]

# Bilingual fuzzy discovery buckets (regex over file names, case-insensitive).
DOC_BUCKETS = {
    "requirement": r"(prd|需求|功能|设计说明|requirement|function|design[\s_-]*description)",
    "history": r"(readme|changelog|更新日志|版本|history)",
    "task": r"(task|todo|任务|进度|backlog|roadmap)",
}

# NOTE: re.ASCII forces \w/\b to ASCII so word boundaries do not break on CJK
# text (in Python 3 \w/\b are Unicode-aware by default and treat 中文 as word
# chars, which would wreck the bilingual breakpoint extraction).
STATUS_DONE = re.compile(r"(?<![\w])(done|已完成|完成|merged|closed|已合并)(?![\w])", re.I | re.A)
STATUS_ACTIVE = re.compile(r"(in[\s_-]*progress|进行中|doing|开发中|未完成|todo|待办|wip)", re.I)
IRON_LAW = re.compile(r"(MUST|REQUIRED|SHALL|严禁|必须|禁止|强制)", re.I)
ERROR_SIGNATURE = re.compile(
    r"(error|exception|traceback|failed|panic|报错|错误|异常|fatal|"
    r"\bECONNREFUSED\b|\bENOENT\b|\bNullPointer\b|\bSegfault\b)",
    re.I | re.A,
)
UNCHECKED_BOX = re.compile(r"-\s*\[\s\]")
TODO_MARK = re.compile(r"\b(TODO|FIXME|HACK|XXX|BUG)\b", re.A)

# Standalone secret token patterns (whole match is the secret -> redact group 0).
SECRET_PATTERNS = [
    re.compile(r"sk-ant-[A-Za-z0-9_\-]{16,}"),                # Anthropic (before generic sk-)
    re.compile(r"sk-[A-Za-z0-9]{16,}"),                       # OpenAI-style
    re.compile(r"AKIA[0-9A-Z]{16}"),                          # AWS access key id
    re.compile(r"AIza[0-9A-Za-z\-_]{20,}"),                   # Google
    re.compile(r"gh[posru]_[A-Za-z0-9]{20,}"),                # GitHub tokens
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"),              # Slack
    re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{6,}"),  # JWT
]
# Key/value secret pattern: group(1)=field-name+operator+optional-quote (kept),
# group(2)=the sensitive value (redacted). Preserves config readability.
SECRET_KV = re.compile(
    r"(?i)((?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key)"
    r"\s*[:=]\s*['\"]?)([^\s'\";,]{8,})"
)
HIGH_ENTROPY_TOKEN = re.compile(r"[A-Za-z0-9_\-\+/=]{24,}")

TEXT_READ_LIMIT = 200_000  # bytes per doc; logs/large files are never fully read

# Resume-routing thresholds (deterministic, zero-token).
STALE_DAYS = 14            # snapshot older than this -> recommend re-snapshot
DIRTY_DELTA_WARN = 5       # current dirty files exceed recorded by this -> drift warning

# Coverage gate: if doc-derived breakpoints miss too much real source, or
# reference too many dead paths, auto-inject an ast-built CODE_MAP (free tier).
OMISSION_WARN = 15.0       # % real source files never named in any doc
DRIFT_WARN = 20.0          # % doc-referenced code paths that no longer exist

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def run_git(root, args):
    try:
        out = subprocess.run(
            ["git"] + args,
            cwd=root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=20,
        )
        return out.returncode, out.stdout.strip(), out.stderr.strip()
    except Exception as exc:  # git missing / timeout
        return 1, "", str(exc)


def has_git(root):
    code, out, _ = run_git(root, ["rev-parse", "--is-inside-work-tree"])
    return code == 0 and out.strip() == "true"


def shannon_entropy(s):
    if not s:
        return 0.0
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def sha256_short(s):
    return hashlib.sha256(s.encode("utf-8", "replace")).hexdigest()[:12]


def read_text(path):
    try:
        with open(path, "rb") as fh:
            raw = fh.read(TEXT_READ_LIMIT)
        # utf-8-sig transparently strips a leading BOM (common in Windows/CJK docs).
        return raw.decode("utf-8-sig", "replace")
    except Exception:
        return ""


def iter_files(root):
    """Walk project skipping heavy/ignored dirs (zero-token local glob)."""
    skip = {
        ".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
        ".next", ".turbo", ".chroma", ".qdrant", ".cursor", ".claude", ".idea",
        ".gradle", "target", ".mypy_cache", ".pytest_cache",
    }
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip and not d.startswith(".aider")]
        for fn in filenames:
            yield os.path.join(dirpath, fn)


# --------------------------------------------------------------------------- #
# Module 1: Stack detection + Shadow Ignorance
# --------------------------------------------------------------------------- #


def detect_stack(root):
    found = []
    top = set(os.listdir(root)) if os.path.isdir(root) else set()
    for sig, label in STACK_SIGNATURES.items():
        if sig.startswith("."):  # extension-style signature -> scan top dir
            if any(name.endswith(sig) for name in top):
                found.append(label)
        elif sig in top:
            found.append(label)
    return sorted(set(found)) or ["Unknown / polyglot"]


def inject_ignores(root, apply=False):
    """Force MagicLamp isolation block to the TOP of each eco ignore file."""
    actions = []
    patch_lines = [IGNORE_PATCH_HEADER] + IGNORE_RULES + [IGNORE_PATCH_FOOTER, ""]
    patch_block = "\n".join(patch_lines)

    for name in ECO_IGNORE_FILES:
        path = os.path.join(root, name)
        existing = read_text(path) if os.path.exists(path) else ""
        if IGNORE_PATCH_HEADER in existing:
            actions.append({"file": name, "action": "already-patched"})
            continue
        new_content = patch_block + "\n" + existing if existing else patch_block + "\n"
        if apply:
            try:
                with open(path, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(new_content)
                actions.append({"file": name, "action": "prepended" if existing else "created"})
            except Exception as exc:
                actions.append({"file": name, "action": "error", "detail": str(exc)})
        else:
            actions.append({"file": name, "action": "dry-run-would-prepend" if existing else "dry-run-would-create"})
    return actions


# --------------------------------------------------------------------------- #
# Module 2: Bilingual discovery + Stereo-Clock arbitration
# --------------------------------------------------------------------------- #


def discover_docs(root):
    docs = []
    for path in iter_files(root):
        base = os.path.basename(path)
        if not re.search(r"\.(md|markdown|txt|rst|adoc)$", base, re.I):
            continue
        for bucket, rx in DOC_BUCKETS.items():
            if re.search(rx, base, re.I):
                docs.append({"path": path, "bucket": bucket})
                break
    return docs


def git_file_state(root, rel):
    code, out, _ = run_git(root, ["status", "--porcelain", "--", rel])
    if code != 0:
        return "no-git"
    if not out:
        return "clean"
    flag = out[:2]
    if "?" in flag:
        return "untracked"
    if flag[0] in "MADRC":
        return "staged"
    return "modified"


def git_last_commit_ts(root, rel):
    code, out, _ = run_git(root, ["log", "-n", "1", "--pretty=format:%ct", "--", rel])
    if code == 0 and out.strip().isdigit():
        return int(out.strip())
    return None


def git_hash_object(root, path):
    code, out, _ = run_git(root, ["hash-object", path])
    return out.strip() if code == 0 else None


def analyze_doc(root, doc, git_present):
    path = doc["path"]
    rel = os.path.relpath(path, root)
    text = read_text(path)
    try:
        st = os.stat(path)
        mtime = st.st_mtime
        ctime = st.st_ctime
    except Exception:
        mtime = ctime = 0.0

    state = git_file_state(root, rel) if git_present else "no-git"
    commit_ts = git_last_commit_ts(root, rel) if git_present and state == "clean" else None

    entropy_marks = len(TODO_MARK.findall(text)) + len(UNCHECKED_BOX.findall(text))
    error_hits = len(ERROR_SIGNATURE.findall(text))
    iron_laws = len(IRON_LAW.findall(text))

    return {
        "path": path,
        "rel": rel.replace("\\", "/"),
        "bucket": doc["bucket"],
        "mtime": mtime,
        "mtime_iso": datetime.fromtimestamp(mtime, timezone.utc).isoformat() if mtime else None,
        "ctime": ctime,
        "git_state": state,
        "git_commit_ts": commit_ts,
        "git_hash": git_hash_object(root, path) if state in ("modified", "staged", "untracked") else None,
        "semantic_entropy": entropy_marks,
        "error_signatures": error_hits,
        "iron_laws": iron_laws,
        "has_error": error_hits > 0,
    }


def authority_clock(doc):
    """Effective truth timestamp following Stereo-Clock cascade A/B/C."""
    state = doc["git_state"]
    if state in ("modified", "staged", "untracked"):
        # Plan C: dirty code -> live scene, boosted above committed time.
        return doc["mtime"] + 1.0, "C-dirty"
    if state == "clean" and doc["git_commit_ts"]:
        # Plan A: standard git logical clock.
        return float(doc["git_commit_ts"]), "A-gitlog"
    # Plan B: virtual physical clock (ctime / mtime).
    return max(doc["mtime"], doc["ctime"]), "B-virtual"


def arbitrate(docs_analyzed):
    """Return ranking + confused-zone flag per Module 2.3 / 2.4."""
    enriched = []
    for d in docs_analyzed:
        clk, plan = authority_clock(d)
        e = dict(d)
        e["auth_clock"] = clk
        e["auth_plan"] = plan
        enriched.append(e)

    enriched.sort(
        key=lambda x: (x["auth_clock"], x["semantic_entropy"], x["error_signatures"], x["rel"]),
        reverse=True,
    )

    confused = False
    confused_pair = []
    if len(enriched) >= 2:
        a, b = enriched[0], enriched[1]
        dt = abs(a["auth_clock"] - b["auth_clock"])
        # < 24h on the authority clock AND no git authority AND entropy tie => deadlock risk
        within_24h = dt < 24 * 3600
        no_git_auth = a["auth_plan"].startswith("B") and b["auth_plan"].startswith("B")
        entropy_tie = (
            a["semantic_entropy"] == b["semantic_entropy"]
            and a["error_signatures"] == b["error_signatures"]
        )
        if within_24h and no_git_auth and entropy_tie:
            confused = True
            confused_pair = [a["rel"], b["rel"]]

    return enriched, confused, confused_pair


# --------------------------------------------------------------------------- #
# Module 3: Secrets laundering + breakpoint extraction
# --------------------------------------------------------------------------- #


def launder_secrets(text):
    """Replace any secret-like substring with a stable SHA256 placeholder."""
    redactions = 0

    def repl_pattern(m):
        nonlocal redactions
        redactions += 1
        token = m.group(0)
        return f"[REDACTED_SECRET_HASH_SHA256:{sha256_short(token)}]"

    out = text
    for rx in SECRET_PATTERNS:
        out = rx.sub(repl_pattern, out)

    # Key/value form: keep the field name + operator, redact only the value.
    def repl_kv(m):
        nonlocal redactions
        if "REDACTED_SECRET_HASH" in m.group(2):
            return m.group(0)  # value already laundered by a standalone pattern
        redactions += 1
        return f"{m.group(1)}[REDACTED_SECRET_HASH_SHA256:{sha256_short(m.group(2))}]"

    out = SECRET_KV.sub(repl_kv, out)

    # Generic high-entropy fallback (skip already-redacted markers).
    def repl_entropy(m):
        nonlocal redactions
        tok = m.group(0)
        if "REDACTED_SECRET_HASH" in tok:
            return tok
        if shannon_entropy(tok) >= 4.0:
            redactions += 1
            return f"[REDACTED_SECRET_HASH_SHA256:{sha256_short(tok)}]"
        return tok

    out = HIGH_ENTROPY_TOKEN.sub(repl_entropy, out)
    return out, redactions


def extract_breakpoints(doc):
    """Convert doc lines into symbolic atomic breakpoints (no code blocks)."""
    text = read_text(doc["path"])
    text, _ = launder_secrets(text)
    out = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        keep = False
        tag = None
        if STATUS_DONE.search(line):
            tag = "[DONE]"
            keep = True
        elif STATUS_ACTIVE.search(line) or UNCHECKED_BOX.search(line):
            tag = "[ACTIVE_BREAKPOINT]"
            keep = True
        if IRON_LAW.search(line):
            tag = (tag + " [IRON_LAW]") if tag else "[IRON_LAW]"
            keep = True
        if not keep:
            continue
        # Strip markdown noise; keep symbolic atom only.
        atom = re.sub(r"[`*#>_\-\[\]]+", " ", line).strip()
        atom = re.sub(r"\s+", " ", atom)[:200]
        if atom:
            out.append(f"{tag} {atom}")
    # de-dup preserving order
    seen, uniq = set(), []
    for a in out:
        if a not in seen:
            seen.add(a)
            uniq.append(a)
    return uniq[:60]


# --------------------------------------------------------------------------- #
# git status high-light region (Security)
# --------------------------------------------------------------------------- #


def git_status_summary(root, git_present):
    if not git_present:
        return {"present": False, "lines": []}
    code, out, _ = run_git(root, ["status", "--porcelain"])
    all_lines = [l for l in out.splitlines() if l.strip()] if code == 0 else []
    code2, branch, _ = run_git(root, ["rev-parse", "--abbrev-ref", "HEAD"])
    return {
        "present": True,
        "branch": branch if code2 == 0 else "?",
        "dirty_count": len(all_lines),   # true total, not capped by display slice
        "lines": all_lines[:50],         # display cap only
    }


# --------------------------------------------------------------------------- #
# Output: DEHYDRATED_CONTEXT.md (cache-stable static header)
# --------------------------------------------------------------------------- #

STATIC_SCHEMA_VERSION = "1.0"


def build_dehydrated(root, stack, ignore_actions, ranking, confused, confused_pair,
                     git_summary, breakpoints_by_doc, code_map=None, audit=None):
    L = []
    # ---- STATIC HEADER (zero-variance, fully cacheable) ---------------------
    L.append("# DEHYDRATED_CONTEXT")
    L.append("")
    L.append(f"SCHEMA_VERSION: {STATIC_SCHEMA_VERSION}")
    L.append("GENERATOR: MagicLamp-AI-Project-Migration")
    L.append("CONTRACT: absolute-anchor-only | no-source-copy | secrets-laundered")
    L.append("")

    if confused:
        L.append("## [CRITICAL_CONFUSED_ZONE]")
        L.append("> Auto-arbitration deadlock (Plan-B semantic-entropy tie, <24h).")
        L.append("> Defer truth selection to the high-performance model + code reality.")
        for rel in confused_pair:
            L.append(f"- CONFLICT_SOURCE: {rel}")
        for d in ranking:
            if d["rel"] in confused_pair:
                for bp in breakpoints_by_doc.get(d["rel"], [])[:6]:
                    L.append(f"  - {bp}")
        L.append("")

    L.append("## 1. STACK")
    L.append(f"- detected: {', '.join(stack)}")
    L.append("")

    L.append("## 2. TRUTH_SOURCE_RANKING (Stereo-Clock)")
    L.append("| rank | doc | bucket | plan | git_state | entropy | err |")
    L.append("|------|-----|--------|------|-----------|---------|-----|")
    for i, d in enumerate(ranking, 1):
        L.append(f"| {i} | {d['rel']} | {d['bucket']} | {d['auth_plan']} | "
                 f"{d['git_state']} | {d['semantic_entropy']} | {d['error_signatures']} |")
    L.append("")

    L.append("## 3. ATOMIC_BREAKPOINTS")
    for d in ranking:
        bps = breakpoints_by_doc.get(d["rel"], [])
        if not bps:
            continue
        L.append(f"### {d['rel']}")
        for bp in bps:
            L.append(f"- {bp}")
        L.append("")

    # ---- AUTO-AUGMENT (conditional): ast-built real file tree + signatures ----
    # Emitted only when doc coverage fails the gate, so doc-only snapshots stay
    # byte-stable. This is the missing code anchor the model needs to avoid an
    # exploration storm when breakpoints describe "what" but not "where".
    if code_map:
        L.append("## 3b. CODE_MAP (auto-augment: doc coverage below gate)")
        if audit:
            L.append(
                f"> Trigger: omission {audit.get('omission_pct')}% "
                f"(gate {OMISSION_WARN}%) / drift {audit.get('drift_pct')}% "
                f"(gate {DRIFT_WARN}%). Real file tree + signatures injected "
                f"(ast, zero source copied)."
            )
        L.append("> Anchors are file paths + class/def names only; no source bodies.")
        L.append("")
        L.append(code_map)
        L.append("")

    L.append("## 4. GIT_HIGHLIGHT_ZONE")
    if git_summary["present"]:
        L.append(f"- branch: {git_summary['branch']} | dirty_files: {git_summary['dirty_count']}")
        for ln in git_summary["lines"]:
            L.append(f"  - `{ln}`")
    else:
        L.append("- no-git environment (Plan-B virtual clock used)")
    L.append("")

    L.append("## 5. SHADOW_IGNORANCE")
    for a in ignore_actions:
        L.append(f"- {a['file']}: {a['action']}")
    L.append("")

    L.append("## 6. TARGET_TOOL_INIT")
    L.append("- See references/adaptive_matrix.md and append the matching Sub-ruleset here.")
    L.append("")

    # ---- VOLATILE TAIL (kept last so it never breaks prompt cache) ----------
    L.append("---")
    L.append("## VOLATILE_METADATA (non-cache zone, keep last)")
    L.append(f"- generated_at: {datetime.now(timezone.utc).isoformat()}")
    L.append(f"- root: {os.path.abspath(root)}")
    L.append("")
    L.append("[TERMINATE_SESSION]")
    return "\n".join(L)


# --------------------------------------------------------------------------- #
# Detect mode: zero-token routing between Snapshot and Resume flows
# --------------------------------------------------------------------------- #


def detect_snapshot(root, out_name, git_present):
    """Decide Snapshot vs Resume and surface freshness/drift (deterministic).

    Returns a JSON-able dict consumed by SKILL.md to pick the flow without
    spending any model tokens on reading the project.
    """
    path = os.path.join(root, out_name)
    result = {
        "root": root,
        "snapshot_exists": os.path.exists(path),
        "snapshot_path": path,
        "recommended_flow": "snapshot",   # default when no doc present
        "reasons": [],
    }

    if not result["snapshot_exists"]:
        result["reasons"].append("no DEHYDRATED_CONTEXT.md -> first-time Snapshot")
        result["action_hint"] = (
            "Prompt user to switch to a LOW-COST model first, then run the "
            "Snapshot pipeline (dehydrate.py --apply-ignores)."
        )
        return result

    text = read_text(path)

    # generated_at age
    age_days = None
    m = re.search(r"generated_at:\s*([0-9T:\-\.\+]+)", text)
    if m:
        try:
            gen = datetime.fromisoformat(m.group(1))
            if gen.tzinfo is None:
                gen = gen.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - gen).total_seconds() / 86400.0
        except Exception:
            age_days = None
    result["age_days"] = round(age_days, 2) if age_days is not None else None

    # recorded dirty count vs current
    recorded = None
    m2 = re.search(r"dirty_files:\s*(\d+)", text)
    if m2:
        recorded = int(m2.group(1))
    current = git_status_summary(root, git_present)["dirty_count"] if git_present else None
    result["recorded_dirty"] = recorded
    result["current_dirty"] = current
    drift = (current - recorded) if (recorded is not None and current is not None) else None
    result["dirty_delta"] = drift

    stale = age_days is not None and age_days > STALE_DAYS
    drifted = drift is not None and drift > DIRTY_DELTA_WARN

    if stale:
        result["reasons"].append(f"snapshot is stale (> {STALE_DAYS}d)")
    if drifted:
        result["reasons"].append(f"git drift +{drift} files (> {DIRTY_DELTA_WARN})")

    if stale or drifted:
        result["recommended_flow"] = "resume_then_resnapshot"
        result["action_hint"] = (
            "Run Resume (adapt + read DEHYDRATED_CONTEXT.md), then recommend the "
            "user re-run /migrate to refresh the snapshot before deep work."
        )
    else:
        result["recommended_flow"] = "resume"
        result["reasons"].append("snapshot fresh + no significant drift")
        result["action_hint"] = (
            "Run Resume: execute Section 6 tool-init, then read Sections 1-5 to "
            "rebuild context. Do NOT re-run breakpoint arbitration."
        )
    return result


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #


def main():
    ap = argparse.ArgumentParser(description="MagicLamp Migration Dehydration Engine")
    ap.add_argument("--root", default=".", help="Project root directory")
    ap.add_argument("--apply-ignores", action="store_true",
                    help="Actually write the AI ignore files (default: dry-run)")
    ap.add_argument("--out", default="DEHYDRATED_CONTEXT.md", help="Output file name")
    ap.add_argument("--signals-only", action="store_true",
                    help="Print JSON signals and exit (no file written)")
    ap.add_argument("--detect", action="store_true",
                    help="Route Snapshot vs Resume: print JSON decision and exit")
    ap.add_argument("--no-code-map", action="store_true",
                    help="Disable the ast-based CODE_MAP coverage augment")
    args = ap.parse_args()

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print(f"ERROR: root not found: {root}", file=sys.stderr)
        sys.exit(2)

    git_present = has_git(root)

    if args.detect:
        print(json.dumps(detect_snapshot(root, args.out, git_present),
                         ensure_ascii=False, indent=2))
        return

    stack = detect_stack(root)
    ignore_actions = inject_ignores(root, apply=args.apply_ignores)
    raw_docs = discover_docs(root)
    analyzed = [analyze_doc(root, d, git_present) for d in raw_docs]
    ranking, confused, confused_pair = arbitrate(analyzed)
    git_summary = git_status_summary(root, git_present)
    breakpoints_by_doc = {d["rel"]: extract_breakpoints(d) for d in ranking}

    # Coverage gate (deterministic, repo-grounded). When doc-derived breakpoints
    # miss too much real source, inject an ast-built CODE_MAP so the model gets
    # the "where" anchors, not just the "what".
    audit_info = None
    code_map = None
    if not args.no_code_map:
        try:
            from build_project_map import coverage_audit, build_map, render_map_md
            audit_info = coverage_audit(root)
            if (audit_info["omission_pct"] > OMISSION_WARN
                    or audit_info["drift_pct"] > DRIFT_WARN):
                code_map = render_map_md(build_map(root))
        except Exception as exc:
            print(f"[warn] code-map augment skipped: {exc}", file=sys.stderr)

    if args.signals_only:
        print(json.dumps({
            "root": root,
            "git_present": git_present,
            "stack": stack,
            "ignore_actions": ignore_actions,
            "ranking": [
                {k: v for k, v in d.items() if k != "path"} for d in ranking
            ],
            "confused": confused,
            "confused_pair": confused_pair,
            "git_summary": git_summary,
            "coverage_audit": audit_info,
            "code_map_injected": bool(code_map),
        }, ensure_ascii=False, indent=2))
        return

    content = build_dehydrated(
        root, stack, ignore_actions, ranking, confused, confused_pair,
        git_summary, breakpoints_by_doc, code_map=code_map, audit=audit_info,
    )
    out_path = os.path.join(root, args.out)
    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)

    print(f"[OK] stack={stack}")
    print(f"[OK] docs_discovered={len(raw_docs)} confused_zone={confused}")
    if audit_info:
        print(f"[OK] coverage: omission={audit_info['omission_pct']}% "
              f"drift={audit_info['drift_pct']}% code_map_injected={bool(code_map)}")
    print(f"[OK] ignore_files: " + ", ".join(f"{a['file']}={a['action']}" for a in ignore_actions))
    print(f"[OK] wrote {out_path}")


if __name__ == "__main__":
    main()
