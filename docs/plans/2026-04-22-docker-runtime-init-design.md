# Docker Runtime Init Design

## Goal

让前端站点可以作为单独 Docker 镜像部署到任意环境，并在首次部署时通过初始化态明确区分三种状态：

- 前端运行时变量未配置
- Supabase 后端资源尚未初始化
- 系统已就绪，可进入业务页面

## Scope

- 前端镜像使用外部 Supabase，不在容器内运行数据库或本地 Supabase 栈
- 运行时注入 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`
- 单独提供一次性 `init` 容器执行 `npm run deploy:supabase:init`
- 前端新增初始化态和就绪检查
- 新增 `health` Edge Function 用于后端资源检查

## Architecture

### Web Container

- 用多阶段 Docker 构建产出静态资源
- 用 `nginx` 提供静态文件
- 容器启动时生成 `env.js`，暴露运行时配置给浏览器

### Init Container

- 单独接收 `SUPABASE_ACCESS_TOKEN`、`PROJECT_REF`、`SUPABASE_DB_PASSWORD`
- 容器启动即执行 `npm run deploy:supabase:init`
- 成功后退出，不常驻

### Frontend Runtime

- 配置读取顺序：`window.__APP_CONFIG__` → `import.meta.env`
- Docker 模式下缺少前端变量时进入“配置未完成”初始化页
- 配置齐全后调用 `health` function，并探测 `check-email`、`admin-users`、`generate-image`
- 未就绪时显示“后端初始化中 / 未完成”页面，并提供重新检测

## Error States

- `config-missing`: 缺少 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_ANON_KEY`
- `functions-missing`: `health` 或业务 Edge Functions 未部署
- `backend-uninitialized`: 表、bucket 或服务端环境未完成
- `network-error`: Supabase 地址不可达或请求失败
- `ready`: 所有检查通过

## Notes

- 保留本地 `npm run dev` 的现有 fallback 行为
- Docker 模式禁止回落到本地假数据模式
- `health` function 只做只读检查，不做初始化动作
