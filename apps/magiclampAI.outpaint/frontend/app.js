/**
 * 神灯AI · Outpaint — 前端主逻辑
 * 功能：Fabric.js 画布、图片上传/拖放、AuraSync 极光主题、
 *       VRAM 显存监控、AI 生成任务提交与轮询、极客终端、计时器、下载壁纸
 */

// ============================================================
// 常量 & 全局状态
// ============================================================
const CANVAS_W = 1792;
const CANVAS_H = 1008;
const DISPLAY_SCALE = 0.55; // 画布在屏幕上的缩放比
const DISPLAY_W = Math.round(CANVAS_W * DISPLAY_SCALE);
const DISPLAY_H = Math.round(CANVAS_H * DISPLAY_SCALE);

let fabricCanvas = null;
let originalFile = null;
let currentTaskId = null;
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
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3500);
}

// ============================================================
// 初始化
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    try {
        initCanvas();
        bindEvents();
        checkHealth();

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

    // 重置
    $("btn-reset").addEventListener("click", resetCanvas);

    // 生成
    $("btn-generate").addEventListener("click", startGenerate);

    // 下载
    $("btn-download").addEventListener("click", downloadResult);
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

    $("empty-state").classList.remove("hidden");
    $("btn-generate").disabled = true;
    $("btn-reset").disabled = true;
    $("btn-download").classList.add("hidden");

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

    const imgObj = fabricCanvas.getObjects()[0];
    if (!imgObj) {
        showToast("画布中没有图片", "error");
        return;
    }

    // 计算图片在真实画布坐标中的位置
    const scaleRatio = 1 / DISPLAY_SCALE;
    const bounds = imgObj.getBoundingRect();
    const layout = {
        img_left: bounds.left * scaleRatio,
        img_top: bounds.top * scaleRatio,
        img_scale: imgObj.scaleX * scaleRatio,
        prompt: ($("prompt-input") ? $("prompt-input").value : "") || "",
    };

    // 构造表单
    const formData = new FormData();
    formData.append("image", originalFile);
    formData.append("layout", JSON.stringify(layout));

    setGenerating(true);

    try {
        const res = await fetch("/api/generate", { method: "POST", body: formData });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "生成请求失败");
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
    showToast("壁纸生成完成！", "success");

    // 系统通知
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("神灯AI · Outpaint", { body: "壁纸已生成完毕，快来查看！" });
    }

    // 在画布上预览结果
    if (currentTaskId) {
        fabric.Image.fromURL(`/api/download/${currentTaskId}`, (img) => {
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
    if (!currentTaskId) {
        showToast("没有可下载的结果", "error");
        return;
    }
    const a = document.createElement("a");
    a.href = `/api/download/${currentTaskId}`;
    a.download = `outpaint_${currentTaskId}.png`;
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