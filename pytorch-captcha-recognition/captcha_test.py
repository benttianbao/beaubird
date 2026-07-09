# -*- coding: UTF-8 -*-
import argparse
import numpy as np
import torch
from pathlib import Path
from torch.autograd import Variable
import captcha_setting
import my_dataset
from captcha_cnn_model import CNN
import one_hot_encoding

def build_arg_parser():
    parser = argparse.ArgumentParser(description="Test captcha CNN.")
    parser.add_argument("--model-path", default=str(Path(__file__).with_name("model.pkl")))
    parser.add_argument("--test-dir", default=captcha_setting.TEST_DATASET_PATH)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--digit-accuracy", action="store_true")
    return parser

def load_model_state(model_path):
    try:
        return torch.load(model_path, map_location="cpu", weights_only=True)
    except TypeError:
        return torch.load(model_path, map_location="cpu")

def calculate_digit_accuracy(label_pairs):
    position_correct = [0] * captcha_setting.MAX_CAPTCHA
    position_total = [0] * captcha_setting.MAX_CAPTCHA
    correct = 0
    total = 0
    for predict_label, true_label in label_pairs:
        for index, (predict_digit, true_digit) in enumerate(zip(predict_label, true_label)):
            if index >= captcha_setting.MAX_CAPTCHA:
                break
            position_total[index] += 1
            total += 1
            if predict_digit == true_digit:
                position_correct[index] += 1
                correct += 1
    return {
        "correct": correct,
        "total": total,
        "position_correct": position_correct,
        "position_total": position_total,
    }

def accuracy_percent(correct, total):
    return 100 * correct / total if total else 0

def main(argv=None):
    args = build_arg_parser().parse_args(argv)
    cnn = CNN()
    cnn.eval()
    cnn.load_state_dict(load_model_state(args.model_path))
    print("load cnn net.")

    test_dataloader = my_dataset.get_test_data_loader(folder=args.test_dir, num_workers=args.num_workers)

    correct = 0
    total = 0
    digit_label_pairs = [] if args.digit_accuracy else None
    for i, (images, labels) in enumerate(test_dataloader):
        image = images
        vimage = Variable(image)
        predict_label = cnn(vimage)

        c0 = captcha_setting.ALL_CHAR_SET[np.argmax(predict_label[0, 0:captcha_setting.ALL_CHAR_SET_LEN].data.numpy())]
        c1 = captcha_setting.ALL_CHAR_SET[np.argmax(predict_label[0, captcha_setting.ALL_CHAR_SET_LEN:2 * captcha_setting.ALL_CHAR_SET_LEN].data.numpy())]
        c2 = captcha_setting.ALL_CHAR_SET[np.argmax(predict_label[0, 2 * captcha_setting.ALL_CHAR_SET_LEN:3 * captcha_setting.ALL_CHAR_SET_LEN].data.numpy())]
        c3 = captcha_setting.ALL_CHAR_SET[np.argmax(predict_label[0, 3 * captcha_setting.ALL_CHAR_SET_LEN:4 * captcha_setting.ALL_CHAR_SET_LEN].data.numpy())]
        predict_label = '%s%s%s%s' % (c0, c1, c2, c3)
        true_label = one_hot_encoding.decode(labels.numpy()[0])
        total += labels.size(0)
        if(predict_label == true_label):
            correct += 1
        if digit_label_pairs is not None:
            digit_label_pairs.append((predict_label, true_label))
        if(total%200==0):
            print('Test Accuracy of the model on the %d test images: %f %%' % (total, 100 * correct / total))
    print('Test Accuracy of the model on the %d test images: %f %%' % (total, 100 * correct / total))
    if digit_label_pairs is not None:
        digit_summary = calculate_digit_accuracy(digit_label_pairs)
        print('Digit Accuracy of the model on the %d digits: %f %%' % (
            digit_summary["total"],
            accuracy_percent(digit_summary["correct"], digit_summary["total"]),
        ))
        print('Digit Accuracy by position:')
        for index, (position_correct, position_total) in enumerate(zip(
                digit_summary["position_correct"],
                digit_summary["position_total"])):
            print('  position %d: %f %%' % (
                index + 1,
                accuracy_percent(position_correct, position_total),
            ))

if __name__ == '__main__':
    main()
