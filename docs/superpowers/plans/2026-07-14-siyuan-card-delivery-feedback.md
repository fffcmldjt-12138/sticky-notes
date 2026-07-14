# SiYuan Card Delivery Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace context-menu SiYuan delivery with a note-title action and visible success or failure feedback.

**Architecture:** `StickyCard` exposes an optional header action slot, while `NoteCard` renders the note-only delivery control. `StickyPanel` forwards delivery to `App`, which owns the existing IPC call, item update, and one-at-a-time toast state.

**Tech Stack:** React, TypeScript, Electron IPC, Vitest, Testing Library, CSS.

---

### Task 1: Card Header Delivery Action

**Files:**
- Modify: `src/renderer/src/components/StickyCard.tsx`
- Modify: `src/renderer/src/components/NoteCard.tsx`
- Modify: `src/renderer/src/components/CardContextMenu.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Test: `tests/cardActions.test.tsx`

- [ ] **Step 1: Write failing tests**

Test that a note card exposes a delivery button beside its title, its click does not invoke `onOpen`, and the item context menu no longer contains `发送到思源`.

- [ ] **Step 2: Verify the tests fail**

Run: `rtk npm test -- tests/cardActions.test.tsx`

Expected: FAIL because `NoteCard` has no header delivery action and the context menu still contains the old entry.

- [ ] **Step 3: Implement the header action**

Add `headerAction?: React.ReactNode` to `StickyCard`, render it after the title button, add `onSend(): Promise<void>` to `NoteCard`, and forward it through `StickyPanel`. Reuse `SiyuanDeliveryButton` in a compact card mode and remove the context-menu action and branch.

- [ ] **Step 4: Verify the focused tests pass**

Run: `rtk npm test -- tests/cardActions.test.tsx tests/siyuanDeliveryButton.test.tsx`

Expected: PASS.

### Task 2: Panel Feedback Toast

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Modify: `src/renderer/src/styles/note-card.css`
- Test: `tests/appCreation.test.tsx`

- [ ] **Step 1: Write failing success and failure tests**

Mock `stickyApi.siyuan.sendNote`, click the note-card delivery button, and assert that success renders `已发送到思源：<title>` while rejection renders `发送失败：<reason>` and leaves the button enabled for retry.

- [ ] **Step 2: Verify the tests fail**

Run: `rtk npm test -- tests/appCreation.test.tsx`

Expected: FAIL because the panel has no delivery callback or toast.

- [ ] **Step 3: Implement feedback state**

Add a single `{ kind, message }` feedback state to `App`, replace it on every result, clear it after three seconds, and render an accessible fixed-position toast. On success, update the returned note in `items`; on failure, show the concrete error without an alert or unhandled rejection.

- [ ] **Step 4: Verify focused behavior**

Run: `rtk npm test -- tests/appCreation.test.tsx tests/cardActions.test.tsx`

Expected: PASS.

### Task 3: Regression Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk npm run smoke
rtk git diff --check
```

Expected: every command exits with code 0.
