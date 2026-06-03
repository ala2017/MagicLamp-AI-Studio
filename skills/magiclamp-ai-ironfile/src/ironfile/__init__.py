"""
IronFile — Atomic file safety middleware for AI coding agents.

Core API:
    from ironfile import safe_edit, scan, checkpoint

    # L1: Atomic edit with backup + verify + rollback
    safe_edit("file.py", "old code", "new code")

    # L2: Git checkpoint before multi-file changes
    checkpoint("refactor auth module")

    # L3: Post-crash integrity scan
    scan(".", fix=True)
"""

from ironfile.safe_edit import safe_edit
from ironfile.scanner import scan
from ironfile.checkpoint import checkpoint

__version__ = "0.1.0"
__all__ = ["safe_edit", "scan", "checkpoint"]
