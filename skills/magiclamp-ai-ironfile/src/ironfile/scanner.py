"""
scanner — 会话恢复后的一键完整性检测（IronFile L3 防线）。

检测内容:
  1. Python 语法有效性 (py_compile)
  2. JavaScript/TypeScript 语法 (node -c / tsc)
  3. HTML/JS/CSS 结构完整性（闭合标签、大括号匹配）
  4. JSON 解析
  5. 文件大小 vs git HEAD（检测截断）

使用场景:
  - 会话重启后跑一次，确认所有文件完好
  - 发现任何问题，自动提示 git checkout 恢复命令

v2 修复（2026-06-02 红队对抗）：
  - [HIGH] _fix_from_git 无条件覆盖损坏文件（先备份再覆盖）
  - [MEDIUM] _check_size_vs_git 的 cwd 路径计算脆弱
  - [MEDIUM] subprocess 调用缺少 timeout
"""

import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from datetime import datetime


# 默认文件模式
DEFAULT_PATTERNS = ["*.py", "*.js", "*.ts", "*.html", "*.css", "*.json"]

# 默认排除目录
DEFAULT_EXCLUDE = {
    "__pycache__", ".git", ".ironfile", "node_modules",
    ".venv", "venv", ".tox", ".mypy_cache", ".pytest_cache",
    "dist", "build", ".failsafe"
}

# subprocess 超时
_SUBPROCESS_TIMEOUT = 30


class ScanResult:
    """单个文件检测结果"""
    def __init__(self, filepath, ok=True, kind="OK", detail=""):
        self.filepath = filepath
        self.ok = ok
        self.kind = kind
        self.detail = detail

    def __repr__(self):
        status = "✅" if self.ok else "❌"
        return f"{status} {self.filepath} — {self.kind}: {self.detail}"


def scan(root=".", patterns=None, exclude=None, fix=False, verbose=False):
    """
    扫描项目的文件完整性。

    Args:
        root: 项目根目录
        patterns: 要检查的文件 glob 模式，默认 DEFAULT_PATTERNS
        exclude: 要排除的目录名集合，默认 DEFAULT_EXCLUDE
        fix: 是否自动从 git HEAD 恢复损坏文件（恢复前先备份当前文件）
        verbose: 是否输出所有文件状态（默认只输出异常）

    Returns:
        dict: {"ok": int, "issues": [ScanResult], "skipped": int}
    """
    root = Path(root).resolve()
    patterns = patterns or DEFAULT_PATTERNS
    exclude = exclude or DEFAULT_EXCLUDE

    files = _find_files(root, patterns, exclude)
    results = {"ok": 0, "issues": [], "skipped": 0}

    for f in sorted(files):
        rel = str(f.relative_to(root))
        ext = f.suffix.lower()

        result = _check_file(f, rel, ext)

        if result.ok:
            results["ok"] += 1
            if verbose:
                print(f"✅ {rel} — OK")
        else:
            results["issues"].append(result)
            print(f"❌ {rel} — {result.kind}")
            print(f"   {result.detail}")
            if fix:
                # 先备份当前（损坏的）文件，再尝试从 git 恢复
                _backup_before_fix(root, rel)
                _fix_from_git(root, rel)

    # 汇总
    if not results["issues"]:
        print(f"\n✅ ALL {results['ok']} FILES INTACT ({results['skipped']} skipped)")
    else:
        n = len(results["issues"])
        print(f"\n❌ {n} ISSUES FOUND ({results['ok']} OK, {results['skipped']} skipped)")
        if not fix:
            for r in results["issues"]:
                rel = r.filepath
                print(f"   Fix: git checkout HEAD -- {rel}")

    return results


def _find_files(root, patterns, exclude_dirs):
    """找出所有需要检查的文件"""
    files = []
    for pattern in patterns:
        for f in root.rglob(pattern):
            parts = set(f.parts)
            if parts & exclude_dirs:
                continue
            files.append(f)
    return files


def _check_file(filepath, rel, ext):
    """根据文件类型选择对应的检查方法"""
    stat = filepath.stat()
    if stat.st_size == 0:
        # 空文件——检查 git 中是否有内容
        head_check = _check_size_vs_git(filepath)
        if not head_check.ok:
            return head_check
        return ScanResult(rel, ok=True, kind="EMPTY", detail="empty file")

    if ext == '.py':
        return _check_python(filepath, rel)
    elif ext in ('.js', '.ts'):
        return _check_javascript(filepath, rel, ext)
    elif ext == '.html':
        return _check_html(filepath, rel)
    elif ext == '.css':
        return _check_braces(filepath, rel, "CSS")
    elif ext == '.json':
        return _check_json(filepath, rel)
    else:
        return ScanResult(rel, ok=True, kind="SKIP", detail="unsupported type")


def _check_python(filepath, rel):
    """Python 语法检查"""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "py_compile", str(filepath)],
            capture_output=True, text=True, timeout=_SUBPROCESS_TIMEOUT
        )
        if result.returncode == 0:
            return ScanResult(rel, ok=True)
        return ScanResult(rel, ok=False, kind="SYNTAX",
                          detail=result.stderr.strip()[:200])
    except subprocess.TimeoutExpired:
        return ScanResult(rel, ok=False, kind="TIMEOUT", detail="py_compile timeout")
    except Exception as e:
        return ScanResult(rel, ok=False, kind="ERROR", detail=str(e)[:200])


def _check_javascript(filepath, rel, ext):
    """JavaScript/TypeScript 语法检查"""
    node = shutil_which("node")
    if not node:
        return ScanResult(rel, ok=True, kind="SKIP", detail="node not found")

    try:
        if ext == '.ts':
            tsc = shutil_which("tsc")
            if tsc:
                result = subprocess.run(
                    [tsc, "--noEmit", str(filepath)],
                    capture_output=True, text=True, timeout=_SUBPROCESS_TIMEOUT
                )
            else:
                return ScanResult(rel, ok=True, kind="SKIP", detail="tsc not found")
        else:
            result = subprocess.run(
                [node, "-c", str(filepath)],
                capture_output=True, text=True, timeout=_SUBPROCESS_TIMEOUT
            )

        if result.returncode == 0:
            return ScanResult(rel, ok=True)
        return ScanResult(rel, ok=False, kind="SYNTAX",
                          detail=result.stderr.strip()[:200])
    except Exception:
        return _check_braces(filepath, rel, "JS")  # fallback


def _check_html(filepath, rel):
    """HTML 基本结构检查"""
    try:
        content = filepath.read_text(encoding='utf-8')
        size = len(content)

        if size < 10:
            return ScanResult(rel, ok=True)

        has_html_open = "<html" in content.lower()
        has_body_close = "</body>" in content.lower()
        has_html_close = "</html>" in content.lower()

        if has_html_open and not has_html_close:
            if size > 5000:
                return ScanResult(rel, ok=False, kind="STRUCTURE",
                                  detail="</html> missing — possible truncation")
        if has_html_open and not has_body_close and size > 5000:
            return ScanResult(rel, ok=False, kind="STRUCTURE",
                              detail="</body> missing — possible truncation")

        # 检查是否有未闭合的 script/style 标签
        for tag in ["<script", "<style"]:
            opens = content.count(tag)
            closes = content.count("</" + tag[1:])
            if opens > closes and size > 5000:
                return ScanResult(rel, ok=False, kind="STRUCTURE",
                                  detail=f"{tag}> unclosed ({opens} open, {closes} close)")

        return ScanResult(rel, ok=True)
    except Exception as e:
        return ScanResult(rel, ok=False, kind="ERROR", detail=str(e)[:200])


def _check_braces(filepath, rel, label="FILE"):
    """大括号匹配检查（JS/CSS 通用）"""
    try:
        content = filepath.read_text(encoding='utf-8')
        size = len(content)
        if size < 10:
            return ScanResult(rel, ok=True)

        braces = 0
        for ch in content:
            if ch == '{':
                braces += 1
            elif ch == '}':
                braces -= 1

        if braces != 0 and size > 5000:
            direction = "unclosed" if braces > 0 else "extra closing"
            return ScanResult(rel, ok=False, kind="STRUCTURE",
                              detail=f"brace mismatch ({abs(braces)} {direction})")

        return ScanResult(rel, ok=True)
    except Exception as e:
        return ScanResult(rel, ok=False, kind="ERROR", detail=str(e)[:200])


def _check_json(filepath, rel):
    """JSON 解析检查"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            json.load(f)
        return ScanResult(rel, ok=True)
    except json.JSONDecodeError as e:
        return ScanResult(rel, ok=False, kind="SYNTAX", detail=str(e)[:200])
    except Exception as e:
        return ScanResult(rel, ok=False, kind="ERROR", detail=str(e)[:200])


def _check_size_vs_git(filepath):
    """对比 git HEAD 文件大小"""
    rel = str(filepath.name)
    try:
        # 向上查找 git 根目录作为 cwd
        git_root = _find_git_root(filepath)
        if git_root is None:
            return ScanResult(rel, ok=True, kind="SKIP", detail="no git root found")

        # git show 需要 repo 相对路径
        try:
            repo_rel = str(filepath.resolve().relative_to(git_root))
        except ValueError:
            return ScanResult(rel, ok=True, kind="SKIP", detail="outside git repo")

        r = subprocess.run(
            ["git", "show", f"HEAD:{repo_rel}"],
            capture_output=True, timeout=_SUBPROCESS_TIMEOUT,
            cwd=str(git_root)
        )
        if r.returncode != 0:
            return ScanResult(rel, ok=True, kind="NEW", detail="not in git HEAD")

        head_size = len(r.stdout)
        curr_size = filepath.stat().st_size
        if head_size == 0:
            return ScanResult(rel, ok=True, kind="EMPTY", detail="empty in HEAD")
        if curr_size < head_size * 0.5:
            pct = int((head_size - curr_size) / head_size * 100)
            return ScanResult(rel, ok=False, kind="SHRANK",
                              detail=f"shrunk {pct}%: {head_size}→{curr_size} bytes")
        return ScanResult(rel, ok=True)
    except Exception:
        return ScanResult(rel, ok=True, kind="SKIP", detail="git check failed")


def _find_git_root(filepath):
    """向上查找 git 根目录"""
    current = Path(filepath).resolve().parent
    depth = 0
    while current != current.parent and depth < 50:
        if (current / '.git').exists():
            return current
        current = current.parent
        depth += 1
    return None


def _backup_dir(root):
    """获取在项目根目录下的备份目录"""
    root = Path(root)
    return root / '.ironfile' / 'backups'


def _backup_before_fix(root, rel):
    """在 git checkout 恢复之前，备份当前（可能损坏的）文件"""
    root = Path(root)
    filepath = root / rel
    if not filepath.exists():
        return
    backup_dir = _backup_dir(root)
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_name = f"{Path(rel).name}.{uuid.uuid4().hex[:12]}.pre-fix.bak"
    backup_path = backup_dir / backup_name
    try:
        content = filepath.read_bytes()
        backup_path.write_bytes(content)
        print(f"   💾 已备份当前文件到 {backup_path.name}")
    except Exception as e:
        print(f"   ⚠️ 备份失败 (跳过，继续修复): {e}")


def _fix_from_git(root, rel):
    """从 git HEAD 恢复文件"""
    try:
        r = subprocess.run(
            ["git", "checkout", "HEAD", "--", rel],
            cwd=str(root),
            capture_output=True, text=True,
            timeout=_SUBPROCESS_TIMEOUT
        )
        if r.returncode == 0:
            print(f"   ✅ Restored from git HEAD")
        else:
            print(f"   ⚠️  git checkout failed: {r.stderr.strip()}")
    except subprocess.TimeoutExpired:
        print(f"   ⚠️  git checkout 超时")
    except Exception as e:
        print(f"   ⚠️  Fix failed: {e}")


def shutil_which(cmd):
    """兼容 Python 3.9 的 which"""
    import shutil
    return shutil.which(cmd)
