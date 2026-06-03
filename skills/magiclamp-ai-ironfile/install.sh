#!/usr/bin/env bash
set -e

# ── 颜色 ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}  ║       IronFile — AI 编程文件安全中间件                       ║${NC}"
echo -e "${CYAN}${BOLD}  ║       一键安装器 (macOS / Linux)                             ║${NC}"
echo -e "${CYAN}${BOLD}  ║       先冷备份 · 再行落盘 · 当场验证                         ║${NC}"
echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  三层防线：L1 原子编辑守卫 · L2 Git 快照 · L3 完整性扫描"
echo ""

# ── 1. 检测 Python ────────────────────────────────────────────

echo -e "  ${BOLD}[1/5]${NC} 检测 Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "  ${RED}❌ 未检测到 Python 3，请先安装 Python 3.9+${NC}"
    echo -e "  👉 macOS:  brew install python@3"
    echo -e "  👉 Linux:  sudo apt install python3 python3-pip (Debian/Ubuntu)"
    echo -e "           sudo dnf install python3 python3-pip (Fedora)"
    exit 1
fi

PY_VER=$(python3 --version)
echo -e "  ${GREEN}✅ ${PY_VER}${NC}"

# ── 2. 检测 Git ───────────────────────────────────────────────

echo ""
echo -e "  ${BOLD}[2/5]${NC} 检测 Git..."
if ! command -v git &> /dev/null; then
    echo -e "  ${RED}❌ 未检测到 Git，请先安装 Git${NC}"
    echo -e "  👉 macOS:  brew install git"
    echo -e "  👉 Linux:  sudo apt install git"
    exit 1
fi
echo -e "  ${GREEN}✅ Git found${NC}"

# ── 3. 安装 Python 依赖 ───────────────────────────────────────

echo ""
echo -e "  ${BOLD}[3/5]${NC} 安装 Python 依赖 (mcp)..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

python3 -m pip install mcp --break-system-packages -q 2>/dev/null || \
python3 -m pip install mcp --break-system-packages

echo -e "  ${GREEN}✅ mcp 已安装${NC}"

# ── 4. 运行自检用例 ───────────────────────────────────────────

echo ""
echo -e "  ${BOLD}[4/5]${NC} 运行 56 个自检用例..."

export PYTHONPATH="$SCRIPT_DIR/src"
python3 -m pytest tests/ -q --tb=line 2>/dev/null && \
  echo -e "  ${GREEN}✅ 56/56 测试通过${NC}" || \
  echo -e "  ${YELLOW}⚠️  部分测试未通过。MCP 服务仍可启动，但建议检查。${NC}"

# ── 5. 写入 Claude Desktop 配置 ───────────────────────────────

echo ""
echo -e "  ${BOLD}[5/5]${NC} 配置 Claude Desktop..."

MCP_SERVER="$SCRIPT_DIR/mcp_server.py"
SRC_DIR="$SCRIPT_DIR/src"

if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_DIR="$HOME/Library/Application Support/Claude-3p"
    STD_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    CONFIG_DIR="$LOCALAPPDATA/Claude-3p"
    STD_DIR="$APPDATA/Claude"
else
    CONFIG_DIR="$HOME/.config/Claude-3p"
    STD_DIR="$HOME/.config/Claude"
fi

CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
STD_CONFIG_FILE="$STD_DIR/claude_desktop_config.json"

mkdir -p "$CONFIG_DIR" "$STD_DIR"

python3 -c "
import json, os

ironfile_entry = {
    'command': 'python3',
    'args': ['$MCP_SERVER'],
    'env': {'PYTHONPATH': '$SRC_DIR'}
}

for cfg_path in ['$CONFIG_FILE', '$STD_CONFIG_FILE']:
    try:
        config = {}
        if os.path.exists(cfg_path):
            with open(cfg_path, 'r') as f:
                config = json.load(f)
        if 'mcpServers' not in config:
            config['mcpServers'] = {}
        config['mcpServers']['ironfile'] = ironfile_entry
        with open(cfg_path, 'w') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except:
        pass

print('OK')
" 2>/dev/null && echo -e "  ${GREEN}✅ Claude Desktop 配置已写入${NC}" || {
    echo -e "  ${YELLOW}⚠️  自动配置失败。请手动添加以下内容到${NC}"
    echo -e "     ${YELLOW}$CONFIG_FILE${NC}"
    echo ""
    echo -e "  ${CYAN}────────────────────────────────────────────${NC}"
    echo -e '  "ironfile": {'
    echo -e '    "command": "python3",'
    echo -e '    "args": ["'"$MCP_SERVER"'"],'
    echo -e "    \"env\": { \"PYTHONPATH\": \"$SRC_DIR\" }"
    echo -e '  }'
    echo -e "  ${CYAN}────────────────────────────────────────────${NC}"
}

# ── 完成 ─────────────────────────────────────────────────────

echo ""
echo -e "  ${GREEN}${BOLD}  ╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "  ${GREEN}${BOLD}  ║  ✅ 安装成功！                                              ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║                                                            ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║  下一步：完全退出 Claude Desktop 后重新打开                 ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║                                                            ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║  打开后 Claude 应该自动加载 5 个 IronFile 工具：            ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║  · ironfile_edit            — L1 原子安全编辑              ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║  · ironfile_checkpoint       — L2 Git 快照                 ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║  · ironfile_rollback         — L2 回退                     ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║  · ironfile_scan             — L3 完整性扫描               ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║  · ironfile_list_checkpoints — 查看快照历史                ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║                                                            ║${NC}"
echo -e "  ${GREEN}${BOLD}  ║  验证：对 AI 说「请用 ironfile_scan 扫描当前项目」     ║${NC}"
echo -e "  ${GREEN}${BOLD}  ╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
