"""
Shared fixtures for IronFile test suite.

Pattern usage (per python-testing-patterns):
    - Arrange:  fixtures set up temp files/dirs
    - Act:      test body calls the function under test
    - Assert:   verify via return values + file content checks
"""

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest


# ── Env: ensure tests always import from src, never from site-packages ──
SRC_DIR = str(Path(__file__).resolve().parent.parent / 'src')
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)


# ── Scoped constants ──
SAMPLE_ASCII = 'print("hello")\nprint("world")\n'
SAMPLE_UTF8 = '# 注释\nprint("你好世界")\ny = 42\n'
SAMPLE_EMOJI = 'print("🔥")\n'


# ── Fixtures ──

@pytest.fixture
def tmp_dir():
    """提供自动清理的临时目录。"""
    d = tempfile.mkdtemp()
    yield Path(d)
    shutil.rmtree(d)


@pytest.fixture
def ascii_file(tmp_dir):
    """创建纯 ASCII 测试文件，返回 path。"""
    path = tmp_dir / 'ascii.py'
    path.write_text(SAMPLE_ASCII)
    return path


@pytest.fixture
def utf8_file(tmp_dir):
    """创建含 UTF-8 中文字符的测试文件，返回 path。"""
    path = tmp_dir / 'utf8.py'
    path.write_text(SAMPLE_UTF8, encoding='utf-8')
    return path


@pytest.fixture
def binary_file(tmp_dir):
    """创建二进制测试文件，返回 path。"""
    path = tmp_dir / 'binary.bin'
    path.write_bytes(b'hello\x00world\x00foo\x00')
    return path


@pytest.fixture
def symlink_file(tmp_dir):
    """创建符号链接指向 target.txt。"""
    target = tmp_dir / 'target.txt'
    target.write_text('original content')
    link = tmp_dir / 'link.txt'
    os.symlink(str(target), str(link))
    return link, target


@pytest.fixture
def large_ascii_file(tmp_dir):
    """创建 300 行的 ASCII 文件（用于截断检测测试）。"""
    path = tmp_dir / 'large.py'
    path.write_text('print("big")\n' * 300)
    return path


@pytest.fixture
def git_repo(tmp_dir):
    """创建临时的 git 仓库用于 checkpoint 测试。"""
    repo = tmp_dir / 'repo'
    repo.mkdir()
    subprocess.run(['git', 'init'], cwd=str(repo),
                   capture_output=True, timeout=15)
    subprocess.run(['git', 'config', 'user.email', 'test@test.com'],
                   cwd=str(repo), capture_output=True, timeout=15)
    subprocess.run(['git', 'config', 'user.name', 'Test'],
                   cwd=str(repo), capture_output=True, timeout=15)
    # Initial commit so we have a HEAD
    readme = repo / 'README.md'
    readme.write_text('# Test Repo')
    subprocess.run(['git', 'add', '-A'], cwd=str(repo),
                   capture_output=True, timeout=15)
    subprocess.run(['git', 'commit', '-m', 'init'],
                   cwd=str(repo), capture_output=True, timeout=15)
    return repo
