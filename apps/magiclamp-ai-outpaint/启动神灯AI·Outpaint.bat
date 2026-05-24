@echo off
title 神灯AI · Outpaint v0.87 - 商业双模工作站启动器
chcp 65001 > nul
cls

echo ============================================================
echo   🔮 神灯AI · Outpaint v0.87 — 商业版智能扩图工作站
echo ============================================================
echo.
echo   请选择您需要拉起的运行模式:
echo.
echo     [1] 测试与自用模式 (在 Chrome/Edge 浏览器中打开，提供 F12 调试)
echo     [2] 商业收费发布模式 (拉起 100% 独立桌面客户端窗口，脱离浏览器)
echo.
echo   [提示] 默认 5 秒内未选择，将自动启动 [选项 1] 浏览器模式。
echo ============================================================
echo.

choice /c 12 /t 5 /d 1 /m "  请输入您的启动选项 (1 或 2): "

if errorlevel 2 goto premium_app
if errorlevel 1 goto standard_browser

:standard_browser
echo.
echo   [启动] 正在以 [选项 1：自用调试版] 唤醒内核，请稍后...
echo.
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe MagicLamp_Outpaint.py
) else (
    python MagicLamp_Outpaint.py
)
goto end

:premium_app
echo.
echo   [启动] 正在以 [选项 2：商业桌面客户端] 唤醒内核，请稍后...
echo.
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe MagicLamp_Outpaint.py --app
) else (
    python MagicLamp_Outpaint.py --app
)
goto end

:end
echo.
echo   [关闭] 软件已安全退出。
echo.
pause
