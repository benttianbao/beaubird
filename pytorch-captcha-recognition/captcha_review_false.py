# -*- coding: UTF-8 -*-
import argparse
import shutil
from pathlib import Path
import secrets
import tkinter as tk
from tkinter import messagebox

from PIL import Image, ImageTk


DEFAULT_INPUT_DIR = Path("dataset") / "yanzhengma_false"
DEFAULT_OUTPUT_DIR = Path("dataset") / "yanzhengma"
DEFAULT_REVIEW_OUTPUT_DIR = Path("dataset") / "yanzhengma_xiugai"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".gif"}


def build_arg_parser():
    parser = argparse.ArgumentParser(description="Review and correct failed captcha filenames.")
    parser.add_argument("--input-dir", default=str(DEFAULT_INPUT_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--review-output-dir", default=str(DEFAULT_REVIEW_OUTPUT_DIR))
    return parser


def is_valid_captcha_code(code):
    return isinstance(code, str) and len(code) == 4 and code.isdigit()


def current_code_from_filename(path):
    return Path(path).stem.split("_", 1)[0]


def build_corrected_filename(source_path, code):
    if not is_valid_captcha_code(code):
        raise ValueError("验证码必须是 4 位数字。")
    source = Path(source_path)
    stem = source.stem
    suffix_text = stem.split("_", 1)[1] if "_" in stem else stem
    return f"{code}_{suffix_text}{source.suffix}"


def unique_destination_path(source_path, code, output_dir, suffix_factory=None):
    output = Path(output_dir)
    filename = build_corrected_filename(source_path, code)
    candidate = output / filename
    if not candidate.exists():
        return candidate

    source = Path(source_path)
    base = candidate.stem
    make_suffix = suffix_factory or (lambda: secrets.token_hex(4))
    while True:
        candidate = output / f"{base}_{make_suffix()}{source.suffix}"
        if not candidate.exists():
            return candidate


def copy_review_captcha(target_path, review_output_dir, suffix_factory=None):
    review_output = Path(review_output_dir)
    review_output.mkdir(parents=True, exist_ok=True)
    target = Path(target_path)
    review_target = review_output / target.name
    if review_target.exists():
        make_suffix = suffix_factory or (lambda: secrets.token_hex(4))
        while True:
            review_target = review_output / f"{target.stem}_{make_suffix()}{target.suffix}"
            if not review_target.exists():
                break
    shutil.copy2(target, review_target)
    return review_target


def move_corrected_captcha(source_path, code, output_dir, suffix_factory=None, review_output_dir=None):
    source = Path(source_path)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    target = unique_destination_path(source, code, output, suffix_factory=suffix_factory)
    source.replace(target)
    if review_output_dir is not None:
        copy_review_captcha(target, review_output_dir, suffix_factory=suffix_factory)
    return target


def list_image_paths(input_dir):
    folder = Path(input_dir)
    if not folder.exists():
        return []
    return sorted(
        (
            path
            for path in folder.iterdir()
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        ),
        key=lambda path: path.name.lower(),
    )


class CaptchaReviewApp:
    def __init__(self, root, input_dir, output_dir, review_output_dir):
        self.root = root
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.review_output_dir = Path(review_output_dir)
        self.files = list_image_paths(self.input_dir)
        self.initial_count = len(self.files)
        self.index = 0
        self.processed_count = 0
        self.photo = None

        self.root.title("验证码校名")
        self.root.geometry("560x360")
        self.root.minsize(480, 300)

        self.progress_label = tk.Label(root, text="", anchor="w")
        self.progress_label.pack(fill="x", padx=14, pady=(12, 4))

        self.filename_label = tk.Label(root, text="", anchor="w")
        self.filename_label.pack(fill="x", padx=14)

        self.image_label = tk.Label(root, background="#f3f3f3", width=440, height=150)
        self.image_label.pack(fill="both", expand=True, padx=14, pady=10)

        form = tk.Frame(root)
        form.pack(fill="x", padx=14)
        tk.Label(form, text="正确验证码").pack(side="left")
        self.code_var = tk.StringVar()
        self.code_entry = tk.Entry(form, textvariable=self.code_var, font=("Consolas", 18), width=8)
        self.code_entry.pack(side="left", padx=(8, 0))
        self.code_entry.bind("<Return>", lambda _event: self.save_current())

        self.message_label = tk.Label(root, text="", anchor="w", fg="#b00020")
        self.message_label.pack(fill="x", padx=14, pady=(6, 0))

        actions = tk.Frame(root)
        actions.pack(fill="x", padx=14, pady=12)
        self.back_button = tk.Button(actions, text="Back", width=10, command=self.back)
        self.back_button.pack(side="left")
        self.skip_button = tk.Button(actions, text="Skip", width=10, command=self.skip)
        self.skip_button.pack(side="left", padx=8)
        self.save_button = tk.Button(actions, text="保存", width=10, command=self.save_current)
        self.save_button.pack(side="right")

        self.load_current()

    def set_message(self, text, error=True):
        self.message_label.config(text=text, fg="#b00020" if error else "#006400")

    def load_current(self):
        if not self.files:
            self.show_done()
            return
        self.index = max(0, min(self.index, len(self.files) - 1))
        path = self.files[self.index]

        self.progress_label.config(
            text=f"当前 {self.index + 1}/{len(self.files)}；已校正 {self.processed_count}；初始 {self.initial_count}"
        )
        self.filename_label.config(text=f"文件：{path.name}")
        self.code_var.set(current_code_from_filename(path))
        self.set_message("", error=False)

        with Image.open(path) as image:
            image = image.convert("RGB")
            image = image.resize((image.width * 3, image.height * 3))
            self.photo = ImageTk.PhotoImage(image)
        self.image_label.config(image=self.photo, text="")
        self.code_entry.config(state="normal")
        self.save_button.config(state="normal")
        self.skip_button.config(state="normal")
        self.back_button.config(state="normal" if self.index > 0 else "disabled")
        self.code_entry.focus_set()
        self.code_entry.selection_range(0, tk.END)

    def show_done(self):
        self.progress_label.config(text=f"已处理完成；已校正 {self.processed_count}；初始 {self.initial_count}")
        self.filename_label.config(text="")
        self.image_label.config(image="", text="已处理完成")
        self.photo = None
        self.code_var.set("")
        self.code_entry.config(state="disabled")
        self.save_button.config(state="disabled")
        self.skip_button.config(state="disabled")
        self.back_button.config(state="disabled")
        self.set_message("没有待处理图片。", error=False)

    def save_current(self):
        if not self.files:
            return
        code = self.code_var.get().strip()
        if not is_valid_captcha_code(code):
            self.set_message("验证码必须是 4 位数字。")
            self.code_entry.focus_set()
            self.code_entry.selection_range(0, tk.END)
            return

        source = self.files[self.index]
        try:
            target = move_corrected_captcha(
                source,
                code,
                self.output_dir,
                review_output_dir=self.review_output_dir,
            )
        except Exception as error:
            messagebox.showerror("保存失败", str(error))
            return

        self.processed_count += 1
        self.files.pop(self.index)
        if self.index >= len(self.files):
            self.index = max(0, len(self.files) - 1)
        self.set_message(f"已保存：{target.name}", error=False)
        self.load_current()

    def skip(self):
        if not self.files:
            return
        if self.index < len(self.files) - 1:
            self.index += 1
            self.load_current()
        else:
            self.set_message("已经是最后一张。", error=False)

    def back(self):
        if self.index > 0:
            self.index -= 1
            self.load_current()


def main(argv=None):
    args = build_arg_parser().parse_args(argv)
    root = tk.Tk()
    CaptchaReviewApp(root, args.input_dir, args.output_dir, args.review_output_dir)
    root.mainloop()


if __name__ == "__main__":
    main()
