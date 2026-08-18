# 城市酒店点评系统 · 聚合后端

零依赖 Node 服务，把分散在各手机/平板/电脑上的评价汇总到一台服务器，后台任意设备可查。

- 仅用 Node 内置模块，**无需 `npm install`**
- 数据落盘为单个 `data/reviews.jsonl`，备份 = 拷一个文件
- 适合单家酒店部署到一台 VPS（阿里云/腾讯云轻量应用服务器等，约 60–100 元/月）

## 1. 快速本地试跑

```bash
cd server
ADMIN_TOKEN=你的随机令牌 PORT=3000 node server.js
```

另开终端验证：

```bash
# 客人提交（开放，无需令牌）
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{"type":"positive","reasons":[],"room":"601","staffUsername":"staff1"}'

# 后台拉全量（需令牌）
curl "http://localhost:3000/api/reviews" -H "X-Admin-Token: 你的随机令牌"
```

## 2. 部署到服务器

1. 把 `server/` 目录上传到服务器（或用 git 拉取）。
2. 用进程管理器常驻（二选一）：
   - `pm2`：`npm i -g pm2 && pm2 start server.js --name hotel-review-sync`
   - 或 `nohup env ADMIN_TOKEN=xxx PORT=3000 node server.js &`
3. 用 `ADMIN_TOKEN` 设置一个强随机串（前后台共用，下面配置要用）。
4. 开放防火墙该端口（如 3000）。

### HTTPS（必做）

微信内打开、以及数据安全都要求 HTTPS。两种方式：

- **A. 反向代理 + 证书（推荐）**：用 Nginx 反代到 `localhost:3000`，并用certbot 申请免费证书：
  ```bash
  certbot --nginx -d review.你的域名.com
  ```
  Nginx 配置示例：
  ```nginx
  server {
    listen 443 ssl;
    server_name review.你的域名.com;
    ssl_certificate     /etc/letsencrypt/live/review.你的域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/review.你的域名.com/privkey.pem;
    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_set_header Host $host;
    }
  }
  ```
- **B. 直接用 443**：把证书路径交给 Node（需改 server.js 引入 https 模块），一般不如 Nginx 省事。

后台里填写的"后端地址"就是 `https://review.你的域名.com`。

## 3. 前端对接

在后台「设置 → 数据聚合后端」中填写：

| 项 | 值 |
|---|---|
| 启用同步 | 开 |
| 后端地址 | `https://review.你的域名.com` |
| 管理员令牌 | 与服务器 `ADMIN_TOKEN` 一致 |

保存后：
- 客人提交评价会**同时写本地 + 异步推送到后端**（断网本地兜底，联网后后台拉取时会补传）
- 后台打开会自动从后端**拉全量汇总**，任意设备登录都能看到所有评价

## 4. 安全说明

- `POST /api/review` 对客人开放（必须，否则无法提交）。仅接受 `type/reasons/room/...` 字段，已做大小与类型校验。
- `GET /api/reviews`、`GET /api/stats` **必须带正确的 `X-Admin-Token`**，否则 401。请勿把令牌写进前端可被游客看到的代码——它只存在于后台设置（仅管理员可进）。
- 数据含房间号，属轻度敏感信息，请确保使用 HTTPS 且令牌不泄露。
- 如需更高安全，可在 Nginx 层对 `/api/reviews`、`/api/stats` 再加 IP 白名单或限流。

## 5. 备份

```bash
cp server/data/reviews.jsonl /备份路径/reviews-$(date +%F).jsonl
```
