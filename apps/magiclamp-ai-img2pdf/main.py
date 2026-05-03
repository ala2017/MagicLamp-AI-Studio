import ctypes
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import zipfile
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from PIL import Image

def enforce_single_instance():
    try:
        kernel32 = ctypes.windll.kernel32
        user32 = ctypes.windll.user32
        
        # Use a unique mutex name
        mutex_name = "Global\\MagiclampAI_Img2Pdf_App_Mutex_v0"
        
        # Create Mutex
        # CreateMutexW returns a handle. If it fails, it returns 0.
        # If it succeeds but the mutex already existed, GetLastError returns ERROR_ALREADY_EXISTS (183).
        mutex = kernel32.CreateMutexW(None, False, mutex_name)
        last_error = kernel32.GetLastError()
        
        if last_error == 183: # ERROR_ALREADY_EXISTS
            # Find the existing window
            WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
            found_hwnd = []
            
            def enum_window_proc(hwnd, lParam):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    title = buff.value
                    if "神灯AI·img2pdf" in title or "magiclamp AI·img2pdf" in title:
                        found_hwnd.append(hwnd)
                        return False # Stop enumeration
                return True
            
            # Keep reference to callback to avoid GC
            proc = WNDENUMPROC(enum_window_proc)
            user32.EnumWindows(proc, 0)
            
            if found_hwnd:
                hwnd = found_hwnd[0]
                # Restore window if minimized
                if user32.IsIconic(hwnd):
                    user32.ShowWindow(hwnd, 9) # SW_RESTORE
                # Bring to front
                user32.SetForegroundWindow(hwnd)
            
            # Exit this instance
            sys.exit(0)
            
        return mutex # Keep handle alive
    except Exception as e:
        print(f"Single instance check failed: {e}")
        return None

APP_MUTEX = None


APP_VERSION = "0.3.23"
SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}

I18N = {
    "zh": {
        "title": "神灯AI·img2pdf",
        "subtitle": "选择目录 -> 自动修复 -> 无缝输出PDF",
        "input_source": "输入目录",
        "input_folder": "图片目录",
        "select_btn": "选择目录/图片",
        "selected_none": "已选择：无",
        "selected_prefix": "已选择：",
        "ai_restoration": "AI清晰修复",
        "ai_on": "开启",
        "ai_mode": "模式",
        "ai_scale": "倍率",
        "preserve_color": "保持原色",
        "output_results": "输出结果",
        "output_status": "输出状态",
        "output_file": "输出文件",
        "open_folder": "打开目录",
        "open_file": "打开文件",
        "start_btn": "开始合并",
        "not_started": "未开始",
        "processing": "处理中",
        "preparing_ai": "准备AI引擎...",
        "restoring": "修复中",
        "merging": "合并中...",
        "completed": "完成",
        "failed": "失败",
        "error": "错误",
        "msg_select_folder": "请选择图片目录",
        "msg_not_found": "目录中未找到图片文件",
        "msg_not_exist": "目录不存在",
        "msg_success": "已生成PDF：",
        "lang_btn": "中/EN",
        "mode_anime": "动漫高清",
        "mode_general": "通用高清",
        "scale_auto": "自动",
        "scale_2x": "2x",
        "scale_4x": "4x"
    },
    "en": {
        "title": "magiclamp AI·img2pdf",
        "subtitle": "Select -> Restore -> Export",
        "input_source": "Input Source",
        "input_folder": "Input Folder",
        "select_btn": "Select Folder/Images",
        "selected_none": "Selected: None",
        "selected_prefix": "Selected: ",
        "ai_restoration": "AI Restoration",
        "ai_on": "On",
        "ai_mode": "Mode",
        "ai_scale": "Scale",
        "preserve_color": "Preserve Colors",
        "output_results": "Output Results",
        "output_status": "Output Status",
        "output_file": "Output File Path",
        "open_folder": "Open Folder",
        "open_file": "Open File",
        "start_btn": "Start Merging",
        "not_started": "Not Started",
        "processing": "Processing",
        "preparing_ai": "Preparing AI Engine...",
        "restoring": "Restoring",
        "merging": "Merging...",
        "completed": "Completed",
        "failed": "Failed",
        "error": "Error",
        "msg_select_folder": "Please select image folder",
        "msg_not_found": "No images found in directory",
        "msg_not_exist": "Directory does not exist",
        "msg_success": "PDF Generated: ",
        "lang_btn": "中/EN",
        "mode_anime": "Anime HD",
        "mode_general": "General HD",
        "scale_auto": "Auto",
        "scale_2x": "2x",
        "scale_4x": "4x"
    }
}
REALESRGAN_URLS = [
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip",
    "https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases/download/v0.2.0/realesrgan-ncnn-vulkan-20220424-windows.zip",
]
REALESRGAN_DIR = "realesrgan"


def find_realesrgan_executable():
    candidates = [
        "realesrgan-ncnn-vulkan.exe",
        "real-esrgan-ncnn-vulkan.exe",
        "realesrgan-ncnn-vulkan",
        "real-esrgan-ncnn-vulkan",
    ]
    app_dir = Path(__file__).resolve().parent
    for name in candidates:
        local = app_dir / name
        if local.exists():
            return str(local)
    for name in candidates:
        path = shutil_which(name)
        if path:
            return path
    return None


def shutil_which(name):
    paths = os.environ.get("PATH", "")
    for p in paths.split(os.pathsep):
        candidate = Path(p) / name
        if candidate.exists():
            return str(candidate)
    return None


def ensure_realesrgan_executable(app_dir):
    exe = find_realesrgan_executable()
    if exe:
        return exe
    app_dir = Path(app_dir)
    download_path = app_dir / "realesrgan.zip"
    extract_dir = app_dir / REALESRGAN_DIR
    extract_dir.mkdir(parents=True, exist_ok=True)
    cached = _find_realesrgan_in_dir(extract_dir)
    if cached:
        return cached
    for url in REALESRGAN_URLS:
        try:
            urllib.request.urlretrieve(url, download_path)
            break
        except Exception:
            continue
    if not download_path.exists():
        return None
    with zipfile.ZipFile(download_path, "r") as zip_ref:
        zip_ref.extractall(extract_dir)
    if download_path.exists():
        download_path.unlink()
    return _find_realesrgan_in_dir(extract_dir)


def _find_realesrgan_in_dir(root_dir):
    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.lower() == "realesrgan-ncnn-vulkan.exe":
                return str(Path(root) / file)
    return None


def list_image_files(folder):
    files = []
    for p in Path(folder).iterdir():
        if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES:
            files.append(p)
    return sorted(files, key=lambda x: x.name.lower())


def build_output_path(folder):
    folder_path = Path(folder)
    name = folder_path.name
    output = folder_path / f"{name}.pdf"
    if not output.exists():
        return output
    ts = time.strftime("%Y%m%d_%H%M%S")
    return folder_path / f"{name}_{ts}.pdf"


def enhance_image_with_realesrgan(exe_path, input_path, output_dir, scale, model, gpu_id, preserve_color):
    exe_dir = Path(exe_path).resolve().parent
    model_dir = exe_dir / "models"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{Path(input_path).stem}.png"
    cmd = [
        exe_path,
        "-i",
        str(input_path),
        "-o",
        str(output_path),
        "-n",
        model,
        "-s",
        str(scale),
    ]
    if model_dir.exists():
        cmd.extend(["-m", str(model_dir)])
    if gpu_id:
        cmd.extend(["-g", str(gpu_id)])
    result = subprocess.run(cmd, cwd=str(exe_dir), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(detail or "AI引擎执行失败")
    if output_path.exists():
        if preserve_color:
            _preserve_color(input_path, output_path)
        return output_path
    return Path(input_path)


def _preserve_color(original_path, enhanced_path):
    try:
        original = Image.open(original_path).convert("RGB")
        enhanced = Image.open(enhanced_path).convert("RGB")
        if original.size != enhanced.size:
            original = original.resize(enhanced.size, Image.LANCZOS)
        orig_y, orig_cb, orig_cr = original.convert("YCbCr").split()
        enh_y, _, _ = enhanced.convert("YCbCr").split()
        merged = Image.merge("YCbCr", (enh_y, orig_cb, orig_cr)).convert("RGB")
        merged.save(enhanced_path)
    except Exception:
        pass


def unify_width_and_merge(image_paths, output_path):
    images = []
    widths = []
    for p in image_paths:
        img = Image.open(p).convert("RGB")
        images.append(img)
        widths.append(img.width)
    target_width = max(widths)
    normalized = []
    total_height = 0
    for img in images:
        if img.width != target_width:
            new_height = int(img.height * (target_width / img.width))
            img = img.resize((target_width, new_height), Image.LANCZOS)
        normalized.append(img)
        total_height += img.height
    max_total_height = 20000
    max_total_pixels = 240_000_000
    if total_height > max_total_height or target_width * total_height > max_total_pixels:
        first, rest = normalized[0], normalized[1:]
        first.save(output_path, save_all=True, append_images=rest)
        return
    merged = Image.new("RGB", (target_width, total_height))
    offset_y = 0
    for img in normalized:
        merged.paste(img, (0, offset_y))
        offset_y += img.height
    merged.save(output_path, save_all=True)


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self._apply_dpi()
        
        self.folder_var = tk.StringVar()
        self.ai_var = tk.BooleanVar(value=False)
        self.mode_var = tk.StringVar()
        self.scale_var = tk.StringVar()
        self.status_var = tk.StringVar(value="未开始")
        self.output_path_var = tk.StringVar(value="未生成")
        self.selected_var = tk.StringVar(value="已选择：无")
        self.preserve_color_var = tk.BooleanVar(value=True)
        self.lang_var = tk.StringVar(value="zh")

        # Set window icon (force use .ico file)
        try:
            if getattr(sys, "frozen", False):
                base_path = sys._MEIPASS
            else:
                base_path = os.path.dirname(os.path.abspath(__file__))

            icon_path = os.path.join(base_path, "app_icon.ico")
            if os.path.exists(icon_path):
                self.iconbitmap(icon_path)
        except Exception:
            pass

        self._apply_style()
        self._build_ui()
        self._update_ui_text()
        self._fit_window()

        self.minsize(840, 620)
        self.geometry(f"{max(self.winfo_reqwidth(), 840)}x{max(self.winfo_reqheight(), 620)}")
        self.resizable(True, True)

    def _apply_dpi(self):
        if os.name == "nt":
            try:
                ctypes.windll.user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
            except Exception:
                try:
                    ctypes.windll.user32.SetProcessDPIAware()
                except Exception:
                    pass
        try:
            self.tk.call("tk", "scaling", 4.0) # Restore 4.0 scaling for high DPI
        except Exception:
            pass

    def _apply_style(self):
        window_bg = "#1A1918"
        bg = "#232221"
        card_bg = "#2E2C2B"
        text = "#F5F5F5"
        muted = "#C9C6C2"
        primary = "#585452"
        secondary = "#6A6562"
        self.configure(bg=window_bg)
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure("App.TFrame", background=bg)
        style.configure("Window.TFrame", background=window_bg)
        style.configure("Card.TLabelframe", background=card_bg, foreground=text)
        style.configure("Card.TLabelframe.Label", background=card_bg, foreground=text, font=("Segoe UI", 10, "bold"))
        style.configure("Card.TFrame", background=card_bg)
        style.configure("Title.TLabel", background=bg, foreground=text, font=("Segoe UI", 16, "bold"))
        style.configure("Subtitle.TLabel", background=bg, foreground=muted, font=("Segoe UI", 11))
        style.configure("Field.TLabel", background=card_bg, foreground=text, font=("Segoe UI", 10))
        style.configure("Status.TLabel", background=card_bg, foreground=muted, font=("Segoe UI", 10))
        style.configure("App.TEntry", fieldbackground="#353230", foreground=text, padding=8)
        style.map("App.TEntry", fieldbackground=[("readonly", "#353230")], foreground=[("readonly", text)])
        style.configure("App.TCombobox", fieldbackground="#353230", foreground=text, padding=20)
        style.map("App.TCombobox", fieldbackground=[("readonly", "#353230")], foreground=[("readonly", text)])
        style.configure("App.TCheckbutton", background=card_bg, foreground=text, indicatorsize=24)
        style.configure("Primary.TButton", background=primary, foreground=text, padding=(22, 12))
        style.map("Primary.TButton", background=[("active", "#6A6663")])
        style.configure("Secondary.TButton", background=secondary, foreground=text, padding=(16, 10))
        style.map("Secondary.TButton", background=[("active", "#77716D")])
        style.configure("Lang.TButton", background=secondary, foreground=text, padding=(3, 2), font=("Segoe UI", 8))
        style.map("Lang.TButton", background=[("active", "#77716D")])

    def _build_ui(self):
        outer = ttk.Frame(self, padding=28, style="Window.TFrame")
        outer.grid(row=0, column=0, sticky="nsew")
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        outer.grid_columnconfigure(0, weight=1)
        outer.grid_rowconfigure(1, weight=1)

        header = ttk.Frame(outer, style="App.TFrame", padding=(0, 8, 0, 12))
        header.grid(row=0, column=0, sticky="ew")
        header.grid_columnconfigure(0, weight=1)
        
        title_container = ttk.Frame(header, style="App.TFrame")
        title_container.grid(row=0, column=0, sticky="ew")
        title_container.grid_columnconfigure(0, weight=1)
        title_container.grid_columnconfigure(1, weight=0)
        title_container.grid_columnconfigure(2, weight=1)

        self.title_label = ttk.Label(title_container, text="神灯AI·img2pdf", style="Title.TLabel")
        self.title_label.grid(row=0, column=1)
        
        # Adjust font size for title to avoid pushing button off screen
        # On high DPI 4.0 scaling, 18pt bold might be too wide.
        # We can dynamically adjust or just pick a slightly smaller safe size.
        # Let's try 16pt. Or rely on column weight to shrink the middle if needed.
        # But ttk grid doesn't shrink content easily.
        # Let's use a slightly smaller font for title.
        
        self.lang_btn = ttk.Button(title_container, text="中/EN", command=self.toggle_language, style="Lang.TButton", width=8)
        self.lang_btn.grid(row=0, column=2, sticky="e", padx=(0, 10))

        self.subtitle_label = ttk.Label(header, text="选择目录 -> 自动修复 -> 无缝输出PDF", style="Subtitle.TLabel")
        self.subtitle_label.grid(row=1, column=0, pady=(6, 0))

        body = ttk.Frame(outer, style="App.TFrame")
        body.grid(row=1, column=0, sticky="nsew")
        body.grid_columnconfigure(0, weight=1)

        self.input_card = ttk.Labelframe(body, text="输入目录", style="Card.TLabelframe", padding=18)
        self.input_card.grid(row=0, column=0, sticky="ew")
        self.input_card.grid_columnconfigure(0, weight=1)
        self.input_label = ttk.Label(self.input_card, text="图片目录", style="Field.TLabel")
        self.input_label.grid(row=0, column=0, sticky="w")
        entry = ttk.Entry(self.input_card, textvariable=self.folder_var, style="App.TEntry", state="readonly", width=36)
        entry.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        self.select_btn = ttk.Button(self.input_card, text="选择目录/图片", command=self.select_folder, style="Secondary.TButton")
        self.select_btn.grid(row=2, column=0, sticky="w", pady=(10, 0))
        ttk.Label(self.input_card, textvariable=self.selected_var, style="Subtitle.TLabel").grid(row=3, column=0, sticky="w", pady=(10, 0))

        self.ai_card = ttk.Labelframe(body, text="AI清晰修复", style="Card.TLabelframe", padding=18)
        self.ai_card.grid(row=1, column=0, sticky="ew", pady=(18, 0))
        self.ai_card.grid_columnconfigure(1, weight=1)
        self.ai_on_label = ttk.Label(self.ai_card, text="AI修复", style="Field.TLabel")
        self.ai_on_label.grid(row=0, column=0, sticky="w")
        self.ai_check = ttk.Checkbutton(self.ai_card, text="开启", variable=self.ai_var, style="App.TCheckbutton")
        self.ai_check.grid(row=0, column=1, sticky="e")
        self.ai_mode_label = ttk.Label(self.ai_card, text="模式", style="Field.TLabel")
        self.ai_mode_label.grid(row=1, column=0, sticky="w", pady=(12, 0))
        self.mode_box = ttk.Combobox(self.ai_card, textvariable=self.mode_var, width=14, state="readonly", style="App.TCombobox")
        self.mode_box.grid(row=2, column=0, sticky="w", pady=(6, 0))
        self.ai_scale_label = ttk.Label(self.ai_card, text="倍率", style="Field.TLabel")
        self.ai_scale_label.grid(row=3, column=0, sticky="w", pady=(12, 0))
        self.scale_box = ttk.Combobox(self.ai_card, textvariable=self.scale_var, width=8, state="readonly", style="App.TCombobox")
        self.scale_box.grid(row=4, column=0, sticky="w", pady=(6, 0))
        self.color_check = ttk.Checkbutton(self.ai_card, text="保持原色", variable=self.preserve_color_var, style="App.TCheckbutton")
        self.color_check.grid(row=5, column=0, sticky="w", pady=(12, 0))

        self.output_card = ttk.Labelframe(body, text="输出结果", style="Card.TLabelframe", padding=18)
        self.output_card.grid(row=2, column=0, sticky="ew", pady=(18, 0))
        self.output_card.grid_columnconfigure(1, weight=1)
        self.output_card.grid_rowconfigure(4, weight=1)
        self.output_status_label = ttk.Label(self.output_card, text="输出状态", style="Field.TLabel")
        self.output_status_label.grid(row=0, column=0, sticky="w")
        ttk.Label(self.output_card, textvariable=self.status_var, style="Status.TLabel").grid(row=0, column=1, sticky="e")
        self.output_file_label = ttk.Label(self.output_card, text="输出文件", style="Field.TLabel")
        self.output_file_label.grid(row=1, column=0, sticky="w", pady=(12, 0))
        output_entry = ttk.Entry(self.output_card, textvariable=self.output_path_var, style="App.TEntry", state="readonly", width=36)
        output_entry.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(6, 0))
        actions_row = ttk.Frame(self.output_card, style="Card.TFrame")
        actions_row.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(12, 0))
        actions_row.grid_columnconfigure(0, weight=1)
        actions_row.grid_columnconfigure(1, weight=1)
        self.open_folder_btn = ttk.Button(actions_row, text="打开目录", command=self.open_output_folder, state=tk.DISABLED, style="Secondary.TButton")
        self.open_folder_btn.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self.open_file_btn = ttk.Button(actions_row, text="打开文件", command=self.open_output_file, state=tk.DISABLED, style="Secondary.TButton")
        self.open_file_btn.grid(row=0, column=1, sticky="ew")

        self.start_btn = ttk.Button(body, text="开始合并", command=self.start_process, style="Primary.TButton")
        self.start_btn.grid(row=3, column=0, sticky="ew", pady=(18, 0))

    def _fit_window(self):
        self.update_idletasks()
        
        # Calculate required size for all content
        req_w = self.winfo_reqwidth()
        req_h = self.winfo_reqheight()
        
        # Ensure we meet minimums but don't force excessively large width
        # The 4.0 scaling might result in huge pixel counts, so we need to be careful.
        # But if the user says "vertical cut off", we MUST respect req_h.
        
        final_w = max(req_w, 840)
        final_h = max(req_h, 620)
        
        # On high DPI + 4.0 scaling, these values might be large (e.g. 1500x1200)
        # This is correct behavior to show all UI.
        self.geometry(f"{final_w}x{final_h}")

    def select_folder(self):
        lang = self.lang_var.get()
        texts = I18N[lang]
        path = filedialog.askdirectory(title=texts["select_btn"])
        if not path:
            return
        self.folder_var.set(path)
        
        try:
            p = Path(path)
            if not p.exists():
                messagebox.showwarning(texts["error"], texts["msg_not_exist"])
                return
            
            files = [f for f in p.iterdir() if f.suffix.lower() in SUPPORTED_SUFFIXES]
            if not files:
                messagebox.showwarning(texts["error"], texts["msg_not_found"])
                return
            
            self.selected_var.set(f"{texts['selected_prefix']}{len(files)}")
        except Exception as e:
            messagebox.showerror(texts["error"], str(e))

    def start_process(self):
        folder = self.folder_var.get().strip()
        if not folder:
            messagebox.showerror("错误", "请选择图片目录")
            return
        if not Path(folder).exists():
            messagebox.showerror("错误", "目录不存在")
            return
        self.start_btn.config(state=tk.DISABLED)
        self.status_var.set("处理中")
        thread = threading.Thread(target=self._run_process, args=(folder, self.ai_var.get(), self.scale_var.get(), self.mode_var.get()))
        thread.daemon = True
        thread.start()

    def _run_process(self, folder, use_ai, scale_label, mode_label):
        try:
            images = list_image_files(folder)
            if not images:
                raise ValueError("目录中未找到图片文件")
            scale = self._resolve_scale(scale_label, images[0])
            model = self._resolve_model(mode_label, scale)
            gpu_id = self._resolve_gpu_id()
            processed = []
            temp_dir = None
            if use_ai:
                self._set_status("preparing_ai")
                exe = ensure_realesrgan_executable(Path(__file__).resolve().parent)
                if not exe:
                    raise ValueError("AI引擎准备失败")
                temp_dir = tempfile.mkdtemp(prefix="ai_enhanced_")
                for idx, p in enumerate(images, start=1):
                    self._set_status("restoring")
                    out = enhance_image_with_realesrgan(exe, p, temp_dir, scale, model, gpu_id, self.preserve_color_var.get())
                    processed.append(out)
            else:
                processed = images
            output_path = build_output_path(folder)
            self._set_status("merging")
            unify_width_and_merge(processed, output_path)
            self._set_output_path(str(output_path))
            self._notify_success(str(output_path))
        except Exception as e:
            self._notify_error(str(e))
        finally:
            if temp_dir and Path(temp_dir).exists():
                try:
                    shutil.rmtree(temp_dir)
                except Exception:
                    pass
            self._reset_ui()

    def toggle_language(self):
        self.lang_var.set("en" if self.lang_var.get() == "zh" else "zh")
        self._update_ui_text()

    def _update_ui_text(self):
        lang = self.lang_var.get()
        texts = I18N[lang]
        
        # Window Title
        self.title(f"{texts['title']} - {APP_VERSION}")
        
        # Header
        self.title_label.config(text=texts["title"])
        self.subtitle_label.config(text=texts["subtitle"])
        self.lang_btn.config(text=texts["lang_btn"])
        
        # Resize title font based on text length to avoid overflow
        # English title is longer, so use smaller font
        if lang == "en":
            style = ttk.Style()
            style.configure("Title.TLabel", font=("Segoe UI", 14, "bold"))
        else:
            style = ttk.Style()
            style.configure("Title.TLabel", font=("Segoe UI", 16, "bold"))
            
        # Cards
        self.input_card.config(text=texts["input_source"])
        self.input_label.config(text=texts["input_folder"])
        self.select_btn.config(text=texts["select_btn"])
        
        self.ai_card.config(text=texts["ai_restoration"])
        self.ai_on_label.config(text=texts["ai_on"])
        self.ai_check.config(text=texts["ai_on"])
        self.ai_mode_label.config(text=texts["ai_mode"])
        
        # Update combo box values and current selection
        current_mode = self.mode_var.get()
        mode_values = [texts["mode_anime"], texts["mode_general"]]
        self.mode_box.config(values=mode_values)
        if current_mode not in mode_values:
            self.mode_var.set(mode_values[0])
            
        self.ai_scale_label.config(text=texts["ai_scale"])
        
        current_scale = self.scale_var.get()
        scale_values = [texts["scale_auto"], texts["scale_2x"], texts["scale_4x"]]
        self.scale_box.config(values=scale_values)
        if current_scale not in scale_values:
            self.scale_var.set(scale_values[0])

        self.color_check.config(text=texts["preserve_color"])
        
        self.output_card.config(text=texts["output_results"])
        self.output_status_label.config(text=texts["output_status"])
        self.output_file_label.config(text=texts["output_file"])
        self.open_folder_btn.config(text=texts["open_folder"])
        self.open_file_btn.config(text=texts["open_file"])
        
        self.start_btn.config(text=texts["start_btn"])
        
        # Update dynamic variables
        if "无" in self.selected_var.get() or "None" in self.selected_var.get():
            self.selected_var.set(texts["selected_none"])
        elif self.selected_var.get().startswith(("已选择：", "Selected: ")):
            val = self.selected_var.get().split(": ")[-1] if ": " in self.selected_var.get() else self.selected_var.get().split("：")[-1]
            self.selected_var.set(f"{texts['selected_prefix']}{val}")
            
        if "未开始" in self.status_var.get() or "Not Started" in self.status_var.get():
            self.status_var.set(texts["not_started"])
            
        if "未生成" in self.output_path_var.get() or "Not Generated" in self.output_path_var.get():
            self.output_path_var.set("尚未生成" if lang == "zh" else "Not Generated")

    def _set_status(self, key):
        lang = self.lang_var.get()
        text = I18N[lang].get(key, key)
        self.after(0, lambda: self.status_var.set(text))

    def _notify_success(self, output_path):
        lang = self.lang_var.get()
        texts = I18N[lang]
        self.after(0, lambda: messagebox.showinfo(texts["completed"], f"{texts['msg_success']}{output_path}"))
        self.after(0, lambda: self.status_var.set(texts["completed"]))

    def _notify_error(self, msg):
        lang = self.lang_var.get()
        texts = I18N[lang]
        self.after(0, lambda: messagebox.showerror(texts["failed"], msg))
        self.after(0, lambda: self.status_var.set(texts["failed"]))

    def _reset_ui(self):
        self.after(0, lambda: self.start_btn.config(state=tk.NORMAL))

    def _set_output_path(self, path):
        def update():
            self.output_path_var.set(path)
            self.open_folder_btn.config(state=tk.NORMAL)
            self.open_file_btn.config(state=tk.NORMAL)
        self.after(0, update)

    def open_output_folder(self):
        path = self.output_path_var.get().strip()
        if not path:
            return
        folder = str(Path(path).parent)
        os.startfile(folder)

    def open_output_file(self):
        path = self.output_path_var.get().strip()
        if not path:
            return
        os.startfile(path)

    def _resolve_scale(self, scale_label, sample_image):
        if scale_label == "4x":
            return 4
        if scale_label == "2x":
            return 2
        img = Image.open(sample_image)
        width = img.width
        img.close()
        return 4 if width < 1600 else 2

    def _resolve_model(self, mode_label, scale):
        if mode_label == "动漫高清":
            return "realesr-animevideov3"
        return "realesrgan-x4plus"

    def _resolve_gpu_id(self):
        gpu_id = os.environ.get("REAL_ESRGAN_GPU", "0").strip()
        if gpu_id.lower() in {"", "auto", "none"}:
            return None
        return gpu_id


if __name__ == "__main__":
    if os.name == "nt":
        # Enforce single instance on Windows
        APP_MUTEX = enforce_single_instance()
        
    app = App()
    app.mainloop()
