# BeauBird 网站登录与后台管理

这一版把网页端 BeauBird 放到一个本地 Node 服务后面，由服务统一处理登录、会话、后台管理和 BirdReport 同源代理。企业微信机器人继续使用独立端口，避免和网站冲突。

## 本地运行

要求 Node.js 24 或更新版本，因为网站服务使用内置 `node:sqlite`。

创建第一个管理员：

```powershell
node server\site\cli.js create-admin --username admin
```

启动网站服务：

```powershell
.\start-site.cmd
```

默认地址：

```text
http://127.0.0.1:3000
```

本地配置可复制 `server/site/.env.example` 为 `server/site/.env` 后调整。数据库默认写入 `data/site.sqlite`，该文件不会提交到 Git。

## 功能范围

- 整站登录：未登录访问 `/` 会跳转到 `/login`。
- 后台地址：`/admin`，只有 `admin` 角色能访问。
- 管理员可新增用户、禁用/启用用户、重置临时密码。
- 新增用户和被重置密码的用户，下次登录必须先修改密码。
- 登录失败按 IP + 用户名计数，连续失败会短时锁定，防止爆破。
- 网页端 BirdReport 请求默认走同源 `/api/birdreport/*`，不再要求浏览器访问云服务器自己的 `127.0.0.1:8787`。

## Ubuntu + Nginx

建议两个 Node 服务都只监听本机地址：

```text
BeauBird 网站：127.0.0.1:3000
企业微信机器人：127.0.0.1:8791
```

公网只开放 Nginx 的 `80/443`。示例配置见 `nginx/site-auth-ubuntu.conf`：

- `/`、`/login`、`/admin`、`/api/*` 转发到 `http://127.0.0.1:3000`
- `/wecom/rare-bot` 转发到 `http://127.0.0.1:8791/wecom/rare-bot`
- `/site/health` 由网站服务响应
- `/wecom/health` 转发到机器人服务的 `/health`

启用 HTTPS 后，将 `server/site/.env` 中的 `BEAUBIRD_SITE_SECURE_COOKIES` 设为 `1`。

## 备份

定期备份：

```text
data/site.sqlite
data/site.sqlite-wal
data/site.sqlite-shm
```

备份时最好先停止网站服务，或使用 SQLite 在线备份工具，避免复制到未刷盘的 WAL 状态。
