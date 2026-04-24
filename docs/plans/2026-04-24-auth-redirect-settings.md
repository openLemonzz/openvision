# Auth Redirect Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let admins manage the public web URL from the backend and make web signup/password-reset emails use the latest saved redirect target on the next action.

**Architecture:** Add a single-row `public.app_settings` table plus admin/public settings APIs in the admin service. Add a dedicated admin “站点配置” page for editing `public_web_url`, and make the web auth flows fetch `GET /api/settings/public` at action time, falling back to `window.location.origin` if the setting is unavailable.

**Tech Stack:** PostgreSQL (Supabase), Express, React, React Router, TypeScript, Node test runner

---

### Task 1: Remove the abandoned env-var direction

**Files:**
- Modify: `web/src/lib/runtime-config.ts`
- Modify: `web/src/lib/runtime-config.test.ts`
- Modify: `web/src/lib/supabase.ts`

**Step 1: Write the failing test**

Use the existing failing runtime-config test as the guard that this field should not exist anymore.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test web/src/lib/runtime-config.test.ts`
Expected: FAIL because `webOrigin` is still asserted but should be removed for the backend-settings design.

**Step 3: Write minimal implementation**

Remove the temporary `VITE_WEB_ORIGIN` support from runtime config and exports.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test web/src/lib/runtime-config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/lib/runtime-config.ts web/src/lib/runtime-config.test.ts web/src/lib/supabase.ts
git commit -m "refactor: remove env-based auth redirect config"
```

### Task 2: Add database support for app settings

**Files:**
- Modify: `supabase/schema.sql`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Add server API tests that expect:

- `GET /api/settings/public` returns `{ publicWebUrl: "https://vision.app" }`
- `PUT /api/settings` normalizes `https://vision.app/path?x=1` to `https://vision.app`
- invalid URLs return `400`

**Step 2: Run test to verify it fails**

Run: `node --test admin/tests/server-api.test.ts`
Expected: FAIL because settings routes/table support do not exist yet.

**Step 3: Write minimal implementation**

Extend `supabase/schema.sql` with `public.app_settings` and default row semantics suitable for a single settings record.

**Step 4: Run test to verify it still fails at the API layer**

Run: `node --test admin/tests/server-api.test.ts`
Expected: still FAIL until server handlers exist.

**Step 5: Commit**

```bash
git add supabase/schema.sql admin/tests/server-api.test.ts
git commit -m "test: cover app settings API contract"
```

### Task 3: Implement settings APIs in admin server

**Files:**
- Modify: `admin/server/app.ts`
- Modify: `admin/src/lib/types.ts`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Use the new tests from Task 2 as the failing contract.

**Step 2: Run test to verify it fails**

Run: `node --test admin/tests/server-api.test.ts`
Expected: FAIL on missing settings endpoints or wrong validation.

**Step 3: Write minimal implementation**

Add:

- settings row loader/upserter helpers
- URL normalization helper that accepts only absolute `http` / `https`
- `GET /api/settings/public`
- `GET /api/settings`
- `PUT /api/settings`

Keep the public route anonymous and the admin routes protected by `requireAdmin`.

**Step 4: Run test to verify it passes**

Run: `node --test admin/tests/server-api.test.ts`
Expected: PASS for the new settings API tests

**Step 5: Commit**

```bash
git add admin/server/app.ts admin/src/lib/types.ts admin/tests/server-api.test.ts
git commit -m "feat: add admin-managed app settings API"
```

### Task 4: Add a dedicated admin settings page

**Files:**
- Create: `admin/src/pages/admin/AdminSettings.tsx`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/pages/admin/AdminLayout.tsx`
- Modify: `admin/src/hooks/useAdminApp.ts`
- Modify: `admin/src/lib/types.ts`

**Step 1: Write the failing test**

If there is no page-level test harness, add a minimal logic-level test or route smoke assertion for the settings page data flow. At minimum, make type-driven compile failure visible by wiring the new route before the page exists.

**Step 2: Run test to verify it fails**

Run: `npm --prefix admin run build`
Expected: FAIL until the new route/page/state wiring is complete.

**Step 3: Write minimal implementation**

Add:

- admin state for settings fetch/update
- a “站点配置” navigation item
- a dedicated page with one editable field and save feedback
- operator guidance about Supabase redirect allowlist

**Step 4: Run test to verify it passes**

Run: `npm --prefix admin run build`
Expected: PASS

**Step 5: Commit**

```bash
git add admin/src/App.tsx admin/src/pages/admin/AdminLayout.tsx admin/src/pages/admin/AdminSettings.tsx admin/src/hooks/useAdminApp.ts admin/src/lib/types.ts
git commit -m "feat: add admin settings page for public web url"
```

### Task 5: Make web auth flows use live backend settings

**Files:**
- Modify: `web/src/lib/auth-registration.ts`
- Modify: `web/src/lib/auth-registration.test.ts`
- Modify: `web/src/hooks/useAuth.ts`

**Step 1: Write the failing test**

Add tests that expect:

- configured public URL from backend wins over browser origin
- invalid or missing backend config falls back to browser origin

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test web/src/lib/auth-registration.test.ts`
Expected: FAIL if the resolver is not yet wired to backend-sourced values.

**Step 3: Write minimal implementation**

Add a small frontend helper that:

- fetches `GET /api/settings/public` from the admin API base
- normalizes the returned URL
- falls back to `window.location.origin`

Use it in both signup and password-reset flows immediately before calling Supabase.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test web/src/lib/auth-registration.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add web/src/lib/auth-registration.ts web/src/lib/auth-registration.test.ts web/src/hooks/useAuth.ts
git commit -m "feat: use live app settings for auth redirects"
```

### Task 6: Verify end-to-end behavior and docs

**Files:**
- Modify: `README.md`
- Modify: `deploy/1panel/README.md`

**Step 1: Write the failing test**

Use documentation drift as the failing condition: the docs still imply runtime env controls this redirect target.

**Step 2: Run test to verify it fails**

Run: `rg -n "VITE_WEB_ORIGIN|Site URL|Redirect URLs|public web url|站点配置" README.md deploy/1panel/README.md`
Expected: output shows the new admin-managed setting is undocumented.

**Step 3: Write minimal implementation**

Document:

- the new admin settings page
- that auth redirects use the configured public web URL
- that Supabase redirect allowlist must include the same origin

**Step 4: Run test to verify it passes**

Run: `npm --prefix admin run build && npm --prefix web run build && node --test admin/tests/server-api.test.ts && node --experimental-strip-types --test web/src/lib/auth-registration.test.ts web/src/lib/runtime-config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md deploy/1panel/README.md
git commit -m "docs: describe admin-managed auth redirect settings"
```
