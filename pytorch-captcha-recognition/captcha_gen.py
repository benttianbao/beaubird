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
    r"C:\Windows\Fonts\cambriaz.ttf",
]


def build_arg_parser():
    parser = argparse.ArgumentParser(description="Generate BirdReport-style numeric captcha images.")
    parser.add_argument("--count", type=int, default=10000)
    parser.add_argument("--output", default=captcha_setting.TRAIN_DATASET_PATH)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--progress-every", type=int, default=1000)
    return parser


def _rng(rng=None):
    return rng or random


def load_font_paths(font_candidates=None):
    candidates = font_candidates or FONT_CANDIDATES
    return [path for path in candidates if os.path.exists(path)]


def random_captcha(rng=None):
    source = _rng(rng)
    return "".join(source.choice(captcha_setting.ALL_CHAR_SET) for _ in range(captcha_setting.MAX_CAPTCHA))


def _load_font(font_paths, size, rng=None):
    source = _rng(rng)
    if font_paths:
        return ImageFont.truetype(source.choice(font_paths), size)
    return ImageFont.load_default()


def layout_digit_positions(text, rng=None):
    source = _rng(rng)
    base_x = source.randint(7, 12)
    close_gap = source.randint(14, 17)
    wide_gap = source.randint(19, 23)
    mid_gap = source.randint(16, 20)
    gaps = [close_gap, wide_gap, mid_gap]
    source.shuffle(gaps)

    positions = []
    x = base_x
    for index, _digit in enumerate(text):
        if index > 0:
            x += gaps[index - 1]
        positions.append((x + source.randint(-1, 1), source.randint(4, 9)))
    return positions


def _damage_digit_edges(layer, rng=None):
    source = _rng(rng)
    pixels = layer.load()
    width, height = layer.size

    for y in range(1, height - 1):
        for x in range(1, width - 1):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            near_transparent = (
                pixels[x - 1, y][3] == 0
                or pixels[x + 1, y][3] == 0
                or pixels[x, y - 1][3] == 0
                or pixels[x, y + 1][3] == 0
            )
            if near_transparent and source.random() < 0.20:
                pixels[x, y] = (red, green, blue, source.randint(0, 70))
            elif source.random() < 0.020:
                pixels[x, y] = (red, green, blue, source.randint(0, 95))

    cutter = ImageDraw.Draw(layer)
    for _ in range(source.randint(1, 2)):
        x = source.randint(5, width - 9)
        y = source.randint(4, height - 10)
        cutter.line(
            [(x, y), (x + source.randint(3, 8), y + source.randint(-1, 2))],
            fill=(255, 255, 255, 0),
            width=source.choice([1, 1, 2]),
        )
    return layer


def _scratch_digit_gaps(image, positions, rng=None):
    source = _rng(rng)
    draw = ImageDraw.Draw(image)
    for x, y in positions:
        for _ in range(source.choice([2, 3, 3])):
            scratch_x = x + source.randint(3, 14)
            scratch_y = y + source.randint(7, 18)
            draw.line(
                [
                    (scratch_x, scratch_y),
                    (scratch_x + source.randint(5, 11), scratch_y + source.randint(-1, 1)),
                ],
                fill=(
                    source.randint(246, 255),
                    source.randint(225, 242),
                    source.randint(225, 242),
                    255,
                ),
                width=1,
            )


def _draw_rotated_digit(canvas, digit, xy, font, fill, rng=None):
    source = _rng(rng)
    layer = Image.new("RGBA", (34, 38), (255, 255, 255, 0))
    draw = ImageDraw.Draw(layer)

    # A small offset mimics the doubled red edges in real BirdReport captchas.
    offsets = [(0, 0), (1, 0)]
    if source.random() < 0.35:
        offsets.append((0, 1))
    for dx, dy in offsets:
        draw.text((2 + dx, -3 + dy), digit, font=font, fill=fill)

    layer = _damage_digit_edges(layer, source)
    if source.random() < 0.75:
        small_size = (max(1, layer.width - source.randint(2, 5)), max(1, layer.height - source.randint(1, 3)))
        layer = layer.resize(small_size, Image.Resampling.BILINEAR).resize(layer.size, Image.Resampling.NEAREST)

    angle = source.uniform(-11, 9)
    layer = layer.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    canvas.alpha_composite(layer, xy)


def generate_birdreport_style_image(text, font_paths=None, rng=None):
    source = _rng(rng)
    width = captcha_setting.IMAGE_WIDTH
    height = captcha_setting.IMAGE_HEIGHT
    background = (
        source.randint(248, 255),
        source.randint(238, 248),
        source.randint(238, 248),
        255,
    )
    image = Image.new("RGBA", (width, height), background)
    draw = ImageDraw.Draw(image)

    font_paths = font_paths if font_paths is not None else load_font_paths()
    font = _load_font(font_paths, source.randint(25, 29), source)
    digit_color = (
        source.randint(190, 225),
        source.randint(8, 35),
        source.randint(15, 48),
        235,
    )

    positions = layout_digit_positions(text, source)
    for digit, (x, y) in zip(text, positions):
        _draw_rotated_digit(image, digit, (x, y), font, digit_color, source)
    _scratch_digit_gaps(image, positions, source)

    for _ in range(source.choice([1, 1, 2])):
        start = (source.randint(-4, 12), source.randint(4, 18))
        end = (source.randint(92, 116), source.randint(21, 35))
        draw.line([start, end], fill=(0, 0, 0, 255), width=source.choice([2, 2, 3]))

    if source.random() < 0.85:
        draw.line(
            [
                (source.randint(-3, 8), source.randint(11, 23)),
                (source.randint(8, 19), source.randint(0, 9)),
            ],
            fill=(0, 0, 0, 255),
            width=source.choice([2, 3]),
        )

    for _ in range(source.randint(35, 75)):
        x = source.randint(0, width - 1)
        y = source.randint(0, height - 1)
        color = source.choice([
            (source.randint(205, 235), source.randint(95, 145), source.randint(95, 145), 255),
            (source.randint(218, 240), source.randint(185, 215), source.randint(185, 215), 255),
        ])
        draw.point((x, y), fill=color)

    if source.random() < 0.5:
        draw.line(
            [
                (source.randint(58, 78), source.randint(10, 18)),
                (source.randint(92, 113), source.randint(14, 25)),
            ],
            fill=(15, 15, 15, 210),
            width=1,
        )

    return image.convert("RGB").filter(ImageFilter.GaussianBlur(radius=source.uniform(0, 0.18)))


def gen_captcha_text_and_image(rng=None):
    source = _rng(rng)
    text = random_captcha(source)
    return text, generate_birdreport_style_image(text, rng=source)


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
    existing = len([
        name for name in os.listdir(args.output)
        if os.path.isfile(os.path.join(args.output, name))
    ])
    started_at = time.time()

    print("output:", args.output)
    print("existing:", existing)
    print("count:", args.count)
    print("size:", f"{captcha_setting.IMAGE_WIDTH}x{captcha_setting.IMAGE_HEIGHT}")
    print("charset:", "".join(captcha_setting.ALL_CHAR_SET))

    for offset in range(args.count):
        index = existing + offset + 1
        text, image = gen_captcha_text_and_image()
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
