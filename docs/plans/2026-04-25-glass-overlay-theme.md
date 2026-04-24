# Glass Overlay Theme Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply a unified translucent glass material to delete-confirmation dialogs and overflow menus across frontend and admin generation flows.

**Architecture:** Update overlay/menu primitives first so pages inherit the material language automatically, then add only minimal page-level fixes if a specific usage needs tuning. This keeps the glass theme consistent and avoids maintaining separate visual rules per page.

**Tech Stack:** React 19, TypeScript, existing Radix-based UI primitives, Vite

---

### Task 1: Dropdown Menu Glass Theme

**Files:**
- Modify: `web/src/components/ui/dropdown-menu.tsx`
- Modify: any matching admin primitive only if needed

**Step 1: Update the shared menu surface**

Add:
- translucent dark background
- backdrop blur
- low-contrast border
- softer shadow

**Step 2: Update menu-item interaction states**

Adjust:
- hover and focus to feel like glass brightening
- separators to match the glass material

**Step 3: Verify frontend/admin compile**

Run:
- `cd web && npm run build`
- `cd admin && npm run build`

### Task 2: Alert Dialog Glass Theme

**Files:**
- Modify: `web/src/components/ui/alert-dialog.tsx`
- Modify: any matching admin primitive only if needed

**Step 1: Restyle the dialog shell**

Adjust:
- smaller max width
- glass background
- blur
- refined padding and spacing

**Step 2: Restyle the action buttons**

Keep:
- clear destructive semantics

But change:
- buttons to match the glass design language instead of default solid styles

**Step 3: Verify compile**

Run:
- `cd web && npm run build`
- `cd admin && npm run build`

### Task 3: Page-Level Integration Checks

**Files:**
- Modify only if necessary:
  - frontend generation cards
  - admin generation page

**Step 1: Check menu/dialog layering**

Ensure:
- overlays appear above image hover layers
- dialog spacing still looks correct in context

**Step 2: Apply minimal local tweaks if needed**

Avoid:
- creating a second visual system at page level

### Task 4: Final Verification

**Files:**
- Verify only

**Step 1: Run web build**

Run: `cd web && npm run build`

**Step 2: Run admin build**

Run: `cd admin && npm run build`

**Step 3: Rebuild running containers if implementation proceeds**

Run:
- `docker compose up -d --build web admin`
