# Generation History Layout Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify homepage and console generation card layout, move the progress track into each card’s left metadata panel, and move image actions into the image panel’s top-right corner.

**Architecture:** Keep the existing two-column card layout but standardize both frontend views on one interaction model. Reuse the pure progress-track mapping logic, then render it per record in the metadata column while letting each page provide its own top-right image actions.

**Tech Stack:** React 19, TypeScript, Vite, node:test

---

### Task 1: Record-Level Progress Mapping

**Files:**
- Modify: `web/src/hooks/useGeneration.ts`
- Modify: `web/src/lib/utils.ts`

**Step 1: Refine the record lifecycle mapping**

Add:
- a clear record-level phase mapping for optimistic requesting placeholders and persisted statuses
- a helper or derived value that card components can use directly

**Step 2: Keep button-level availability separate**

Ensure:
- the generate button keeps only availability state
- per-record progress no longer depends on button placement

**Step 3: Verify the web app still compiles**

Run: `cd web && npm run build`
Expected: PASS or fail only where card props still need updating

### Task 2: Homepage Card Layout

**Files:**
- Modify: `web/src/components/HistoryStream.tsx`

**Step 1: Replace the old metadata-side lifecycle bar**

Add:
- the five-stage progress track in the left panel for every record

**Step 2: Move image actions to the top-right overlay**

Use:
- `放大 / 重混 / 删除` for completed homepage cards
- `删除` only for non-complete homepage cards

**Step 3: Keep card structure stable across statuses**

Ensure:
- pending, generating, completed, and failed all share the same layout skeleton

### Task 3: Console Card Layout

**Files:**
- Modify: `web/src/pages/console/ConsoleGenerations.tsx`

**Step 1: Match the homepage card structure**

Add:
- the same left metadata panel structure
- the same per-record progress track placement

**Step 2: Match the top-right image action placement**

Use:
- `放大 / 收藏 / 删除` for completed console cards
- `删除` only for non-complete console cards

**Step 3: Keep console-specific behavior intact**

Ensure:
- favorite toggling still works
- lightbox still works

### Task 4: Final Verification

**Files:**
- Verify only

**Step 1: Run frontend logic tests**

Run: `cd web && node --experimental-strip-types --test ./src/lib/generation-ui.test.ts`

**Step 2: Run web build**

Run: `cd web && npm run build`

**Step 3: Rebuild the running web container**

Run: `docker compose up -d --build web`
