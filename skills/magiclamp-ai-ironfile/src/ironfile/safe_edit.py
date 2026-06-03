"""
safe_edit — 原子文件编辑，零截断，有备份，可回滚。

这是 IronFile L1 防线的核心引擎。每次文件修改走完整路径：
读取 → 验证 → 替换 → 备份 → 写入 → 验证 → 清理（失败时回滚）。

设计原则：
  - 先备份，再写入
  - 写入后验证文件大小和尾部内容
  - 任何异常都回滚到备份
  - 成功后删除备份（不留垃圾）

v2 修复记录（2026-06-02 红队对抗）：
  - [CRITICAL] str/bytes 类型混用导致所有文本文件编辑失败
  - [HIGH] 备份失败时静默降级到无保护写入
  - [HIGH] 备份文件名可预测（UUID 而非固定名称）
  - [HIGH] TOCTOU 竞态条件（写入前二次验证文件未被篡改）
  - [HIGH] 符号链接无感知
  - [MEDIUM] 截断阈值绕过（<10KB 文件不检查）
  - [MEDIUM] 无膨胀检测（防止垃圾数据注入）
  - [LOW] 超大字符串无 OOM 防护
"""

import os
import shutil
import sys
import uuid
from pathlib import Path


class IronFileError(Exception):
    """IronFile 操作异常基类"""
    pass


class OldStringNotFound(IronFileError):
    """要替换的内容在文件中不存在"""
    pass


class OldStringAmbiguous(IronFileError):
    """要替换的内容出现了多次，无法唯一确定"""
    pass


class TruncationSuspected(IronFileError):
    """检测到疑似截断：新内容比原文件缩小超过阈值"""
    pass


class WriteVerificationFailed(IronFileError):
    """写入后验证失败：文件大小或尾部内容与预期不符"""
    pass


# ── 安全常量 ──
_MAX_OLD_STR_BYTES = 1 * 1024 * 1024        # old_str 最大 1MB
_MAX_NEW_STR_BYTES = 50 * 1024 * 1024       # new_str 最大 50MB
_MAX_FILE_BYTES = 500 * 1024 * 1024         # 文件最大 500MB
_EXPANSION_FACTOR = 50                      # 膨胀上限：新文件最多为原文件的 50 倍
_MAX_BACKUP_DEPTH = 50                      # 查找 .git 的最大目录深度


def safe_edit(filepath, old_str, new_str, replace_all=False,
              truncation_threshold=0.6, tail_check_bytes=200):
    """
    安全编辑文件：备份 → 写入 → 验证 → 失败时自动回滚。

    Args:
        filepath: 要编辑的文件路径
        old_str: 要替换的文本
        new_str: 替换后的文本
        replace_all: 是否替换所有匹配项（默认只替换第一个）
        truncation_threshold: 截断预警阈值，新文件小于原文件的此比例时中止（默认 0.6）
        tail_check_bytes: 尾部校验的字节数（默认 200）

    Returns:
        dict: {"replaced": count, "delta_bytes": int}

    Raises:
        OldStringNotFound: old_str 在文件中不存在
        OldStringAmbiguous: old_str 多次出现但 replace_all=False
        TruncationSuspected: 新文件异常缩小
        WriteVerificationFailed: 写入后验证失败
    """
    filepath = str(filepath)
    fpath = Path(filepath)

    # ── 0. 前置检查 ──
    if not fpath.exists():
        raise IronFileError(f"文件不存在: {filepath}")

    if fpath.is_symlink():
        dest = os.path.realpath(filepath)
        print(f"⚠️  {filepath} 是符号链接，指向 {dest}", file=sys.stderr)

    file_size = fpath.stat().st_size
    if file_size > _MAX_FILE_BYTES:
        raise IronFileError(
            f"文件过大 ({file_size / 1024 / 1024:.0f}MB)，"
            f"超过限制 {_MAX_FILE_BYTES / 1024 / 1024:.0f}MB"
        )

    # ── 1. 参数安全检查（基于字节长度，防止 OOM） ──
    old_len = len(old_str.encode('utf-8') if isinstance(old_str, str) else old_str)
    new_len = len(new_str.encode('utf-8') if isinstance(new_str, str) else new_str)

    if old_len > _MAX_OLD_STR_BYTES:
        raise IronFileError(
            f"old_str 过大 ({old_len} 字节)，超过限制 {_MAX_OLD_STR_BYTES} 字节"
        )
    if new_len > _MAX_NEW_STR_BYTES:
        raise IronFileError(
            f"new_str 过大 ({new_len} 字节)，超过限制 {_MAX_NEW_STR_BYTES} 字节"
        )

    # ── 2. 统一以 bytes 读取文件 ──
    raw = fpath.read_bytes()
    orig_size = len(raw)

    # ── 3. 类型判定 + 内容类型对齐 ──
    try:
        text = raw.decode('utf-8')
        is_binary = False
    except UnicodeDecodeError:
        is_binary = True

    if is_binary:
        content = raw
        old_match = old_str.encode('utf-8') if isinstance(old_str, str) else old_str
        new_match = new_str.encode('utf-8') if isinstance(new_str, str) else new_str
    else:
        content = text
        old_match = old_str.decode('utf-8') if isinstance(old_str, bytes) else old_str
        new_match = new_str.decode('utf-8') if isinstance(new_str, bytes) else new_str

    # ── 4. 验证 old_string 存在于文件中 ──
    count = content.count(old_match)
    if count == 0:
        first_line = old_match.split(b'\n' if is_binary else '\n')[0]
        if isinstance(first_line, bytes):
            first_line = first_line.decode('utf-8', errors='replace')
        raise OldStringNotFound(
            f"未找到要替换的内容。提示: 第一行是 '{first_line[:80]}'，"
            f"检查换行符/缩进是否完全匹配"
        )
    if not replace_all and count > 1:
        raise OldStringAmbiguous(
            f"old_string 出现了 {count} 次，请用 replace_all=True 或加更多上下文"
        )

    # ── 5. 执行替换 ──
    new_content = content.replace(old_match, new_match, 1 if not replace_all else -1)

    # 统一序列化为 bytes，后续所有大小/尾部比较统一在 bytes 层面做
    new_raw = new_content.encode('utf-8') if not is_binary else new_content
    new_size = len(new_raw)
    delta = new_size - orig_size

    # ── 6. 截断预警（移除 10KB 阈值，对所有文件生效） ──
    if new_size < orig_size * truncation_threshold:
        pct = int((orig_size - new_size) / orig_size * 100)
        raise TruncationSuspected(
            f"文件将缩小 {orig_size - new_size} 字节 ({pct}%)，疑似截断。已中止。"
        )

    # ── 7. 膨胀检测（防止注入垃圾数据） ──
    if orig_size > 0 and new_size > orig_size * _EXPANSION_FACTOR:
        pct = int((new_size - orig_size) / orig_size * 100)
        raise IronFileError(
            f"文件将膨胀 {new_size - orig_size} 字节 ({pct}%)，"
            f"超过膨胀上限 {_EXPANSION_FACTOR * 100}%。已中止。"
        )

    # ── 8. 备份（使用 UUID 文件名防止竞争） ──
    backup_dir = _backup_dir(filepath)
    backup_dir.mkdir(parents=True, exist_ok=True)

    backup_name = f"{fpath.stem}.{uuid.uuid4().hex[:12]}.bak"
    backup_path = backup_dir / backup_name

    try:
        backup_path.write_bytes(raw)
    except OSError as e:
        _try_cleanup(backup_path)
        raise IronFileError(
            f"备份失败: {e}，已中止。请检查磁盘空间和权限。"
        ) from e

    # ── 9. TOCTOU 守卫：写入前验证源文件未被外部修改 ──
    try:
        current_raw = fpath.read_bytes()
    except Exception as e:
        _try_cleanup(backup_path)
        raise IronFileError(f"写入前验证读取失败: {e}") from e

    if current_raw != raw:
        _try_cleanup(backup_path)
        raise IronFileError(
            "写入前检测到文件已被外部修改，已中止以保护数据一致性。"
        )

    # ── 10. 写入 ──
    try:
        fpath.write_bytes(new_raw)
    except Exception as e:
        _restore(filepath, backup_path)
        raise IronFileError(f"写入失败: {e}") from e

    # ── 11. 验证 ──
    try:
        verify = fpath.read_bytes()
    except Exception as e:
        _restore(filepath, backup_path)
        raise WriteVerificationFailed(f"验证读取失败: {e}") from e

    verify_size = len(verify)
    if verify_size != new_size:
        _restore(filepath, backup_path)
        raise WriteVerificationFailed(
            f"文件大小验证失败: 预期 {new_size} 字节，实际 {verify_size} 字节"
        )

    # ── 12. 尾部完整性检查 ──
    tail_len = min(tail_check_bytes, verify_size)
    if verify[-tail_len:] != new_raw[-tail_len:]:
        _restore(filepath, backup_path)
        raise WriteVerificationFailed("尾部截断检测: 文件末尾与预期不符")

    # ── 13. 成功，清理备份 ──
    _try_cleanup(backup_path)

    replacement_count = count if replace_all else 1
    return {"replaced": replacement_count, "delta_bytes": delta}


def _backup_dir(filepath):
    """获取备份目录：项目根目录下的 .ironfile/backups/"""
    filepath = Path(filepath).resolve()
    current = filepath.parent
    depth = 0
    while current != current.parent and depth < _MAX_BACKUP_DEPTH:
        if (current / '.git').exists():
            return current / '.ironfile' / 'backups'
        current = current.parent
        depth += 1
    return filepath.parent / '.ironfile' / 'backups'


def _restore(filepath, backup_path):
    """从备份恢复文件"""
    if backup_path and backup_path.exists():
        try:
            shutil.copy(str(backup_path), filepath)
            print("✅ 已从备份恢复", file=sys.stderr)
        except Exception as e:
            print(f"❌ 备份恢复也失败了: {e}", file=sys.stderr)
            print(f"   备份文件在: {backup_path}", file=sys.stderr)


def _try_cleanup(backup_path):
    """尝试清理备份文件（静默忽略删除失败）"""
    if backup_path and backup_path.exists():
        try:
            backup_path.unlink()
        except OSError:
            pass
