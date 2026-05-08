# 企业微信浙江稀有记录机器人

这个服务独立于现有前端和 Android 功能，默认监听 `127.0.0.1:8791`。群里发送 `@机器人 2026-05-07` 后，服务会查询这一天浙江省 BirdReport 稀有鸟种记录，并只返回鸟种名称；发送 `@机器人 2026-05-07 仙八色鸫` 会返回这个鸟种当天的公开出现地点。

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
- 云服务器部署时设置 `WECOM_PUBLIC_BASE_URL`，例如 `http://120.26.231.157`，用于生成 BirdReport 验证码图片链接。

## 群内命令

```text
@机器人 2026-05-07
```

只返回当天浙江命中的稀有鸟种名称，不显示出现次数和地点。

```text
@机器人 2026-05-07 仙八色鸫
```

返回这个鸟种当天在浙江的公开地点和地点出现次数。遇到 BirdReport 验证码时，机器人会发出验证码图片链接，直接在群里回复验证码即可自动重试刚才的查询。

## 回调行为

- `GET /wecom/rare-bot`：企业微信 URL 验证。
- `GET /wecom/rare-bot/captcha/:id`：临时验证码图片。
- `POST /wecom/rare-bot` JSON：智能机器人 API 模式，返回加密 `msgtype=stream` 文本。
- `POST /wecom/rare-bot` XML：自建应用消息回调，解密后查询，并通过群 Webhook 推送结果，接口返回 `success`。
