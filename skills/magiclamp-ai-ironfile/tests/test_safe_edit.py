"""
Tests for IronFile L1 — safe_edit atomic edit guard.

遵循 pytest 最佳实践（python-testing-patterns）：
  - AAA 模式：Arrange → Act → Assert
  - 描述性命名：test_<unit>_<scenario>_<expected>
  - 测试独立隔离，无共享状态
  - 使用 conftest.py 中的 fixture
"""

import pytest

from ironfile.safe_edit import (
    IronFileError,
    OldStringNotFound,
    OldStringAmbiguous,
    TruncationSuspected,
    WriteVerificationFailed,
    safe_edit,
)

# ════════════════════════════════════════════════════════════════
#  Happy Path — 基本编辑功能
# ════════════════════════════════════════════════════════════════

class TestEditASCII:
    """纯 ASCII 文件的编辑功能。修复前这个失败（str/bytes bug）。"""

    def test_edit_ascii_content_replaces_successfully(self, ascii_file):
        """替换纯 ASCII 文件中的文本并验证内容"""
        result = safe_edit(str(ascii_file), 'hello', 'HELLO')
        assert result['replaced'] == 1
        content = ascii_file.read_text()
        assert 'HELLO' in content
        assert 'hello' not in content

    def test_edit_ascii_returns_correct_delta(self, ascii_file):
        """返回正确的字节变化量（替换长度相等时 delta=0）"""
        result = safe_edit(str(ascii_file), 'hello', 'HELLO')
        assert result['delta_bytes'] == 0

    def test_edit_ascii_preserves_unrelated_content(self, ascii_file):
        """只修改目标字符串，不碰其他内容"""
        safe_edit(str(ascii_file), 'hello', 'HELLO')
        content = ascii_file.read_text()
        assert 'world' in content  # 未被影响


class TestEditUTF8:
    """含中文/多字节字符文件的编辑功能。修复前这个全面失败。"""

    def test_edit_chinese_file_replaces_y_equals_42(self, utf8_file):
        """含中文的文件中替换 ASCII 内容"""
        result = safe_edit(str(utf8_file), 'y = 42', 'z = 99')
        assert result['replaced'] == 1
        content = utf8_file.read_text(encoding='utf-8')
        assert 'z = 99' in content

    def test_edit_chinese_string_directly(self, tmp_path):
        """直接替换中文字符串"""
        path = tmp_path / 'test.py'
        path.write_text('x = "你好世界"\n', encoding='utf-8')
        result = safe_edit(str(path), '你好世界', 'Hello World')
        assert result['replaced'] == 1
        assert 'Hello World' in path.read_text(encoding='utf-8')

    def test_edit_emoji_content(self, tmp_path):
        """替换 emoji 字符（多字节且超出 BMP）"""
        path = tmp_path / 'test.py'
        path.write_text('print("🔥")\n', encoding='utf-8')
        result = safe_edit(str(path), '🔥', '❄️')
        assert result['replaced'] == 1
        content = path.read_text(encoding='utf-8')
        assert '❄️' in content
        assert '🔥' not in content

    def test_edit_chinese_replace_all(self, tmp_path):
        """中文全局替换"""
        path = tmp_path / 'test.py'
        path.write_text('x = "你好"\nx = "你好"\n', encoding='utf-8')
        result = safe_edit(str(path), '你好', 'Hello', replace_all=True)
        assert result['replaced'] == 2
        content = path.read_text(encoding='utf-8')
        assert content.count('Hello') == 2


class TestEditBinary:
    """二进制文件的编辑功能。"""

    def test_edit_binary_replaces_content(self, binary_file):
        """替换二进制文件中的字节序列"""
        result = safe_edit(str(binary_file), b'hello', b'HELLO')
        assert result['replaced'] == 1
        assert binary_file.read_bytes().startswith(b'HELLO')

    def test_edit_binary_with_str_args_auto_encodes(self, tmp_path):
        """str 类型参数在二进制模式下自动编码"""
        path = tmp_path / 'test.bin'
        path.write_bytes(b'hello world')
        result = safe_edit(str(path), 'hello', 'HELLO')
        assert result['replaced'] == 1
        assert path.read_bytes().startswith(b'HELLO')


# ════════════════════════════════════════════════════════════════
#  Error Path — 异常场景
# ════════════════════════════════════════════════════════════════

class TestErrors:

    def test_nonexistent_file_raises(self):
        """对不存在的文件应报错"""
        with pytest.raises(IronFileError, match='文件不存在'):
            safe_edit('/nonexistent/path/file.py', 'a', 'b')

    def test_missing_old_string_raises(self, ascii_file):
        """old_string 不在文件中时应抛出 OldStringNotFound"""
        with pytest.raises(OldStringNotFound, match='未找到'):
            safe_edit(str(ascii_file), 'nonexistent', 'x')

    def test_ambiguous_old_string_raises_without_replace_all(self, ascii_file):
        """old_string 出现多次且未指定 replace_all 时应抛出 OldStringAmbiguous"""
        path = ascii_file
        path.write_text('x = 1\nx = 1\n')
        with pytest.raises(OldStringAmbiguous, match='出现了 2 次'):
            safe_edit(str(path), 'x = 1', 'y = 2')

    def test_replace_all_ambiguous_does_not_raise(self, ascii_file):
        """replace_all=True 时不应抛出歧义错误"""
        path = ascii_file
        path.write_text('x = 1\nx = 1\n')
        result = safe_edit(str(path), 'x = 1', 'y = 2', replace_all=True)
        assert result['replaced'] == 2

    def test_truncation_above_threshold_raises(self, large_ascii_file):
        """文件缩小超过截断阈值应触发 TruncationSuspected"""
        path = large_ascii_file
        with pytest.raises(TruncationSuspected, match='缩小'):
            safe_edit(str(path), 'print("big")\n', '',
                      replace_all=True, truncation_threshold=0.8)

    def test_truncation_below_threshold_succeeds(self, tmp_path):
        """缩小量在阈值内的编辑应正常执行"""
        path = tmp_path / 'moderate.py'
        path.write_text('x = 1' * 100 + 'keep this line\n')
        # old 和 new 长度接近，缩小量很小
        result = safe_edit(str(path), 'x = 1', 'y = 2',
                          replace_all=True, truncation_threshold=0.5)
        assert result['replaced'] == 100


# ════════════════════════════════════════════════════════════════
#  Security — 安全加固验证
# ════════════════════════════════════════════════════════════════

class TestSecurity:

    def test_oversized_new_string_is_rejected(self, ascii_file):
        """超大的 new_str 应被 OOM 保护阻止"""
        with pytest.raises(IronFileError, match='过大'):
            safe_edit(str(ascii_file), 'hello', 'x' * 60_000_000)

    def test_extreme_file_expansion_is_rejected(self, ascii_file):
        """写入导致文件膨胀超过 50 倍应被阻止"""
        with pytest.raises(IronFileError, match='膨胀'):
            safe_edit(str(ascii_file), 'hello', '# ' * 50000)

    def test_symlink_edit_warns_and_modifies_target(self, symlink_file):
        """编辑符号链接应输出警告并修改目标文件"""
        link, target = symlink_file
        safe_edit(str(link), 'original', 'modified')
        assert 'modified' in target.read_text()

    def test_noop_replacement_handles_gracefully(self, ascii_file):
        """替换前后内容相同时应正确处理（至少在备份后恢复）"""
        result = safe_edit(str(ascii_file), 'hello', 'hello')
        assert result['replaced'] == 1


# ════════════════════════════════════════════════════════════════
#  Rollback — 失败回滚验证
# ════════════════════════════════════════════════════════════════

class TestRollback:

    def test_safe_edit_verifies_write_success(self, tmp_path):
        """
        safe_edit 在写入后自动验证（文件大小 + 尾部内容）。
        本测试验证正常路径下写入验证通过。
        """
        path = tmp_path / 'verify.py'
        path.write_text('original content\n')
        result = safe_edit(str(path), 'original', 'modified')
        assert result['replaced'] == 1
        content = path.read_text()
        assert 'modified' in content
        assert content == 'modified content\n'
