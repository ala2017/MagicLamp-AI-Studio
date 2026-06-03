"""
checkpoint — Git 快照管理（IronFile L2 防线）。

在 AI 多文件修改前打 checkpoint，修改完成后 commit。
中断后可快速回退到任务前状态。

v2 修复（2026-06-02 红队对抗）：
  - [HIGH] rollback 仅靠 git log --grep 匹配关键字（攻击者可伪造）
  - [HIGH] git reset --hard 不可逆，无确认机制
  - [MEDIUM] subprocess 调用缺少 timeout
  - [MEDIUM] checkpoint 搜索范围只有最近 50 条
  - [LOW] _parse_file_count 缺少超时
"""

import hashlib
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

_SUBPROCESS_TIMEOUT = 30


class CheckpointVerificationError(Exception):
    """checkpoint 签名验证失败"""
    pass


def _checkpoint_manifest_path(root):
    """获取 .ironfile/checkpoints.json 路径"""
    return Path(root) / '.ironfile' / 'checkpoints.json'


def _read_manifest(root):
    """读取 checkpoint manifest"""
    manifest_path = _checkpoint_manifest_path(root)
    if manifest_path.exists():
        try:
            return json.loads(manifest_path.read_text())
        except (json.JSONDecodeError, OSError):
            return {"checkpoints": []}
    return {"checkpoints": []}


def _write_manifest(root, manifest):
    """写入 checkpoint manifest（失败时静默忽略）"""
    manifest_path = _checkpoint_manifest_path(root)
    try:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    except OSError:
        pass


def _compute_signature(message, hash_val):
    """checkpoint 的简单内容签名（防止 manifest 篡改）"""
    raw = "{}::{}".format(message, hash_val).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()[:16]


def checkpoint(message, root="."):
    """
    创建 Git checkpoint（暂存所有变更 + commit）。

    每次 checkpoint 会在 .ironfile/checkpoints.json 中记录签名，
    避免只依赖 git log --grep 来识别 checkpoint。

    Args:
        message: checkpoint 描述信息
        root: 项目根目录（默认当前目录）

    Returns:
        dict: {"hash": str, "files": int}

    Raises:
        RuntimeError: git 不可用或操作失败
    """
    root = Path(root).resolve()

    # 验证是 git 仓库
    if not (root / '.git').exists():
        raise RuntimeError("不是 git 仓库: {}".format(root))

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    full_message = "ironfile checkpoint: {} [{}]".format(message, timestamp)

    # git add -A
    r1 = subprocess.run(
        ["git", "add", "-A"],
        cwd=str(root), capture_output=True, text=True,
        timeout=_SUBPROCESS_TIMEOUT
    )
    if r1.returncode != 0:
        raise RuntimeError("git add 失败: {}".format(r1.stderr.strip()))

    # git commit --allow-empty
    r2 = subprocess.run(
        ["git", "commit", "--allow-empty", "-m", full_message],
        cwd=str(root), capture_output=True, text=True,
        timeout=_SUBPROCESS_TIMEOUT
    )
    if r2.returncode != 0:
        raise RuntimeError("git commit 失败: {}".format(r2.stderr.strip()))

    # 获取 commit hash
    r3 = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=str(root), capture_output=True, text=True,
        timeout=_SUBPROCESS_TIMEOUT
    )
    commit_hash = r3.stdout.strip()

    # 统计文件数
    r4 = subprocess.run(
        ["git", "diff", "--stat", "HEAD~1..HEAD"],
        cwd=str(root), capture_output=True, text=True,
        timeout=_SUBPROCESS_TIMEOUT
    )
    files_line = r4.stdout.strip().split('\n')[-1] if r4.stdout.strip() else ""
    files_count = _parse_file_count(files_line)

    # 记录到 manifest（带签名）
    sig = _compute_signature(full_message, commit_hash)
    manifest = _read_manifest(root)
    manifest["checkpoints"].append({
        "hash": commit_hash,
        "message": full_message,
        "timestamp": timestamp,
        "files": files_count,
        "signature": sig
    })
    # 只保留最近 100 条
    manifest["checkpoints"] = manifest["checkpoints"][-100:]
    _write_manifest(root, manifest)

    return {"hash": commit_hash, "files": files_count}


def rollback(target="checkpoint", root=".", force=False):
    """
    回退到指定 checkpoint。

    Args:
        target: checkpoint 的标识（commit hash、'checkpoint' 关键字、HEAD~N）
        root: 项目根目录
        force: 跳过确认提示

    Returns:
        dict: {"restored_to": str}

    Raises:
        RuntimeError: git 不可用或操作失败
        CheckpointVerificationError: 签名验证失败
    """
    root = Path(root).resolve()

    if target == "checkpoint":
        # 优先从 manifest 查找最近的 checkpoint
        manifest = _read_manifest(root)
        if manifest["checkpoints"]:
            latest = manifest["checkpoints"][-1]
            # 验证签名
            sig = _compute_signature(latest["message"], latest["hash"])
            if sig != latest.get("signature", ""):
                raise CheckpointVerificationError(
                    "checkpoint {} 签名验证失败，可能已被篡改".format(latest["hash"])
                )
            target = latest["hash"]
        else:
            # fallback 到 git log --grep（搜索范围扩大到 200 条）
            r = subprocess.run(
                ["git", "log", "--oneline", "-200", "--grep=ironfile checkpoint:"],
                cwd=str(root), capture_output=True, text=True,
                timeout=_SUBPROCESS_TIMEOUT
            )
            if r.returncode != 0 or not r.stdout.strip():
                raise RuntimeError("找不到 ironfile checkpoint")
            target = r.stdout.strip().split('\n')[0].split()[0]

    # 确认提示（除非 force）
    if not force:
        print("即将执行 git reset --hard {}，这将丢弃未提交的修改。".format(target), file=sys.stderr)
        print("输入 YES 确认: ", end="", file=sys.stderr)
        try:
            confirm = input().strip()
        except (EOFError, KeyboardInterrupt):
            print("\n已取消", file=sys.stderr)
            raise RuntimeError("用户取消操作")
        if confirm != "YES":
            print("已取消", file=sys.stderr)
            raise RuntimeError("用户取消操作")

    r = subprocess.run(
        ["git", "reset", "--hard", target],
        cwd=str(root), capture_output=True, text=True,
        timeout=_SUBPROCESS_TIMEOUT
    )
    if r.returncode != 0:
        raise RuntimeError("git reset 失败: {}".format(r.stderr.strip()))

    return {"restored_to": target}


def list_checkpoints(root=".", limit=20):
    """
    列出最近的 ironfile checkpoints。
    优先从 manifest 读取，fallback 到 git log。
    """
    root = Path(root).resolve()

    # 优先从 manifest 读取
    manifest = _read_manifest(root)
    if manifest["checkpoints"]:
        result = []
        for cp in manifest["checkpoints"][-limit:]:
            sig = _compute_signature(cp["message"], cp["hash"])
            result.append({
                "hash": cp["hash"],
                "message": cp["message"],
                "timestamp": cp.get("timestamp", ""),
                "files": cp.get("files", 0),
                "verified": sig == cp.get("signature", "")
            })
        return result

    # fallback 到 git log
    r = subprocess.run(
        ["git", "log", "--oneline", "-{}".format(limit), "--grep=ironfile checkpoint:"],
        cwd=str(root), capture_output=True, text=True,
        timeout=_SUBPROCESS_TIMEOUT
    )
    if r.returncode != 0:
        raise RuntimeError("git log 失败: {}".format(r.stderr.strip()))

    lines = r.stdout.strip().split('\n') if r.stdout.strip() else []
    return [{"hash": l.split()[0], "message": ' '.join(l.split()[1:]), "verified": False}
            for l in lines]


def _parse_file_count(line):
    """从 git diff --stat 输出解析文件数"""
    if not line:
        return 0
    try:
        parts = line.split()
        return int(parts[0])
    except (ValueError, IndexError):
        return 0
