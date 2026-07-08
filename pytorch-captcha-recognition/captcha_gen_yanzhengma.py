# -*- coding: UTF-8 -*-
import argparse
import os
import random
import time

from PIL import Image, ImageDraw, ImageFilter, ImageFont

import captcha_setting


FONT_CANDIDATES = [
    r"C:\Windows\Fonts\timesbd.ttf",
    r"C:\Windows\Fonts\timesbi.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\calibrib.ttf",
]


def build_arg_parser():
    parser = argparse.ArgumentParser(description="Generate yanzhengma-style numeric captchas.")
    parser.add_argument("--count", type=int, default=100000)
    parser.add_argument("--output", default=captcha_setting.TRAIN_DATASET_PATH)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--progress-every", type=int, default=1000)
    return parser


def load_fonts():
    fonts = []
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            fonts.append(path)
    if not fonts:
        raise RuntimeError("No usable Windows font was found for captcha generation.")
    return fonts


def random_text():
    return "".join(random.choice(captcha_setting.NUMBER) for _ in range(captcha_setting.MAX_CAPTCHA))


def draw_rotated_char(canvas, char, xy, font, fill):
    char_layer = Image.new("RGBA", (34, 36), (255, 255, 255, 0))
    draw = ImageDraw.Draw(char_layer)
    draw.text((1, -2), char, font=font, fill=fill)
    angle = random.uniform(-10, 8)
    char_layer = char_layer.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    canvas.alpha_composite(char_layer, xy)


def generate_image(text, font_paths):
    width = captcha_setting.IMAGE_WIDTH
    height = captcha_setting.IMAGE_HEIGHT
    image = Image.new("RGBA", (width, height), (255, 255, 255, 255))

    font_path = random.choice(font_paths)
    font_size = random.randint(25, 29)
    font = ImageFont.truetype(font_path, font_size)
    red = (
        random.randint(190, 230),
        random.randint(10, 35),
        random.randint(15, 45),
        255,
    )

    base_x = random.randint(9, 13)
    for index, char in enumerate(text):
        x = base_x + index * random.randint(19, 22) + random.randint(-2, 2)
        y = random.randint(4, 9)
        draw_rotated_char(image, char, (x, y), font, red)

    draw = ImageDraw.Draw(image)
    line_count = random.choice([1, 1, 2])
    for _ in range(line_count):
        start = (random.randint(-3, 12), random.randint(4, 17))
        end = (random.randint(92, 116), random.randint(22, 35))
        draw.line([start, end], fill=(0, 0, 0, 255), width=random.choice([2, 2, 3]))

    if random.random() < 0.85:
        draw.line(
            [
                (random.randint(-2, 6), random.randint(11, 21)),
                (random.randint(9, 18), random.randint(0, 8)),
            ],
            fill=(0, 0, 0, 255),
            width=random.choice([2, 3]),
        )

    if random.random() < 0.45:
        draw.line(
            [
                (random.randint(60, 78), random.randint(11, 18)),
                (random.randint(93, 112), random.randint(15, 25)),
            ],
            fill=(20, 20, 20, 230),
            width=1,
        )

    return image.convert("RGB").filter(ImageFilter.GaussianBlur(radius=random.uniform(0, 0.25)))


def unique_output_path(output_dir, text, index):
    now = str(int(time.time()))
    filename = f"{text}_{index}_{now}.png"
    path = os.path.join(output_dir, filename)
    suffix = 1
    while os.path.exists(path):
        filename = f"{text}_{index}_{now}_{suffix}.png"
        path = os.path.join(output_dir, filename)
        suffix += 1
    return path


def main(argv=None):
    args = build_arg_parser().parse_args(argv)
    if args.seed is not None:
        random.seed(args.seed)

    os.makedirs(args.output, exist_ok=True)
    font_paths = load_fonts()
    existing = len([
        name for name in os.listdir(args.output)
        if os.path.isfile(os.path.join(args.output, name))
    ])
    start_index = existing + 1
    started_at = time.time()

    print("output:", args.output)
    print("existing:", existing)
    print("count:", args.count)
    print("size:", f"{captcha_setting.IMAGE_WIDTH}x{captcha_setting.IMAGE_HEIGHT}")
    print("charset:", "".join(captcha_setting.ALL_CHAR_SET))

    for offset in range(args.count):
        index = start_index + offset
        text = random_text()
        image = generate_image(text, font_paths)
        output_path = unique_output_path(args.output, text, index)
        image.save(output_path)

        done = offset + 1
        if args.progress_every > 0 and (done % args.progress_every == 0 or done == args.count):
            elapsed = time.time() - started_at
            speed = done / elapsed if elapsed > 0 else 0
            print(f"generated={done}/{args.count} total={existing + done} speed={speed:.1f}/s")

    print("done")


if __name__ == "__main__":
    main()
