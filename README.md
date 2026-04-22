# VISION Deployment Guide

VISION 现在只保留一套可运行架构：

- `web`: 用户站前端
- `admin`: 后台管理端 + 唯一业务后端 API
- `supabase/schema.sql`: 唯一可信数据库结构定义

当前仓库已清理掉：

- 旧 `app` 单体目录
- 所有 Edge Functions
- 旧 Supabase init / 多迁移链路
- 过时设计文档

## 1. Runtime Architecture

- `web` 只负责前端渲染和 Supabase Auth 登录态
- `web` 所有业务请求都走 `admin` API
- `admin` 负责：
  - 用户鉴权
  - RBAC
  - 模型配置管理
  - 调用上游模型
  - Storage 上传
  - 业务数据读写
- Supabase 只负责：
  - Auth
  - PostgreSQL
  - Storage

## 2. Prerequisites

本地部署至少需要：

- Docker Desktop
- Node.js 20+
- `npm`
- `psql`

安装依赖：

```bash
npm install
npm --prefix web install
npm --prefix admin install
```

## 3. Environment Variables

复制模板：

```bash
cp web/.env.example web/.env
cp admin/.env.example admin/.env
```

### `web/.env`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_API_URL=http://localhost:8787/api
VITE_ADMIN_APP_URL=http://localhost:8787
```

### `admin/.env`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=/api

PORT=8787
WEB_ORIGIN=http://localhost:8080
DATABASE_URL=postgresql://postgres:password@db-host:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CONFIG_CRYPT_KEY=replace-with-random-secret
```

关键约束：

- `WEB_ORIGIN` 必须和用户实际访问 `web` 的地址一致
- `VITE_ADMIN_API_URL` 必须指向实际 `admin` API 地址
- `VITE_ADMIN_APP_URL` 必须指向实际 `admin` UI 地址

本地请统一使用其中一套：

- `localhost`
- 或 `127.0.0.1`

不要混用。

## 4. Apply Fixed Database Schema

仓库不再维护迁移链，只维护一份固定 schema：

- `supabase/schema.sql`

应用命令：

```bash
npm run db:apply
```

它会直接执行：

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
```

这份 schema 会收敛数据库到当前结构，并清理旧的历史对象。

## 5. Create the First User

管理员身份仍然基于 Supabase Auth 用户。

先创建一个普通用户：

1. 启动服务后从 `web` 注册
2. 或在 Supabase Dashboard 手动创建

后台登录时使用这个用户自己的邮箱和密码。

## 6. Grant Admin Role

给某个用户授予后台权限：

```sql
insert into public.admin_roles (user_id)
select id
from auth.users
where email = 'your-admin@example.com'
on conflict (user_id) do nothing;
```

校验：

```sql
select u.email, (ar.user_id is not null) as is_admin
from auth.users u
left join public.admin_roles ar on ar.user_id = u.id
where u.email = 'your-admin@example.com';
```

## 7. Start Services

启动全部服务：

```bash
npm run docker:up
```

访问：

- `web`: `http://localhost:8080`
- `admin`: `http://localhost:8787`

或：

- `web`: `http://127.0.0.1:8080`
- `admin`: `http://127.0.0.1:8787`

## 8. Common Commands

```bash
npm run docker:ps
npm run docker:logs:web
npm run docker:logs:admin
npm run docker:restart:web
npm run docker:restart:admin
npm run docker:recreate:web
npm run docker:recreate:admin
npm run docker:down
```

只重建某一个服务：

```bash
npm run docker:up:web
npm run docker:up:admin
```

## 9. Health Checks

检查 `admin`：

```bash
curl http://127.0.0.1:8787/api/health
```

期望：

```json
{"ok":true,"missing":[]}
```

检查 `web`：

```bash
curl -I http://127.0.0.1:8080
```

期望返回 `200 OK`。

## 10. Smoke Test

建议至少验证：

1. `web` 首页不是“服务启动中，请稍候…”
2. 普通用户能登录并进入控制台
3. `admin` 登录页能正常显示
4. 管理员能登录后台
5. 模型列表能在前台正常读取
6. `/api/generate` 能由 `admin` 处理

## 11. Troubleshooting

### `{"ok":false,"missing":[...]}`

说明 `admin/.env` 缺关键服务端变量。

重点检查：

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CONFIG_CRYPT_KEY`

### `web` 卡在“服务启动中，请稍候…”

先检查：

```bash
curl http://127.0.0.1:8787/api/health
```

再确认：

- `web/.env` 里的 `VITE_ADMIN_API_URL`
- `admin/.env` 里的 `WEB_ORIGIN`
- `localhost` / `127.0.0.1` 是否混用

### `Loading admin...`

先检查：

```bash
curl http://127.0.0.1:8787/api/health
```

再看：

```bash
npm run docker:logs:admin
```

### 后台登录显示“没有管理权限”

先查 `admin_roles`：

```sql
select u.email, ar.user_id is not null as is_admin
from auth.users u
left join public.admin_roles ar on ar.user_id = u.id
where u.email = 'your-admin@example.com';
```

### `/api/generate` 返回 `{"error":"Upstream failed: 401"}`

说明模型上游返回了 401。

优先检查后台模型配置：

- `api_endpoint`
- `api_key_ciphertext` 是否已设置
- 上游 key 是否有效
- `protocol` 是否匹配上游接口

## 12. Production Notes

生产环境建议：

- `web` 和 `admin` 使用独立域名或子域名
- `WEB_ORIGIN` 配置成真实 `web` 地址
- `VITE_ADMIN_API_URL` 配置成真实 `admin` API 地址
- `VITE_ADMIN_APP_URL` 配置成真实 `admin` UI 地址
- `SUPABASE_SERVICE_ROLE_KEY` 和 `CONFIG_CRYPT_KEY` 只放到 `admin` 服务端环境

以后如果结构变更，直接更新：

- `README.md`
- `supabase/schema.sql`

不要再新增迁移链或旧架构副本。
