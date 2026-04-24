# Frontend Action Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify workshop, console, and gallery generation interactions by improving left-column readability, standardizing image actions, adding overflow menus, routing image-edit back to the workshop, and requiring delete confirmation.

**Architecture:** Reuse the current generation-card structure and existing UI primitives instead of introducing a broad new shared component system. Standardize action placement and destructive flows while adding a lightweight workshop edit hand-off mechanism.

**Tech Stack:** React 19, TypeScript, Vite, existing UI primitives

---

### Task 1: Console Exit Affordance

**Files:**
- Modify: `web/src/pages/console/ConsoleLayout.tsx`

**Step 1: Replace the top-left console brand affordance**

Make:
- the primary top-left affordance read `返回工坊`

**Step 2: Remove redundant duplicate exit affordance**

Adjust:
- the sidebar bottom `返回工坊` entry if it becomes repetitive

**Step 3: Verify the page compiles**

Run: `cd web && npm run build`

### Task 2: Left Column Readability

**Files:**
- Modify: `web/src/components/HistoryStream.tsx`
- Modify: `web/src/pages/console/ConsoleGenerations.tsx`

**Step 1: Reorder the left-column content**

Use:
- ratio / time
- engine / strength
- copyable `gen:` / `pic:`
- five-stage progress track
- prompt text

**Step 2: Keep homepage and console aligned**

Ensure:
- both views keep the same ordering and spacing model

### Task 3: Overflow Action Menu

**Files:**
- Modify: `web/src/components/HistoryStream.tsx`
- Modify: `web/src/pages/console/ConsoleGenerations.tsx`
- Modify: `web/src/pages/Gallery.tsx`

**Step 1: Add the `...` trigger**

Place:
- in the image panel top-right action area

**Step 2: Add menu items**

Implement:
- `下载`
- `复制图片链接`
- `改图`

**Step 3: Keep quick actions coherent**

Ensure:
- workshop main image actions visually match generation history actions

### Task 4: Image Edit Hand-Off

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/Home.tsx`
- Modify: `web/src/components/GenerateConsole.tsx`
- Modify: any local state/helper files needed for passing the reference image

**Step 1: Add edit-mode navigation payload**

Carry:
- image URL
- prompt text when available

**Step 2: Restore into workshop state**

Ensure:
- workshop opens with the reference image already loaded
- edit mode is visually distinct from plain prompt generation

### Task 5: Delete Confirmation

**Files:**
- Modify: `web/src/components/HistoryStream.tsx`
- Modify: `web/src/pages/console/ConsoleGenerations.tsx`
- Modify: `web/src/pages/Gallery.tsx`

**Step 1: Wrap delete actions in confirmation**

Use:
- a single confirmation pattern based on the existing alert dialog primitives

**Step 2: Apply everywhere consistently**

Cover:
- workshop main record
- console generation records
- gallery records

### Task 6: Final Verification

**Files:**
- Verify only

**Step 1: Run frontend logic tests**

Run: `cd web && node --experimental-strip-types --test ./src/lib/generation-ui.test.ts`

**Step 2: Run web build**

Run: `cd web && npm run build`

**Step 3: Rebuild the running web container**

Run: `docker compose up -d --build web`
