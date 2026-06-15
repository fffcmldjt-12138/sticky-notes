# Mixed Order, Folder Actions, Time Picker, And Markdown Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mixed item/folder ordering, complete folder management, scrollable time selection, Markdown-aware copying, and a verified clean shutdown path.

**Architecture:** Introduce a shared ordered-node representation derived from flat item and folder data, and persist reorder operations transactionally in `NoteStore`. Keep folder actions behind IPC. Keep time selection and Markdown clipboard conversion inside focused renderer components. Treat shutdown as a separate main-process lifecycle problem with repeatable tests and packaged-process verification.

**Tech Stack:** Electron, React, TypeScript, TipTap/ProseMirror, dnd-kit, Vitest, Testing Library.

---

### Task 1: Unified Ordered Nodes

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/main/ipc/folderIpc.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/lib/folderTree.ts`
- Test: `tests/folderStore.test.ts`
- Test: `tests/folderTree.test.ts`

- [ ] Add failing tests for note, todo, and folder mixed ordering in the root and nested folders.
- [ ] Add a single reorder operation accepting `{ kind, id }[]` and a parent folder ID.
- [ ] Normalize sibling orders to `0..n-1` after moves and reorder operations.
- [ ] Build folder trees with one `children` array containing typed item and folder nodes.
- [ ] Run focused store and tree tests.

### Task 2: Mixed Drag And Drop

**Files:**
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/components/StickyCard.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Test: `tests/folderPanel.test.tsx`

- [ ] Add failing tests for mixed rendering order and moving a child to its parent.
- [ ] Render a unified ordered list in root and folder contents.
- [ ] Add drop targets between siblings for reordering.
- [ ] Add an explicit parent-level drop zone at the top of expanded folders.
- [ ] Persist every successful drop through the reorder IPC and update local state.
- [ ] Run panel tests.

### Task 3: Folder Context Menu And Delete Promotion

**Files:**
- Create: `src/renderer/src/components/FolderContextMenu.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/main/ipc/folderIpc.ts`
- Modify: `src/shared/electronApi.ts`
- Test: `tests/folderStore.test.ts`
- Test: `tests/folderPanel.test.tsx`

- [ ] Add failing store tests proving folder deletion promotes direct items and child folders to the parent in stable order.
- [ ] Add folder rename and delete IPC.
- [ ] Add right-click menu with rename and delete.
- [ ] Confirm delete before invoking it and refresh items/folders after completion.
- [ ] Replace the boxed toggle with a rotating chevron.
- [ ] Run folder tests.

### Task 4: Scrollable Time Picker

**Files:**
- Create: `src/renderer/src/components/DateTimePicker.tsx`
- Modify: `src/renderer/src/components/ReminderPopover.tsx`
- Modify: `src/renderer/src/components/DeadlinePopover.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Test: `tests/dateTimePicker.test.tsx`
- Test: `tests/todoEditor.test.tsx`

- [ ] Add failing tests for hour/minute wheel changes and explicit confirm/cancel.
- [ ] Implement date, hour, and five-minute increment columns with wheel handling.
- [ ] Keep picker changes local until the picker confirm action.
- [ ] Keep popover changes local until outer save.
- [ ] Run picker and todo tests.

### Task 5: Copy Selected Markdown

**Files:**
- Create: `src/renderer/src/lib/markdownClipboard.ts`
- Modify: `src/renderer/src/components/MarkdownEditor.tsx`
- Test: `tests/markdownClipboard.test.ts`
- Test: `tests/markdownEditor.test.tsx`

- [ ] Add failing tests converting selected ProseMirror slices to Markdown.
- [ ] Intercept `Ctrl+C` only for a non-empty editor selection.
- [ ] Write Markdown to `text/plain` and selected HTML to `text/html`.
- [ ] Preserve default copy behavior when the selection is empty.
- [ ] Run Markdown tests.

### Task 6: Shutdown Investigation And Fix

**Files:**
- Modify: `src/main/services/WindowService.ts`
- Modify: `src/main/services/DetachedWindowService.ts`
- Modify: `src/main/services/TrayService.ts`
- Modify: `src/main/main.ts`
- Modify: `scripts/smoke.cjs`
- Test: `tests/windowService.test.ts`
- Test: `tests/detachedWindow.test.ts`

- [ ] Add failing tests for repeated shutdown calls and no persistence callbacks after shutdown begins.
- [ ] Route tray exit only through `app.quit()`.
- [ ] Make shutdown services idempotent and cancel all timers before destroying windows.
- [ ] Add a packaged quit smoke mode that starts, requests app quit, and checks exit code/stderr.
- [ ] Run lifecycle tests and repeat packaged quit at least ten times.

### Task 7: Release Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run smoke`.
- [ ] Build the Windows installer.
- [ ] Run packaged startup and repeated packaged quit checks.
