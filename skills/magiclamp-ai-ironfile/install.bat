@echo off
setlocal enabledelayedexpansion

echo.
echo   ============================================================
echo     IronFile — AI 编程文件安全中间件
echo     一键安装器 (Windows)
echo     先冷备份 · 再行落盘 · 当场验证
echo   ============================================================
echo.
echo   三层防线：L1 原子编辑守卫 · L2 Git 快照 · L3 完整性扫描
echo.

:: ── 1. Check Python ─────────────────────────────────────────

echo   [1/5] 检测 Python...
where python >nul 2>&1
if errorlevel 1 (
    echo   [FAIL] Python 未安装。请安装 Python 3.9+
    echo   Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PY_VER=%%i
echo   [OK] %PY_VER%

:: ── 2. Check Git ─────────────────────────────────────────────

echo.
echo   [2/5] 检测 Git...
where git >nul 2>&1
if errorlevel 1 (
    echo   [FAIL] Git 未安装。请安装 Git。
    echo   Download: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo   [OK] Git found

:: ── 3. Install Python dependencies ────────────────────────────

echo.
echo   [3/5] 安装 Python 依赖 (mcp)...

set "IRONFILE_DIR=%~dp0"
cd /d "%IRONFILE_DIR%"

pip install mcp --break-system-packages -q 2>nul
if errorlevel 1 (
    echo   [FAIL] pip install mcp 失败。检查网络连接。
    pause
    exit /b 1
)
echo   [OK] mcp 已安装

:: ── 4. Run tests (optional sanity check) ──────────────────────

echo.
echo   [4/5] 运行 56 个自检用例...

set "PYTHONPATH=%IRONFILE_DIR%src"
python -m pytest tests/ -q --tb=line 2>nul
if errorlevel 1 (
    echo   [WARN] 部分测试未通过。MCP 服务仍可启动，但建议检查。
) else (
    echo   [OK] 56/56 测试通过
)

:: ── 5. Write Claude Desktop config ────────────────────────────

echo.
echo   [5/5] 配置 Claude Desktop...

set "CONFIG_DIR=%LOCALAPPDATA%\Claude-3p"
set "CONFIG_FILE=%CONFIG_DIR%\claude_desktop_config.json"

if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

:: 使用 Python 合并 JSON（避免依赖 node）
python -c "
import json, os, sys, pathlib

config_path = r'%CONFIG_FILE%'
ironfile_dir = r'%IRONFILE_DIR%'
mcp_server = os.path.join(ironfile_dir, 'mcp_server.py')
src_dir = os.path.join(ironfile_dir, 'src')

config = {}
try:
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
except:
    config = {}

if 'mcpServers' not in config:
    config['mcpServers'] = {}

config['mcpServers']['ironfile'] = {
    'command': 'python',
    'args': [mcp_server],
    'env': {'PYTHONPATH': src_dir}
}

with open(config_path, 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

# 同时给标准 Claude 路径写一份
standard_dir = os.path.join(os.environ['APPDATA'], 'Claude')
standard_config = os.path.join(standard_dir, 'claude_desktop_config.json')
os.makedirs(standard_dir, exist_ok=True)
try:
    if os.path.exists(standard_config):
        with open(standard_config, 'r') as f:
            std_cfg = json.load(f)
    else:
        std_cfg = {}
    if 'mcpServers' not in std_cfg:
        std_cfg['mcpServers'] = {}
    std_cfg['mcpServers']['ironfile'] = config['mcpServers']['ironfile']
    with open(standard_config, 'w') as f:
        json.dump(std_cfg, f, indent=2, ensure_ascii=False)
except:
    pass

print('OK')
" 2>nul

if errorlevel 1 (
    echo   [WARN] 自动配置失败。请手动添加以下内容到：
    echo   %CONFIG_FILE%
    echo.
    echo   "ironfile": {
    echo     "command": "python",
    echo     "args": ["%IRONFILE_DIR%mcp_server.py"],
    echo     "env": { "PYTHONPATH": "%IRONFILE_DIR%src" }
    echo   }
) else (
    echo   [OK] Claude Desktop 配置已写入
)

:: ── Done ─────────────────────────────────────────────────────

echo.
echo   ============================================================
echo     ✅ 安装成功！
echo.
echo     下一步：完全退出 Claude Desktop 后重新打开。
echo.
echo     打开后 Claude 应该自动加载 5 个 IronFile 工具：
echo     · ironfile_edit       — L1 原子安全编辑
echo     · ironfile_checkpoint — L2 Git 快照
echo     · ironfile_rollback   — L2 回退
echo     · ironfile_scan       — L3 完整性扫描
echo     · ironfile_list_checkpoints — 查看快照历史
echo.
echo     验证：对 AI 说 "请用 ironfile_scan 扫描当前项目"
echo   ============================================================
echo.

pause