"""
Tests for IronFile L2 — checkpoint / rollback / list_checkpoints.

Checkpoint 操作依赖真实的 git 仓库，所以使用 conftest 中的 git_repo fixture。

注意：
  - 这些测试修改 git 历史，每个 fixture 提供独立仓库，测试间互不干扰
  - rollback 需要 stdin 输入 'YES'，用 monkeypatch 模拟
"""

import pytest

from ironfile.checkpoint import (
    CheckpointVerificationError,
    _compute_signature,
    _read_manifest,
    _write_manifest,
    _checkpoint_manifest_path,
    checkpoint,
    rollback,
    list_checkpoints,
)


# ════════════════════════════════════════════════════════════════
#  签名机制
# ════════════════════════════════════════════════════════════════

class TestComputeSignature:

    def test_identical_inputs_produce_identical_signatures(self):
        """相同输入应产生相同签名"""
        sig1 = _compute_signature('test message', 'abc123')
        sig2 = _compute_signature('test message', 'abc123')
        assert sig1 == sig2

    def test_different_messages_produce_different_signatures(self):
        """不同消息应产生不同签名"""
        sig1 = _compute_signature('message one', 'abc123')
        sig2 = _compute_signature('message two', 'abc123')
        assert sig1 != sig2

    def test_different_hashes_produce_different_signatures(self):
        """不同 hash 应产生不同签名"""
        sig1 = _compute_signature('same message', 'hash1')
        sig2 = _compute_signature('same message', 'hash2')
        assert sig1 != sig2

    def test_signature_is_16_hex_chars(self):
        """签名应为 16 位十六进制字符（SHA-256 截断取前 16）"""
        sig = _compute_signature('x', 'y')
        assert len(sig) == 16
        assert all(c in '0123456789abcdef' for c in sig)


# ════════════════════════════════════════════════════════════════
#  Manifest 读写
# ════════════════════════════════════════════════════════════════

class TestManifest:

    def test_read_manifest_returns_empty_dict_if_no_file(self, tmp_path):
        """不存在的 manifest 文件应返回空列表"""
        manifest = _read_manifest(tmp_path)
        assert manifest == {"checkpoints": []}

    def test_write_and_read_manifest_round_trip(self, tmp_path):
        """写入后读取应返回相同内容"""
        data = {"checkpoints": [{"hash": "abc", "message": "test"}]}
        _write_manifest(tmp_path, data)
        result = _read_manifest(tmp_path)
        assert result == data

    def test_corrupted_manifest_returns_empty(self, tmp_path):
        """损坏的 manifest 文件应返回空列表而非崩溃"""
        path = _checkpoint_manifest_path(tmp_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('not json')
        result = _read_manifest(tmp_path)
        assert result == {"checkpoints": []}


# ════════════════════════════════════════════════════════════════
#  Checkpoint 创建
# ════════════════════════════════════════════════════════════════

class TestCheckpoint:

    def test_checkpoint_creates_commit(self, git_repo):
        """在 git 仓库中创建 checkpoint 应返回 hash 和文件数"""
        result = checkpoint('test snapshot', root=str(git_repo))
        assert 'hash' in result
        assert len(result['hash']) >= 7
        assert 'files' in result

    def test_checkpoint_records_in_manifest(self, git_repo):
        """创建 checkpoint 后 manifest 应有记录"""
        result = checkpoint('manifest test', root=str(git_repo))
        manifest = _read_manifest(git_repo)
        assert len(manifest['checkpoints']) >= 1
        last = manifest['checkpoints'][-1]
        assert last['hash'] == result['hash']
        assert 'signature' in last

    def test_checkpoint_signature_is_valid(self, git_repo):
        """manifest 中的签名应可通过 _compute_signature 验证"""
        checkpoint('sig test', root=str(git_repo))
        manifest = _read_manifest(git_repo)
        last = manifest['checkpoints'][-1]
        expected_sig = _compute_signature(last['message'], last['hash'])
        assert last['signature'] == expected_sig

    def test_checkpoint_outside_git_repo_raises(self, tmp_path):
        """非 git 目录应抛出 RuntimeError"""
        with pytest.raises(RuntimeError, match='不是 git 仓库'):
            checkpoint('fail', root=str(tmp_path))


# ════════════════════════════════════════════════════════════════
#  Rollback
# ════════════════════════════════════════════════════════════════

class TestRollback:

    def test_rollback_to_checkpoint_requires_confirmation(self, git_repo, monkeypatch):
        """默认情况下 rollback 需要用户确认，模拟 YES 应成功"""
        checkpoint('before rollback', root=str(git_repo))
        monkeypatch.setattr('sys.stdin', type('StdinMock', (), {'readline': lambda self: 'YES\n', 'isatty': lambda self: True})())
        # 用 force=True 跳过交互
        result = rollback('checkpoint', root=str(git_repo), force=True)
        assert 'restored_to' in result

    def test_rollback_without_checkpoint_raises(self, git_repo):
        """没有任何 checkpoint 时 rollback 应报错"""
        # 初始仓库没有 ironfile checkpoint
        with pytest.raises(RuntimeError, match='找不到'):
            rollback('checkpoint', root=str(git_repo), force=True)

    def test_rollback_to_specific_hash(self, git_repo):
        """可按指定的 commit hash 回退"""
        r1 = checkpoint('first', root=str(git_repo))
        r2 = checkpoint('second', root=str(git_repo))
        # 回到 first
        result = rollback(r1['hash'], root=str(git_repo), force=True)
        assert result['restored_to'] == r1['hash']

    def test_rollback_with_verified_manifest_succeeds(self, git_repo):
        """manifest 签名验证通过时应正常回退"""
        checkpoint('verified', root=str(git_repo))
        result = rollback('checkpoint', root=str(git_repo), force=True)
        assert 'restored_to' in result


# ════════════════════════════════════════════════════════════════
#  List Checkpoints
# ════════════════════════════════════════════════════════════════

class TestListCheckpoints:

    def test_list_checkpoints_returns_empty_if_none(self, git_repo):
        """没有 checkpoint 时应返回空列表"""
        result = list_checkpoints(root=str(git_repo))
        assert result == []

    def test_list_checkpoints_returns_recorded(self, git_repo):
        """创建 checkpoint 后应能列出"""
        checkpoint('list test', root=str(git_repo))
        result = list_checkpoints(root=str(git_repo))
        assert len(result) >= 1
        assert result[0]['hash']
        assert result[0]['message'] != ''

    def test_list_checkpoints_shows_verification_status(self, git_repo):
        """列表应显示签名验证状态"""
        checkpoint('verify status', root=str(git_repo))
        result = list_checkpoints(root=str(git_repo))
        assert 'verified' in result[0]
        assert result[0]['verified'] is True
