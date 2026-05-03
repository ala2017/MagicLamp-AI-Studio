@echo off
setlocal
cd /d %~dp0

set VENV_DIR=%~dp0\.venv-build
if exist "%VENV_DIR%" (
  echo Using existing build venv: %VENV_DIR%
) else (
  py -m venv "%VENV_DIR%"
)

call "%VENV_DIR%\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install pyinstaller

python -m PyInstaller ^
  --noconsole ^
  --onefile ^
  --icon "app_icon.ico" ^
  --name "magiclamp_AI_img2pdf_v0.3.23" ^
  --add-data "app_icon.ico;." ^
  --add-data "realesrgan;realesrgan" ^
  --collect-all PIL ^
  main.py

echo.
echo Build finished. Check dist\magiclamp_AI_img2pdf_v0.3.23.exe
