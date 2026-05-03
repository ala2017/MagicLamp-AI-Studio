#!/usr/bin/env python3
"""
MagiclampAI Redteam Skill - 自动化上传脚本

功能：
1. 初始化git仓库
2. 创建GitHub仓库
3. 提交代码
4. 推送到远程仓库
"""

import os
import subprocess
from pathlib import Path

# 项目路径
PROJECT_DIR = r"F:\=神灯智库\- 神灯AI·app\神灯AI·专家学习系统\magiclampAI-redteamskill"

def run_command(cmd, description):
    """执行命令并打印结果"""
    try:
        result = subprocess.run(
            cmd,
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            check=True,
            encoding='utf-8',
            shell=True
        )
        print(f"✅ {description}")
        if result.stdout.strip():
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description}")
        print(f"错误: {e.stderr}")
        return False

def main():
    os.chdir(PROJECT_DIR)
    print(f"📍 工作目录: {PROJECT_DIR}")
    print("=" * 50)

    # Step 1: 初始化 Git 仓库
    if not os.path.exists(os.path.join(PROJECT_DIR, '.git')):
        print("\n📦 Step 1: 初始化 Git 仓库")
        run_command("git init", "Git 仓库已初始化")
    else:
        print("\n✅ Git 仓库已存在，跳过初始化")

    # Step 2: 添加所有文件
    print("\n📝 Step 2: 添加文件到暂存区")
    run_command("git add .", "文件已添加到暂存区")

    # Step 3: 创建初始提交
    print("\n💾 Step 3: 创建初始提交")
    commit_msg = """feat: initial commit - MagiclampAI Redteam Skill v1.0

- 实现分析优先原则
- 实现提问克制机制
- 4个核心工具：价值扫描器、逻辑检查器、风险雷达、优化器
- 5步流程：信息收集→问题生成→问题合并→深度分析→输出报告
- 基于日本AI安全研究所、AVID框架、Promptfoo模式的融合设计"""

    run_command(f'git commit -m "{commit_msg}"', "创建初始提交")

    # Step 4: 创建 GitHub 仓库
    print("\n🌐 Step 4: 创建 GitHub 仓库")
    repo_name = "magiclampai/redteam-skill"
    run_command(
        f"gh repo create {repo_name} --public --source=. --remote=origin",
        "GitHub 仓库已创建"
    )

    # Step 5: 推送到远程仓库
    print("\n🚀 Step 5: 推送到远程仓库")
    run_command("git push origin main", "代码已推送到 GitHub")

    print("\n" + "=" * 50)
    print("✅ 所有任务完成！")
    print(f"🔗 仓库地址: https://github.com/{repo_name}")
    print("=" * 50)

if __name__ == "__main__":
    main()
