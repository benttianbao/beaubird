# -*- coding: UTF-8 -*-
from pathlib import Path
import unittest

import captcha_predict
import captcha_setting


class CaptchaPredictArgsTest(unittest.TestCase):
    def test_predict_cli_accepts_model_path_and_predict_dir(self):
        args = captcha_predict.build_arg_parser().parse_args([
            "--model-path",
            "model-finetune.pkl",
            "--predict-dir",
            "dataset/test",
        ])

        self.assertEqual(args.model_path, "model-finetune.pkl")
        self.assertEqual(args.predict_dir, "dataset/test")

    def test_predict_cli_defaults_to_model_pkl_and_predict_dataset(self):
        args = captcha_predict.build_arg_parser().parse_args([])

        self.assertEqual(Path(args.model_path).name, "model.pkl")
        self.assertEqual(args.predict_dir, captcha_setting.PREDICT_DATASET_PATH)


if __name__ == "__main__":
    unittest.main()
