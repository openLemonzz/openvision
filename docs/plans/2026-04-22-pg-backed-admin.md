# Dual-Service Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the project into `web` and `admin` services, move privileged logic into `admin`, and make PostgreSQL plus Supabase Auth the only system of record.

**Architecture:** `web` becomes a user-only frontend. `admin` becomes a combined admin frontend and privileged Node API, backed by `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CONFIG_CRYPT_KEY`. Shared schema and storage setup live in root `supabase/`.

**Tech Stack:** React 19, Vite, TypeScript, Express, pg, Supabase Auth, PostgreSQL, Supabase Storage

---

### Task 1: Create the two-service repository layout

**Files:**
- Create: `package.json`
- Modify: `.gitignore`
- Create: `web/`
- Create: `admin/`
- Create: `supabase/`

**Step 1: Copy the current app into `web`**

Run a bulk copy without `node_modules`, `dist`, or `.env`.

**Step 2: Create the `admin` package skeleton**

- Add package metadata
- Add Vite client config
- Add TypeScript server config

**Step 3: Verify the new layout exists**

Run: `find . -maxdepth 2 -type d | sort`
Expected: includes `./web`, `./admin`, `./supabase`

### Task 2: Add PG-backed shared schema

**Files:**
- Create: `supabase/migrations/20260422190000_dual_service_refactor.sql`
- Modify: `supabase/schema.sql`
- Modify: `supabase/config.toml`

**Step 1: Write the migration**

- add `profiles`
- add `admin_roles`
- add `referrals`
- add `model_configs`
- add profile/invite triggers
- keep `generations`

**Step 2: Update the schema snapshot**

- mirror the migration in `schema.sql`

**Step 3: Update health expectations**

- new deployment assumes these tables exist

### Task 3: Build the `admin` service API

**Files:**
- Create: `admin/server/index.ts`
- Create: `admin/server/config.ts`
- Create: `admin/server/db.ts`
- Create: `admin/server/auth.ts`
- Create: `admin/server/crypto.ts`

**Step 1: Add authenticated endpoints**

- `GET /api/health`
- `GET /api/me`
- `GET /api/users`
- `PATCH /api/users/:id/status`
- `GET /api/models`
- `PUT /api/models/:id`
- `GET /api/generations`
- `DELETE /api/generations/:id`
- `GET /api/public/models`
- `POST /api/generate`

**Step 2: Keep secrets server-only**

- encrypt provider keys before DB writes
- decrypt only inside `POST /api/generate`

### Task 4: Build the `admin` frontend

**Files:**
- Create: `admin/src/App.tsx`
- Create: `admin/src/main.tsx`
- Create: `admin/src/lib/api.ts`
- Create: `admin/src/lib/supabase.ts`
- Create: `admin/src/lib/types.ts`
- Create: `admin/src/hooks/useAdminApp.ts`
- Modify: `admin/src/pages/admin/*.tsx`

**Step 1: Reuse the current admin pages**

- keep the UI
- replace local state and hard-coded password flows

**Step 2: Switch login to email/password**

- use Supabase Auth on the admin site
- verify admin role through `/api/me`

**Step 3: Bind all tables to API data**

- users
- models
- generations

### Task 5: Cut `web` down to user-only responsibilities

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/hooks/useAuth.ts`
- Modify: `web/src/hooks/useGeneration.ts`
- Create: `web/src/hooks/usePublicModels.ts`
- Create: `web/src/lib/admin-api.ts`

**Step 1: Remove the embedded admin route path**

- `web` no longer serves admin pages

**Step 2: Remove local business fallbacks**

- auth fallback
- generation fallback
- model fallback

**Step 3: Read models from `admin`**

- `GET /api/public/models`

**Step 4: Send generation requests to `admin`**

- `POST /api/generate`

### Task 6: Redesign deployment around two services

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Create or modify: service-specific `.env.example` files

**Step 1: Build separate web and admin images**

- `web` serves static user app
- `admin` serves static admin app plus API

**Step 2: Document new env vars**

- `VITE_ADMIN_API_URL`
- `DATABASE_URL`
- `CONFIG_CRYPT_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Task 7: Verification

**Files:**
- No code changes intended

**Step 1: Run web build**

Run: `npm --prefix web run build`

**Step 2: Run admin build**

Run: `npm --prefix admin run build`

**Step 3: Run web lint**

Run: `npm --prefix web run lint`

**Step 4: Run admin lint**

Run: `npm --prefix admin run lint`
