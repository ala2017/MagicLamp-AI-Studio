#!/usr/bin/env python3
"""
IronFile MCP Server

将 IronFile 三层防线包装为 MCP Tools，供 Claude Desktop / Claude App 直接调用。

Tools:
  - ironfile_edit:    L1 原子安全编辑（备份→写入→验证→回滚）
  - ironfile_checkpoint: L2 Git 快照
  - ironfile_rollback:   L2 回退快照
  - ironfile_scan:       L3 完整性扫描
  - ironfile_list_checkpoints: 列出 checkpoint 历史
"""

import sys
import os
from pathlib import Path

# 确保 skill 目录内的 src 可以被导入
SKILL_DIR = Path(__file__).resolve().parent
SRC_DIR = SKILL_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# IronFile 引擎
from ironfile.safe_edit import (
    safe_edit,
    IronFileError,
    OldStringNotFound,
    OldStringAmbiguous,
    TruncationSuspected,
    WriteVerificationFailed,
)
from ironfile.checkpoint import (
    checkpoint,
    rollback,
    list_checkpoints,
    CheckpointVerificationError,
)
from ironfile.scanner import scan

# ── 创建 MCP Server ──
server = Server("magiclamp-ai-ironfile")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="ironfile_edit",
            description="原子安全编辑文件。备份→写入→验证→失败回滚。比原生 Edit/Write 多一层安全保证——写入后自动验证文件大小和尾部完整性，不对就自动回滚。所有文件修改都应通过此工具执行。",
            inputSchema={
                "type": "object",
                "properties": {
                    "filepath": {
                        "type": "string",
                        "description": "要编辑的文件路径（绝对路径或相对路径）"
                    },
                    "old_str": {
                        "type": "string",
                        "description": "要替换的原文（必须在文件中精确匹配才执行）"
                    },
                    "new_str": {
                        "type": "string",
                        "description": "替换成的新文本"
                    },
                    "replace_all": {
                        "type": "boolean",
                        "description": "是否替换所有匹配项（默认只替换第一个）",
                        "default": False
                    }
                },
                "required": ["filepath", "old_str", "new_str"]
            }
        ),
        Tool(
            name="ironfile_checkpoint",
            description="创建 Git checkpoint。多文件修改任务开始前打快照，出问题可一键回退。",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "checkpoint 描述信息"
                    },
                    "root": {
                        "type": "string",
                        "description": "项目根目录（默认当前目录）",
                        "default": "."
                    }
                },
                "required": ["message"]
            }
        ),
        Tool(
            name="ironfile_rollback",
            description="回退到最近的 checkpoint 或指定 commit。带上 --force 跳过交互确认。",
            inputSchema={
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "回退目标：'checkpoint'（最近 checkpoint）或具体 commit hash",
                        "default": "checkpoint"
                    },
                    "root": {
                        "type": "string",
                        "description": "项目根目录",
                        "default": "."
                    },
                    "force": {
                        "type": "boolean",
                        "description": "跳过确认提示",
                        "default": False
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="ironfile_scan",
            description="完整性扫描。检查项目文件是否有语法错误、截断、零字节清空。会话恢复时必跑。",
            inputSchema={
                "type": "object",
                "properties": {
                    "root": {
                        "type": "string",
                        "description": "项目根目录",
                        "default": "."
                    },
                    "fix": {
                        "type": "boolean",
                        "description": "是否自动从 git HEAD 恢复损坏文件",
                        "default": False
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="ironfile_list_checkpoints",
            description="列出最近的 ironfile checkpoint 历史。",
            inputSchema={
                "type": "object",
                "properties": {
                    "root": {
                        "type": "string",
                        "description": "项目根目录",
                        "default": "."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "显示数量",
                        "default": 20
                    }
                },
                "required": []
            }
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        if name == "ironfile_edit":
            result = safe_edit(
                arguments["filepath"],
                arguments["old_str"],
                arguments["new_str"],
                replace_all=arguments.get("replace_all", False)
            )
            return [TextContent(
                type="text",
                text=f"✅ 安全编辑完成: {result['replaced']} 处替换, "
                     f"{result['delta_bytes']:+d} 字节"
            )]

        elif name == "ironfile_checkpoint":
            result = checkpoint(
                arguments["message"],
                root=arguments.get("root", ".")
            )
            return [TextContent(
                type="text",
                text=f"✅ Checkpoint {result['hash']} ({result['files']} 文件)"
            )]

        elif name == "ironfile_rollback":
            result = rollback(
                target=arguments.get("target", "checkpoint"),
                root=arguments.get("root", "."),
                force=arguments.get("force", False)
            )
            return [TextContent(
                type="text",
                text=f"✅ 已回退到 {result['restored_to']}"
            )]

        elif name == "ironfile_scan":
            result = scan(
                root=arguments.get("root", "."),
                fix=arguments.get("fix", False)
            )
            ok = result["ok"]
            issues = len(result["issues"])
            if issues == 0:
                msg = f"✅ ALL {ok} FILES INTACT"
            else:
                msg = f"❌ {issues} ISSUES FOUND ({ok} OK)"
                for r in result["issues"]:
                    msg += f"\n   {r.filepath}: {r.detail}"
            return [TextContent(type="text", text=msg)]

        elif name == "ironfile_list_checkpoints":
            cps = list_checkpoints(
                root=arguments.get("root", "."),
                limit=arguments.get("limit", 20)
            )
            if not cps:
                return [TextContent(type="text", text="No ironfile checkpoints found.")]
            lines = []
            for cp in cps:
                verified = "✓" if cp.get("verified", False) else "⚠"
                lines.append(f"  {verified} {cp['hash']}  {cp['message']}")
            return [TextContent(type="text", text="\n".join(lines))]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except OldStringNotFound as e:
        return [TextContent(
            type="text",
            text=f"⚠️ OldStringNotFound: {e}\n请重新读取文件确认当前内容后重试。"
        )]
    except OldStringAmbiguous as e:
        return [TextContent(
            type="text",
            text=f"⚠️ OldStringAmbiguous: {e}\n请用 replace_all=true 或添加更多上下文。"
        )]
    except TruncationSuspected as e:
        return [TextContent(type="text", text=f"🛑 截断预警: {e}")]
    except WriteVerificationFailed as e:
        return [TextContent(
            type="text",
            text=f"❌ 写入验证失败: {e}\n文件已自动从备份恢复。"
        )]
    except CheckpointVerificationError as e:
        return [TextContent(type="text", text=f"❌ 签名验证失败: {e}")]
    except IronFileError as e:
        return [TextContent(type="text", text=f"❌ IronFile 错误: {e}")]
    except RuntimeError as e:
        return [TextContent(type="text", text=f"❌ 运行时错误: {e}")]
    except Exception as e:
        msg = "未知错误: {}: {}".format(type(e).__name__, e)
        return [TextContent(type="text", text="❌ {}".format(msg))]


# ── 入口 ──
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def run():
    import asyncio
    asyncio.run(main())