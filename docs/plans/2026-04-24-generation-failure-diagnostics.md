# Generation Failure Diagnostics And Capacity Polling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist admin-only failure diagnostics for generation records, add admin image zoom, and make generate availability backend-authoritative with a 5-second polling loop.

**Architecture:** Extend `public.generations` with structured failure text fields and record diagnostics at every backend failure exit. Add a dedicated `/api/my/generation-capacity` endpoint so the web client can lock the generate button until the backend confirms availability, instead of inferring availability from local history timing.

**Tech Stack:** React 19, TypeScript, Express, PostgreSQL, Supabase, Vite, node:test

---

### Task 1: Generation Failure Fields And API Contract

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `admin/server/app.ts`
- Modify: `admin/src/lib/types.ts`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Cover:
- `GET /api/generations` returns `errorMessage` and `errorDetails`
- `GET /api/my/generations` does not expose those fields

**Step 2: Run test to verify it fails**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`
Expected: FAIL because the generation payload does not include admin-only diagnostics yet

**Step 3: Write minimal implementation**

Add:
- `error_message` and `error_details` columns to `public.generations`
- response mapping for admin generation rows
- user-facing generation payload remains unchanged

**Step 4: Run test to verify it passes**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`
Expected: PASS for the new generation payload assertions

### Task 2: Persist Detailed Failure Diagnostics

**Files:**
- Modify: `admin/server/app.ts`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Cover:
- upstream non-2xx response stores a concise summary and detailed diagnostic text
- non-upstream failures such as missing image payload also store diagnostic text

**Step 2: Run test to verify it fails**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`
Expected: FAIL because failed rows currently only change status

**Step 3: Write minimal implementation**

Add:
- normalized helper to truncate diagnostic text
- `markGenerationFailed(id, userId, errorMessage, errorDetails)`
- capture of upstream status plus response text when available
- capture of internal exception text for other failure paths

**Step 4: Run test to verify it passes**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`
Expected: PASS for failure-diagnostic persistence

### Task 3: Backend Capacity Endpoint

**Files:**
- Modify: `admin/server/app.ts`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Cover:
- `GET /api/my/generation-capacity` returns `concurrencyLimit`, `activeGenerationCount`, `canGenerate`, and `reason`
- response says `canGenerate = false` when `pending/generating` count reaches the limit

**Step 2: Run test to verify it fails**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`
Expected: FAIL because the endpoint does not exist

**Step 3: Write minimal implementation**

Add:
- shared helper to read the user's `concurrency_limit`
- shared helper to count active `pending/generating` jobs
- `/api/my/generation-capacity` route using those helpers

**Step 4: Run test to verify it passes**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`
Expected: PASS for the capacity endpoint coverage

### Task 4: Admin Generation Diagnostics And Image Zoom

**Files:**
- Modify: `admin/src/lib/types.ts`
- Modify: `admin/src/pages/admin/AdminGenerations.tsx`

**Step 1: Add the missing admin state**

Update:
- admin generation record type with `errorMessage` and `errorDetails`
- local UI state for selected lightbox image
- local UI state for expanded failure details

**Step 2: Implement the UI minimally**

Add:
- clickable thumbnail preview for successful images
- fullscreen lightbox for image inspection
- inline failure summary for failed rows
- expandable detailed diagnostics block for failed rows

**Step 3: Verify the admin UI compiles**

Run: `cd admin && npm run build`
Expected: PASS

### Task 5: Web Capacity Polling And Locked Generate Button

**Files:**
- Modify: `web/src/hooks/useGeneration.ts`
- Modify: `web/src/components/GenerateConsole.tsx`
- Test: `web/src/lib/generation-ui.test.ts`

**Step 1: Write the failing test**

Cover:
- generate availability is unknown on first load, so the button must stay locked
- a backend capacity result unlocks the button only when `canGenerate = true`
- submit action immediately returns the client to a locked state

**Step 2: Run test to verify it fails**

Run: `cd web && node --experimental-strip-types --test ./src/lib/generation-ui.test.ts`
Expected: FAIL because the current logic still relies on local history timing

**Step 3: Write minimal implementation**

Add:
- capacity polling state inside `useGeneration`
- initial locked state before the first capacity response
- 5-second polling loop for `/api/my/generation-capacity`
- immediate relock after submit starts
- button labels that reflect syncing/locked state

**Step 4: Run test to verify it passes**

Run: `cd web && node --experimental-strip-types --test ./src/lib/generation-ui.test.ts`
Expected: PASS

### Task 6: Final Verification

**Files:**
- Verify only

**Step 1: Run backend tests**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`

**Step 2: Run admin server build**

Run: `cd admin && npm run build:server`

**Step 3: Run admin client build**

Run: `cd admin && npm run build`

**Step 4: Run web behavior test**

Run: `cd web && node --experimental-strip-types --test ./src/lib/generation-ui.test.ts`

**Step 5: Run web build**

Run: `cd web && npm run build`
