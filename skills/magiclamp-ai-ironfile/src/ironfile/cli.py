"""
CLI — IronFile 命令行接口。

用法:
    # L1: 安全编辑
    ironfile edit <file> <old_str> <new_str>
    ironfile edit <file> --old-file /tmp/old.txt --new-file /tmp/new.txt

    # L2: Git checkpoint
    ironfile checkpoint "refactor: extract auth module"
    ironfile rollback
    ironfile checkpoints

    # L3: 完整性扫描
    ironfile scan
    ironfile scan --fix
    ironfile scan --verbose
"""

import argparse
import sys

from ironfile import __version__
from ironfile.safe_edit import (
    safe_edit,
    IronFileError,
    OldStringNotFound,
    OldStringAmbiguous,
    TruncationSuspected,
    WriteVerificationFailed,
)
from ironfile.scanner import scan
from ironfile.checkpoint import checkpoint, rollback, list_checkpoints, CheckpointVerificationError


def main():
    parser = argparse.ArgumentParser(
        description="IronFile — Atomic file safety for AI coding agents",
        epilog="https://github.com/magiclamp-ai/ironfile"
    )
    parser.add_argument('--version', action='version', version=f'ironfile {__version__}')

    sub = parser.add_subparsers(dest='command', help='子命令')

    # ── edit ──
    p_edit = sub.add_parser('edit', help='安全编辑文件（L1 原子守卫）')
    p_edit.add_argument('filepath', help='要编辑的文件路径')
    p_edit.add_argument('old_string', nargs='?', help='要替换的文本')
    p_edit.add_argument('new_string', nargs='?', help='替换后的文本')
    p_edit.add_argument('--all', dest='replace_all', action='store_true',
                        help='替换所有匹配项（默认只替换第一个）')
    p_edit.add_argument('--old-file', help='从文件读取 old_string')
    p_edit.add_argument('--new-file', help='从文件读取 new_string')
    p_edit.add_argument('--truncation-threshold', type=float, default=0.6,
                        help='截断预警阈值（默认 0.6）')

    # ── checkpoint ──
    p_cp = sub.add_parser('checkpoint', help='创建 Git checkpoint（L2）')
    p_cp.add_argument('message', nargs='?', default='auto checkpoint',
                      help='checkpoint 描述')

    # ── rollback ──
    p_rb = sub.add_parser('rollback', help='回退到 checkpoint')
    p_rb.add_argument('target', nargs='?', default='checkpoint',
                      help='目标 commit hash 或 "checkpoint"（默认最近 checkpoint）')
    p_rb.add_argument('--force', '-f', action='store_true',
                      help='跳过确认提示')

    # ── checkpoints ──
    p_list = sub.add_parser('checkpoints', help='列出 checkpoint 历史')
    p_list.add_argument('-n', type=int, default=20, help='显示数量（默认 20）')

    # ── scan ──
    p_scan = sub.add_parser('scan', help='完整性扫描（L3）')
    p_scan.add_argument('root', nargs='?', default='.',
                        help='项目根目录（默认当前目录）')
    p_scan.add_argument('--fix', action='store_true',
                        help='自动从 git HEAD 恢复损坏文件')
    p_scan.add_argument('--verbose', '-v', action='store_true',
                        help='显示所有文件状态（默认只显示异常）')
    p_scan.add_argument('--patterns', nargs='*',
                        help='自定义文件 glob 模式')

    args = parser.parse_args()

    if args.command == 'edit':
        _cmd_edit(args)
    elif args.command == 'checkpoint':
        _cmd_checkpoint(args)
    elif args.command == 'rollback':
        _cmd_rollback(args)
    elif args.command == 'checkpoints':
        _cmd_checkpoints(args)
    elif args.command == 'scan':
        _cmd_scan(args)
    else:
        parser.print_help()
        sys.exit(1)


def _cmd_edit(args):
    """处理 edit 子命令"""
    old_str = args.old_string
    new_str = args.new_string

    if args.old_file:
        with open(args.old_file, 'r', encoding='utf-8') as f:
            old_str = f.read()
    if args.new_file:
        with open(args.new_file, 'r', encoding='utf-8') as f:
            new_str = f.read()

    if old_str is None or new_str is None:
        print("❌ 需要提供 old_string 和 new_string，或 --old-file/--new-file")
        sys.exit(1)

    try:
        result = safe_edit(
            args.filepath, old_str, new_str,
            replace_all=args.replace_all,
            truncation_threshold=args.truncation_threshold
        )
        print(f"✅ {args.filepath}  "
              f"({result['delta_bytes']:+d} 字节, {result['replaced']} 处替换)")
    except OldStringNotFound as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)
    except OldStringAmbiguous as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)
    except TruncationSuspected as e:
        print(f"⚠️  {e}", file=sys.stderr)
        sys.exit(1)
    except WriteVerificationFailed as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)
    except IronFileError as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)


def _cmd_checkpoint(args):
    """处理 checkpoint 子命令"""
    try:
        result = checkpoint(args.message)
        print(f"✅ Checkpoint {result['hash']}  "
              f"({result['files']} files)")
    except RuntimeError as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)


def _cmd_rollback(args):
    """处理 rollback 子命令"""
    try:
        result = rollback(args.target, force=args.force)
        print(f"✅ Rolled back to {result['restored_to']}")
    except CheckpointVerificationError as e:
        print(f"❌ 签名验证失败: {e}", file=sys.stderr)
        sys.exit(1)
    except RuntimeError as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)


def _cmd_checkpoints(args):
    """处理 checkpoints 子命令"""
    try:
        cps = list_checkpoints(limit=args.n)
        if not cps:
            print("No ironfile checkpoints found.")
        for cp in cps:
            print(f"  {cp['hash']}  {cp['message']}")
    except RuntimeError as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)


def _cmd_scan(args):
    """处理 scan 子命令"""
    result = scan(
        root=args.root,
        fix=args.fix,
        verbose=args.verbose,
    )
    if result["issues"]:
        sys.exit(1)


if __name__ == '__main__':
    main()
