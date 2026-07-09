# -*- coding: UTF-8 -*-
from pathlib import Path
import tempfile
import unittest

import captcha_review_false


class CaptchaReviewFalseTest(unittest.TestCase):
    def test_validates_four_digit_codes(self):
        self.assertTrue(captcha_review_false.is_valid_captcha_code("8038"))
        self.assertFalse(captcha_review_false.is_valid_captcha_code("803"))
        self.assertFalse(captcha_review_false.is_valid_captcha_code("80381"))
        self.assertFalse(captcha_review_false.is_valid_captcha_code("80A8"))

    def test_builds_corrected_name_by_replacing_code_prefix(self):
        source = Path("0038_2026-07-09T08-08-23-621.png")

        name = captcha_review_false.build_corrected_filename(source, "8038")

        self.assertEqual(name, "8038_2026-07-09T08-08-23-621.png")

    def test_move_corrected_captcha_moves_to_output_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            input_dir = root / "false"
            output_dir = root / "yanzhengma"
            input_dir.mkdir()
            source = input_dir / "0038_2026-07-09T08-08-23-621.png"
            source.write_bytes(b"image")

            target = captcha_review_false.move_corrected_captcha(source, "8038", output_dir)

            self.assertFalse(source.exists())
            self.assertEqual(target.name, "8038_2026-07-09T08-08-23-621.png")
            self.assertEqual(target.read_bytes(), b"image")

    def test_move_corrected_captcha_avoids_overwriting_existing_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            input_dir = root / "false"
            output_dir = root / "yanzhengma"
            input_dir.mkdir()
            output_dir.mkdir()
            source = input_dir / "0038_2026-07-09T08-08-23-621.png"
            source.write_bytes(b"new")
            existing = output_dir / "8038_2026-07-09T08-08-23-621.png"
            existing.write_bytes(b"existing")

            target = captcha_review_false.move_corrected_captcha(
                source,
                "8038",
                output_dir,
                suffix_factory=lambda: "a1b2c3d4",
            )

            self.assertEqual(existing.read_bytes(), b"existing")
            self.assertEqual(target.name, "8038_2026-07-09T08-08-23-621_a1b2c3d4.png")
            self.assertEqual(target.read_bytes(), b"new")

    def test_lists_only_supported_images_in_name_order(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "b.png").write_bytes(b"b")
            (root / "a.jpg").write_bytes(b"a")
            (root / "notes.txt").write_text("skip", encoding="utf-8")

            images = captcha_review_false.list_image_paths(root)

            self.assertEqual([path.name for path in images], ["a.jpg", "b.png"])

    def test_arg_parser_accepts_input_and_output_directories(self):
        args = captcha_review_false.build_arg_parser().parse_args([
            "--input-dir",
            "dataset/yanzhengma_false",
            "--output-dir",
            "dataset/yanzhengma",
        ])

        self.assertEqual(args.input_dir, "dataset/yanzhengma_false")
        self.assertEqual(args.output_dir, "dataset/yanzhengma")


if __name__ == "__main__":
    unittest.main()
