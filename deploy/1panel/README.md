# VISION - 1Panel 部署指南

## 架构说明

| 服务 | 说明 | 容器端口 | 宿主机端口 |
|------|------|---------|-----------|
| web | 前端静态页面（Nginx） | 80 | 9901 |
| admin | 后端 API + 管理后台（Node.js） | 9902 | 9902 |

外部访问通过 **1Panel OpenResty** 反向代理到上述端口，不直接暴露端口到公网。

---

## 前置准备

1. **1Panel 服务器**（已安装并配置好）
2. **域名**（至少 1 个，建议 2 个：
   - `vision.app` → Web 前端
   - `admin.vision.app` → Admin 后端）
3. **Supabase 项目**（数据库 + 认证服务，本项目不自带数据库）

---

## 部署步骤

### 第一步：在 1Panel 中创建编排

1. 进入 **1Panel → 容器 → 编排**
2. 点击 **创建编排**
3. 填写信息：
   - **名称**：`vision`
   - **路径**：`/opt/1panel/docker/compose/vision`
4. 点击创建文件夹，然后进入该目录

### 第二步：上传代码

将项目代码上传到服务器编排目录：

```bash
# 在本地打包项目（排除 node_modules / .git / dist）
cd /你的项目路径/vision
tar czvf vision-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='web/dist' \
  --exclude='admin/dist' \
  .

# 上传到服务器
scp vision-deploy.tar.gz root@你的服务器IP:/opt/1panel/docker/compose/vision/

# 在服务器上解压
ssh root@你的服务器IP
cd /opt/1panel/docker/compose/vision
tar xzvf vision-deploy.tar.gz

# 把 1Panel 部署文件移到编排根目录
cp deploy/1panel/docker-compose.yml ./docker-compose.yml
```

### 第三步：配置环境变量

复制模板并填写真实值：

```bash
cd /opt/1panel/docker/compose/vision
cp deploy/1panel/web.env ./web.env
cp deploy/1panel/admin.env ./admin.env

# 生成强随机加密密钥
openssl rand -hex 32
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

### 第四步：启动编排

在 1Panel 编排页面：

1. 确认 `docker-compose.yml` 内容正确
2. 点击 **启动**
3. 等待构建完成（首次构建约 2-3 分钟）

或者在服务器命令行执行：

```bash
cd /opt/1panel/docker/compose/vision
docker compose up -d --build
```

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

---

## 常用运维命令

```bash
cd /opt/1panel/docker/compose/vision

# 查看容器状态
docker compose ps

# 查看日志
docker compose logs -f web
docker compose logs -f admin

# 重启服务
docker compose restart

# 重建（代码更新后）
docker compose up -d --build

# 停止
docker compose down
```

---

## 注意事项

1. **`CONFIG_CRYPT_KEY`** 部署前必须更换，且更换后已加密的历史数据将无法解密
2. **`SUPABASE_SERVICE_ROLE_KEY`** 拥有管理员权限，绝不要泄露到前端或 Git
3. **数据库**：本项目依赖 Supabase PostgreSQL，不需要在服务器本地安装数据库
4. **文件存储**：图片生成后存储在服务端本地，生产环境建议配置持久化卷或迁移到对象存储
5. **CORS**：`WEB_ORIGIN` 必须填写前端的真实线上域名，否则 API 请求会被拦截
