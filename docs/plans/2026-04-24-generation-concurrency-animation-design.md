# Generation Concurrency And Latest-Image Animation Design

**Context**

The homepage currently replaces the latest generation card abruptly when a new image finishes. The transition already has a reveal layer, but it does not distinguish between a brand-new completed image and a normal history refresh, so the handoff from placeholder state to finished image feels mechanical.

User profiles also do not have any per-user generation concurrency setting. The system therefore cannot express a user-specific limit, cannot enforce that limit server-side, and cannot disable the web generate action when the user has already reached the allowed number of active jobs.

**Goals**

- Improve the animation that swaps the latest homepage result from loading state to the newly generated image.
- Add a per-user `concurrencyLimit` setting with a default value of `1`.
- Let admins edit that setting in the admin user management screen.
- Enforce the limit on both frontend and backend.
- Count only `pending` and `generating` records toward the limit.

**Chosen Approach**

Store the concurrency setting on `public.profiles` as `concurrency_limit integer not null default 1 check (concurrency_limit >= 1)`. Extend the existing `/api/me` payload to return the current user's limit and extend `/api/users` to expose the limit in the admin UI. Add a focused admin endpoint for user settings updates so the admin panel can update only `concurrencyLimit` without overloading the status toggle route.

Enforce the limit in two places. On the backend, `POST /api/generate` will query the current user's active generation count (`status in ('pending', 'generating')`) before inserting a new generation and return `409` when the limit is already reached. On the frontend, the web app will compute the active count from current history plus the user's `concurrencyLimit` from `/api/me`, disable the generate button when full, and show a clearer capacity indicator such as `并发 1/3`.

For animation, keep the existing placeholder states for `pending` and `generating`, but change the completed-image reveal to be driven by a record status transition instead of every render. Only the newest record that just changed from unfinished to `completed` should animate. The finished image enters with a short blur/scale/opacity handoff plus a left-to-right reveal so the new image feels like it takes over the card instead of replacing it instantly. Old completed records loaded from history should not replay the reveal.

**Data Flow**

- Database default provides `concurrency_limit = 1` for new and existing users.
- `/api/me` returns `concurrencyLimit` for the signed-in web user.
- `/api/users` returns `concurrencyLimit` for each admin list row.
- `PATCH /api/users/:id/settings` accepts `{ concurrencyLimit }` and persists the profile setting.
- `useAuth` stores `concurrencyLimit` in the user profile payload.
- `useGeneration` derives `activeGenerationCount` from `history`.
- `GenerateConsole` uses `activeGenerationCount` and `concurrencyLimit` to disable generate actions before submission.
- `POST /api/generate` performs final backend enforcement in case the request bypasses the UI.

**Error Handling**

- Backend rejects invalid config updates with `400` and a message equivalent to `concurrencyLimit must be an integer >= 1`.
- Backend rejects generation creation beyond the limit with `409`.
- Frontend converts the `409` response into a user-facing toast such as `已达到并发上限`.
- The generate button stays disabled while the client already knows capacity is full.

**Testing**

- Add server API coverage for `/api/me`, `/api/users`, user settings update, and generation-limit rejection.
- Add focused frontend behavior coverage for the capacity gating logic and the animation transition trigger so the reveal only runs once for the newest newly completed record.

**Files Expected**

- `supabase/schema.sql`
- `admin/server/app.ts`
- `admin/tests/server-api.test.ts`
- `admin/src/lib/types.ts`
- `admin/src/hooks/useAdminApp.ts`
- `admin/src/pages/admin/AdminUsers.tsx`
- `web/src/hooks/useAuth.ts`
- `web/src/hooks/useGeneration.ts`
- `web/src/components/GenerateConsole.tsx`
- `web/src/components/HistoryStream.tsx`
- `web/src/App.tsx`
- `web/src/pages/Home.tsx`
