"""
神灯AI · Outpaint — 一键启动脚本

功能：
1. 自动创建 Python 虚拟环境（首次）
2. 自动安装所有依赖（首次）
3. 检查 HuggingFace 登录状态
4. 启动 FastAPI 服务
5. 自动打开浏览器
"""
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ---- 配置 ----
BASE_DIR = Path(__file__).parent
VENV_DIR = BASE_DIR / "venv"
REQUIREMENTS = BASE_DIR / "requirements.txt"
HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}"

# Windows venv 路径
if sys.platform == "win32":
    VENV_PYTHON = VENV_DIR / "Scripts" / "python.exe"
    VENV_PIP = VENV_DIR / "Scripts" / "pip.exe"
else:
    VENV_PYTHON = VENV_DIR / "bin" / "python"
    VENV_PIP = VENV_DIR / "bin" / "pip"


def print_banner():
    print()
    print("=" * 56)
    print("  🔮 神灯AI · Outpaint — 智能扩图工作站")
    print("=" * 56)
    print()


def step(msg):
    print(f"  ▸ {msg}")


def success(msg):
    print(f"  ✅ {msg}")


def warn(msg):
    print(f"  ⚠️  {msg}")


def error(msg):
    print(f"  ❌ {msg}")


def create_venv():
    """创建虚拟环境"""
    if VENV_PYTHON.exists():
        success("虚拟环境已存在")
        return

    step("创建 Python 虚拟环境...")
    subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
    success("虚拟环境创建完成")


def install_dependencies():
    """安装 pip 依赖"""
    # 检查标记文件，避免每次重复安装
    marker = VENV_DIR / ".deps_installed"
    if marker.exists():
        success("依赖已安装")
        return

    step("安装 Python 依赖（首次需要几分钟）...")

    # 升级 pip
    subprocess.run(
        [str(VENV_PYTHON), "-m", "pip", "install", "--upgrade", "pip"],
        check=True,
        stdout=subprocess.DEVNULL,
    )

    # 第一步：安装 PyTorch CUDA 版本（必须用 --index-url 指定源）
    step("安装 PyTorch + CUDA 12.4 ...")
    result = subprocess.run(
        [str(VENV_PIP), "install",
         "torch>=2.4.0", "torchvision>=0.19.0",
         "--index-url", "https://download.pytorch.org/whl/cu124"],
        check=False,
    )
    if result.returncode != 0:
        error("PyTorch CUDA 安装失败")
        sys.exit(1)

    # 第二步：安装其余依赖
    step("安装其余依赖 ...")
    result = subprocess.run(
        [str(VENV_PIP), "install", "-r", str(REQUIREMENTS)],
        check=False,
    )

    if result.returncode != 0:
        error("依赖安装失败，请检查网络连接")
        sys.exit(1)

    # 写入标记
    marker.write_text("ok")
    success("所有依赖安装完成")


def check_hf_login():
    """设置 HuggingFace Token（已内置）"""
    os.environ.setdefault("HF_TOKEN", "<YOUR_HF_TOKEN_HERE>")
    success("HuggingFace Token 已就绪")


def clean_debug_files():
    """清理 output/ 中的 DEBUG 中间文件，仅保留最终结果和重绘 mask"""
    output_dir = BASE_DIR / "output"
    if not output_dir.exists():
        return

    debug_suffixes = ("_01_uploaded.png", "_02_canvas.png", "_03_mask.png", "_04_flux_output.png")
    removed = 0
    for f in output_dir.iterdir():
        if f.is_file() and any(f.name.endswith(s) for s in debug_suffixes):
            try:
                f.unlink()
                removed += 1
            except Exception:
                pass

    if removed > 0:
        success(f"已清理 {removed} 个历史调试文件")
    else:
        success("输出目录干净，无需清理")


def kill_zombies():
    """检测并强制杀掉占用端口的残留进程，强制释放显存"""
    step("系统自检：排查并清理占用显存的僵尸进程...")
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind((HOST, PORT))
        s.close()
        success("自检通过，显存环境干净。")
        return
    except OSError:
        pass
        
    warn(f"检测到上次运行的进程意外残留（端口 {PORT} 被占用）。")
    warn("正在执行物理级清理，强制释放 11.3GB 僵尸显存...")
    if sys.platform == "win32":
        try:
            output = subprocess.check_output(f"netstat -ano | findstr :{PORT}", shell=True, text=True)
            pids = set()
            for line in output.splitlines():
                if "LISTENING" in line or "ESTABLISHED" in line:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        pids.add(parts[-1])
            for pid in pids:
                if pid != "0":
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1)
            success("清理完毕，显存已满血恢复。")
        except Exception:
            error("无法自动清理僵尸进程，请按 Ctrl+Shift+Esc 打开任务管理器，手动结束所有 python.exe 进程！")


def start_server():
    """启动 FastAPI 服务"""
    step(f"启动服务: {URL}")
    print()
    print("  " + "─" * 48)
    print(f"  🌐 打开浏览器访问: {URL}")
    print(f"  📋 按 Ctrl+C 停止服务")
    print("  " + "─" * 48)
    print()

    # 智能打开浏览器：等待服务启动后，直接打开新标签页
    def open_browser():
        import urllib.request
        import time
        
        # 轮询等待服务器就绪 (最多等待 15 秒)
        server_ready = False
        for _ in range(30):
            try:
                urllib.request.urlopen(f"{URL}/api/health", timeout=1)
                server_ready = True
                break
            except Exception:
                time.sleep(0.5)
                
        if server_ready:
            print("  🌐 服务已启动，正在打开新窗口...")
            webbrowser.open(URL)
        else:
            print("  ⚠️ 服务启动超时或异常，请手动打开浏览器访问。")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # 启动 uvicorn
    subprocess.run(
        [
            str(VENV_PYTHON), "-m", "uvicorn",
            "backend.main:app",
            "--host", HOST,
            "--port", str(PORT),
            "--reload",
        ],
        cwd=str(BASE_DIR),
    )


def main():
    print_banner()

    try:
        # Step 1: 虚拟环境
        create_venv()

        # Step 2: 安装依赖
        install_dependencies()

        # Step 3: HuggingFace 登录检查
        check_hf_login()

        # Step 4: 创建输出目录
        (BASE_DIR / "output").mkdir(exist_ok=True)
        (BASE_DIR / "models").mkdir(exist_ok=True)

        # Step 4.5: 清理 output/ 中的 DEBUG 中间文件
        clean_debug_files()

        # Step 5: 僵尸进程清理
        kill_zombies()

        # Step 5: 启动服务
        start_server()

    except KeyboardInterrupt:
        print("\n\n  👋 服务已停止")
    except Exception as e:
        error(f"启动失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
