# -*- coding: UTF-8 -*-
import random
import unittest

import captcha_gen
import captcha_setting


class CaptchaGenStyleTest(unittest.TestCase):
    def test_digit_layout_uses_irregular_close_spacing(self):
        positions = captcha_gen.layout_digit_positions("1234", random.Random(84))
        x_positions = [x for x, _y in positions]
        gaps = [right - left for left, right in zip(x_positions, x_positions[1:])]

        self.assertEqual(len(positions), captcha_setting.MAX_CAPTCHA)
        self.assertLessEqual(min(gaps), 17)
        self.assertGreater(max(gaps) - min(gaps), 3)

    def test_generated_image_uses_birdreport_style_contract(self):
        text, image = captcha_gen.gen_captcha_text_and_image(random.Random(1234))

        self.assertEqual(len(text), captcha_setting.MAX_CAPTCHA)
        self.assertTrue(text.isdigit())
        self.assertEqual(image.size, (captcha_setting.IMAGE_WIDTH, captcha_setting.IMAGE_HEIGHT))
        self.assertEqual(image.mode, "RGB")

        data = image.convert("RGB").tobytes()
        pixels = list(zip(data[0::3], data[1::3], data[2::3]))
        red_pixels = sum(1 for red, green, blue in pixels if red > 150 and green < 90 and blue < 90)
        black_pixels = sum(1 for red, green, blue in pixels if red < 60 and green < 60 and blue < 60)

        self.assertGreater(red_pixels, 80)
        self.assertGreater(black_pixels, 20)

    def test_generated_image_has_broken_red_edges(self):
        _text, image = captcha_gen.gen_captcha_text_and_image(random.Random(20260708))
        image = image.convert("RGB")
        width, height = image.size

        broken_edge_pixels = 0
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                red, green, blue = image.getpixel((x, y))
                if not (red > 150 and green < 90 and blue < 90):
                    continue
                neighbors = [
                    image.getpixel((x - 1, y)),
                    image.getpixel((x + 1, y)),
                    image.getpixel((x, y - 1)),
                    image.getpixel((x, y + 1)),
                ]
                pale_neighbors = sum(1 for nr, ng, nb in neighbors if nr > 215 and ng > 160 and nb > 160)
                if pale_neighbors >= 2:
                    broken_edge_pixels += 1

        self.assertGreater(broken_edge_pixels, 30)


if __name__ == "__main__":
    unittest.main()
