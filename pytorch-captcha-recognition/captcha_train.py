# -*- coding: UTF-8 -*-
import argparse
import time
import torch
import torch.nn as nn
import os
import my_dataset
from captcha_cnn_model import CNN

# Hyper Parameters
num_epochs = 30
batch_size = 64
learning_rate = 0.001

def build_arg_parser():
    parser = argparse.ArgumentParser(description="Train captcha CNN.")
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--epochs", type=int, default=num_epochs)
    parser.add_argument("--batch-size", type=int, default=batch_size)
    parser.add_argument("--save-every", type=int, default=100)
    parser.add_argument("--max-steps", type=int, default=None)
    parser.add_argument("--model-path", default="./model.pkl")
    return parser


def resolve_device(device_name):
    if device_name == "auto":
        if torch.cuda.is_available():
            return torch.device("cuda")
        print("CUDA is unavailable; training on CPU.")
        return torch.device("cpu")
    if device_name == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA was requested, but torch.cuda.is_available() is False.")
        return torch.device("cuda")
    return torch.device("cpu")


def state_dict_for_save(cnn):
    return {
        key: value.detach().cpu() if torch.is_tensor(value) else value
        for key, value in cnn.state_dict().items()
    }


def load_state_dict(model_path, device):
    try:
        return torch.load(model_path, map_location=device, weights_only=True)
    except TypeError:
        return torch.load(model_path, map_location=device)


def save_model(cnn, model_path, replace_attempts=5, retry_delay=0.2):
    tmp_path = model_path + ".tmp"
    model_dir = os.path.dirname(os.path.abspath(model_path))
    if model_dir:
        os.makedirs(model_dir, exist_ok=True)
    torch.save(state_dict_for_save(cnn), tmp_path)
    for attempt in range(replace_attempts):
        try:
            os.replace(tmp_path, model_path)
            return
        except PermissionError:
            if attempt + 1 >= replace_attempts:
                raise
            time.sleep(retry_delay)


def describe_device(device):
    if device.type == "cuda":
        return "cuda: " + torch.cuda.get_device_name(device)
    return "cpu"


def main(argv=None):
    args = build_arg_parser().parse_args(argv)
    device = resolve_device(args.device)
    print("train device:", describe_device(device))

    cnn = CNN().to(device)
    if os.path.exists(args.model_path):
        try:
            cnn.load_state_dict(load_state_dict(args.model_path, device))
            print("resume model")
        except RuntimeError as exc:
            print(args.model_path + " is unreadable; start from scratch:", exc)
    cnn.train()
    print('init net')
    criterion = nn.MultiLabelSoftMarginLoss()
    optimizer = torch.optim.Adam(cnn.parameters(), lr=learning_rate)

    # Train the Model
    train_dataloader = my_dataset.get_train_data_loader(
        batch_size=args.batch_size,
        pin_memory=(device.type == "cuda"),
    )
    for epoch in range(args.epochs):
        last_step = -1
        last_loss = None
        for i, (images, labels) in enumerate(train_dataloader):
            images = images.to(device, non_blocking=(device.type == "cuda"))
            labels = labels.float().to(device, non_blocking=(device.type == "cuda"))
            predict_labels = cnn(images)
            # print(predict_labels.type)
            # print(labels.type)
            loss = criterion(predict_labels, labels)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            last_step = i
            last_loss = loss.item()
            if (i+1) % 10 == 0:
                print("epoch:", epoch, "step:", i, "loss:", last_loss)
            if args.save_every > 0 and (i+1) % args.save_every == 0:
                save_model(cnn, args.model_path)   #current is model.pkl
                print("save model")
            if args.max_steps is not None and (i+1) >= args.max_steps:
                break
        if last_loss is not None:
            print("epoch:", epoch, "step:", last_step, "loss:", last_loss)
    save_model(cnn, args.model_path)   #current is model.pkl
    print("save last model")

if __name__ == '__main__':
    main()
