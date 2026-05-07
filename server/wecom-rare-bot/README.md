# 企业微信浙江稀有记录机器人

这个服务独立于现有前端和 Android 功能，默认监听 `127.0.0.1:8791`。群里发送 `@机器人 2026-05-07` 后，服务会查询这一天浙江省 BirdReport 稀有鸟种记录，并返回鸟种、出现次数和地点。

## 本地启动

1. 复制环境变量模板：

   ```powershell
   Copy-Item server\wecom-rare-bot\.env.example server\wecom-rare-bot\.env
   ```

2. 编辑 `server\wecom-rare-bot\.env`，填入企业微信配置。服务启动时会自动读取这个文件；云服务器上也可以改用系统环境变量。

3. 启动服务：

   ```powershell
   node server\wecom-rare-bot\server.js
   ```

4. 检查健康状态：

   ```powershell
   Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8791/health
   ```

## nginx 本地反代

示例配置在 `nginx/wecom-rare-bot.local.conf`。nginx 监听 `127.0.0.1:8088`，把 `/wecom/rare-bot` 和 `/health` 转发到 Node 服务。

企业微信回调必须能从公网访问，所以本地 nginx 还需要配合 ngrok、cloudflared 或 frp 暴露 HTTPS 地址，例如：

```text
https://your-tunnel.example.com/wecom/rare-bot
```

## 企业微信准备项

- 优先确认企业微信后台是否有“智能机器人 / API 模式”。有的话使用同一个回调地址，机器人可直接在群内回复。
- 如果暂时不能使用智能机器人，则创建自建应用回调，并再准备目标群的群机器人 Webhook URL。自建应用负责接收消息，Webhook 负责把查询结果推回群里。
- 需要准备：`CorpID`、`Token`、`EncodingAESKey`；兜底方案还需要 `WECOM_GROUP_WEBHOOK_URL`。

## 回调行为

- `GET /wecom/rare-bot`：企业微信 URL 验证。
- `POST /wecom/rare-bot` JSON：智能机器人 API 模式，直接返回 `msgtype=text`。
- `POST /wecom/rare-bot` XML：自建应用消息回调，解密后查询，并通过群 Webhook 推送结果，接口返回 `success`。
