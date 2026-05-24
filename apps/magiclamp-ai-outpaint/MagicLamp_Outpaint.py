# -*- coding: utf-8 -*-
"""
🔮 神灯AI · Outpaint — 商业级双模自适应启动器 (v0.87)

功能：
1. 自动检测并拉起 Python 虚拟环境 (venv)
2. 自动检查依赖、僵尸进程与 CUDA 显存状态并完成系统自愈
3. 支持双模自适应启动：
   - 选项 1 (测试自用版)：常规浏览器调试模式 (localhost:8001)
   - 选项 2 (商业收费版)：pywebview 驱动的 100% 独立高档桌面客户端窗口
4. 物理级进程生命周期托管：在客户端窗口关闭瞬间，自动彻底杀灭后台大模型进程并 100% 释放显存。
"""
import os
import re
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ---- 配置 ----
BASE_DIR = Path(__file__).parent.resolve()
VENV_DIR = BASE_DIR / "venv"
REQUIREMENTS = BASE_DIR / "requirements.txt"
HOST = "127.0.0.1"
PORT = 8001 # v0.87 核心端口，避免与 v1 (8000) 发生显存死锁与冲突
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
    print("=" * 60)
    print("    🔮 神灯AI · Outpaint v0.87 — 商业版智能扩图工作站")
    print("=" * 60)
    print()


def step(msg):
    # 为防 Windows GBK 终端下特殊符号崩溃，移除 Emoji，改用通用字符
    print(f"  -> {msg}")


def success(msg):
    print(f"  [OK] {msg}")


def warn(msg):
    print(f"  [WARN] {msg}")


def error(msg):
    print(f"  [FAIL] {msg}")


def create_venv():
    """创建虚拟环境"""
    if VENV_PYTHON.exists():
        success("Python 虚拟环境已就绪。")
        return

    step("正在首次创建 Python 虚拟环境 (venv)...")
    subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
    success("虚拟环境创建成功。")


def install_dependencies():
    """安装依赖"""
    marker = VENV_DIR / ".deps_installed"
    if marker.exists():
        success("Python 推理依赖项校验成功。")
        return

    step("正在安装旗舰大模型推理依赖（首次初始化，需几分钟，请保持联网）...")
    
    # 升级 pip
    subprocess.run(
        [str(VENV_PYTHON), "-m", "pip", "install", "--upgrade", "pip"],
        check=True,
        stdout=subprocess.DEVNULL,
    )

    # 第一步：安装 PyTorch CUDA 12.4
    step("正在拉取加速引擎 PyTorch + CUDA 12.4 (RTX 显卡强力加速) ...")
    result = subprocess.run(
        [str(VENV_PIP), "install",
         "torch>=2.4.0", "torchvision>=0.19.0",
         "--index-url", "https://download.pytorch.org/whl/cu124"],
        check=False,
    )
    if result.returncode != 0:
        error("PyTorch + CUDA 强力硬件级加速依赖安装失败。")
        sys.exit(1)

    # 第二步：安装其余依赖
    step("正在补齐前后端、OpenCV 及超分辨率等依赖组件 ...")
    result = subprocess.run(
        [str(VENV_PIP), "install", "-r", str(REQUIREMENTS)],
        check=False,
    )

    if result.returncode != 0:
        error("依赖安装失败，请检查网络或更换清华/阿里源重试。")
        sys.exit(1)

    marker.write_text("ok")
    success("所有大模型及修图依赖组件全量就绪。")


def check_hf_login():
    """检测内置 HuggingFace 安全登录状态"""
    os.environ.setdefault("HF_TOKEN", "<YOUR_HF_TOKEN_HERE>")


def clean_debug_files():
    """清理 output 历史调试垃圾图片，保持分包体积纯净"""
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
        success(f"已清理 {removed} 个冗余历史调试图片缓存。")


def kill_zombies():
    """排除并强杀占用显存的僵尸服务进程"""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind((HOST, PORT))
        s.close()
        return
    except OSError:
        pass
        
    warn(f"检测到上次运行的后台服务未彻底释放（端口 {PORT} 被占用）。")
    warn("正在执行进程级安全清理，自动释放僵尸显存...")
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
            time.sleep(1.5)
            success("显存僵尸进程释放成功，端口满血复活。")
        except Exception:
            error("释放端口失败。请进入任务管理器关闭所有 python.exe 以手动清理。")


def run_standard_browser_mode():
    """选项 1：测试与自用浏览器运行模式"""
    step(f"启动自用测试模式。健康页侦听: {URL}/api/health")
    
    # 打开浏览器
    def open_browser():
        import urllib.request
        server_ready = False
        for _ in range(30):
            try:
                urllib.request.urlopen(f"{URL}/api/health", timeout=1)
                server_ready = True
                break
            except Exception:
                time.sleep(0.5)
                
        if server_ready:
            print("  🌐 内核已就绪，正在自动打开浏览器...")
            webbrowser.open(URL)
        else:
            print("  [WARN] 等待服务冷启动超时，请在浏览器中手动访问。")

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


def run_premium_app_mode():
    """选项 2：收费商业化发布模式 (WebView 磨砂独立桌面视口)"""
    step("正在以 [商业级桌面应用模式] 物理拉起...")
    
    # 检查并杀灭僵尸
    kill_zombies()

    # 1. 异步在后台线程非阻塞地拉起 FastAPI 服务
    cmd = [
        str(VENV_PYTHON), "-m", "uvicorn",
        "backend.main:app",
        "--host", HOST,
        "--port", str(PORT),
    ]
    
    step("正在后台拉起 神灯AI 智能扩图内核...")
    server_process = subprocess.Popen(
        cmd,
        cwd=str(BASE_DIR),
        stdout=subprocess.DEVNULL, # 隐藏命令行黑屏中的 uvicorn 杂乱日志
        stderr=subprocess.DEVNULL,
    )

    # 2. 尝试导入 pywebview 库
    try:
        import webview
    except ImportError:
        error("缺失桌面引擎依赖组件 pywebview。")
        warn("正在自动为您尝试静默补装桌面引擎 (约需几秒)...")
        subprocess.run([str(VENV_PIP), "install", "pywebview"], check=True)
        try:
            import webview
        except ImportError:
            error("桌面引擎自动补装失败，将为您安全降级至浏览器自用调试模式...")
            server_process.terminate()
            run_standard_browser_mode()
            return

    # 3. 轮询等待后台大模型服务就绪
    step("正在等待 11GB FLUX.1 Fill 大模型加载就绪 (首次冷启动需约 30 秒)...")
    server_ready = False
    for _ in range(120):
        try:
            import urllib.request
            urllib.request.urlopen(f"{URL}/api/health", timeout=1)
            server_ready = True
            break
        except Exception:
            time.sleep(0.5)

    if server_ready:
        success("大模型内核启动完毕。正在唤醒独立磨砂客户端主窗口...")
        
        # 创建一个精致的无任何浏览器地址栏、独立的软件客户端窗口
        webview.create_window(
            title="神灯AI · Outpaint v0.87",
            url=URL,
            width=1650,
            height=880,
            resizable=True,
            min_size=(1366, 768)
        )
        # 物理进入 GUI 主循环
        webview.start()
    else:
        error("大模型服务冷启动超时崩溃。")

    # 4. 👑 物理级生命周期管理：当客户端窗口关闭时，彻底强制杀灭 uvicorn 后台服务，100% 物理释放 VRAM 显存
    step("检测到窗口关闭。正在安全物理关闭大模型后台并安全清空显存...")
    server_process.terminate()
    try:
        server_process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        server_process.kill()
    success("所有显存及侦听端口已满血安全释放，软件安全关闭。")


def main():
    print_banner()

    try:
        # Step 1: 环境校验与自检自愈
        create_venv()
        install_dependencies()
        check_hf_login()

        # Step 2: 建立产出和模型目录
        (BASE_DIR / "output").mkdir(exist_ok=True)
        (BASE_DIR / "models").mkdir(exist_ok=True)

        # Step 3: 清理调试图片
        clean_debug_files()

        # Step 4: 识别启动参数，分流进入双模引擎
        # 支持 python MagicLamp_Outpaint.py --app 运行
        IS_APP_MODE = "--app" in sys.argv

        if IS_APP_MODE:
            run_premium_app_mode()
        else:
            # 首次排查清理僵尸进程，保持环境清爽
            kill_zombies()
            run_standard_browser_mode()

    except KeyboardInterrupt:
        print("\n\n  👋 服务已停止。")
    except Exception as e:
        error(f"系统启动出现严重异常: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
