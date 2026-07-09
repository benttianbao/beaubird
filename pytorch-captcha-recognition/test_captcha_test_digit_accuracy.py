# -*- coding: UTF-8 -*-
import unittest

import captcha_test


class CaptchaTestDigitAccuracyTests(unittest.TestCase):
    def test_arg_parser_accepts_digit_accuracy_flag(self):
        args = captcha_test.build_arg_parser().parse_args(["--digit-accuracy"])

        self.assertTrue(args.digit_accuracy)

    def test_calculates_overall_and_position_digit_accuracy(self):
        summary = captcha_test.calculate_digit_accuracy([
            ("1234", "1234"),
            ("1299", "1200"),
        ])

        self.assertEqual(6, summary["correct"])
        self.assertEqual(8, summary["total"])
        self.assertEqual([2, 2, 1, 1], summary["position_correct"])
        self.assertEqual([2, 2, 2, 2], summary["position_total"])


if __name__ == "__main__":
    unittest.main()
