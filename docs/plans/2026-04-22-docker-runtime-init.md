# Docker Runtime Init Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Docker web/init deployment with runtime env injection and an initialization state that blocks the app until external Supabase is ready.

**Architecture:** A multi-stage Docker build produces a static web image served by nginx, while a separate init target runs the existing Supabase bootstrap command once. The frontend reads runtime config from `env.js`, checks backend readiness through a new public `health` function plus function probes, and renders an initialization screen until the system is ready.

**Tech Stack:** Vite, React 19, TypeScript, nginx, Docker, Supabase Edge Functions, Node built-in test runner

---

### Task 1: Runtime Config And Readiness State

**Files:**
- Create: `app/src/lib/runtime-config.ts`
- Create: `app/src/lib/runtime-config.test.ts`
- Create: `app/src/hooks/useInitialization.ts`
- Modify: `app/src/lib/supabase.ts`
- Modify: `app/src/App.tsx`
- Modify: `app/index.html`

**Step 1: Write the failing test**

Create tests for:
- docker mode with missing runtime vars returns `config-missing`
- docker mode with vars present returns `check-required`
- local dev mode without vars still allows local fallback

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test ./src/lib/runtime-config.test.ts`
Expected: FAIL because runtime config helper does not exist yet

**Step 3: Write minimal implementation**

Implement runtime config parsing and initialization state helpers, then gate the app in `App.tsx`.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test ./src/lib/runtime-config.test.ts`
Expected: PASS

### Task 2: Initialization Screen And Health Checks

**Files:**
- Create: `app/src/components/InitializationScreen.tsx`
- Modify: `app/src/hooks/useAuth.ts`
- Modify: `app/src/hooks/useAdmin.ts`
- Modify: `app/src/hooks/useGeneration.ts`
- Create: `app/supabase/functions/health/index.ts`
- Modify: `app/supabase/config.toml`

**Step 1: Write the failing test**

Add tests for health payload interpretation:
- missing resources return `backend-uninitialized`
- missing function probe returns `functions-missing`

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test ./src/lib/runtime-config.test.ts`
Expected: FAIL because readiness interpretation is incomplete

**Step 3: Write minimal implementation**

Add the initialization screen, wire runtime Supabase URL reads, implement the `health` function, and block business flows in Docker mode until checks pass.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test ./src/lib/runtime-config.test.ts`
Expected: PASS

### Task 3: Docker Web And Init Containers

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `docker/nginx.conf`
- Create: `docker/web-entrypoint.sh`
- Create: `.dockerignore`

**Step 1: Write the failing test**

Extend script tests to assert docker runtime config generation inputs and init command prerequisites.

**Step 2: Run test to verify it fails**

Run: `npm run test:supabase:init`
Expected: FAIL if docker-related assumptions are not yet encoded

**Step 3: Write minimal implementation**

Add Docker targets for `web` and `init`, nginx config, and runtime env injection entrypoint.

**Step 4: Run test to verify it passes**

Run: `npm run test:supabase:init`
Expected: PASS

### Task 4: Documentation And Verification

**Files:**
- Modify: `README.md`
- Modify: `app/.env.example`
- Modify: `app/package.json`

**Step 1: Run full verification**

Run:
- `node --experimental-strip-types --test ./src/lib/runtime-config.test.ts`
- `npm run test:supabase:init`
- `npm run lint`
- `npm run build`

Expected: all commands pass

**Step 2: Update docs**

Document:
- Docker build and run
- `init` container usage
- initialization screen meanings
- runtime variables vs init variables

**Step 3: Commit**

```bash
git add README.md app .dockerignore Dockerfile docker docker-compose.yml docs/plans/2026-04-22-docker-runtime-init-design.md docs/plans/2026-04-22-docker-runtime-init.md
git commit -m "feat: add docker runtime init flow"
```
