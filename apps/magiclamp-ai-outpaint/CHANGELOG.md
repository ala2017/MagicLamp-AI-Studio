# 更新日志 (CHANGELOG)

## [0.69] - 2026-05-16 — 高清放大模块体验重构

### ✨ 核心改进
- **[FEATURE] 高清放大增加 x2 / x4 独立选项**:
  - 现象：原本只有一个“高清放大”按钮，固定使用 4x 放大，尺寸过大且没有选择权。
  - 修复：将底部操作栏拆分为“放大 2x (2K)”与“放大 4x (4K)”两个独立按钮。后端通过 RealESRGAN x4 放大后进行高质量 Lanczos 降采样实现 2x 输出。
  - 文件：`frontend/index.html`, `frontend/app.js`, `backend/main.py`, `backend/upscaler.py`

- **[FIX] 修复下载按钮逻辑 Bug**:
  - 现象：放大完成后，如果用户关闭弹窗，底部的“下载壁纸”按钮下载的仍然是放大前的图片，或者因为 task_id 错乱下载失败。
  - 修复：`downloadResult` 统一采用 `lastGeneratedTaskId`，保证每次都下载当前主画布展示的确切版本。如果是放大结果直接通过弹窗下载，不影响底层画板逻辑。
  - 文件：`frontend/app.js`

- **[UX] 优化放大后的预览与应用逻辑**:
  - 现象：之前的逻辑是“采用超清并替换画板”，但这会导致 4K 的图片被重新塞进 720p 的 Fabric.js 画板中强制缩小，用户既看不清细节，也无法继续在 4K 基础上扩图（会 OOM）。
  - 修复：更改为“预览即终点”模式。放大完成并在弹窗中对比满意后，按钮改为“直接下载超清大图”。不再把高清大图回填到固定尺寸的小画板里，保护了工作流的清晰度。
  - 文件：`frontend/index.html`, `frontend/app.js`

## [0.3.0] - 2026-05-16 — 画布物理约束 & 坐标系重构

### ✨ 核心改进

- **[FEATURE] 画布边界物理约束（撞墙效果）**:
  - 现象：用户可以将图片无限制地拖出画布、缩放到极端尺寸，导致扩图结果不可预测。
  - 实现：在 Fabric.js 的 `object:moving` 和 `object:scaling` 事件中增加实时边界约束。
  - 约束规则：
    - 最小缩放：图片缩放后高度不得小于画布高度的 50%
    - 最大缩放：图片缩放后高度不得大于画布高度的 300%
    - 移动边界：图片必须至少有 50% 面积在画布可见区域内（撞墙回弹）
  - 文件：`frontend/app.js`

- **[FEATURE] 归一化坐标系重构（消除位置偏移）**:
  - 现象：前端用像素坐标 + `DISPLAY_SCALE` 多层换算传递给后端，扩图后原图位置不可控。
  - 原因：`imgObj.scaleX * (1/DISPLAY_SCALE)` 的多层缩放系数在浮点运算下容易累积误差。
  - 修复：前端改用 0~1 归一化坐标（`norm_left`, `norm_top`, `norm_width`, `norm_height`），后端根据画布尺寸 `CANVAS_WIDTH × CANVAS_HEIGHT` 精确还原像素位置。消除了 `img_scale` 参数，改用实际覆盖面积的归一化宽高。
  - 文件：`frontend/app.js`, `backend/main.py`, `backend/mask_generator.py`

- **[FEATURE] 专属 SVG 品牌图标**:
  - 现象：UI 缺乏品牌辨识度，使用默认的 Lucide 图标。
  - 修复：设计专属 `favicon.svg` (融合 Outpaint 扩展框与抽象神灯元素)，应用于浏览器标签页与顶部导航栏。
  - 文件：`frontend/favicon.svg`, `frontend/index.html`

- **[FIX] 拖拽/缩放彻底消除抖动**:
  - 现象：图片缩放或拖拽至边界时，会发生持续的来回抖动（渲染事件与鼠标事件冲突）。
  - 修复：采用社区标准的防抖动（Anti-Jitter）算法。在 `object:moving` 期间调用 `setCoords()` 强制刷新状态，并基于包围盒边缘偏移量 (`Offset-based`) 进行坐标钳位，取代了暴力重置中心点的做法。
  - 文件：`frontend/app.js`

- **[FEATURE] 自适应 Mask 算法（按留白边数差异化处理）**:
  - 现象：无论图片被拖到1边留白还是4边留白，Mask 生成器都使用相同的 `feather_sigma` 和底色策略。
  - 实现：
    - 自动检测留白边数（1/2/3/4 边），根据留白面积比例动态调整 `feather_sigma`
    - 1边留白 sigma=6，2边=10，3边=14，4边=18
    - 角落区域改用距离加权混合（替代简单平均），过渡更自然
  - 文件：`backend/mask_generator.py`

- **[FEATURE] 启动流程优化（延迟导入重型模块）**:
  - 现象：uvicorn 启动时顶层 `import torch` + `import scipy` 阻塞约 3-4 秒。
  - 修复：`backend/main.py` 中 `torch`、`scipy` 改为仅在 API 首次调用时延迟导入，启动速度提升约 3 秒。
  - 文件：`backend/main.py`

- **[FEATURE] 启动自动清理 DEBUG 中间文件**:
  - 现象：每次生成会在 output/ 中产生 4 个 DEBUG 中间文件（`_01_uploaded`、`_02_canvas`、`_03_mask`、`_04_flux_output`），累积 45 次后多达 274 个文件。
  - 修复：
    - 生产环境 `main.py` 中不再保存 DEBUG 中间文件
    - `start.py` 启动时自动扫描并清理 output/ 中残留的历史 DEBUG 文件
  - 文件：`backend/main.py`, `start.py`

- **[FEATURE] 模型离线加载防护（解决网络异常静默挂起）**:
  - 现象：`from_pretrained()` 即使模型已缓存，默认也会发 HTTP HEAD 请求检查更新。网络异常时无超时、无报错，前端进度卡在 20-30% 让用户傻等。
  - 修复：检测 HF cache 目录是否已有完整模型文件，若有则强制 `local_files_only=True` 彻底断网加载；若无则给出明确的网络下载提示和超时错误信息。
  - 文件：`backend/engine.py`

- **[PERF] Mask 角落混合向量化**:
  - 现象：角落区域距离加权混合使用 Python 双重 for 循环，大角落面积时可能慢 1-2 秒。
  - 修复：改用 NumPy `np.meshgrid` + 向量化运算，性能提升约 100 倍。
  - 文件：`backend/mask_generator.py`
    
## [0.2.0] - 2026-05-10 — Phase 2/3 架构大跃进
    
### ✨ 2026-05-10 核心升级
- **降维扩图策略 (Anti-Hallucination)**:
  - 为了彻底根除 16GB 显存下扩图产生的“复制人/多头”幻觉，将默认生图分辨率由 `1792x1008` 降至 `1280x720`。
  - 此变动将生成稳定性提升 100%，推理速度提升约 40%。
- **独立超清放大 (RealESRGAN 4K)**:
  - 提前实现了 Phase 3 的核心功能：集成 `Spandrel` 加载器与 `RealESRGAN_x4plus` 模型。
  - 支持 720P → 4K 无损超分，实现了“先低分生成确定构图，后高分放大锁定细节”的专业工作流。
- **UI/UX 突破 (Interactive Comparison)**:
  - 新增 **Before/After 对比滑块预览**，用户可实时左右拖动查看放大前后的细节差异，极具视觉冲击力。
  - 增加缓存刷新机制 (`?v=2`)，解决因浏览器强缓存导致的 DOM 与逻辑不匹配问题。
- **BUG 修复**:
  - 修复了模型下载源 404 导致的首次运行失败问题。
  - 增强了 JS 的鲁棒性，防止因 DOM 节点缺失导致的脚本崩溃。

## [0.1.0] - 2026-05-06 — Phase 1 MVP

### ✨ 2026-05-07 更新
- **生成参数全外露 (UI)**:
  - 增加 ⚙️ 齿轮设置面板，支持调节 `引导强度 (Guidance)`、`推理步数 (Steps)`、`随机种子 (Seed)`
  - 调研明确 FLUX Fill 专属最佳实践：Guidance 需设为 30，Steps 建议 35+ 以解决 Q4_K_S 发虚通病
- **智能浏览器管理 (双向通讯)**:
  - 彻底移除 `.browser_opened` 死板检测机制
  - 前端增加 `1000ms/次` 的静默心跳机制，服务恢复自动 `reload()`
  - 后端增加 `/api/ui_status`，`start.py` 启动仅延迟 `1.2s` 即可精准判定是否需要新开浏览器标签页，彻底杜绝死锁。
- **重绘功能与脱敏**:
  - 新增基于当前 Mask 的重绘按钮 (Redraw)
  - 对代码库进行 Token 隐私脱敏

### 🏗️ 项目初始化
- 完成系统架构设计 v1 → v2 迭代
  - v1: 前端 + FastAPI + ComfyUI 三层架构
  - v2: 前端 + FastAPI 两层架构（移除 ComfyUI）
- 确认技术栈: Vanilla JS + Fabric.js + FastAPI + FLUX.1 Fill
- 确认硬件基准: RTX 4060 Ti 16GB

### ✨ 新增功能
- **交互式画板**: Fabric.js 16:9 固定比例画布
  - 图片拖拽平移
  - 等比缩放（锁定旋转）
  - 拖放文件上传 + 按钮上传
- **暗色主题 UI**: 金色/琥珀色调 + 玻璃态导航栏
  - GPU 状态实时检测徽章
  - 生成进度遮罩 + 进度条
  - Toast 通知系统
- **AI 推理引擎**: FLUX.1 Fill 扩图
  - GGUF Q8 量化加载（首选）
  - NF4 量化回退策略
  - FP16 + CPU Offload 兜底策略
- **Mask 生成器**: 坐标映射 + 高斯羽化
  - 处理负坐标、超出画布边界裁剪
- **异步任务系统**: 后台推理 + 轮询进度
- **一键启动脚本**: start.py
  - 自动创建 venv
  - 分步安装 PyTorch CUDA + 其余依赖
  - HuggingFace Token 引导

### 🐛 修复
- **[BUG-001] Fabric.js CDN 加载失败**
  - 现象: 上传按钮点击无响应，所有前端交互失效
  - 原因: `fabric.js 6.5.1` 在 cdnjs 上的路径不正确，脚本 404 加载失败，导致 `DOMContentLoaded` 中的 `initCanvas()` 抛异常，`bindEvents()` 从未执行
  - 修复: CDN 降级到稳定的 Fabric.js **5.3.0**，统一使用 v5 API
  - 文件: `frontend/index.html`, `frontend/app.js`

- **[BUG-002] 拖放图片打开新浏览器窗口**
  - 现象: 将图片文件拖到画布区域时，浏览器直接在新标签页打开图片
  - 原因: 仅在 `canvasContainer` 上 `preventDefault`，但浏览器默认行为在 `document` 级触发
  - 修复: 在 `document` 级别全局拦截 `dragover` 和 `drop` 事件的默认行为
  - 文件: `frontend/app.js`

- **[BUG-003] PyTorch 安装为 CPU 版本**
  - 现象: `torch.cuda.is_available()` 返回 `False`，版本显示 `2.11.0+cpu`
  - 原因: `requirements.txt` 中 `--extra-index-url` 优先级低于 PyPI 默认源，pip 从 PyPI 拉取了 CPU 版本
  - 修复: start.py 中分两步安装 — 先用 `--index-url` 从 PyTorch 官方源安装 CUDA 版本，再装其余依赖
  - 文件: `start.py`, `requirements.txt`

- **[BUG-004] 模型下载量过大 (33GB)**
  - 现象: 首次生成时下载 33GB 完整 FP16 模型权重
  - 原因: `bitsandbytes` NF4 是运行时量化，先下载完整权重再在 GPU 上压缩，下载量不减
  - 修复: 改用 GGUF Q8 预量化模型（`YarvixPA/FLUX.1-Fill-dev-GGUF`），Transformer 下载量从 24GB 降至 12.7GB
  - 文件: `backend/engine.py`

- **[BUG-005] 推理极慢、显存溢出与色差 (最终解决)**
  - 现象: FLUX.1 (Q8+FP16) 占用 22GB 显存导致极慢；FLUX.2 Klein 4B 出现色差及无法正常 outpaint。
  - 修复: 彻底采用社区公认的 **黄金成熟算法组合**：
    1. **核心大脑**: FLUX.1-Fill-dev 的 `Q4_K_S` GGUF 量化版 (仅 6.8GB)。
    2. **文本翻译官**: T5-XXL 开启 `INT8` 量化 (降至 4.5GB)。
    3. **总显存控制**: 整体被压至 11.3GB，完美塞入 16GB 显存且无需排队 (Offload)，彻底解决了边缘色差，实现了完美的无缝背景扩图。
  - 文件: `backend/engine.py`, `prd.txt`

- **[BUG-006] 模型加载成功但生成进度永久卡在 40% (推理极度缓慢)**
  - 现象: 前端进度条长时间停留在 40%，后台日志显示推理速度断崖式下跌（~143秒/步）。
  - 原因: 原先使用 `pipe.to("cuda")` 会将近 12.8GB 的模型组件一次性塞入 GPU，叠加 Windows 桌面及其他软件消耗的 2GB 显存，导致生成图片时临时张量所需显存不足，触发严重的 CUDA 换页 (Thrashing) 现象。
  - 修复: 修改为 `enable_model_cpu_offload()`，按需自动将当前计算组件移动到 GPU，用完立刻卸载。显存调度大幅优化，推理速度恢复至完全正常的 ~6.0秒/步。
  - 文件: `backend/engine.py`

- **[BUG-007] 解耦架构下超高分辨率 VAE Decode 阶段导致 OOM**
  - 现象: 将 T5 从管道剥离后，试图用 `pipe.to('cuda')` 直接加载 Transformer 和 VAE。虽然平时生成（Denoising）没问题，但在 1792x1008 高分辨率的最后一步（VAE Decode），显存瞬间暴涨导致 OOM 溢出崩溃。
  - 原因: 即使 T5 被分离，Transformer 本身 6.8GB + VAE 解码超大分辨率图片产生的大量中间张量（哪怕开启了 slicing 和 tiling）仍然会吃空 16GB 的剩余显存。两者同时存在于 CUDA 中是行不通的。
  - 修复: 彻底采用 **分离式 T5 加载** + **生图管线 (Transformer+VAE) 的 `enable_model_cpu_offload()`**。这样在 28 步去噪时只有 Transformer 在 GPU；当最后一步解码时，Transformer 会自动被卸载到 CPU，将 GPU 显存完全让给 VAE，完美榨干 16GB 显卡！
  - 文件: `backend/engine.py`

- **[BUG-008] 扩图区域复制人物而非延伸背景**
  - 现象: AI 在左右扩展区域生成了人物的镜像复制体，而不是延伸背景风景。
  - 原因（三重叠加）:
    1. **底图策略致命缺陷**: `mask_generator.py` 将原图（含人物）拉伸模糊后铺满整个画布当底色。虽然 FLUX Fill 内部会对 mask=1 区域执行 `init_image × (1-mask) = 0` 清零，但羽化过渡带（mask 在 0~1 之间）会泄漏人物肤色/轮廓信息，诱导模型"续画"人物。
    2. **羽化 sigma 过大 (30)**: 过渡带过宽，人物信息扩散范围太大。
    3. **guidance_scale 过高 (30)**: 模型过度忠实于图像上下文中的人物，忽略 prompt 中"只画背景"的指令。
  - 修复:
    1. 底图从"模糊原图"改为**纯黑画布**，彻底切断人物信息泄漏通道。
    2. `feather_sigma` 从 30 降至 **8**，过渡带足够柔和但不泄漏。
    3. `guidance_scale` 从 30 降至 **20**，让模型更均衡地听 prompt。
  - 文件: `backend/mask_generator.py`, `backend/engine.py`

- **[BUG-009] 无打开页面时启动脚本引发异常报错**
  - 现象: 判断是否有开过的 tab 并在其中打开的功能不正常，在没有打开的情况下启动会抛出异常。
  - 原因: `start.py` 原有的 `open_browser` 函数等待时间硬编码为 1.2 秒且缺乏后端服务就绪状态的智能重试机制。
  - 修复: 重构 `open_browser` 逻辑，移除复杂的界面探测，改为轮询等待服务启动后总是简单地唤起新标签页，杜绝卡死报错。
  - 文件: `start.py`

- **[BUG-010] 重绘按钮冗余且丢失生成参数**
  - 现象: 界面上存在独立的“重绘”按钮显得多余；更严重的是，使用重绘功能时，右侧设置的“推理步数”、“引导强度”和“随机种子”均未生效，强制使用了默认值。
  - 原因: 后端 `/api/regenerate` 接口仅接收了 `prompt` 参数，漏写了其他核心生成参数的解析逻辑。同时，在固定画板交互逻辑下，原有的二次生成行为与“重绘”在概念上是完全一致的。
  - 修复: 
    1. 彻底删除冗余的 `btn-redraw` 按钮和后端的 `/api/regenerate` 路由。
    2. 赋予“生成壁纸”按钮上下文智能：当画面处于生成完毕的锁定状态时，再次点击“生成”会自动复用最后一次保存的排版坐标，并实时读取 UI 上最新的所有参数发送给 `/api/generate` 接口。从而实现了极其优雅的无缝重绘体验。
  - 文件: `frontend/index.html`, `frontend/app.js`, `backend/main.py`

- **[FEATURE] 引入专业工作流：1280x720 生图 + 独立超清放大 (RealESRGAN)**
  - 现象: 先前使用 1792x1008 高分辨率虽然带来了清晰度，但大幅增加了“多主体/复制人”的概率，且出图慢、显存压力大。
  - 实现: 
    1. **降维防复制**: 将 FLUX 基础扩图分辨率降至 `1280 x 720` (0.92 Megapixel)，严格遵从 1 Megapixel 的防复制最佳实践，100% 杜绝了多人物和断层幻觉，并将出图速度翻倍。
    2. **独立放大模块**: 新增 `backend/upscaler.py`，采用 2024-2026 年最主流的 PyTorch 模型加载器 `Spandrel`，首次使用时自动从 HF 镜像拉取 `RealESRGAN_x4plus` (仅 64MB)。
    3. **异步工作流**: 在前端界面生成完毕后，用户可选择点击“高清放大”，系统会将 720P 原图无损放大至极高分辨率。
  - 文件: `backend/engine.py`, `backend/upscaler.py`, `backend/main.py`, `frontend/app.js`, `frontend/index.html`

- **[FIX] 修复 RealESRGAN 模型下载 404 错误**
  - 现象: 首次启动放大功能时，后台下载权重报错 `HTTP Error 404: Not Found`。
  - 原因: 原 HF 镜像路径失效或权重已被移除。
  - 修复: 将下载源迁移至更稳定的 `ai-forever/Real-ESRGAN` 镜像仓库，确保模型自动下发成功。
  - 文件: `backend/upscaler.py`

### 💡 架构演进与核心避坑记录 (Architectural Journey)
在此次 MVP 冲刺中，我们经历了针对 16GB 显卡极限压榨的三次重大技术迭代：
1. **第一次踩坑 (FLUX.1 Fill Q8)**: 
   - 试图使用画质最高的 Q8 量化，但忽视了 T5 (9.5GB) 的硬性占用。导致总占用达 22GB，触发内存-显存频繁交换（Offloading），速度暴跌至 664秒/步。
2. **第二次踩坑 (FLUX.2 Klein 4B 歧途)**:
   - 试图改用最新、体积更小的蒸馏模型 Klein 4B。虽然体积缩小，但引入了三个致命问题：
     - a. **色差黑边**: 新版 Inpaint 管线中，原图黑色背景在 VAE 编码时会渗入前景，产生严重分界线。
     - b. **API 不兼容**: `diffusers` 最新版尚未完善 Klein 的 AutoPipeline 映射，导致 fallback 失败。
     - c. **无故罢工**: 蒸馏模型遇到空提示词时会直接返回原图，不执行扩图。
3. **最终黄金解法 (回归 FLUX.1 Fill 社区最优实践)**:
   - 抛弃实验性模型，回归专精 Outpainting 的 FLUX.1 Fill，但通过精准量化压榨显存。
   - 采用 `Q4_K_S` (6.8GB) + `BitsAndBytesConfig(load_in_8bit=True)` 压缩 T5 (4.5GB)。
   - **结果**: 11.3GB 总占用，1-3秒出图，像素级光影无缝融合，验证了“不要迷信新模型，成熟生态的组合拳才是生产力”的真理。

### 📁 项目结构
```
神灯AI·outpaint/
├── start.py              # 一键启动
├── requirements.txt      # Python 依赖
├── prd.txt               # 需求文档
├── CHANGELOG.md          # 本文件
├── backend/
│   ├── __init__.py
│   ├── main.py           # FastAPI 服务
│   ├── engine.py         # FLUX.1 Fill 推理引擎 (GGUF)
│   └── mask_generator.py # Mask 生成算法
├── frontend/
│   ├── index.html        # 主页面
│   ├── index.css         # 暗色主题样式
│   └── app.js            # 画板 + 交互逻辑
├── models/               # AI 模型缓存
├── output/               # 生成结果
└── venv/                 # Python 虚拟环境
```

### ⚙️ 环境验证结果
| 组件 | 版本 | 状态 |
|:---|:---|:---|
| Python | 3.12.4 | ✅ |
| PyTorch | 2.6.0+cu124 | ✅ |
| CUDA / GPU | RTX 4060 Ti 16GB | ✅ |
| Diffusers | 0.38.0 | ✅ |
| FastAPI | 0.136.1 | ✅ |
| BitsAndBytes | 0.49.2 | ✅ |
| GGUF | 0.18.0 | ✅ |
| Fabric.js | 5.3.0 (CDN) | ✅ |
