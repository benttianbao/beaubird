@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" -u captcha_train.py --device auto
pause
