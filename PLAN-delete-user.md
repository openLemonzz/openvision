# 规划：管理端控制台支持删除用户

## 背景
管理端已有用户列表、搜索、筛选、禁用/启用功能，但缺少彻底删除用户的能力。

## 数据库现状
schema.sql 中所有 public 表的外键均已配置 `on delete cascade`：
- `public.generations(user_id)` → `auth.users(id)`
- `public.profiles(user_id)` → `auth.users(id)`  
- `public.admin_roles(user_id)` → `auth.users(id)`
- `public.referrals(inviter_id / invitee_id)` → `auth.users(id)`

因此，从 `auth.users` 删除一条记录会自动级联清理所有关联数据，无需手动维护多表一致性。

---

## 改动范围（4 个文件）

### 1. 后端 `admin/server/app.ts`

新增端点：

```
DELETE /api/users/:id
```

- 中间件：`requireAdmin`
- 防护规则：
  - 若 `req.params.id === req.authUser.id`，返回 `403 Forbidden`（禁止管理员删除自己）
  - 先查询确认用户存在，不存在返回 `404 Not Found`
- 删除方式：直接使用 SQL `DELETE FROM auth.users WHERE id = $1`
  - 理由：简单可靠，且数据库已配置级联删除
  - 替代方案（暂不用）：Supabase Admin SDK `auth.admin.deleteUser()`，会引入额外依赖且本项目当前后端模式以 raw SQL 为主
- 返回：`204 No Content`

---

### 2. 前端 Hook `admin/src/hooks/useAdminApp.ts`

新增方法签名：

```ts
const deleteUser = useCallback(async (id: string) => {
  await apiFetch(`/users/${id}`, { method: 'DELETE' });
  setUsers((prev) => prev.filter((u) => u.id !== id));
}, []);
```

- 乐观更新：请求成功后立即从本地列表移除
- 异常抛出让调用方处理（保持与 `deleteGeneration` 一致的异常策略）

---

### 3. 前端页面 `admin/src/pages/admin/AdminUsers.tsx`

新增 props：

```ts
interface AdminUsersProps {
  users: AdminUser[];
  onToggleStatus: (id: string) => void;
  onDeleteUser: (id: string) => void;
  currentAdminId?: string;   // 用于隐藏自己的删除按钮
}
```

UI 改动：
- 操作列增加红色删除按钮（`Trash2` 图标）
- 点击后弹出确认对话框（Alert Dialog），文案示例：
  > 确认删除用户「username」？
  > 该用户有 12 条生成记录、3 个被邀请人，所有数据将被永久删除且不可恢复。
- 当前登录管理员自己的行隐藏删除按钮（防止误操作）
- 确认对话框复用已有的 shadcn/ui AlertDialog（项目 admin/src/components/ui 下已存在 alert-dialog.tsx）

---

### 4. 前端路由 `admin/src/App.tsx`

在 `users` 路由中传入新增的 `onDeleteUser`：

```tsx
<Route
  path="users"
  element={
    <AdminUsers
      users={admin.users}
      onToggleStatus={admin.toggleUserStatus}
      onDeleteUser={admin.deleteUser}
      currentAdminId={admin.me?.id}
    />
  }
/>
```

---

## 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 硬删除 vs 软删除 | 硬删除 | 已有「禁用」作为软封禁手段；用户明确要求删除，应彻底清理 |
| 级联清理方式 | 依赖数据库 `on delete cascade` | schema 已配置，无需后端手动删多表 |
| 删除入口 | SQL `DELETE FROM auth.users` | 与现有 toggleStatus（直接 UPDATE profiles）风格一致，无需引入 Supabase Admin SDK 额外依赖 |
| 防自删 | 后端 403 + 前端隐藏按钮 | 双重保险 |
| 二次确认 | AlertDialog + 显示生成/邀请数量 | 不可逆操作，必须阻断误触 |
| 异常反馈 | 沿用现有模式：hook 抛异常，页面层不处理 | 统一由 App 层或 toast 系统处理（目前 admin 侧尚未接入 toast，异常会自然抛到控制台，与现有行为一致）|

---

## 实施顺序

1. 后端 `admin/server/app.ts` — 新增 DELETE 端点
2. Hook `admin/src/hooks/useAdminApp.ts` — 新增 `deleteUser`
3. 页面 `admin/src/pages/admin/AdminUsers.tsx` — 新增删除按钮 + AlertDialog
4. 路由 `admin/src/App.tsx` — 串联 props
5. 端到端测试：
   - 删除普通用户 → 列表刷新，关联数据级联清理
   - 删除不存在的用户 → 404
   - 删除自己 → 403 + 按钮不可见
