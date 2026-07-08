@echo off
cd /d "%~dp0"
set OMP_NUM_THREADS=2
set MKL_NUM_THREADS=2
set TORCH_NUM_THREADS=2
".venv\Scripts\python.exe" -u captcha_train.py --device cpu > captcha_train.log 2> captcha_train.err.log
