/**
 * 神灯AI · Outpaint — 前端主逻辑
 * 功能：Fabric.js 画布、图片上传/拖放、AuraSync 极光主题、
 *       VRAM 显存监控、AI 生成任务提交与轮询、极客终端、计时器、下载壁纸
 */

// ============================================================
// 常量 & 全局状态
// ============================================================
const CANVAS_W = 1280;
const CANVAS_H = 720;
const DISPLAY_SCALE = 0.75; // 画布在屏幕上的缩放比
const DISPLAY_W = Math.round(CANVAS_W * DISPLAY_SCALE);
const DISPLAY_H = Math.round(CANVAS_H * DISPLAY_SCALE);

let fabricCanvas = null;
let originalFile = null;
let currentTaskId = null;
let lastGeneratedTaskId = null; // 重绘：保存上一次成功生成的 task_id
let lastLayoutData = null;      // 重绘：保存上一次排版参数
let pollingInterval = null;
let timerInterval = null;
let timerStart = 0;

// ============================================================
// 工具函数
// ============================================================
const $ = (id) => document.getElementById(id);

function showToast(msg, type = "info") {
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    
    const textSpan = document.createElement("span");
    textSpan.textContent = msg;
    textSpan.style.wordBreak = "break-all";
    el.appendChild(textSpan);
    
    // 如果是报错，添加关闭按钮，并且不自动消失
    if (type === "error") {
        const closeBtn = document.createElement("span");
        closeBtn.innerHTML = "&times;";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.marginLeft = "12px";
        closeBtn.style.fontWeight = "bold";
        closeBtn.style.fontSize = "18px";
        closeBtn.onclick = () => {
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 300);
        };
        el.appendChild(closeBtn);
        document.body.appendChild(el);
    } else {
        document.body.appendChild(el);
        setTimeout(() => {
            if (el.parentNode) {
                el.style.opacity = "0";
                setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
            }
        }, 3500);
    }
}

// ============================================================
// 初始化
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    try {
        initCanvas();
        bindEvents();
        checkHealth();
        startAutoReloadWatcher();

        // 请求通知权限
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        console.log("[Outpaint] 初始化完成");
    } catch (err) {
        console.error("[Outpaint] 初始化失败:", err);
    }
});

// ============================================================
// Fabric.js 画布初始化
// ============================================================
function initCanvas() {
    const container = $("canvas-container");
    container.style.width = DISPLAY_W + "px";
    container.style.height = DISPLAY_H + "px";

    fabricCanvas = new fabric.Canvas("fabric-canvas", {
        width: DISPLAY_W,
        height: DISPLAY_H,
        backgroundColor: "transparent",
        selection: false,
    });

    // ── 画布边界物理约束（撞墙效果）──
    fabricCanvas.on("object:moving", enforceMoveBounds);
    fabricCanvas.on("object:scaling", enforceScaleBounds);
}

/**
 * 移动边界约束：采用成熟的防抖动（Anti-Jitter）算法
 * 严格限制图片在画布内部，通过包围盒偏移量计算消除抖动
 */
function enforceMoveBounds(e) {
    const obj = e.target;
    
    // 如果图片超出画布尺寸，直接不限制（否则会卡死），但下面有缩放限制保证其不会发生
    if (obj.width * obj.scaleX > DISPLAY_W || obj.height * obj.scaleY > DISPLAY_H) {
        return;
    }

    // 关键：强制刷新内部坐标缓存，这是解决抖动的核心
    obj.setCoords();

    // 获取真实的视觉包围盒
    const bounds = obj.getBoundingRect();

    // 基于偏移量(Offset)的钳位算法：
    // obj.top 并不一定是图像的最上沿(比如原点在 center)，
    // 我们需要计算 bounds.top 和 obj.top 之间的差值，来推导真正的限制范围。
    const newTop = Math.max(
        (obj.top - bounds.top), 
        Math.min(obj.top, DISPLAY_H - bounds.height + (obj.top - bounds.top))
    );
    
    const newLeft = Math.max(
        (obj.left - bounds.left), 
        Math.min(obj.left, DISPLAY_W - bounds.width + (obj.left - bounds.left))
    );

    obj.set({ top: newTop, left: newLeft });
}

/**
 * 缩放边界约束：
 * - 最小：缩放后高度 >= 画布高度的 50%
 * - 最大：缩放后高度 <= 画布高度的 300%
 * 缩放后也强制执行移动边界约束
 */
function enforceScaleBounds(e) {
    const obj = e.target;
    const scaledW = obj.width * obj.scaleX;
    const scaledH = obj.height * obj.scaleY;
    
    const minH = DISPLAY_H * 0.2; // 最小允许缩放至画布的 20%
    
    // 最大缩放限制：宽高都不能超过画布，否则会卡死在撞墙判定里
    const maxScaleW = DISPLAY_W / obj.width;
    const maxScaleH = DISPLAY_H / obj.height;
    const maxScale = Math.min(maxScaleW, maxScaleH);

    if (scaledH < minH) {
        const fixScale = minH / obj.height;
        obj.set({ scaleX: fixScale, scaleY: fixScale });
    }
    
    if (obj.scaleX > maxScale || obj.scaleY > maxScale) {
        obj.set({ scaleX: maxScale, scaleY: maxScale });
    }

    // 缩放后也执行移动约束
    enforceMoveBounds(e);
}

// ============================================================
// 事件绑定
// ============================================================
function bindEvents() {
    // 上传按钮
    $("btn-upload").addEventListener("click", () => $("file-input").click());
    $("file-input").addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            loadImage(e.target.files[0]);
        }
    });

    // 拖放
    const container = $("canvas-container");
    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        container.classList.add("drag-over");
    });
    container.addEventListener("dragleave", () => container.classList.remove("drag-over"));
    container.addEventListener("drop", (e) => {
        e.preventDefault();
        container.classList.remove("drag-over");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            loadImage(e.dataTransfer.files[0]);
        }
    });

    // 点击空状态区域触发上传
    $("empty-state").addEventListener("click", () => $("file-input").click());

    // 点击画布容器（无图时）也触发上传
    $("canvas-container").addEventListener("click", (e) => {
        if (!originalFile && e.target === $("canvas-container")) {
            $("file-input").click();
        }
    });

    // 重置
    $("btn-reset").addEventListener("click", resetCanvas);

    // 生成
    $("btn-generate").addEventListener("click", startGenerate);

    // 高清放大
    const btnUpscaleX2 = $("btn-upscale-x2");
    if (btnUpscaleX2) btnUpscaleX2.addEventListener("click", () => startUpscale(2));
    const btnUpscaleX4 = $("btn-upscale-x4");
    if (btnUpscaleX4) btnUpscaleX4.addEventListener("click", () => startUpscale(4));

    // 下载
    $("btn-download").addEventListener("click", downloadResult);

    // 设置面板
    $("btn-settings").addEventListener("click", () => {
        $("settings-panel").classList.toggle("hidden");
    });
    $("btn-settings-close").addEventListener("click", () => {
        $("settings-panel").classList.add("hidden");
    });
    // 滑块实时显示数值
    $("setting-guidance").addEventListener("input", (e) => {
        $("setting-guidance-val").textContent = e.target.value;
    });
    $("setting-steps").addEventListener("input", (e) => {
        $("setting-steps-val").textContent = e.target.value;
    });
}

// ============================================================
// AuraSync 极光色彩同步
// ============================================================
const colorThief = new ColorThief();

function executeAuraSync(imgElement) {
    try {
        const palette = colorThief.getPalette(imgElement, 3);
        if (!palette || palette.length < 3) return;

        const [c1, c2, c3] = palette;
        const root = document.documentElement;

        // 设置极光色 (半透明，作为流体光球的颜色)
        root.style.setProperty("--aurora-light-1", `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, 0.45)`);
        root.style.setProperty("--aurora-light-2", `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, 0.4)`);
        root.style.setProperty("--accent-glow", `rgba(${c3[0]}, ${c3[1]}, ${c3[2]}, 0.35)`);

        console.log("[AuraSync] 极光色已同步:", palette);
    } catch (e) {
        console.warn("[AuraSync] 提色失败, 使用默认主题:", e);
    }
}

// ============================================================
// 图片加载 (Fabric.js v5 API)
// ============================================================
function loadImage(file) {
    originalFile = file;
    console.log("[Upload] 新图片已加载:", file.name, file.size, "bytes");
    const url = URL.createObjectURL(file);

    // AuraSync: 先用一个 Image 元素提取颜色
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.onload = () => {
        executeAuraSync(tempImg);
    };
    tempImg.src = url;

    fabric.Image.fromURL(url, (fabricImg) => {
        fabricCanvas.clear();

        // 自动缩放：让图片高度填满画布
        const scale = DISPLAY_H / fabricImg.height;
        fabricImg.set({
            scaleX: scale,
            scaleY: scale,
            left: DISPLAY_W / 2,
            top: DISPLAY_H / 2,
            originX: "center",
            originY: "center",
            hasControls: true,
            hasBorders: true,
            lockRotation: true,
            cornerColor: "#f0a830",
            cornerStrokeColor: "#f0a830",
            borderColor: "rgba(240, 168, 48, 0.6)",
            cornerSize: 10,
            transparentCorners: false,
        });

        fabricCanvas.add(fabricImg);
        fabricCanvas.setActiveObject(fabricImg);
        fabricCanvas.renderAll();

        // 隐藏空状态
        $("empty-state").classList.add("hidden");

        // 启用按钮
        $("btn-generate").disabled = false;
        $("btn-reset").disabled = false;
        $("btn-download").classList.add("hidden");

        // 清除上一次的生成状态，允许重新排版
        lastGeneratedTaskId = null;
        lastLayoutData = null;

        showToast("图片已加载，可拖动调整位置", "success");
    });
}

// ============================================================
// 重置画布
// ============================================================
function resetCanvas() {
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "transparent";
    fabricCanvas.renderAll();
    originalFile = null;
    currentTaskId = null;
    lastGeneratedTaskId = null;
    lastLayoutData = null;

    $("empty-state").classList.remove("hidden");
    $("btn-generate").disabled = true;
    $("btn-reset").disabled = true;
    $("btn-download").classList.add("hidden");
    $("btn-upscale").classList.add("hidden");

    // 重置极光色为默认
    const root = document.documentElement;
    root.style.removeProperty("--aurora-light-1");
    root.style.removeProperty("--aurora-light-2");
    root.style.removeProperty("--accent-glow");

    showToast("画板已重置", "info");
}

// ============================================================
// 生成任务
// ============================================================
async function startGenerate() {
    if (!originalFile) {
        showToast("请先上传图片", "error");
        return;
    }

    let layout;

    if (lastGeneratedTaskId && lastLayoutData) {
        // 重绘模式：复用上次的排版坐标（归一化），只更新生成参数
        layout = { ...lastLayoutData };
        layout.prompt = ($("prompt-input") ? $("prompt-input").value : "") || "";
        layout.guidance_scale = parseFloat($("setting-guidance").value);
        layout.num_steps = parseInt($("setting-steps").value);
        layout.seed = parseInt($("setting-seed").value);
    } else {
        const imgObj = fabricCanvas.getObjects()[0];
        if (!imgObj) {
            showToast("画布中没有图片", "error");
            return;
        }

        // ── 归一化坐标系：传 0~1 范围的相对位置和尺寸 ──
        const bounds = imgObj.getBoundingRect();
        layout = {
            norm_left:   bounds.left / DISPLAY_W,
            norm_top:    bounds.top / DISPLAY_H,
            norm_width:  bounds.width / DISPLAY_W,
            norm_height: bounds.height / DISPLAY_H,
            prompt: ($("prompt-input") ? $("prompt-input").value : "") || "",
            guidance_scale: parseFloat($("setting-guidance").value),
            num_steps: parseInt($("setting-steps").value),
            seed: parseInt($("setting-seed").value),
        };

        // 保存排版参数供重绘使用（归一化坐标不会随缩放变化）
        lastLayoutData = { ...layout };
    }

    // 构造表单
    const formData = new FormData();
    formData.append("image", originalFile);
    formData.append("layout", JSON.stringify(layout));
    
    console.log("[Generate] 发送图片:", originalFile.name, originalFile.size, "bytes");
    console.log("[Generate] 归一化布局参数:", layout);

    setGenerating(true);

    try {
        const res = await fetch("/api/generate", { method: "POST", body: formData });
        if (!res.ok) {
            const err = await res.json();
            let msg = err.detail || "生成请求失败";
            if (Array.isArray(msg)) msg = msg.map(m => m.msg || JSON.stringify(m)).join(", ");
            throw new Error(msg);
        }
        const data = await res.json();
        currentTaskId = data.task_id;
        startPolling(currentTaskId);
        startTimer();
        showToast("AI 开始创作...", "info");
    } catch (e) {
        setGenerating(false);
        showToast("生成失败: " + e.message, "error");
    }
}

// ============================================================
// 高清放大任务
// ============================================================
async function startUpscale(factor) {
    if (!lastGeneratedTaskId) {
        showToast("没有可放大的结果", "error");
        return;
    }

    const formData = new FormData();
    formData.append("task_id", lastGeneratedTaskId);
    formData.append("factor", factor);

    console.log(`[Upscale] 请求放大任务: ${lastGeneratedTaskId}, 放大倍数: ${factor}`);

    setGenerating(true);
    $("btn-upscale-x2").classList.add("hidden");
    $("btn-upscale-x4").classList.add("hidden");

    try {
        const res = await fetch("/api/upscale", { method: "POST", body: formData });
        if (!res.ok) {
            const err = await res.json();
            let msg = err.detail || "放大请求失败";
            if (Array.isArray(msg)) msg = msg.map(m => m.msg || JSON.stringify(m)).join(", ");
            throw new Error(msg);
        }
        const data = await res.json();
        currentTaskId = data.task_id;
        startPolling(currentTaskId);
        startTimer();
        showToast("AI 正在超分辨率放大...", "info");
    } catch (e) {
        setGenerating(false);
        $("btn-upscale-x2").classList.remove("hidden");
        $("btn-upscale-x4").classList.remove("hidden");
        showToast("放大失败: " + e.message, "error");
    }
}

// ============================================================
// 轮询 & 通知
// ============================================================
function startPolling(taskId) {
    pollingInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/status/${taskId}`);
            const data = await res.json();

            // 更新进度
            updateProgress(data.progress || 0);

            // 更新终端日志
            if (data.logs && data.logs.length > 0) {
                updateTerminal(data.logs);
            }

            if (data.status === "completed") {
                clearInterval(pollingInterval);
                pollingInterval = null;
                onGenerateComplete();
            } else if (data.status === "error") {
                clearInterval(pollingInterval);
                pollingInterval = null;
                setGenerating(false);
                stopTimer();
                showToast("生成出错: " + (data.error || "未知错误"), "error");
            }
        } catch (e) {
            console.error("[Poll] 轮询出错:", e);
        }
    }, 1000);
}

function updateProgress(percent) {
    const fill = $("gen-progress-fill");
    const text = $("gen-progress-text");
    if (fill) fill.style.width = percent + "%";
    if (text) text.textContent = percent + "%";
}

function updateTerminal(logs) {
    const container = $("terminal-lines");
    if (!container) return;
    container.innerHTML = "";
    // 只显示最近 3 条
    const recent = logs.slice(-3);
    recent.forEach(line => {
        const el = document.createElement("div");
        el.className = "term-line";
        el.textContent = line;
        container.appendChild(el);
    });
}

// ============================================================
// 生成完成
// ============================================================
function onGenerateComplete() {
    setGenerating(false);
    $("btn-generate").disabled = false;
    $("btn-download").classList.remove("hidden");
    
    stopTimer();

    // 系统通知
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("神灯AI · Outpaint", { body: "任务处理完毕！" });
    }

    if (currentTaskId.endsWith("_upscaled")) {
        showToast("超清放大完成！", "success");
        openUpscaleModal(currentTaskId);
    } else {
        const btnUpscaleX2 = $("btn-upscale-x2");
        if (btnUpscaleX2) btnUpscaleX2.classList.remove("hidden");
        const btnUpscaleX4 = $("btn-upscale-x4");
        if (btnUpscaleX4) btnUpscaleX4.classList.remove("hidden");
        
        showToast("壁纸生成完成！", "success");
        lastGeneratedTaskId = currentTaskId;
        
        // 在画布上预览结果
        const timestamp = Date.now();
        fabric.Image.fromURL(`/api/download/${currentTaskId}?t=${timestamp}`, (img) => {
            fabricCanvas.clear();
            img.set({
                scaleX: DISPLAY_W / img.width,
                scaleY: DISPLAY_H / img.height,
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
            });
            fabricCanvas.add(img);
            fabricCanvas.renderAll();
        });
    }
}

// ============================================================
// 放大对比 Modal 逻辑
// ============================================================
function openUpscaleModal(upscaledTaskId) {
    const baseTaskId = upscaledTaskId.replace("_upscaled", "");
    const t = Date.now();
    
    $("compare-before").src = `/api/download/${baseTaskId}?t=${t}`;
    $("compare-after").src = `/api/download/${upscaledTaskId}?t=${t}`;
    
    // 初始化滑块位置在中间
    $("compare-slider").value = 50;
    $("compare-after-container").style.width = "50%";
    $("compare-handle").style.left = "50%";
    
    $("upscale-modal").classList.remove("hidden");
    
    // 采用超清大图（直接下载，不再替换回画板，因为画板是 720p 固定视图）
    $("btn-upscale-apply").onclick = () => {
        const a = document.createElement("a");
        a.href = `/api/download/${upscaledTaskId}?t=${t}`;
        a.download = `outpaint_${upscaledTaskId}.png`;
        a.click();
        
        $("upscale-modal").classList.add("hidden");
        showToast("超清大图已开始下载", "success");
        
        // 恢复放大按钮
        $("btn-upscale-x2").classList.remove("hidden");
        $("btn-upscale-x4").classList.remove("hidden");
    };
    
    // 取消
    $("btn-upscale-close").onclick = () => {
        $("upscale-modal").classList.add("hidden");
        $("btn-upscale-x2").classList.remove("hidden");
        $("btn-upscale-x4").classList.remove("hidden");
    };
}

// 滑块事件
const compareSlider = $("compare-slider");
if (compareSlider) {
    compareSlider.addEventListener("input", (e) => {
        const val = e.target.value;
        $("compare-after-container").style.width = val + "%";
        $("compare-handle").style.left = val + "%";
    });
}

// ============================================================
// UI 状态管理
// ============================================================
function setGenerating(isGen) {
    const overlay = $("generating-overlay");
    if (isGen) {
        overlay.classList.remove("hidden");
        $("btn-generate").disabled = true;
        $("btn-upload").disabled = true;
        $("btn-reset").disabled = true;
        updateProgress(0);
        updateTerminal([]);
    } else {
        overlay.classList.add("hidden");
        $("btn-upload").disabled = false;
        $("btn-reset").disabled = false;
    }
}

// ============================================================
// 计时器
// ============================================================
function startTimer() {
    timerStart = Date.now();
    const timerEl = $("gen-timer");
    const timerText = $("gen-timer-text");
    timerEl.classList.remove("hidden");
    timerEl.style.opacity = "1";

    timerInterval = setInterval(() => {
        const elapsed = (Date.now() - timerStart) / 1000;
        timerText.textContent = elapsed.toFixed(1) + "s";
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    // 保留最终时间显示，不隐藏
}

// ============================================================
// 下载壁纸
// ============================================================
function downloadResult() {
    if (!lastGeneratedTaskId) {
        showToast("没有可下载的结果", "error");
        return;
    }
    const a = document.createElement("a");
    // 添加时间戳防止浏览器缓存
    a.href = `/api/download/${lastGeneratedTaskId}?t=${Date.now()}`;
    a.download = `outpaint_${lastGeneratedTaskId}.png`;
    a.click();
}

// ============================================================
// GPU 健康检查 & VRAM 监控
// ============================================================
async function checkHealth() {
    try {
        const res = await fetch("/api/health");
        const data = await res.json();

        const badge = $("gpu-badge");
        const gpuName = $("gpu-name");

        if (data.cuda_available && data.gpu_name) {
            badge.className = "badge badge-ok";
            gpuName.textContent = data.gpu_name;
            initVRAMMonitor(data.vram_used, data.vram_total);
        } else {
            badge.className = "badge badge-error";
            gpuName.textContent = "No CUDA GPU";
        }

        // 持续轮询 VRAM
        setInterval(async () => {
            try {
                const r = await fetch("/api/health");
                const d = await r.json();
                if (d.cuda_available) {
                    updateVRAM(d.vram_used, d.vram_total);
                }
            } catch (_) {}
        }, 3000);

    } catch (e) {
        const badge = $("gpu-badge");
        badge.className = "badge badge-error";
        $("gpu-name").textContent = "连接失败";
    }
}

function initVRAMMonitor(used, total) {
    const monitor = $("vram-monitor");
    const blocksContainer = $("vram-blocks");
    monitor.classList.remove("hidden");
    monitor.style.opacity = "1";

    // 生成 8 个显存块
    blocksContainer.innerHTML = "";
    for (let i = 0; i < 8; i++) {
        const block = document.createElement("div");
        block.className = "vram-block";
        blocksContainer.appendChild(block);
    }

    updateVRAM(used, total);
}

function updateVRAM(used, total) {
    const blocks = document.querySelectorAll(".vram-block");
    const ratio = used / total;
    const activeCount = Math.round(ratio * 8);

    blocks.forEach((b, i) => {
        b.className = "vram-block";
        if (i < activeCount) {
            if (ratio > 0.85) b.classList.add("active-red");
            else if (ratio > 0.6) b.classList.add("active-amber");
            else b.classList.add("active-green");
        }
    });

    const vramText = $("vram-text");
    if (vramText) vramText.textContent = `${used.toFixed(1)}GB / ${total.toFixed(1)}GB`;
}

// ============================================================
// 服务重启自动刷新（无需手动 F5）
// ============================================================
function startAutoReloadWatcher() {
    let serverWasDown = false;

    setInterval(async () => {
        try {
            const res = await fetch("/api/health", { signal: AbortSignal.timeout(2000) });
            if (res.ok && serverWasDown) {
                // 服务恢复了，自动刷新页面
                console.log("[AutoReload] 服务已恢复，自动刷新页面...");
                location.reload();
            }
            serverWasDown = false;
        } catch (_) {
            // 连不上服务器，标记为已断开
            if (!serverWasDown) {
                console.log("[AutoReload] 服务已断开，等待恢复后自动刷新...");
            }
            serverWasDown = true;
        }
    }, 1000);
}