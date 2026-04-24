# Generation Business Code Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `gen_`-prefixed business generation code for all generation records, backfill old data, and make both generation and image identifiers clickable/copyable in the UI.

**Architecture:** Preserve the existing UUID primary key for internal behavior and routing, while introducing a separate unique `generation_code` field for user-facing display. Expose the new field through generation APIs and add lightweight copy interactions wherever `generationCode` and `pictureId` are shown.

**Tech Stack:** TypeScript, Express, PostgreSQL, Supabase, React 19, Vite, node:test

---

### Task 1: Schema And Backfill

**Files:**
- Modify: `supabase/schema.sql`

**Step 1: Add the new field**

Add:
- `generation_code text`
- uniqueness enforcement

**Step 2: Backfill existing rows**

Write:
- SQL that fills `generation_code` only for rows where it is null
- values in the format `gen_<timestamp>_<suffix>`

**Step 3: Verify schema remains re-runnable**

Ensure:
- `npm run db:apply` can be re-executed safely without duplicating or breaking existing rows

### Task 2: Backend API Contract

**Files:**
- Modify: `admin/server/app.ts`
- Modify: `admin/src/lib/types.ts`
- Test: `admin/tests/server-api.test.ts`

**Step 1: Write the failing test**

Cover:
- user generation payload includes `generationCode`
- admin generation payload includes `generationCode`

**Step 2: Run test to verify it fails**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`

**Step 3: Write minimal implementation**

Add:
- `generationCode` mapping in generation row serialization
- generation code creation when a new generation row is inserted

**Step 4: Run test to verify it passes**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`

### Task 3: Frontend Display And Copy

**Files:**
- Modify: `web/src/hooks/useGeneration.ts`
- Modify: `web/src/components/HistoryStream.tsx`
- Modify: `web/src/pages/console/ConsoleGenerations.tsx`
- Modify: `web/src/pages/Gallery.tsx`
- Modify: `admin/src/pages/admin/AdminGenerations.tsx`

**Step 1: Update generation record types**

Add:
- `generationCode` to the shared/frontend/admin generation record shapes

**Step 2: Render both codes**

Add:
- `gen: {generationCode}`
- `pic: {pictureId}`

**Step 3: Add click-to-copy**

Implement:
- copy only the clicked identifier
- lightweight visual feedback

**Step 4: Verify the UI compiles**

Run: `cd web && npm run build`
Run: `cd admin && npm run build`

### Task 4: Final Verification

**Files:**
- Verify only

**Step 1: Run backend tests**

Run: `cd admin && node --import tsx --test ./tests/server-api.test.ts`

**Step 2: Run frontend build**

Run: `cd web && npm run build`

**Step 3: Run admin build**

Run: `cd admin && npm run build`

**Step 4: Reapply schema**

Run: `npm run db:apply`
