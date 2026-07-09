# 验证码模型训练指令

本文档整理 `F:\beaubird\pytorch-captcha-recognition` 下验证码模型的常用训练、测试和排查命令。

## 0. 进入项目目录

```powershell
Set-Location F:\beaubird\pytorch-captcha-recognition
```

后续命令都默认在这个目录下执行。

## 1. 生成训练数据

生成 100000 张模拟浙江鸟类记录验证码风格的训练图片：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_gen.py --count 100000 --output "D:\captcha-train"
```

如果需要固定随机种子，方便复现同一批生成逻辑：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_gen.py --count 100000 --output "D:\captcha-train" --seed 20260708
```

生成文件名格式类似：

```text
1234_1_1783520000.png
```

训练脚本会取文件名中第一个 `_` 前面的内容作为真实验证码标签。

## 2. 从零训练预训练模型

如果要重新训练 `model-pretrain.pkl`，使用 `--no-resume`：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_train.py --device auto --train-dir "D:\captcha-train" --num-workers 2 --no-resume --model-path ".\model-pretrain.pkl"
```

说明：

- `--no-resume` 表示不加载已有模型，从零开始训练。
- 如果 `model-pretrain.pkl` 已存在，这个命令最终会覆盖它。
- `--device auto` 会优先使用 CUDA；没有 CUDA 时使用 CPU。

## 3. 基于旧模型继续训练

如果要基于已有 `model-pretrain.pkl` 继续训练，建议先复制一份作为微调模型：

```powershell
Copy-Item .\model-pretrain.pkl .\model-finetune.pkl
```

然后训练 `model-finetune.pkl`，注意不要加 `--no-resume`：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_train.py --device auto --train-dir "D:\captcha-train" --num-workers 2 --model-path ".\model-finetune.pkl"
```

看到输出里有：

```text
resume model
```

说明脚本已经加载旧模型继续训练。

## 4. 限制训练轮数或步数

只训练 1 轮：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_train.py --device auto --train-dir "D:\captcha-train" --num-workers 2 --model-path ".\model-finetune.pkl" --epochs 1
```

只跑少量 step，用来快速确认训练流程是否正常：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_train.py --device auto --train-dir "D:\captcha-train" --num-workers 0 --model-path ".\model-finetune.pkl" --epochs 1 --max-steps 10
```

## 5. 测试模型准确率

测试 `dataset\test`：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_test.py --model-path ".\model-finetune.pkl" --test-dir ".\dataset\test" --num-workers 2
```

测试真实验证码目录 `dataset\yanzhengma`：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_test.py --model-path ".\model-finetune.pkl" --test-dir ".\dataset\yanzhengma" --num-workers 2
```

输出示例：

```text
Test Accuracy of the model on the 128 test images: 46.093750 %
```

这里是整张 4 位验证码全部预测正确的比例，不是单个数字的准确率。

如果要同时输出单个数字准确率，加 `--digit-accuracy`：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_test.py --model-path ".\model-finetune.pkl" --test-dir ".\dataset\yanzhengma" --num-workers 2 --digit-accuracy
```

输出会额外包含：

```text
Digit Accuracy of the model on the 512 digits: 82.031250 %
Digit Accuracy by position:
  position 1: 88.281250 %
  position 2: 78.906250 %
  position 3: 80.468750 %
  position 4: 80.468750 %
```

## 6. 输出目录里的预测结果

爬虫自动验证码默认使用 `model-finetune1.pkl`。如果要手动验证这个默认模型，可以先跑：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_predict.py --model-path ".\model-finetune1.pkl" --predict-dir ".\dataset\yanzhengma"
```

预测 `dataset\test` 目录：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_predict.py --model-path ".\model-finetune1.pkl" --predict-dir ".\dataset\test"
```

预测真实验证码目录：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_predict.py --model-path ".\model-finetune1.pkl" --predict-dir ".\dataset\yanzhengma"
```

当前 `captcha_predict.py` 只逐行输出预测验证码文本，不输出文件名。

爬虫遇到验证码时会把单张验证码临时放进一个目录，复用这个批量预测入口自动识别。需要换模型时，在爬虫命令里加：

```powershell
node tools/crawl-zhejiang-birdreport.mjs --auto-captcha --manual-captcha --open-captcha --captcha-model-path "pytorch-captcha-recognition\model-finetune.pkl"
```

## 7. 批量校正错误验证码文件名

`dataset\yanzhengma_false` 里保存的是模型提交后被 BirdReport 判错的验证码图片。用下面的本地窗口工具逐张查看图片并输入正确验证码；保存后图片会按正确验证码重命名并移动到 `dataset\yanzhengma`，然后自动打开下一张：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_review_false.py
```

如果要手动指定输入和输出目录：

```powershell
.\.venv\Scripts\python.exe -u .\captcha_review_false.py --input-dir ".\dataset\yanzhengma_false" --output-dir ".\dataset\yanzhengma"
```

快捷操作：

- `Enter`：保存当前输入的 4 位验证码并打开下一张
- `Skip`：跳过当前图片
- `Back`：回到上一张，不撤销已经保存的移动

## 8. 排查训练集中损坏图片

如果训练时报错类似：

```text
OSError: image file is truncated
```

通常表示训练目录里有损坏、空文件、未写完或非图片文件。先只扫描，不删除：

```powershell
@'
from pathlib import Path
from PIL import Image

folder = Path(r"D:\captcha-train")
bad = []
total = 0

for path in folder.iterdir():
    if not path.is_file():
        continue
    total += 1
    try:
        with Image.open(path) as img:
            img.verify()
        with Image.open(path) as img:
            img.convert("L").load()
    except Exception as e:
        bad.append((path, repr(e), path.stat().st_size))

print("total files:", total)
print("bad files:", len(bad))
for path, err, size in bad[:200]:
    print(f"{path}\tsize={size}\t{err}")
'@ | .\.venv\Scripts\python.exe -
```

排查建议：

- 不要一边生成图片、一边用同一个目录训练。
- 如果 `--num-workers 2` 报错不直观，可以临时用 `--num-workers 0` 复现。
- 先确认坏文件列表，再决定如何处理。

## 9. 查看脚本参数

```powershell
.\.venv\Scripts\python.exe -u .\captcha_gen.py --help
```

```powershell
.\.venv\Scripts\python.exe -u .\captcha_train.py --help
```

```powershell
.\.venv\Scripts\python.exe -u .\captcha_test.py --help
```

```powershell
.\.venv\Scripts\python.exe -u .\captcha_predict.py --help
```

```powershell
.\.venv\Scripts\python.exe -u .\captcha_review_false.py --help
```
