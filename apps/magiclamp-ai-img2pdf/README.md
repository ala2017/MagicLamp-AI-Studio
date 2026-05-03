# 神灯AI·img2pdf (magiclamp AI·img2pdf)

开源的 Windows 图片转 PDF 工具，支持批量图片无缝合并，并可选用 Real-ESRGAN 做 AI 清晰修复。

## 功能特性
- 批量读取目录图片并合并为 PDF
- 自动统一宽度，按顺序无缝拼接
- 集成 Real-ESRGAN（首次自动准备运行环境）
- 支持 AI 模式与倍率选择（自动 / 2x / 4x）
- 支持保持原色选项
- 支持中英文界面切换
- 支持防多开（重复启动自动唤醒已打开窗口）

## 环境要求
- Windows 10/11
- Python 3.10+
- 依赖：Pillow

## 安装依赖
```bash
pip install -r requirements.txt
```

## 开发运行
```bash
python main.py
```

或双击 [一键启动.bat](file:///f:/=神灯智库/- 神灯AI·app/-jpg2pdf/一键启动.bat)。

## 打包 EXE
```bash
build_windows.bat
```

输出文件位于 `dist\magiclamp_AI_img2pdf_v*.exe`。

## 使用说明
1. 点击“选择目录/图片”，选择图片文件夹
2. 根据需要开启“AI清晰修复”
3. 选择修复模式与倍率
4. 点击“开始合并”
5. 完成后点击“打开目录 / 打开文件”

## 支持格式
- jpg
- jpeg
- png
- bmp
- tif
- tiff
- webp

## 输出规则
- 输出路径：图片目录内
- 默认命名：`<目录名>.pdf`
- 若重名：自动追加时间戳

## GPU 指定（可选）
```bash
set REAL_ESRGAN_GPU=0
```

## 开源协议
本项目采用 MIT License，详见 [LICENSE](file:///f:/=神灯智库/- 神灯AI·app/-jpg2pdf/LICENSE)。
