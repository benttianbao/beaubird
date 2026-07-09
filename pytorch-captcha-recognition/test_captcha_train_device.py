# -*- coding: UTF-8 -*-
import os
import tempfile
import unittest
from unittest.mock import patch

import torch

import captcha_test
import captcha_train


class CaptchaTrainDeviceTests(unittest.TestCase):
    def test_auto_prefers_cuda_when_available(self):
        with patch.object(captcha_train.torch.cuda, "is_available", return_value=True):
            device = captcha_train.resolve_device("auto")

        self.assertEqual("cuda", device.type)

    def test_auto_falls_back_to_cpu_when_cuda_is_unavailable(self):
        with patch.object(captcha_train.torch.cuda, "is_available", return_value=False):
            device = captcha_train.resolve_device("auto")

        self.assertEqual("cpu", device.type)

    def test_explicit_cuda_fails_when_cuda_is_unavailable(self):
        with patch.object(captcha_train.torch.cuda, "is_available", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "CUDA"):
                captcha_train.resolve_device("cuda")

    def test_state_dict_for_save_keeps_saved_tensors_on_cpu(self):
        model = torch.nn.Linear(2, 1)

        state_dict = captcha_train.state_dict_for_save(model)

        self.assertTrue(state_dict)
        self.assertTrue(all(tensor.device.type == "cpu" for tensor in state_dict.values()))

    def test_arg_parser_accepts_training_runtime_options(self):
        args = captcha_train.build_arg_parser().parse_args([
            "--device", "cpu",
            "--epochs", "1",
            "--batch-size", "2",
            "--save-every", "3",
            "--max-steps", "4",
            "--model-path", "F:\\beaubird\\.tmp\\captcha-smoke-model.pkl",
            "--train-dir", "D:\\captcha-train",
            "--num-workers", "2",
            "--no-resume",
        ])

        self.assertEqual("cpu", args.device)
        self.assertEqual(1, args.epochs)
        self.assertEqual(2, args.batch_size)
        self.assertEqual(3, args.save_every)
        self.assertEqual(4, args.max_steps)
        self.assertEqual("F:\\beaubird\\.tmp\\captcha-smoke-model.pkl", args.model_path)
        self.assertEqual("D:\\captcha-train", args.train_dir)
        self.assertEqual(2, args.num_workers)
        self.assertTrue(args.no_resume)

    def test_test_arg_parser_accepts_runtime_options(self):
        args = captcha_test.build_arg_parser().parse_args([
            "--model-path", "D:\\captcha-model.pkl",
            "--test-dir", "D:\\captcha-test",
            "--num-workers", "2",
        ])

        self.assertEqual("D:\\captcha-model.pkl", args.model_path)
        self.assertEqual("D:\\captcha-test", args.test_dir)
        self.assertEqual(2, args.num_workers)

    def test_main_passes_training_directory_and_workers_to_loader(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = os.path.join(temp_dir, "model.pkl")
            model = torch.nn.Linear(1, 1)
            with patch.object(captcha_train, "CNN", return_value=model), \
                    patch.object(captcha_train.my_dataset, "get_train_data_loader", return_value=[]) as loader:
                captcha_train.main([
                    "--device", "cpu",
                    "--epochs", "0",
                    "--model-path", model_path,
                    "--train-dir", "D:\\captcha-train",
                    "--num-workers", "2",
                ])

        loader.assert_called_once_with(
            folder="D:\\captcha-train",
            batch_size=64,
            pin_memory=False,
            num_workers=2,
        )

    def test_no_resume_skips_existing_model_load(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = os.path.join(temp_dir, "model.pkl")
            torch.save(torch.nn.Linear(1, 1).state_dict(), model_path)
            model = torch.nn.Linear(1, 1)
            with patch.object(captcha_train, "CNN", return_value=model), \
                    patch.object(captcha_train, "load_state_dict") as load_state, \
                    patch.object(captcha_train.my_dataset, "get_train_data_loader", return_value=[]):
                captcha_train.main([
                    "--device", "cpu",
                    "--epochs", "0",
                    "--model-path", model_path,
                    "--no-resume",
                ])

        load_state.assert_not_called()

    def test_save_model_retries_when_windows_temporarily_denies_replace(self):
        model = torch.nn.Linear(2, 1)
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = os.path.join(temp_dir, "model.pkl")

            with patch.object(
                captcha_train.os,
                "replace",
                side_effect=[PermissionError("locked briefly"), None],
            ) as replace:
                captcha_train.save_model(model, model_path)

        self.assertEqual(2, replace.call_count)


if __name__ == "__main__":
    unittest.main()
