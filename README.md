# VISION

双服务：

- `web`：用户站
- `admin`：后台页面 + 管理 API

## 必填环境变量

复制：

```bash
cp web/.env.example web/.env
cp admin/.env.example admin/.env
```

`web/.env`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_API_URL=http://localhost:8787/api
VITE_ADMIN_APP_URL=http://localhost:8787
```

`admin/.env`

```env
PORT=8787
WEB_ORIGIN=http://localhost:8080
DATABASE_URL=postgresql://postgres:password@db.your-project-ref.supabase.co:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
CONFIG_CRYPT_KEY=replace-with-random-secret
```

## 0-1 部署

### 1. 跑数据库迁移

```bash
npm run db:migrate
```

### 2. 创建管理员

先注册一个普通用户，再执行：

```sql
insert into public.admin_roles (user_id)
select id
from auth.users
where email = 'your-admin@example.com'
on conflict (user_id) do nothing;
```

后台登录：

- 邮箱：Supabase Auth 邮箱
- 密码：这个邮箱自己的密码

### 3. 启动全部服务

```bash
npm run docker:up
```

访问：

- `web`：`http://localhost:8080`
- `admin`：`http://localhost:8787`

## 单服务部署

只部署 `web`：

```bash
npm run docker:up:web
```

只部署 `admin`：

```bash
npm run docker:up:admin
```

## 常用命令

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

## 验证

```bash
curl http://127.0.0.1:8787/api/health
```

期望：

```json
{"ok":true,"missing":[]}
```
