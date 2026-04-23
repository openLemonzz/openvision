# Homepage Intro Transition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first-visit-only sci-fi loading transition that fades into the homepage and types out the main slogan.

**Architecture:** Keep initialization gating in `App`, but hold a styled overlay above the homepage during the intro handoff. Move replay rules and typewriter math into a small browser-safe utility so the stateful UI code stays minimal and testable.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, node:test

---

### Task 1: Intro Utility

**Files:**
- Create: `web/src/lib/home-intro.ts`
- Test: `web/src/lib/home-intro.test.ts`

**Step 1: Write the failing test**

Cover:
- intro plays when no storage flag exists
- intro is skipped after the flag is written
- typewriter text respects delay and reveals characters progressively

**Step 2: Run test to verify it fails**

Run: `cd web && node --experimental-strip-types --test ./src/lib/home-intro.test.ts`

**Step 3: Write minimal implementation**

Add:
- intro storage key helpers
- safe read/write helpers for browser storage
- a pure typewriter text helper

**Step 4: Run test to verify it passes**

Run: `cd web && node --experimental-strip-types --test ./src/lib/home-intro.test.ts`

### Task 2: Overlay State

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/InitializationScreen.tsx`

**Step 1: Add first-visit intro orchestration**

Track:
- whether intro should play from local storage
- whether the overlay is exiting
- when to mount homepage behind the overlay

**Step 2: Keep loading behavior intact**

Continue showing retry/status when init is not ready.

**Step 3: Add smooth exit timing**

On first successful ready state:
- mark intro as seen
- briefly hold the overlay
- fade it out over the homepage

### Task 3: Homepage Hero Motion

**Files:**
- Modify: `web/src/pages/Home.tsx`
- Modify: `web/src/index.css`

**Step 1: Add hero intro props**

Let `Home` know whether it should run the first-view animation.

**Step 2: Implement slogan typewriter**

Use the pure helper to reveal `影境 · 从数据洪流中按下快门` after a short delay.

**Step 3: Sharpen typography**

Increase slogan size and contrast and make the `VISION` wordmark crisper.

### Task 4: Verification

**Files:**
- Verify only

**Step 1: Run focused test**

Run: `cd web && node --experimental-strip-types --test ./src/lib/home-intro.test.ts`

**Step 2: Run build**

Run: `cd web && npm run build`
