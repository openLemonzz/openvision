# Generation Progress Track Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make backend capacity polling visually silent after first confirmation and replace generic generate-state feedback with a fixed five-stage generation progress track.

**Architecture:** Keep backend capacity as the source of truth, but decouple background polling from visible loading language. Introduce a single frontend progress-track mapper that combines capacity confirmation, submit lifecycle, and latest generation status into stable UI stages.

**Tech Stack:** React 19, TypeScript, Vite, node:test

---

### Task 1: Progress Track Logic

**Files:**
- Modify: `web/src/lib/utils.ts`
- Test: `web/src/lib/generation-ui.test.ts`

**Step 1: Write the failing test**

Cover:
- initial capacity check keeps stage 1 unresolved and the button unavailable
- later background polling does not visibly regress an already confirmed ready state
- `pending`, `generating`, `completed`, and `failed` map to the expected five-stage progress track

**Step 2: Run test to verify it fails**

Run: `cd web && node --experimental-strip-types --test ./src/lib/generation-ui.test.ts`
Expected: FAIL because the current helpers do not model the full five-stage track

**Step 3: Write minimal implementation**

Add:
- a pure progress-track state helper
- a pure button-availability helper that distinguishes initial unresolved state from silent background polling
- stable status labels for the five track stages

**Step 4: Run test to verify it passes**

Run: `cd web && node --experimental-strip-types --test ./src/lib/generation-ui.test.ts`
Expected: PASS

### Task 2: Hook State Shaping

**Files:**
- Modify: `web/src/hooks/useGeneration.ts`

**Step 1: Refine the frontend state contract**

Update:
- first-capacity-confirmed state
- submit-in-flight / task-created state
- derived latest-generation lifecycle for the track

**Step 2: Make 5-second polling silent**

Ensure:
- polling still updates internal availability
- already confirmed ready state does not force visible sync language
- submit flow still relocks immediately after click

**Step 3: Verify the hook compiles**

Run: `cd web && npm run build`
Expected: PASS or fail only in downstream component props that still need updating

### Task 3: Generate Console UI

**Files:**
- Modify: `web/src/components/GenerateConsole.tsx`
- Modify: `web/src/pages/Home.tsx`

**Step 1: Replace generic loading copy**

Remove:
- user-facing repeated `状态同步中...` during steady-state 5-second polling

**Step 2: Render the five-stage progress track**

Add:
- fixed stage list
- one-by-one fill behavior
- failure styling on the last stage when generation fails
- small auxiliary hint for concurrency blocking without resetting the track

**Step 3: Verify the UI compiles**

Run: `cd web && npm run build`
Expected: PASS

### Task 4: Final Verification

**Files:**
- Verify only

**Step 1: Run frontend logic tests**

Run: `cd web && node --experimental-strip-types --test ./src/lib/generation-ui.test.ts`

**Step 2: Run web build**

Run: `cd web && npm run build`
