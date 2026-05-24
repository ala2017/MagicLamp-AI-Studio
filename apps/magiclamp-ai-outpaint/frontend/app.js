/**
 * 神灯AI · Outpaint v2 — 前端逻辑 (单画布方案)
 */

const DOM = {
    workspace: document.getElementById('workspace'),
    canvasContainer: document.getElementById('canvas-container'),
    emptyState: document.getElementById('empty-state'),
    fileInput: document.getElementById('file-input'),
    
    tools: {
        upload: document.getElementById('btn-upload'),
        reset: document.getElementById('btn-reset'),
        move: document.getElementById('btn-tool-move'),
        brush: document.getElementById('btn-tool-brush'),
        rect: document.getElementById('btn-tool-rect'),
        eraser: document.getElementById('btn-tool-eraser'),
    },
    
    panels: {
        outpaint: document.getElementById('panel-outpaint'),
        brush: document.getElementById('panel-brush'),
        result: document.getElementById('panel-result'),
        global: document.getElementById('panel-global'),
    },
    
    brushPanelLabel: document.getElementById('brush-panel-label'),
    brushPanelIcon: document.getElementById('brush-panel-icon'),
    brushHint: document.querySelector('.smart-action-tip span'),
    brushSize: document.getElementById('brush-size'),
    valBrushSize: document.getElementById('brush-size-val'),
    brushSizeGroup: document.getElementById('brush-size-group'),
    btnToggleEraser: document.getElementById('btn-tool-eraser'),
    btnBrush: null,
    btnEraser: null,
    btnUndo: document.getElementById('btn-undo'),
    btnClearMask: document.getElementById('btn-clear-mask'),
    btnFastErase: document.getElementById('btn-fast-erase'),
    btnAiInpaint: document.getElementById('btn-ai-inpaint'),
    btnCancelBrush: null,
    
    promptInput: document.getElementById('prompt-input'),
    btnGenerate: document.getElementById('btn-generate'),
    btnDownload: document.getElementById('btn-download'),
    btnLeftDownload: document.getElementById('btn-left-download'),
    btnRegenerate: document.getElementById('btn-regenerate'),
    btnNewImage: document.getElementById('btn-new-image'),
    btnCompare: document.getElementById('btn-compare'),
    
    resultImg: document.getElementById('result-img'),
    overlay: document.getElementById('generating-overlay'),
    phaseText: document.getElementById('gen-phase-text'),
    progressFill: document.getElementById('gen-progress-fill'),
    progressText: document.getElementById('gen-progress-text'),
    statusLog: document.getElementById('status-log'),
    statusFill: document.getElementById('status-fill'),
    terminalTimer: document.getElementById('terminal-timer'),
    terminalLogsView: document.getElementById('terminal-logs-view'),
    
    comparisonView: document.getElementById('comparison-view'),
    imgNoPasteback: document.getElementById('img-no-pasteback'),
    imgWithPasteback: document.getElementById('img-with-pasteback'),
    btnCloseComparison: document.getElementById('btn-close-comparison'),
    systemLoadingGate: document.getElementById('system-loading-gate'),
    loadingGpuName: document.getElementById('loading-gpu-name'),
    loadingVramText: document.getElementById('loading-vram-text'),
    loadingStatusText: document.getElementById('loading-status-text'),
    loadingProgressFill: document.getElementById('loading-progress-fill'),
    zoomControlBar: document.getElementById('zoom-control-bar'),
    btnZoomToggle: document.getElementById('btn-zoom-toggle'),
    txtZoomToggle: document.getElementById('txt-zoom-toggle'),
    btnFloatingDownload: document.getElementById('btn-floating-download'),
};

const State = {
    currentTool: 'move', // 'move' | 'brush' | 'eraser' | 'rect'
    isProcessing: false,
    isZoomed100: false,
    taskId: null,
    pollInterval: null,
    timerInterval: null,
    startTime: 0,
    originalFile: null,
    uploadFileName: '', // 保存用户最初上传文件的原始文件名（不含后缀，例如 'my_scenery'）
    initialFile: null,    // 用户首次上传的 100% 绝对纯净高清原图，用于原地重新生成保真
    initialLayout: null,  // 首次扩图时的归一化排版坐标与配置，用于原地重新生成保真
    imageObj: null,     // 当前图片对象
    maskPaths: [],      // 涂抹的路径列表
    brushUndoStack: [],
    isEraser: false,
    rectStartX: 0,
    rectStartY: 0,
    activeRect: null,
    isModelLoaded: true, // 标志大模型是否已预加载完成
};

// 常量
const CANVAS_W = 1280;
const CANVAS_H = 720;

// ==========================================
// 初始化 Fabric Canvas (单画布)
// ==========================================
const canvas = new fabric.Canvas('fabric-canvas', {
    width: CANVAS_W,
    height: CANVAS_H,
    selection: true,
    preserveObjectStacking: true,
});

// 配置画笔
canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
canvas.freeDrawingBrush.color = 'rgba(255, 60, 60, 0.35)';
canvas.freeDrawingBrush.width = 20;

// ==========================================
// 智能动作免切换系统 & 交互模式自流转
// ==========================================
function updateActiveToolUI(toolName) {
    State.currentTool = toolName;
    if (DOM.tools.move) DOM.tools.move.classList.toggle('active', toolName === 'move');
    if (DOM.tools.brush) DOM.tools.brush.classList.toggle('active', toolName === 'brush');
    if (DOM.tools.rect) DOM.tools.rect.classList.toggle('active', toolName === 'rect');
    if (DOM.tools.eraser) DOM.tools.eraser.classList.toggle('active', toolName === 'eraser');
    
    if (DOM.brushSizeGroup) {
        DOM.brushSizeGroup.style.display = (toolName === 'brush') ? '' : 'none';
    }
}

function initSmartActionSystem() {
    // 监听选中事件：选中图片意味着要进行“排版移动”
    canvas.on('selection:created', (e) => {
        if (State.currentTool === 'brush' || State.currentTool === 'eraser' || State.currentTool === 'rect') return;
        if (e.target === State.imageObj) {
            canvas.isDrawingMode = false;
            canvas.selection = true;
            DOM.canvasContainer.style.cursor = 'default';
            logTerminal('已选中图片：可直接拖动、缩放排版。点击空白背景即可写画遮罩。');
            updateActiveToolUI('move');
        }
    });

    canvas.on('selection:updated', (e) => {
        if (State.currentTool === 'brush' || State.currentTool === 'eraser' || State.currentTool === 'rect') return;
        if (e.target === State.imageObj) {
            canvas.isDrawingMode = false;
            canvas.selection = true;
            DOM.canvasContainer.style.cursor = 'default';
            updateActiveToolUI('move');
        }
    });

    // 监听失焦事件：点击空白背景释放选中状态，意味着要进行“画笔涂抹”
    canvas.on('selection:cleared', () => {
        if (State.currentTool === 'brush' || State.currentTool === 'eraser' || State.currentTool === 'rect') return;
        if (State.imageObj) {
            enterBrushMode(State.isEraser);
            logTerminal('已锁定图片：可在任意位置涂抹红色遮罩或进行擦除。');
        }
    });

    // 智能动作捕获与抓手平移：鼠标按下时
    canvas.on('mouse:down', (options) => {
        // 如果空格键平移激活，或是鼠标中键按下，进入画布拖拽平移状态
        if (State.isSpacePanning || options.e.button === 1) {
            State.isDragging = true;
            State.lastPanX = options.e.clientX;
            State.lastPanY = options.e.clientY;
            canvas.selection = false;
            canvas.setCursor('grabbing');
            return;
        }

        if (State.currentTool === 'rect') {
            const pointer = canvas.getPointer(options.e);
            State.rectStartX = pointer.x;
            State.rectStartY = pointer.y;
            State.activeRect = new fabric.Rect({
                left: pointer.x,
                top: pointer.y,
                width: 0,
                height: 0,
                fill: 'rgba(255, 60, 60, 0.35)',
                stroke: '#ef4444',
                strokeWidth: 1,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false
            });
            canvas.add(State.activeRect);
            return;
        }

        if (State.currentTool === 'brush' || State.currentTool === 'eraser') return;
        if (!State.imageObj) return;

        const pointer = canvas.getPointer(options.e);
        const bounds = State.imageObj.getBoundingRect();

        // 碰撞测试
        const clickedInsideImage = 
            pointer.x >= bounds.left && 
            pointer.x <= (bounds.left + bounds.width) &&
            pointer.y >= bounds.top && 
            pointer.y <= (bounds.top + bounds.height);

        if (clickedInsideImage) {
            // 点击在大图内：智能切换为“排版移动”
            if (canvas.isDrawingMode) {
                exitBrushMode();
                canvas.setActiveObject(State.imageObj);
                canvas.requestRenderAll();
                logTerminal('智能切换：已自动进入图片排版模式 (可自由拖拽缩放)。');
            }
        } else {
            // 点击大图外/空白背景：智能切换为“写画遮罩”
            if (!canvas.isDrawingMode) {
                canvas.discardActiveObject();
                canvas.requestRenderAll();
                logTerminal('智能切换：已自动锁定图片并启用涂抹。');
            }
        }
    });

    // 抓手平移拖拽移动中
    canvas.on('mouse:move', (options) => {
        if (State.isDragging) {
            const e = options.e;
            const dx = e.clientX - State.lastPanX;
            const dy = e.clientY - State.lastPanY;
            State.lastPanX = e.clientX;
            State.lastPanY = e.clientY;
            
            canvas.relativePan(new fabric.Point(dx, dy));
            canvas.setCursor('grabbing');
            return;
        }

        if (State.currentTool === 'rect' && State.activeRect) {
            const pointer = canvas.getPointer(options.e);
            if (State.rectStartX > pointer.x) {
                State.activeRect.set({ left: Math.abs(pointer.x) });
            }
            if (State.rectStartY > pointer.y) {
                State.activeRect.set({ top: Math.abs(pointer.y) });
            }
            State.activeRect.set({ width: Math.abs(State.rectStartX - pointer.x) });
            State.activeRect.set({ height: Math.abs(State.rectStartY - pointer.y) });
            canvas.requestRenderAll();
        }
    });

    // 抓手平移拖拽释放
    canvas.on('mouse:up', () => {
        State.isDragging = false;
        if (State.isSpacePanning) {
            canvas.setCursor('grab');
        }

        if (State.currentTool === 'rect' && State.activeRect) {
            // 如果宽或高太小，则视为误触，移除
            if (State.activeRect.width < 5 || State.activeRect.height < 5) {
                canvas.remove(State.activeRect);
            } else {
                State.activeRect.set({
                    strokeWidth: 0 // 固化后去掉边框
                });
                State.brushUndoStack.push(State.activeRect);
                updateUndoButton();
            }
            State.activeRect = null;
            canvas.requestRenderAll();
        }
    });
}

// 兼容旧路由，防止其它业务函数调用崩坏
function switchTool(toolName) {
    if (!State.imageObj) return;
    DOM.panels.result.classList.add('hidden');
    DOM.panels.outpaint.classList.remove('hidden');
    DOM.panels.brush.classList.remove('hidden');
    DOM.panels.global.classList.remove('hidden');
    
    if (toolName === 'move') {
        exitBrushMode();
        canvas.setActiveObject(State.imageObj);
        canvas.requestRenderAll();
    } else if (toolName === 'rect') {
        enterRectMode();
    } else {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        enterBrushMode(toolName === 'eraser');
    }
}

function enterRectMode() {
    if (!State.imageObj) return;
    ensureEditModeOnInteraction();
    
    State.imageObj.set({
        selectable: false,
        evented: false,
    });
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';
    DOM.canvasContainer.style.cursor = 'crosshair';
    
    updateActiveToolUI('rect');
}

// ==========================================
// 画笔与橡皮擦模式
// ==========================================
function enterBrushMode(isEraser = false) {
    if (!State.imageObj) return;
    
    // 自动流转：若当前处于成品就绪面板，进入画笔时自动隐退成品页并亮起编辑面板
    if (!DOM.panels.result.classList.contains('hidden')) {
        DOM.panels.result.classList.add('hidden');
        DOM.panels.outpaint.classList.remove('hidden');
        DOM.panels.brush.classList.remove('hidden');
        DOM.panels.global.classList.remove('hidden');
        logTerminal('已进入画笔编辑模式');
    }
    
    // 锁定图片
    State.imageObj.set({
        selectable: false,
        evented: false,
    });
    
    // 开启画笔
    canvas.isDrawingMode = true;
    canvas.selection = false;
    
    setEraserMode(isEraser);
    updateUndoButton();
}

function exitBrushMode() {
    if (State.imageObj) {
        State.imageObj.set({
            selectable: true,
            evented: true,
        });
    }
    canvas.isDrawingMode = false;
    canvas.selection = true;
    DOM.canvasContainer.style.cursor = 'default';
    updateActiveToolUI('move');
}

function setEraserMode(isEraser) {
    State.isEraser = isEraser;
    
    // 更新平铺按钮的激活高亮状态
    updateActiveToolUI(isEraser ? 'eraser' : 'brush');
    
    if (isEraser) {
        DOM.brushPanelLabel.textContent = '橡皮擦消除';
        if (DOM.brushPanelIcon) DOM.brushPanelIcon.setAttribute('data-lucide', 'eraser');
        if (DOM.brushHint) DOM.brushHint.textContent = '用橡皮擦在红色区域划过以撤除涂抹遮罩';
        canvas.freeDrawingBrush.color = 'rgba(0, 0, 0, 1)';
        canvas.freeDrawingBrush.width = 30;
    } else {
        DOM.brushPanelLabel.textContent = '画笔消除与局部重绘';
        if (DOM.brushPanelIcon) DOM.brushPanelIcon.setAttribute('data-lucide', 'pencil');
        if (DOM.brushHint) DOM.brushHint.textContent = '用画笔涂抹要消除的水印、杂物或大面积重绘的区域';
        canvas.freeDrawingBrush.color = 'rgba(255, 60, 60, 0.35)';
        canvas.freeDrawingBrush.width = parseInt(DOM.brushSize.value, 10);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    updateBrushCursor();
}

function updateBrushCursor() {
    if (!canvas || !canvas.freeDrawingBrush) return;
    
    // 如果是橡皮擦，取 30px；如果是普通画笔，实时取当前粗细
    const size = canvas.freeDrawingBrush.width || 20;
    const isEraser = State.isEraser;
    const fillCol = isEraser ? 'rgba(249, 115, 22, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    const strokeCol = isEraser ? '#f97316' : '#ef4444';
    
    // 动态生成一比一对应直径的 SVG Circle，热点精准锚定在正中心 (size/2, size/2)
    const half = Math.round(size / 2);
    const r = Math.max(1, half - 1);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${half}" cy="${half}" r="${r}" fill="${fillCol}" stroke="${strokeCol}" stroke-width="1.5"/></svg>`;
    const encoded = encodeURIComponent(svg);
    const dataUrl = `url('data:image/svg+xml,${encoded}') ${half} ${half}, crosshair`;
    
    // Fabric.js 5.x 画笔光标由 canvas.freeDrawingCursor 控制，而非 brush.cursor
    canvas.freeDrawingCursor = dataUrl;
    // 同步清除容器上的硬编码光标，让 Fabric 的 freeDrawingCursor 生效
    DOM.canvasContainer.style.cursor = '';
}

// 橡皮擦路径检测（检测与橡皮擦轨迹相交的其他路径）
function erasePathsIntersecting(eraserPath) {
    const eraserBounds = eraserPath.getBoundingRect();
    const paths = canvas.getObjects('path').filter(p => p !== eraserPath);
    
    const toRemove = [];
    paths.forEach(path => {
        const pathBounds = path.getBoundingRect();
        if (rectsIntersect(eraserBounds, pathBounds)) {
            toRemove.push(path);
        }
    });
    
    toRemove.forEach(p => {
        canvas.remove(p);
        // 从撤销栈中移除被擦除的路径
        const index = State.brushUndoStack.indexOf(p);
        if (index > -1) State.brushUndoStack.splice(index, 1);
    });
    canvas.remove(eraserPath);
    canvas.requestRenderAll();
    updateUndoButton();
}

function rectsIntersect(r1, r2) {
    return !(r1.left + r1.width < r2.left || 
             r2.left + r2.width < r1.left ||
             r1.top + r1.height < r2.top ||
             r2.top + r2.height < r1.top);
}

// 绑定橡皮擦模式开关
DOM.btnToggleEraser?.addEventListener('click', () => {
    if (!State.imageObj) return;
    
    // 如果目前选中了图片，我们要强制取消选中图片并进入画笔
    if (!canvas.isDrawingMode) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
    }
    
    setEraserMode(!State.isEraser);
});

// 路径创建/橡皮擦逻辑
canvas.on('path:created', (e) => {
    if (!State.imageObj) {
        // 无图物理拦截防御！直接移除该路径
        canvas.remove(e.path);
        canvas.requestRenderAll();
        logTerminal('请先导入图片再涂抹遮罩！');
        return;
    }
    if (State.isEraser) {
        // 橡皮擦模式：擦除相交的路径
        erasePathsIntersecting(e.path);
    } else {
        // 物理锁死掩膜笔画对象，使其绝对不可选中，且鼠标事件穿透 (杜绝误拖拽位移)
        const path = e.path;
        path.set({
            selectable: false,
            evented: false,
            hoverCursor: 'default',
            hasControls: false,
            hasBorders: false
        });
        
        // 笔画级撤销栈：直接存入 Path 对象引用，实现无损物理撤销
        State.brushUndoStack.push(path);
        updateUndoButton();
    }
});

function undoBrush() {
    if (State.brushUndoStack.length === 0) return;
    const lastPath = State.brushUndoStack.pop();
    if (lastPath) {
        canvas.remove(lastPath);
        canvas.requestRenderAll();
    }
    updateUndoButton();
}

function updateUndoButton() {
    const maskObjects = canvas.getObjects().filter(obj => obj.type === 'path' || obj.type === 'rect');
    DOM.btnUndo.disabled = maskObjects.length === 0;
}

DOM.btnUndo.addEventListener('click', undoBrush);

// 清空涂抹
DOM.btnClearMask.addEventListener('click', () => {
    const maskObjects = canvas.getObjects().filter(obj => obj.type === 'path' || obj.type === 'rect');
    maskObjects.forEach(obj => canvas.remove(obj));
    State.brushUndoStack = [];
    updateUndoButton();
});

// ==========================================
// 交互状态自动流转 (从成果态自动隐退并切换回编辑态)
// ==========================================
function ensureEditModeOnInteraction() {
    if (!DOM.panels.result.classList.contains('hidden')) {
        DOM.panels.result.classList.add('hidden');
        DOM.panels.outpaint.classList.remove('hidden');
        DOM.panels.brush.classList.remove('hidden');
        DOM.panels.global.classList.remove('hidden');
        logTerminal('已自动切换为二次编辑排版模式');
    }
}

// ==========================================
// 边界限制
// ==========================================
canvas.on('object:moving', (e) => {
    ensureEditModeOnInteraction();
    const obj = e.target;
    if (!obj) return;
    if (State.isZoomed100) {
        obj.setCoords();
        return; // 100% 细节状态下，跳过物理边界撞墙卡死，允许自由平移拖拽查看细节！
    }
    obj.setCoords();
    const bounds = obj.getBoundingRect();
    
    if (bounds.left < 0) obj.set('left', obj.left - bounds.left);
    if (bounds.top < 0) obj.set('top', obj.top - bounds.top);
    if (bounds.left + bounds.width > CANVAS_W) obj.set('left', obj.left - (bounds.left + bounds.width - CANVAS_W));
    if (bounds.top + bounds.height > CANVAS_H) obj.set('top', obj.top - (bounds.top + bounds.height - CANVAS_H));
});

canvas.on('object:scaling', (e) => {
    ensureEditModeOnInteraction();
    const obj = e.target;
    if (!obj) return;
    if (State.isZoomed100) {
        return; // 100% 细节状态下，允许缩放，不撞墙限制
    }
    
    const imgW = obj.width * obj.scaleX;
    const imgH = obj.height * obj.scaleY;
    
    // 使用统一缩放值保持比例
    let newScale = obj.scaleX;
    if (imgW < 50) newScale = 50 / obj.width;
    if (imgH < 50) newScale = 50 / obj.height;
    if (imgW > CANVAS_W) newScale = CANVAS_W / obj.width;
    if (imgH > CANVAS_H) newScale = CANVAS_H / obj.height;
    
    obj.set({ scaleX: newScale, scaleY: newScale });
    
    // 撞墙
    const bounds = obj.getBoundingRect();
    if (bounds.left < 0) obj.set('left', obj.left - bounds.left);
    if (bounds.top < 0) obj.set('top', obj.top - bounds.top);
    if (bounds.left + bounds.width > CANVAS_W) obj.set('left', obj.left - (bounds.left + bounds.width - CANVAS_W));
    if (bounds.top + bounds.height > CANVAS_H) obj.set('top', obj.top - (bounds.top + bounds.height - CANVAS_H));
});

// ==========================================
// 拖放与上传
// ==========================================
DOM.tools.upload.addEventListener('click', () => DOM.fileInput.click());
DOM.emptyState.addEventListener('click', () => DOM.fileInput.click());

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    DOM.canvasContainer.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

DOM.canvasContainer.addEventListener('dragenter', () => DOM.emptyState.style.background = 'rgba(255,255,255,0.05)');
DOM.canvasContainer.addEventListener('dragleave', () => DOM.emptyState.style.background = '');
DOM.canvasContainer.addEventListener('drop', handleDrop);

function handleDrop(e) {
    DOM.emptyState.style.background = '';
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
        handleFile(dt.files[0]);
    }
}

DOM.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) return;
    State.originalFile = file;
    
    // 只有当传入的不是后端生成的临时图片时，才记忆并锁定最初的上传文件名
    if (file && file.name && file.name !== 'result.png' && file.name !== 'preprocessed.png') {
        State.initialFile = file; // 物理锁定最初的 100% 纯净原图
        const origName = file.name;
        const lastDotIndex = origName.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            State.uploadFileName = origName.substring(0, lastDotIndex);
        } else {
            State.uploadFileName = origName;
        }
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // 清空画布
            canvas.clear();
            State.brushUndoStack = [];
            
            // 构造 Fabric Image
            const fImg = new fabric.Image(img);
            
            // 初始排版：自适应吸合 Contain 到边框（通常上下边框重合）
            const scale = Math.min(
                CANVAS_W / fImg.width,
                CANVAS_H / fImg.height
            );
            fImg.set({
                originX: 'center',
                originY: 'center',
                left: CANVAS_W / 2,
                top: CANVAS_H / 2,
                scaleX: scale,
                scaleY: scale,
                cornerColor: '#f97316',
                cornerStrokeColor: '#ffffff',
                transparentCorners: false,
                cornerSize: 8,
                padding: 0,
                borderColor: '#f97316',
                borderDashArray: [5, 5],
                lockUniScaling: true,
            });

            canvas.add(fImg);
            canvas.setActiveObject(fImg);
            State.imageObj = fImg;
            
            // UI 更新
            DOM.emptyState.classList.add('hidden');
            DOM.tools.reset.disabled = false;
            // 载入新图时隐退右上角细节及下载控制条以防残留
            DOM.zoomControlBar?.classList.add('hidden');
            DOM.btnLeftDownload?.classList.add('hidden');
            
            // 极速擦除作为 CV 离线计算，导入图片后即时可用！
            DOM.btnFastErase.disabled = false;
            
            // 黄金按需延迟加载：导入图片后，智能扩图与重绘按钮直接点亮可用！
            DOM.btnGenerate.disabled = false;
            DOM.btnAiInpaint.disabled = false;
            
            switchTool('move');
            logTerminal('图片加载成功');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function getDownloadFileName() {
    if (State.uploadFileName) {
        return `${State.uploadFileName}_result.png`;
    }
    return 'result.png';
}

// ==========================================
// 重置
// ==========================================
DOM.tools.reset.addEventListener('click', () => {
    canvas.clear();
    DOM.emptyState.classList.remove('hidden');
    DOM.tools.reset.disabled = true;
    DOM.btnGenerate.disabled = true;
    DOM.btnFastErase.disabled = true;
    DOM.btnAiInpaint.disabled = true;
    State.originalFile = null;
    State.uploadFileName = '';
    State.initialFile = null;
    State.initialLayout = null;
    State.imageObj = null;
    DOM.zoomControlBar?.classList.add('hidden');
    DOM.btnLeftDownload?.classList.add('hidden');
    State.isZoomed100 = false;
    switchTool('move');
});

// ==========================================
// 画笔粗细调节
// ==========================================
DOM.brushSize.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.valBrushSize.textContent = val + 'px';
    canvas.freeDrawingBrush.width = parseInt(val, 10);
    updateBrushCursor();
});

// 快捷键与空格键抓手平移系统
window.addEventListener('keydown', (e) => {
    // 空格键平移临时切换 (抓手)
    if (e.key === ' ' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!State.isSpacePanning) {
            State.isSpacePanning = true;
            State.prevDrawingMode = canvas.isDrawingMode;
            canvas.isDrawingMode = false;
            canvas.selection = false;
            canvas.defaultCursor = 'grab';
            canvas.setCursor('grab');
            canvas.requestRenderAll();
        }
    }

    // 画笔模式下
    if (State.currentTool === 'brush' || State.currentTool === 'eraser' || State.currentTool === 'rect') {
        if (e.key === '[') {
            DOM.brushSize.value = Math.max(5, parseInt(DOM.brushSize.value) - 5);
            DOM.brushSize.dispatchEvent(new Event('input'));
        } else if (e.key === ']') {
            DOM.brushSize.value = Math.min(100, parseInt(DOM.brushSize.value) + 5);
            DOM.brushSize.dispatchEvent(new Event('input'));
        } else if (e.key === 'e' || e.key === 'E') {
            switchTool('eraser');
        } else if (e.key === 'b' || e.key === 'B') {
            switchTool('brush');
        } else if (e.key === 'r' || e.key === 'R') {
            switchTool('rect');
        } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            undoBrush();
        }
    }
    
    // M = 移动模式
    if (e.key === 'm' || e.key === 'M') {
        switchTool('move');
    }
});

// 全局释放空格键，完美无感恢复原工具状态
window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
        if (State.isSpacePanning) {
            State.isSpacePanning = false;
            State.isDragging = false;
            canvas.selection = true;
            canvas.defaultCursor = 'default';
            
            // 恢复原画笔模式或移动排版模式
            if (State.prevDrawingMode) {
                canvas.isDrawingMode = true;
                updateBrushCursor();
            } else {
                canvas.isDrawingMode = false;
                canvas.setCursor('default');
            }
            canvas.requestRenderAll();
        }
    }
});

// ==========================================
// 导出 Mask (黑底白图，供 FLUX Fill 使用)
// ==========================================
function exportMask() {
    console.log('[DEBUG] 启动高性能 Hires 矢量投影 Mask 渲染...');
    
    // 如果大图存在，则使用其原始宽高；否则回退为 1280x720 画布大小
    const W_orig = State.imageObj ? State.imageObj.width : CANVAS_W;
    const H_orig = State.imageObj ? State.imageObj.height : CANVAS_H;
    
    // 1. 创建一个与大图尺寸完全 1:1 的临时静态 Fabric Canvas
    const tempCanvasEl = document.createElement('canvas');
    tempCanvasEl.width = W_orig;
    tempCanvasEl.height = H_orig;
    
    const tempCanvas = new fabric.StaticCanvas(tempCanvasEl, {
        enableRetinaScaling: false,
        backgroundColor: 'black'
    });
    
    // 2. 收集主画布中的所有涂抹路径和矩形遮罩
    const maskObjects = canvas.getObjects().filter(obj => obj.type === 'path' || obj.type === 'rect');
    console.log(`[DEBUG] 找到 ${maskObjects.length} 个涂抹对象，准备投影到原图坐标系...`);
    
    // ────────────────────────────────────────────────────────────
    // 核心修复：正确计算大图的画布左上角物理坐标
    // 图片 originX/originY = 'center'，意味着 imageObj.left/top 是中心点坐标
    // 必须先算出真实的左上角 = center - (原始宽高 * scale) / 2
    // ────────────────────────────────────────────────────────────
    const imgScaleX = State.imageObj ? State.imageObj.scaleX : 1;
    const imgScaleY = State.imageObj ? State.imageObj.scaleY : 1;
    
    let imgLeftTopX = 0, imgLeftTopY = 0;
    if (State.imageObj) {
        // originX='center' → left 是中心 X；originY='center' → top 是中心 Y
        imgLeftTopX = State.imageObj.left - (State.imageObj.width * imgScaleX) / 2;
        imgLeftTopY = State.imageObj.top - (State.imageObj.height * imgScaleY) / 2;
    }
    
    console.log(`[DEBUG] 图片左上角物理坐标: (${imgLeftTopX.toFixed(1)}, ${imgLeftTopY.toFixed(1)}), scale: (${imgScaleX.toFixed(4)}, ${imgScaleY.toFixed(4)})`);
    
    // 3. 克隆所有的遮罩对象并转换坐标到原图坐标系下
    const clonePromises = maskObjects.map(obj => {
        return new Promise((resolve) => {
            obj.clone((clonedObj) => {
                // 核心：投影坐标系转换！
                clonedObj.set({
                    left: (obj.left - imgLeftTopX) / imgScaleX,
                    top: (obj.top - imgLeftTopY) / imgScaleY,
                    scaleX: obj.scaleX / imgScaleX,
                    scaleY: obj.scaleY / imgScaleY,
                    stroke: '#ffffff',
                    opacity: 1.0
                });
                
                if (clonedObj.type === 'path') {
                    clonedObj.set({
                        fill: 'none',
                        strokeWidth: obj.strokeWidth / imgScaleX,
                        strokeUniform: true, // 锁定等宽渲染，忽略 scaleX 二次拉伸，完美对准大图绝对物理线宽
                        strokeLineCap: 'round',
                        strokeLineJoin: 'round'
                    });
                } else if (clonedObj.type === 'rect') {
                    clonedObj.set({
                        fill: '#ffffff',
                        strokeWidth: 0
                    });
                }
                
                // 将对象放入临时 Canvas 中
                tempCanvas.add(clonedObj);
                resolve();
            });
        });
    });
    
    // 等待所有克隆及坐标计算完成
    return Promise.all(clonePromises).then(() => {
        // 4. 同步渲染临时 Canvas
        tempCanvas.renderAll();
        console.log(`[DEBUG] 1:1 矢量投影 Mask 渲染成功，尺寸: ${W_orig}x${H_orig}`);
        
        // 5. 导出 Blob 图像数据
        return new Promise((resolve) => {
            tempCanvasEl.toBlob((blob) => {
                // 销毁临时 canvas 释放内存
                tempCanvas.dispose();
                resolve(blob);
            }, 'image/png');
        });
    });
}

// ==========================================
// API: 预处理 (AI清除)
// ==========================================
async function handlePreprocess(toolType) {
    console.log(`[DEBUG] 触发清除操作, 工具: ${toolType}`);
    const maskObjects = canvas.getObjects().filter(obj => obj.type === 'path' || obj.type === 'rect');
    if (maskObjects.length === 0) {
        showToast('请先涂抹或框选需要处理的区域', 'error');
        return;
    }

    setLoading(true, toolType === 'fast_erase' ? "极速擦除中..." : "AI 局部重绘中...");
    console.log('[DEBUG] 开始导出Mask...');

    let maskBlob;
    try {
        maskBlob = await exportMask();
        console.log('[DEBUG] Mask导出成功:', maskBlob ? maskBlob.size : 'null');
    } catch (e) {
        console.error('[DEBUG] Mask导出失败:', e);
        handleError('Mask导出失败: ' + e.message);
        return;
    }

    if (!maskBlob) {
        handleError('Mask为空，请重新涂抹');
        return;
    }

    const formData = new FormData();
    formData.append('image', State.originalFile);
    formData.append('mask', maskBlob, 'mask.png');
    formData.append('tool', toolType);

    console.log('[DEBUG] 发送请求到 /api/preprocess...');
    try {
        const res = await fetch('/api/preprocess', { method: 'POST', body: formData });
        console.log('[DEBUG] 收到响应:', res.status);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log('[DEBUG] 任务ID:', data.task_id);

        State.taskId = data.task_id;
        startPolling(handlePreprocessSuccess);
    } catch (e) {
        console.error('[DEBUG] 请求失败:', e);
        handleError('处理失败: ' + e.message);
    }
}

DOM.btnFastErase?.addEventListener('click', () => handlePreprocess('fast_erase'));
DOM.btnAiInpaint?.addEventListener('click', () => handlePreprocess('ai_inpaint'));

async function handlePreprocessSuccess() {
    const imgUrl = `/api/download/${State.taskId}?t=${Date.now()}`;
    
    try {
        const res = await fetch(imgUrl);
        const blob = await res.blob();
        
        // 更新原图
        State.originalFile = new File([blob], "preprocessed.png", { type: "image/png" });
        
        // 替换图片
        const img = new Image();
        img.onload = () => {
            if (State.imageObj) {
                State.imageObj.setElement(img);
                // 保持原来的位置 and 缩放
                canvas.requestRenderAll();
            }
            
            // 清空涂抹和矩形遮罩
            const maskObjects = canvas.getObjects().filter(obj => obj.type === 'path' || obj.type === 'rect');
            maskObjects.forEach(obj => canvas.remove(obj));
            State.brushUndoStack = [];
            updateUndoButton();
            
            // 二次迭代流转：如果当前右侧正展示扩图成果，在擦除/重绘成功后自动隐退成果卡片，重新亮起扩图控制面板，以供二次扩图
            if (!DOM.panels.result.classList.contains('hidden')) {
                DOM.panels.result.classList.add('hidden');
                DOM.panels.outpaint.classList.remove('hidden');
                logTerminal('修补完成：已自动切换回扩图排版控制');
            }
            
            // 在极速擦除、AI 局部重绘成功后点亮右上角细节查看与下载浮动控制条
            DOM.zoomControlBar?.classList.remove('hidden');
            DOM.btnLeftDownload?.classList.remove('hidden');
            
            setLoading(false);
            logTerminal('清除完成，可继续扩图或保存');
        };
        img.src = URL.createObjectURL(blob);
    } catch (e) {
        handleError('下载结果失败: ' + e.message);
    }
}

DOM.btnGenerate.addEventListener('click', async () => {
    if (!State.originalFile || !State.imageObj) return;
    
    setLoading(true, "AI 扩图生成中...");
    
    // 计算图片在画布上的归一化坐标（用于 Paste-Back 回贴）
    // 关键：使用 getBoundingRect() 获取视觉包围盒，与管线一保持一致
    State.imageObj.setCoords();
    const bounds = State.imageObj.getBoundingRect();
    
    const layout = {
        norm_left: bounds.left / CANVAS_W,
        norm_top: bounds.top / CANVAS_H,
        norm_width: bounds.width / CANVAS_W,
        norm_height: bounds.height / CANVAS_H,
        prompt: DOM.promptInput.value || '',
        guidance_scale: parseFloat(document.getElementById('setting-guidance')?.value || '30') || 30.0,
        num_steps: parseInt(document.getElementById('setting-steps')?.value || '28', 10) || 28,
        seed: parseInt(document.getElementById('setting-seed')?.value || '-1', 10) || -1,
    };
    
    // 终极记忆锁：只有当当前不是成果态时（即原文件名不是 result.png），才记录为最初摆放该小原图的 initialLayout
    if (State.originalFile && State.originalFile.name !== 'result.png') {
        State.initialLayout = {
            norm_left: layout.norm_left,
            norm_top: layout.norm_top,
            norm_width: layout.norm_width,
            norm_height: layout.norm_height,
        };
    }
    
    console.log('[Generate] 归一化坐标:', layout);
    console.log('[Generate] 视觉包围盒:', bounds);
    
    // 智能路由选择机制
    let sendImage = State.originalFile;
    let sendLayout = { ...layout };
    
    if (State.originalFile && State.originalFile.name === 'result.png') {
        // 如果当前是成果态（以 result.png 作为临时文件）且图片铺满屏（原地重新生成）
        const isFull = Math.abs(layout.norm_left) < 0.02 && 
                       Math.abs(layout.norm_top) < 0.02 && 
                       Math.abs(layout.norm_width - 1) < 0.02;
        
        if (isFull && State.initialFile && State.initialLayout) {
            console.log('[DEBUG] [SMART-ROUTER] 检测到成果态原地重生成！自动降级路由为 100% 纯净初始原图与初始坐标，保真度 100%！');
            sendImage = State.initialFile;
            sendLayout.norm_left = State.initialLayout.norm_left;
            sendLayout.norm_top = State.initialLayout.norm_top;
            sendLayout.norm_width = State.initialLayout.norm_width;
            sendLayout.norm_height = State.initialLayout.norm_height;
        } else {
            console.log('[DEBUG] [SMART-ROUTER] 检测到成果态二次迭代外扩！基于刚才的 5K 大图进行第二轮大图向外扩图！');
        }
    }
    
    const formData = new FormData();
    formData.append('image', sendImage);
    formData.append('layout', JSON.stringify(sendLayout));
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        
        State.taskId = data.task_id;
        startPolling(handleGenerateSuccess);
    } catch (e) {
        handleError('生成失败: ' + e.message);
    }
});

async function handleGenerateSuccess() {
    const imgUrl = `/api/download/${State.taskId}?t=${Date.now()}`;
    
    try {
        const res = await fetch(imgUrl);
        const blob = await res.blob();
        
        DOM.resultImg.src = imgUrl;
        DOM.panels.result.classList.remove('hidden');
        DOM.panels.outpaint.classList.add('hidden');
        // 扩图完毕后，左侧的修图控制卡片和管理卡片保持 100% 可见并存，不进行隐藏！
        DOM.panels.brush.classList.remove('hidden');
        DOM.panels.global.classList.remove('hidden');
        
        // 更新原图为结果
        State.originalFile = new File([blob], "result.png", { type: "image/png" });
        
        // ── 刷新画板：将扩图结果同步载入画布，支持在此基础上的“二次无限编辑/扩图” ──
        const img = new Image();
        img.onload = () => {
            // 清空画板中的旧图和涂抹痕迹
            canvas.clear();
            State.brushUndoStack = [];
            updateUndoButton();
            
            // 重置 100% 细节缩放状态与右上角按钮
            State.isZoomed100 = false;
            if (DOM.btnZoomToggle) {
                DOM.btnZoomToggle.innerHTML = '<i data-lucide="zoom-in"></i>';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            DOM.zoomControlBar?.classList.remove('hidden');
            DOM.btnLeftDownload?.classList.remove('hidden');
            
            // 构造新的 Fabric Image 并自适应 Contain 吸合铺满整个 1280x720 画板
            const fImg = new fabric.Image(img);
            const scale = Math.min(
                CANVAS_W / fImg.width,
                CANVAS_H / fImg.height
            );
            
            fImg.set({
                originX: 'center',
                originY: 'center',
                left: CANVAS_W / 2,
                top: CANVAS_H / 2,
                scaleX: scale,
                scaleY: scale,
                cornerColor: '#f97316',
                cornerStrokeColor: '#ffffff',
                transparentCorners: false,
                cornerSize: 8,
                padding: 0,
                borderColor: '#f97316',
                borderDashArray: [5, 5],
                lockUniScaling: true,
            });
            
            canvas.add(fImg);
            canvas.setActiveObject(fImg);
            State.imageObj = fImg;
            
            // 默认重设为移动排版底层状态（非画笔写画状态），同时保留成品展示面板！
            canvas.isDrawingMode = false;
            canvas.selection = true;
            DOM.canvasContainer.style.cursor = 'default';
            State.currentTool = 'move';
            if (DOM.tools.move) {
                DOM.tools.move.classList.add('active');
                DOM.tools.brush?.classList.remove('active');
                DOM.tools.eraser?.classList.remove('active');
            }
            
            setLoading(false);
            logTerminal('扩图生成完成！成品已载入画板，可随时在此基础上精修或二次扩图。');
        };
        img.src = URL.createObjectURL(blob);
        
    } catch (e) {
        handleError('下载结果失败: ' + e.message);
    }
}

DOM.btnRegenerate.addEventListener('click', () => {
    DOM.panels.result.classList.add('hidden');
    DOM.panels.outpaint.classList.remove('hidden');
    DOM.panels.brush.classList.remove('hidden'); // 恢复画笔消除面板平铺
    DOM.panels.global.classList.remove('hidden'); // 恢复全局快捷面板
});

if (DOM.btnNewImage) {
    DOM.btnNewImage.addEventListener('click', () => {
        DOM.tools.reset.click(); // 复用重置画板逻辑
    });
}

DOM.btnDownload.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = DOM.resultImg.src;
    a.download = getDownloadFileName();
    a.click();
});

if (DOM.btnLeftDownload) {
    DOM.btnLeftDownload.addEventListener('click', () => {
        DOM.btnDownload.click(); // 完美复用原有下载细节逻辑
    });
}

// ==========================================
// 轮询与状态
// ==========================================
function startPolling(callback) {
    const maxAttempts = 300;
    let attempts = 0;
    
    State.pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            const res = await fetch(`/api/status/${State.taskId}`);
            const data = await res.json();
            
            // 更新进度
            if (data.progress !== undefined) {
                DOM.progressFill.style.width = data.progress + '%';
                DOM.progressText.textContent = data.progress + '%';
                DOM.statusFill.style.width = data.progress + '%';
            }
            
            // 同步后端极客日志
            if (data.logs && Array.isArray(data.logs)) {
                updateTerminalLogs(data.logs);
            }
            
            if (data.status === 'completed') {
                clearInterval(State.pollInterval);
                callback();
            } else if (data.status === 'error' || data.status === 'failed') {
                clearInterval(State.pollInterval);
                handleError(data.error || '任务失败');
            } else if (attempts >= maxAttempts) {
                clearInterval(State.pollInterval);
                handleError('任务超时');
            }
        } catch (e) {
            // 忽略轮询错误
        }
    }, 1000);
}

// ==========================================
// Loading 状态
// ==========================================
function setLoading(isLoading, text = '') {
    State.isProcessing = isLoading;
    if (isLoading) {
        DOM.overlay.classList.remove('hidden');
        DOM.phaseText.textContent = text;
        DOM.progressFill.style.width = '0%';
        DOM.progressText.textContent = '0%';
        DOM.statusFill.style.width = '0%';
        DOM.statusLog.textContent = text;
        
        if (DOM.terminalTimer) DOM.terminalTimer.innerHTML = '⏱ 已耗时 0:00';
        if (DOM.terminalLogsView) DOM.terminalLogsView.innerHTML = '';
        
        // 禁用工具
        DOM.tools.move.disabled = true;
        DOM.tools.brush.disabled = true;
        DOM.tools.eraser.disabled = true;
        DOM.btnGenerate.disabled = true;
        DOM.btnFastErase.disabled = true;
        DOM.btnAiInpaint.disabled = true;
        
        startTimer();
    } else {
        DOM.overlay.classList.add('hidden');
        stopTimer();
        
        // 恢复工具
        DOM.tools.move.disabled = false;
        DOM.tools.brush.disabled = false;
        DOM.tools.eraser.disabled = false;
        
        // 按钮可用性控制
        if (State.imageObj) {
            DOM.btnFastErase.disabled = false;
            DOM.btnGenerate.disabled = false;
            DOM.btnGenerate.innerHTML = `<i data-lucide="wand-2" class="btn-icon"></i> 智能扩图`;
            DOM.btnAiInpaint.disabled = false;
            DOM.btnAiInpaint.innerHTML = `<i data-lucide="sparkles" class="btn-icon"></i> AI 局部重绘`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

function handleError(msg) {
    setLoading(false);
    alert('错误: ' + msg);
    DOM.statusLog.textContent = '任务失败: ' + msg;
}

// ==========================================
// 计时器
// ==========================================
function startTimer() {
    State.startTime = Date.now();
    State.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - State.startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        if (DOM.terminalTimer) {
            DOM.terminalTimer.innerHTML = `⏱ 已耗时 ${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function updateTerminalLogs(logs) {
    if (!DOM.terminalLogsView) return;
    
    DOM.terminalLogsView.innerHTML = logs.map(log => {
        let className = 'terminal-line-silver';
        if (log.includes('[ERROR]')) className = 'terminal-line-error';
        return `<div class="${className}">${log}</div>`;
    }).join('');
    
    // 自动滚动到底部
    DOM.terminalLogsView.scrollTop = DOM.terminalLogsView.scrollHeight;
}

function stopTimer() {
    if (State.timerInterval) {
        clearInterval(State.timerInterval);
        State.timerInterval = null;
    }
}

// ==========================================
// 日志
// ==========================================
function logTerminal(msg) {
    DOM.statusLog.textContent = msg;
    console.log('[神灯AI]', msg);
}

// ==========================================
// 事件绑定
// ==========================================
DOM.tools.move.addEventListener('click', () => switchTool('move'));
DOM.tools.brush.addEventListener('click', () => switchTool('brush'));
DOM.tools.rect.addEventListener('click', () => switchTool('rect'));
DOM.tools.eraser.addEventListener('click', () => switchTool('eraser'));
DOM.btnCancelBrush?.addEventListener('click', () => switchTool('move'));

// ==========================================
// Paste-Back 对比视图
// ==========================================
if (DOM.btnCompare) {
    DOM.btnCompare.addEventListener('click', async () => {
        if (!State.taskId) return;
        
        // 显示 AI 扩图结果（带回贴的最终效果）
        DOM.imgWithPasteback.src = DOM.resultImg.src;
        
        // 获取未回贴的 AI 扩图（使用 raw=true 参数）
        DOM.imgNoPasteback.src = `/api/download/${State.taskId}?raw=true&t=${Date.now()}`;
        
        // 显示对比视图
        DOM.comparisonView.classList.remove('hidden');
        
        // 初始化 Lucide 图标
        lucide.createIcons();
    });
}

if (DOM.btnCloseComparison) {
    DOM.btnCloseComparison.addEventListener('click', () => {
        DOM.comparisonView.classList.add('hidden');
    });
}

// ESC 键关闭对比视图
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !DOM.comparisonView.classList.contains('hidden')) {
        DOM.comparisonView.classList.add('hidden');
    }
});

// 初始化 Lucide 图标
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

// ==========================================
// 定时监测后台大模型预加载状态 (防误触及极速CV响应联动)
// ==========================================
let modelCheckInterval = null;
let currentPollDelay = 2000;

function startModelStatusCheck() {
    if (modelCheckInterval) clearInterval(modelCheckInterval);
    
    const check = async () => {
        try {
            const res = await fetch('/api/health');
            if (!res.ok) throw new Error('Health check response not ok');
            const data = await res.json();
            
            const gpuBadge = document.getElementById('gpu-badge');
            const gpuNameEl = document.getElementById('gpu-name');
            const vramMonitor = document.getElementById('vram-monitor');
            const badgeDot = gpuBadge ? gpuBadge.querySelector('.badge-dot') : null;
            
            if (badgeDot) {
                badgeDot.classList.remove('live', 'warn', 'error');
            }
            
            if (data.model_loaded) {
                // ── 模型加载就绪 ──
                State.isModelLoaded = true;
                
                if (badgeDot) badgeDot.classList.add('live');
                if (gpuNameEl) {
                    gpuNameEl.textContent = data.gpu_name ? `${data.gpu_name}` : 'GPU (已就绪)';
                }
                
                // 显示显存监视器
                if (vramMonitor) vramMonitor.classList.remove('hidden');
                
                // 渲染显存 Block
                if (data.vram_used !== undefined && data.vram_total !== undefined) {
                    const vramTextEl = document.getElementById('vram-text');
                    if (vramTextEl) {
                        vramTextEl.textContent = `${data.vram_used.toFixed(1)}GB / ${data.vram_total.toFixed(1)}GB`;
                    }
                    
                    const blockCount = 8;
                    const ratio = data.vram_used / data.vram_total;
                    const usedBlocks = Math.round(ratio * blockCount);
                    
                    let blocksHTML = '';
                    for (let i = 0; i < blockCount; i++) {
                        let blockClass = 'vram-block';
                        if (i < usedBlocks) {
                            if (ratio > 0.9) {
                                blockClass += ' critical';
                            } else if (ratio > 0.75) {
                                blockClass += ' high';
                            } else {
                                blockClass += ' used';
                            }
                        }
                        blocksHTML += `<div class="${blockClass}"></div>`;
                    }
                    const vramBlocksEl = document.getElementById('vram-blocks');
                    if (vramBlocksEl) vramBlocksEl.innerHTML = blocksHTML;
                }
            } else {
                // ── 大模型未加载（待命状态） ──
                State.isModelLoaded = false;
                
                if (badgeDot) badgeDot.classList.add('warn'); // 橙色/黄色，代表待命
                if (gpuNameEl) {
                    gpuNameEl.textContent = data.gpu_name ? `${data.gpu_name} (待命)` : 'GPU (待命)';
                }
                
                // 显示显存监视器
                if (vramMonitor) vramMonitor.classList.remove('hidden');
                
                // 渲染显存 Block
                if (data.vram_used !== undefined && data.vram_total !== undefined) {
                    const vramTextEl = document.getElementById('vram-text');
                    if (vramTextEl) {
                        vramTextEl.textContent = `${data.vram_used.toFixed(1)}GB / ${data.vram_total.toFixed(1)}GB`;
                    }
                    
                    const blockCount = 8;
                    const ratio = data.vram_used / data.vram_total;
                    const usedBlocks = Math.round(ratio * blockCount);
                    
                    let blocksHTML = '';
                    for (let i = 0; i < blockCount; i++) {
                        let blockClass = 'vram-block';
                        if (i < usedBlocks) {
                            if (ratio > 0.9) {
                                blockClass += ' critical';
                            } else if (ratio > 0.75) {
                                blockClass += ' high';
                            } else {
                                blockClass += ' used';
                            }
                        }
                        blocksHTML += `<div class="${blockClass}"></div>`;
                    }
                    const vramBlocksEl = document.getElementById('vram-blocks');
                    if (vramBlocksEl) vramBlocksEl.innerHTML = blocksHTML;
                }
            }
            
            // 无论大模型是否加载，只要图片已导入且当前不在生成中，就激活生成按钮！
            if (State.imageObj && !State.isProcessing) {
                if (DOM.btnGenerate && (DOM.btnGenerate.disabled || DOM.btnGenerate.innerHTML.includes('spinner') || DOM.btnGenerate.textContent.includes('离线'))) {
                    DOM.btnGenerate.disabled = false;
                    DOM.btnGenerate.innerHTML = `<i data-lucide="wand-2" class="btn-icon"></i> 智能扩图`;
                }
                if (DOM.btnAiInpaint && (DOM.btnAiInpaint.disabled || DOM.btnAiInpaint.innerHTML.includes('spinner') || DOM.btnAiInpaint.textContent.includes('离线'))) {
                    DOM.btnAiInpaint.disabled = false;
                    DOM.btnAiInpaint.innerHTML = `<i data-lucide="sparkles" class="btn-icon"></i> AI 局部重绘`;
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            
            // 保持低频 5 秒心跳即可，既环保又实时
            if (currentPollDelay !== 5000) {
                currentPollDelay = 5000;
                startModelStatusCheck();
            }
        } catch (e) {
            // ── 后端未启动或服务离线 ──
            State.isModelLoaded = false;
            
            const gpuBadge = document.getElementById('gpu-badge');
            const gpuNameEl = document.getElementById('gpu-name');
            const vramMonitor = document.getElementById('vram-monitor');
            const badgeDot = gpuBadge ? gpuBadge.querySelector('.badge-dot') : null;
            
            if (badgeDot) {
                badgeDot.classList.remove('live', 'warn');
                badgeDot.classList.add('error'); // 红色
            }
            if (gpuNameEl) gpuNameEl.textContent = '后端未连接';
            if (vramMonitor) vramMonitor.classList.add('hidden');
            
            // 如果后端离线，则禁用生成和局部重绘
            if (!State.isProcessing) {
                if (DOM.btnGenerate) {
                    DOM.btnGenerate.disabled = true;
                    DOM.btnGenerate.innerHTML = `<i data-lucide="alert-triangle" class="btn-icon"></i> 后端已离线`;
                }
                if (DOM.btnAiInpaint) {
                    DOM.btnAiInpaint.disabled = true;
                    DOM.btnAiInpaint.innerHTML = `<i data-lucide="alert-triangle" class="btn-icon"></i> 后端已离线`;
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            
            if (currentPollDelay !== 5000) {
                currentPollDelay = 5000;
                startModelStatusCheck();
            }
        }
    };
    
    check();
    modelCheckInterval = setInterval(check, currentPollDelay);
}

// 自动拉起高科技感状态监控
startModelStatusCheck();

// 自动激活智能动作免切换系统
initSmartActionSystem();

// ==========================================
// 100% 原始细节查看浮动控制与切换系统
// ==========================================
function toggleZoom100() {
    if (!State.imageObj) return;
    
    const fImg = State.imageObj;
    
    if (!State.isZoomed100) {
        // ── 切换到 100% 原尺寸超高清查看 ──
        State.isZoomed100 = true;
        
        fImg.set({
            scaleX: 1.0,
            scaleY: 1.0,
            originX: 'center',
            originY: 'center',
            left: CANVAS_W / 2,
            top: CANVAS_H / 2
        });
        
        canvas.requestRenderAll();
        
        if (DOM.btnZoomToggle) {
            DOM.btnZoomToggle.innerHTML = '<i data-lucide="zoom-out"></i>';
        }    if (typeof lucide !== 'undefined') lucide.createIcons();
        
        // 强制进入移动拖拽模式，方便用户使用抓手或鼠标拖拽平移查看超清局部细节
        switchTool('move');
        
        logTerminal('已进入 100% 原始超清细节模式。直接拖动或按住 Space 键可自由平移查看局部。');
    } else {
        // ── 切换回自适应 Contain 吸合边框 ──
        State.isZoomed100 = false;
        
        const scale = Math.min(
            CANVAS_W / fImg.width,
            CANVAS_H / fImg.height
        );
        
        fImg.set({
            scaleX: scale,
            scaleY: scale,
            originX: 'center',
            originY: 'center',
            left: CANVAS_W / 2,
            top: CANVAS_H / 2
        });
        
        canvas.requestRenderAll();
        
        if (DOM.btnZoomToggle) {
            DOM.btnZoomToggle.innerHTML = '<i data-lucide="zoom-in"></i>';
        }    if (typeof lucide !== 'undefined') lucide.createIcons();
        
        logTerminal('已返回自适应边框视图。');
    }
}

// 绑定右上角浮动按钮
DOM.btnZoomToggle?.addEventListener('click', toggleZoom100);

// Z 键一键快捷键切换
window.addEventListener('keydown', (e) => {
    if (e.key === 'z' || e.key === 'Z') {
        // 仅在未选中任何输入框或文本域时响应，防止打字冲突
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            // 如果 Ctrl 被按着，那是撤销，不要触发缩放
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toggleZoom100();
            }
        }
    }
});

// 绑定右上角一键超清下载浮动按钮
DOM.btnFloatingDownload?.addEventListener('click', () => {
    if (!State.taskId) return;
    const a = document.createElement('a');
    a.href = `/api/download/${State.taskId}?t=${Date.now()}`;
    a.download = getDownloadFileName();
    a.click();
    logTerminal('已开始下载超清壁纸成品！');
});
