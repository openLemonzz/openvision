# Generation Concurrency And Latest-Image Animation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin-configured per-user generation concurrency limits and make the homepage latest-image swap animate only when a new result first completes.

**Architecture:** Store the concurrency limit on `public.profiles`, expose it through existing user payloads, and enforce it on both the frontend and backend. Keep the latest-image animation local to the homepage history component by detecting state transitions from unfinished records to the newest completed record.

**Tech Stack:** React 19, TypeScript, Express, PostgreSQL, Supabase, Vite, node:test

---

### Task 1: Database Default And API Contract

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `admin/server/app.ts`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Cover:
- `GET /api/me` returns `concurrencyLimit`
- `GET /api/users` includes `concurrencyLimit`

**Step 2: Run test to verify it fails**

Run: `cd admin && node --test ./tests/server-api.test.ts`
Expected: FAIL because the payloads do not include `concurrencyLimit`

**Step 3: Write minimal implementation**

Add:
- `concurrency_limit` column with default `1` and lower-bound validation
- query selections and response mappings for `concurrencyLimit`

**Step 4: Run test to verify it passes**

Run: `cd admin && node --test ./tests/server-api.test.ts`
Expected: PASS for the new payload assertions

### Task 2: Admin User Settings Endpoint

**Files:**
- Modify: `admin/server/app.ts`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Cover:
- `PATCH /api/users/:id/settings` accepts a valid `concurrencyLimit`
- invalid values return `400`

**Step 2: Run test to verify it fails**

Run: `cd admin && node --test ./tests/server-api.test.ts`
Expected: FAIL because the route does not exist

**Step 3: Write minimal implementation**

Add:
- request validation for integer values `>= 1`
- profile update query for `concurrency_limit`
- response payload containing the saved `concurrencyLimit`

**Step 4: Run test to verify it passes**

Run: `cd admin && node --test ./tests/server-api.test.ts`
Expected: PASS for the new route coverage

### Task 3: Backend Generate Limit Enforcement

**Files:**
- Modify: `admin/server/app.ts`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Cover:
- `POST /api/generate` returns `409` when active `pending/generating` count is already at `concurrencyLimit`

**Step 2: Run test to verify it fails**

Run: `cd admin && node --test ./tests/server-api.test.ts`
Expected: FAIL because generation is not yet limit-checked

**Step 3: Write minimal implementation**

Add:
- query to read `is_disabled` and `concurrency_limit`
- query to count active jobs with statuses `pending` and `generating`
- `409` rejection before the new generation insert

**Step 4: Run test to verify it passes**

Run: `cd admin && node --test ./tests/server-api.test.ts`
Expected: PASS for the limit rejection test

### Task 4: Admin UI For Concurrency Editing

**Files:**
- Modify: `admin/src/lib/types.ts`
- Modify: `admin/src/hooks/useAdminApp.ts`
- Modify: `admin/src/pages/admin/AdminUsers.tsx`

**Step 1: Add the missing type and action plumbing**

Update:
- `AdminUser.concurrencyLimit`
- admin hook method for saving user settings

**Step 2: Implement the UI minimally**

Add:
- `并发数` column
- row-level numeric input with save action
- loading and inline error handling per edited row

**Step 3: Verify the UI compiles**

Run: `cd admin && npm run build`
Expected: PASS

### Task 5: Web User Profile And Capacity Gating

**Files:**
- Modify: `web/src/hooks/useAuth.ts`
- Modify: `web/src/hooks/useGeneration.ts`
- Modify: `web/src/components/GenerateConsole.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/Home.tsx`

**Step 1: Write the failing test or define focused behavior target**

Cover behavior:
- current user profile stores `concurrencyLimit`
- active generation count only includes `pending/generating`
- generate button disables and shows the capacity state when full

**Step 2: Run the relevant verification**

Run: `cd web && npm run build`
Expected: current code cannot compile with the new props and state shape until implementation is added

**Step 3: Write minimal implementation**

Add:
- `concurrencyLimit` on the web user profile
- derived `activeGenerationCount`
- button disabled state and `并发 x/y` display
- `409` toast handling

**Step 4: Run verification**

Run: `cd web && npm run build`
Expected: PASS

### Task 6: Latest Image Transition Animation

**Files:**
- Modify: `web/src/components/HistoryStream.tsx`

**Step 1: Define the transition trigger**

Detect:
- newest record only
- previous status was `pending` or `generating`
- current status is `completed`

**Step 2: Implement the animation minimally**

Add:
- one-time transition state keyed by record id
- blur/scale/opacity handoff
- single left-to-right reveal on first completion only

**Step 3: Verify no replay on ordinary refresh**

Check:
- already completed history rows render statically
- only newly completed latest row animates

### Task 7: Final Verification

**Files:**
- Verify only

**Step 1: Run server tests**

Run: `cd admin && node --test ./tests/server-api.test.ts`

**Step 2: Run admin build**

Run: `cd admin && npm run build`

**Step 3: Run web build**

Run: `cd web && npm run build`
