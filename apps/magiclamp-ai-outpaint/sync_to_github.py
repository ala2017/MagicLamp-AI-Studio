import os
import subprocess
import shutil
from pathlib import Path

def safe_sync_to_github():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("错误：未找到 GITHUB_TOKEN 环境变量")
        return

    # 源目录：当前项目路径
    src_dir = Path(r"f:\=神灯智库\- 神灯AI·app\神灯AI·outpaint")
    
    # 临时工作目录
    temp_workspace = src_dir / "scratch_sync_temp"
    if temp_workspace.exists():
        shutil.rmtree(temp_workspace, ignore_errors=True)
    temp_workspace.mkdir()

    print("正在建立与远程仓库的安全连接...")
    remote_url = f"https://{token}@github.com/ala2017/MagicLamp-AI-Studio.git"
    
    # 浅克隆以保证速度和不破坏其他文件
    clone_cmd = ["git", "clone", "--depth", "1", remote_url, str(temp_workspace)]
    res = subprocess.run(clone_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("同步连接失败，请检查网络或 Token 权限。")
        print(res.stderr)
        return

    print("连接成功！正在精准对齐目标目录: apps/magiclamp-ai-outpaint")
    target_app_dir = temp_workspace / "apps" / "magiclamp-ai-outpaint"
    
    # 如果远程已有该目录，先清空其旧代码（但不删 .git 和其他无关目录）
    if target_app_dir.exists():
        shutil.rmtree(target_app_dir, ignore_errors=True)
    target_app_dir.mkdir(parents=True, exist_ok=True)

    print("正在同步本地最新代码至远程队列...")
    # 忽略的文件和目录
    ignore_list = ['.git', 'venv', '__pycache__', 'scratch_sync_temp', '.kiro', '.browser_opened']

    for item in src_dir.iterdir():
        if item.name in ignore_list:
            continue
        dest_item = target_app_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest_item)
        else:
            shutil.copy2(item, dest_item)

    print("代码装载完毕，开始安全推送...")
    # 在临时仓库中进行 git 操作
    os.chdir(temp_workspace)
    
    # 配置本地 git 用户信息（防止由于全局未配置导致 commit 失败）
    subprocess.run(["git", "config", "user.name", "ala2017"], capture_output=True)
    subprocess.run(["git", "config", "user.email", "aidiemail@gmail.com"], capture_output=True)

    subprocess.run(["git", "add", "."], capture_output=True)
    
    # 检查是否有改动
    status_res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
    if not status_res.stdout.strip():
        print("远程目录已是最新状态，无需推送。")
    else:
        commit_cmd = ["git", "commit", "-m", "backup(outpaint): 同步神灯AI·Outpaint v0.87 最新工作站代码"]
        subprocess.run(commit_cmd, capture_output=True)
        
        push_cmd = ["git", "push", "origin", "main"]
        push_res = subprocess.run(push_cmd, capture_output=True, text=True)
        
        if push_res.returncode == 0:
            print("🚀 恭喜！同步备份 100% 成功完成！")
            print("您的代码已安全落定至：MagicLamp-AI-Studio/apps/magiclamp-ai-outpaint")
        else:
            print("推送失败！")
            print(push_res.stderr)

    # 清理现场
    os.chdir(src_dir)
    try:
        # 移除只读属性以便删除
        def remove_readonly(func, path, _):
            os.chmod(path, 0o777)
            func(path)
        shutil.rmtree(temp_workspace, onerror=remove_readonly)
    except Exception as e:
        print(f"清理临时目录时遇到小提示: {e}，您可以稍后手动删除 scratch_sync_temp 文件夹。")

if __name__ == "__main__":
    safe_sync_to_github()
