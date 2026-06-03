"""
Tests for IronFile L3 — scanner integrity scanner.

Scanner 依赖 subprocess 调用外部工具（py_compile, node, git），
所以测试策略：
  - 直接测试 _check_* 类函数（通过构造已知好/坏的文件）
  - Python 语法检查在所有环境可用，重点覆盖
  - JS/TS/HTML 检查在 node 不可用时自动 SKIP
"""

import pytest

from ironfile.scanner import (
    ScanResult,
    _check_python,
    _check_json,
    _check_html,
    _check_braces,
    _check_size_vs_git,
    _check_file,
    _find_files,
    _backup_before_fix,
    DEFAULT_PATTERNS,
    DEFAULT_EXCLUDE,
)


class TestCheckPython:

    def test_valid_python_file_passes(self, tmp_path):
        path = tmp_path / 'valid.py'
        path.write_text('x = 1\ny = 2\n')
        result = _check_python(path, str(path))
        assert result.ok is True

    def test_invalid_python_file_fails_syntax_check(self, tmp_path):
        path = tmp_path / 'invalid.py'
        path.write_text('x = ;')
        result = _check_python(path, str(path))
        assert result.ok is False
        assert result.kind == 'SYNTAX'


class TestCheckJSON:

    def test_valid_json_passes(self, tmp_path):
        path = tmp_path / 'valid.json'
        path.write_text('{"key": "value"}')
        result = _check_json(path, str(path))
        assert result.ok is True

    def test_invalid_json_fails(self, tmp_path):
        path = tmp_path / 'invalid.json'
        path.write_text('{invalid json}')
        result = _check_json(path, str(path))
        assert result.ok is False
        assert result.kind == 'SYNTAX'


class TestCheckHTML:

    def test_complete_html_passes(self, tmp_path):
        path = tmp_path / 'test.html'
        path.write_text('<html><body>ok</body></html>')
        result = _check_html(path, str(path))
        assert result.ok is True

    def test_large_html_missing_closing_tag_fails(self, tmp_path):
        path = tmp_path / 'truncated.html'
        path.write_text('<html>' + '<p>content</p>' * 600)
        result = _check_html(path, str(path))
        if len(path.read_text()) > 5000:
            assert result.ok is False
            assert result.kind == 'STRUCTURE'
        else:
            assert result.ok is True


class TestCheckBraces:

    def test_balanced_braces_pass(self, tmp_path):
        path = tmp_path / 'test.css'
        path.write_text('.cls { color: red; }')
        result = _check_braces(path, str(path))
        assert result.ok is True

    def test_unbalanced_braces_in_large_file_fails(self, tmp_path):
        path = tmp_path / 'test.css'
        path.write_text('{' * 6000 + '}' * 5900)
        result = _check_braces(path, str(path))
        if len(path.read_text()) > 5000:
            assert result.ok is False
            assert result.kind == 'STRUCTURE'


class TestCheckSizeVsGit:

    def test_file_not_in_git_returns_skipped(self, tmp_path):
        path = tmp_path / 'new.py'
        path.write_text('content')
        result = _check_size_vs_git(path)
        assert result.ok is True
        assert result.kind in ('NEW', 'SKIP')

    def test_outside_git_repo_returns_skipped(self, tmp_path):
        path = tmp_path / 'orphan.py'
        path.write_text('content')
        result = _check_size_vs_git(path)
        assert result.ok is True


class TestCheckFileRouting:

    def test_py_file_routes_to_python_check(self, tmp_path):
        path = tmp_path / 'app.py'
        path.write_text('x = 1')
        result = _check_file(path, str(path), '.py')
        assert result.ok is True

    def test_json_file_routes_to_json_check(self, tmp_path):
        path = tmp_path / 'data.json'
        path.write_text('{"a": 1}')
        result = _check_file(path, str(path), '.json')
        assert result.ok is True

    def test_empty_file_checked_against_git(self, tmp_path):
        path = tmp_path / 'empty.py'
        path.write_text('')
        result = _check_file(path, str(path), '.py')
        assert result.ok is True

    def test_unsupported_extension_skips(self, tmp_path):
        path = tmp_path / 'data.csv'
        path.write_text('a,b,c')
        result = _check_file(path, str(path), '.csv')
        assert result.ok is True
        assert result.kind == 'SKIP'


class TestFindFiles:

    def test_find_files_includes_matching_patterns(self, tmp_path):
        (tmp_path / 'app.py').write_text('')
        (tmp_path / 'style.css').write_text('')
        files = _find_files(tmp_path, ['*.py', '*.css'], set())
        assert len(files) == 2

    def test_find_files_excludes_default_dirs(self, tmp_path):
        (tmp_path / 'app.py').write_text('')
        (tmp_path / '__pycache__').mkdir()
        (tmp_path / '__pycache__' / 'cache.pyc').write_text('')
        (tmp_path / '.git').mkdir()
        (tmp_path / '.git' / 'config').write_text('')
        files = _find_files(tmp_path, ['*.py', '*.pyc'], DEFAULT_EXCLUDE)
        matched = [f for f in files if f.suffix != '.md']
        assert len(matched) <= 1


class TestBackupBeforeFix:

    def test_backup_before_fix_creates_backup_file(self, tmp_path):
        path = tmp_path / 'broken.py'
        path.write_text('broken content')
        _backup_before_fix(tmp_path, 'broken.py')
        backup_dir = tmp_path / '.ironfile' / 'backups'
        assert backup_dir.exists()
        backups = list(backup_dir.iterdir())
        assert len(backups) >= 1
        assert backups[0].suffix == '.bak'

    def test_backup_before_fix_nonexistent_file_skips(self, tmp_path):
        _backup_before_fix(tmp_path, 'nonexistent.py')
        backup_dir = tmp_path / '.ironfile' / 'backups'
        assert not backup_dir.exists() or len(list(backup_dir.iterdir())) == 0
