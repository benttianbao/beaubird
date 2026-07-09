# -*- coding: UTF-8 -*-
import argparse
import numpy as np
import torch
from pathlib import Path
from torch.autograd import Variable
#from visdom import Visdom # pip install Visdom
import captcha_setting
import my_dataset
from captcha_cnn_model import CNN

def build_arg_parser():
    parser = argparse.ArgumentParser(description="Predict captcha text with a trained CNN.")
    parser.add_argument("--model-path", default=str(Path(__file__).with_name("model.pkl")))
    parser.add_argument("--predict-dir", default=captcha_setting.PREDICT_DATASET_PATH)
    return parser

def load_model_state(model_path):
    try:
        return torch.load(model_path, map_location="cpu", weights_only=True)
    except TypeError:
        return torch.load(model_path, map_location="cpu")

def main(argv=None):
    args = build_arg_parser().parse_args(argv)
    cnn = CNN()
    cnn.eval()
    cnn.load_state_dict(load_model_state(args.model_path))
    print("load cnn net.")

    predict_dataloader = my_dataset.get_predict_data_loader(folder=args.predict_dir)

    #vis = Visdom()
    for i, (images, labels) in enumerate(predict_dataloader):
        image = images
        vimage = Variable(image)
        predict_label = cnn(vimage)

        c0 = captcha_setting.ALL_CHAR_SET[np.argmax(predict_label[0, 0:captcha_setting.ALL_CHAR_SET_LEN].data.numpy())]
        c1 = captcha_setting.ALL_CHAR_SET[np.argmax(predict_label[0, captcha_setting.ALL_CHAR_SET_LEN:2 * captcha_setting.ALL_CHAR_SET_LEN].data.numpy())]
        c2 = captcha_setting.ALL_CHAR_SET[np.argmax(predict_label[0, 2 * captcha_setting.ALL_CHAR_SET_LEN:3 * captcha_setting.ALL_CHAR_SET_LEN].data.numpy())]
        c3 = captcha_setting.ALL_CHAR_SET[np.argmax(predict_label[0, 3 * captcha_setting.ALL_CHAR_SET_LEN:4 * captcha_setting.ALL_CHAR_SET_LEN].data.numpy())]

        c = '%s%s%s%s' % (c0, c1, c2, c3)
        print(c)
        #vis.images(image, opts=dict(caption=c))

if __name__ == '__main__':
    main()
