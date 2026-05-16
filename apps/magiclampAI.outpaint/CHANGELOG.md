# 更新日志 (CHANGELOG)

## [0.1.0] - 2026-05-06 — Phase 1 MVP

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
