#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
神灯AI · Outpaint 自动版本更新脚本
自动同步 prd.md、index.html、index.css 和 main.py 的版本号。
用法:
  python update_version.py        # 自动读取当前版本并自增 0.01
  python update_version.py 0.86   # 手动指定版本号为 0.86
"""
import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
PRD_MD = BASE_DIR / "prd.md"
INDEX_HTML = BASE_DIR / "frontend" / "index.html"
INDEX_CSS = BASE_DIR / "frontend" / "index.css"
MAIN_PY = BASE_DIR / "backend" / "main.py"

ALL_FILES = [PRD_MD, INDEX_HTML, INDEX_CSS, MAIN_PY]


def get_current_version() -> str:
    """从 prd.md 中提取当前版本号"""
    if not PRD_MD.exists():
        return "0.87"
    content = PRD_MD.read_text(encoding="utf-8")
    match = re.search(r"Outpaint v(\d+\.\d+)", content)
    if match:
        return match.group(1)
    return "0.87"


def auto_increment(version: str) -> str:
    """自增版本号，如 0.85 -> 0.86"""
    try:
        val = float(version)
        new_val = val + 0.01
        return f"{new_val:.2f}"
    except Exception:
        return version


def update_file_content(path: Path, old_ver: str, new_ver: str) -> bool:
    if not path.exists():
        print(f"  [WARN] File not found: {path.relative_to(BASE_DIR)}")
        return False
    
    content = path.read_text(encoding="utf-8")
    original = content
    
    # 针对不同文件应用精准的正则替换，杜绝任何全局误伤
    if path.name == "prd.md":
        # 1. 替换 Outpaint vX.XX
        content = re.sub(r"Outpaint v\d+\.\d+", f"Outpaint v{new_ver}", content)
        # 2. 替换 vX.XX (并存迭代重构版)
        content = re.sub(r"v\d+\.\d+ \(并存迭代重构版\)", f"v{new_ver} (并存迭代重构版)", content)
        # 3. 替换标题 # 神灯AI · Outpaint vX.XX
        content = re.sub(r"# 神灯AI · Outpaint v\d+\.\d+", f"# 神灯AI · Outpaint v{new_ver}", content)
    
    elif path.name == "index.html":
        # 1. 替换 title
        content = re.sub(r"Outpaint v\d+\.\d+ — 智能扩图工作站", f"Outpaint v{new_ver} — 智能扩图工作站", content)
        # 2. 替换 version-badge 角标
        content = re.sub(r'class="version-badge">v\d+\.\d+', f'class="version-badge">v{new_ver}', content)
    
    elif path.name == "index.css":
        # 1. 替换头部注释
        content = re.sub(r"Outpaint v\d+\.\d+ — 样式表", f"Outpaint v{new_ver} — 样式表", content)
    
    elif path.name == "main.py":
        # 1. 替换 FastAPI title
        content = re.sub(r'title="神灯AI·Outpaint v\d+\.\d+"', f'title="神灯AI·Outpaint v{new_ver}"', content)
        # 2. 替换 FastAPI version
        content = re.sub(r'version="\d+\.\d+"', f'version="{new_ver}"', content)

    if content != original:
        path.write_text(content, encoding="utf-8")
        print(f"  [OK] Updated: {path.relative_to(BASE_DIR)}")
        return True
    else:
        print(f"  [SKIP] No change in: {path.relative_to(BASE_DIR)}")
        return False


def main():
    current = get_current_version()
    
    if len(sys.argv) > 1:
        target = sys.argv[1]
        # 确保输入格式为 X.XX
        if not re.match(r"^\d+\.\d+$", target):
            print(f"  [FAIL] Invalid version format: '{target}'. Use format like '0.86'")
            sys.exit(1)
    else:
        target = auto_increment(current)
    
    print("=" * 48)
    print(f"  神灯AI · Outpaint Version Sync Utility")
    print(f"  Current Version:  v{current}")
    print(f"  Target Version:   v{target}")
    print("=" * 48)
    print()
    
    updated = 0
    for f in ALL_FILES:
        if update_file_content(f, current, target):
            updated += 1
            
    print()
    print(f"  [SUCCESS] Finished. Updated {updated} files to v{target} successfully.")
    print("=" * 48)


if __name__ == "__main__":
    main()
