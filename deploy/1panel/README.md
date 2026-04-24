# VISION - 1Panel 部署指南

## 架构说明

| 服务 | 说明 | 容器端口 | 宿主机端口 |
|------|------|---------|-----------|
| web | 前端静态页面（Nginx） | 80 | 9901 |
| admin | 后端 API + 管理后台（Node.js） | 9902 | 9902 |

当前推荐生产模式：

- GitHub Actions 负责构建镜像
- Docker Hub 负责存储镜像
- 1Panel 服务器只负责 `pull` 和运行镜像

外部访问通过 **1Panel OpenResty** 反向代理到上述端口，不直接暴露端口到公网。

---

## 前置准备

1. **1Panel 服务器**（已安装并配置好）
2. **域名**（至少 1 个，建议 2 个：
   - `vision.app` → Web 前端
   - `admin.vision.app` → Admin 后端）
3. **Supabase 项目**（数据库 + 认证服务，本项目不自带数据库）
4. **Docker Hub 仓库**：
   - `vision-web`
   - `vision-admin`
5. **GitHub 仓库 Secrets**：
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

## 发布流程

### GitHub 到 Docker Hub

仓库新增的 GitHub Actions 工作流会在以下时机自动发布镜像：

- `push` 到 `main`
  - `vision-web:latest`
  - `vision-web:sha-<7位提交号>`
  - `vision-admin:latest`
  - `vision-admin:sha-<7位提交号>`
- `push` tag，例如 `v1.2.3`
  - `vision-web:v1.2.3`
  - `vision-admin:v1.2.3`

发布前会先执行：

```bash
npm ci
npm run build:web
npm run build:admin
```

只有这些构建检查通过，镜像才会被推送到 Docker Hub。

---

## 部署步骤

### 第一步：在 1Panel 中创建编排

1. 进入 **1Panel → 容器 → 编排**
2. 点击 **创建编排**
3. 填写信息：
   - **名称**：`vision`
   - **路径**：`/opt/1panel/docker/compose/vision`
4. 点击创建文件夹，然后进入该目录

### 第二步：上传部署文件

生产服务器不再需要整个项目源码，只需要部署文件：

```bash
cd /你的项目路径/vision
scp deploy/1panel/docker-compose.yml \
  deploy/1panel/.env.example \
  deploy/1panel/web.env \
  deploy/1panel/admin.env \
  root@你的服务器IP:/opt/1panel/docker/compose/vision/
```

### 第三步：配置环境变量

登录服务器，复制模板并填写真实值：

```bash
cd /opt/1panel/docker/compose/vision
cp .env.example .env

# 生成强随机加密密钥
openssl rand -hex 32
```

编辑 `.env`：

```env
VISION_WEB_IMAGE=docker.io/你的DockerHub用户名/vision-web:latest
VISION_ADMIN_IMAGE=docker.io/你的DockerHub用户名/vision-admin:latest
```

如果要回滚，可以直接把 tag 改成之前发布过的版本，例如：

```env
VISION_WEB_IMAGE=docker.io/你的DockerHub用户名/vision-web:sha-abc1234
VISION_ADMIN_IMAGE=docker.io/你的DockerHub用户名/vision-admin:v1.2.3
```

编辑 `web.env`：

```env
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon-key
VITE_ADMIN_API_URL=https://admin.你的域名.com/api
VITE_ADMIN_APP_URL=https://admin.你的域名.com
```

编辑 `admin.env`：

```env
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon-key
VITE_API_BASE_URL=/api
PORT=9902
WEB_ORIGIN=https://你的域名.com
DATABASE_URL=postgresql://postgres.xxxxx:密码@aws-0-xxxxx.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_ANON_KEY=你的anon-key
SUPABASE_SERVICE_ROLE_KEY=你的service-role-key
CONFIG_CRYPT_KEY=用openssl生成的64位十六进制字符串
```

这里的 `WEB_ORIGIN` 只用于 admin API 的 CORS。
邮件确认和密码重置的跳转地址需要在部署完成后进入后台“站点配置”单独设置。

### 第四步：启动编排

第一次部署前，先确认 Docker Hub 里已经有镜像。

在服务器命令行执行：

```bash
cd /opt/1panel/docker/compose/vision
docker compose pull
docker compose up -d
```

或者在 1Panel 编排页面：

1. 确认 `docker-compose.yml` 内容正确
2. 先执行拉取镜像
3. 再启动编排

### 第五步：配置 OpenResty 反向代理

#### Web 前端（用户访问的页面）

1. 进入 **1Panel → 网站 → 创建网站 → 反向代理**
2. 填写：
   - **主域名**：`vision.app`（你的域名）
   - **代理地址**：`http://127.0.0.1:9901`
   - **开启 HTTPS**：勾选（自动申请 Let's Encrypt 证书）
3. 保存

#### Admin 后端（API + 管理后台）

1. 创建第二个反向代理网站
2. 填写：
   - **主域名**：`admin.vision.app`（你的子域名）
   - **代理地址**：`http://127.0.0.1:9902`
   - **开启 HTTPS**：勾选
3. 保存

### 第六步：配置 Supabase

1. 进入 Supabase Dashboard → Authentication → URL Configuration
2. 设置：
   - **Site URL**：`https://vision.app`
   - **Redirect URLs**：添加 `https://vision.app` 和 `https://admin.vision.app`
3. 进入 Database → 执行 `supabase/schema.sql` 初始化表结构（如未执行过）
4. 使用管理员账号登录 `admin`，进入“站点配置”
5. 把“前台公开地址”设置为用户实际访问的 web 域名，例如 `https://vision.app`

---

## 常用运维命令

```bash
cd /opt/1panel/docker/compose/vision

# 查看容器状态
docker compose ps

# 查看日志
docker compose logs -f web
docker compose logs -f admin

# 拉取最新镜像并更新服务
docker compose pull
docker compose up -d

# 仅重启容器
docker compose restart

# 停止
docker compose down
```

## 更新与回滚

### 更新到最新 `main`

1. 本地提交并推送到 GitHub `main`
2. 等待 GitHub Actions 推送新镜像到 Docker Hub
3. 服务器执行：

```bash
cd /opt/1panel/docker/compose/vision
docker compose pull
docker compose up -d
```

### 发布正式版本

```bash
git tag v1.2.3
git push origin v1.2.3
```

镜像发布成功后，把 `.env` 中的 tag 改为 `v1.2.3`，再执行：

```bash
docker compose pull
docker compose up -d
```

### 回滚

把 `.env` 中的 `VISION_WEB_IMAGE` 和 `VISION_ADMIN_IMAGE` 改成之前的 `sha-*` 或 `v*` tag，然后执行：

```bash
docker compose pull
docker compose up -d
```

---

## 注意事项

1. **`CONFIG_CRYPT_KEY`** 部署前必须更换，且更换后已加密的历史数据将无法解密
2. **`SUPABASE_SERVICE_ROLE_KEY`** 拥有管理员权限，绝不要泄露到前端或 Git
3. **数据库**：本项目依赖 Supabase PostgreSQL，不需要在服务器本地安装数据库
4. **文件存储**：图片生成后存储在服务端本地，生产环境建议配置持久化卷或迁移到对象存储
5. **CORS**：`WEB_ORIGIN` 必须填写前端的真实线上域名，否则 API 请求会被拦截；但它不再决定邮件跳转地址
6. **认证跳转**：后台“站点配置”的“前台公开地址”必须和 Supabase Authentication → Redirect URLs 中允许的 origin 保持一致
7. **镜像命名**：服务器实际运行的版本取决于 `.env` 中的 `VISION_WEB_IMAGE` 和 `VISION_ADMIN_IMAGE`，而不是服务器目录里是否存在源码
