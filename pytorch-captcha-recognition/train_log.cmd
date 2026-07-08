@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" -u captcha_train.py --device auto > captcha_train.log 2> captcha_train.err.log
