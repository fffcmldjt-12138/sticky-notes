# Todo Completion, Strong Reminder, Drag, and Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consistent parent/subtask completion, persistent strong reminders, visible custom reminder controls, outside-panel drag behavior, and Markdown H1-H5 support.

**Architecture:** Completion and snooze invariants live in `NoteStore` and `ReminderService`; Electron main owns the system notification and dedicated reminder window; renderer components only express user intent through IPC. Tree dragging derives a single inside/outside state that controls both the overlay and insertion feedback.

**Tech Stack:** Electron, TypeScript, React, Tiptap, dnd-kit, Vite, Vitest, electron-builder

---

### Task 1: Enforce parent/subtask completion

**Files:**
- Modify: `src/main/services/NoteStore.ts`
- Modify: `tests/noteStore.test.ts`

- [ ] Add a failing test where completing the final child completes its parent.
- [ ] Add a failing test where reopening one child reopens its parent.
- [ ] Add a failing test where toggling a parent applies the state to all children.
- [ ] Run `rtk npm test -- tests/noteStore.test.ts` and confirm the new assertions fail.
- [ ] Normalize completion in `updateTodoTask` and `updateTodoSubtask`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Check subtasks from the main card

**Files:**
- Modify: `src/renderer/src/components/TodoCard.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Modify: `tests/todoCard.test.tsx`

- [ ] Add a failing component test for visible child checkboxes and callback IDs.
- [ ] Extend the card callback to identify task and subtask.
- [ ] Route child updates through `updateTodoSubtask` and update local item state.
- [ ] Style child rows as compact subordinate checklist entries.
- [ ] Re-run focused card and app tests.

### Task 3: Persist snooze and identify reminders

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/ReminderService.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `tests/reminderService.test.ts`
- Modify: `tests/noteStore.test.ts`

- [ ] Add a failing test proving a snoozed reminder fires at its absolute snooze time.
- [ ] Add a failing test proving reminder payloads contain the reminder ID.
- [ ] Extend `TaskReminder` with optional `snoozedUntil` and clear it after delivery or schedule changes.
- [ ] Re-run focused service/store tests.

### Task 4: Add the dedicated strong reminder window

**Files:**
- Create: `src/main/services/ReminderWindowService.ts`
- Create: `src/renderer/src/pages/ReminderWindow.tsx`
- Modify: `src/main/services/ReminderPresentationService.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/ipc/noteIpc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Create: `tests/reminderWindowService.test.ts`
- Modify: `tests/reminderPresentationService.test.ts`

- [ ] Add failing service tests for one-at-a-time queueing, acknowledge, open, and 5/10/30-minute snooze.
- [ ] Create a centered always-on-top BrowserWindow with taskbar flashing.
- [ ] Send reminder payloads and actions over narrow IPC channels.
- [ ] Persist snooze through the store before closing the reminder window.
- [ ] Keep Windows `Notification` for its default sound and Notification Center entry.
- [ ] Re-run reminder service, presentation, renderer, and IPC tests.

### Task 5: Make custom reminders visible and editable

**Files:**
- Modify: `src/renderer/src/components/TaskSchedulePopover.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Modify: `tests/taskSchedulePopover.test.tsx`

- [ ] Add failing tests for a visible custom reminder chip, removal, duplicate feedback, and invalid feedback.
- [ ] Render selected reminders as removable chips sorted by offset.
- [ ] Show inline feedback and keep custom controls within narrow windows.
- [ ] Re-run the popover tests.

### Task 6: Suppress panel sorting feedback outside the application

**Files:**
- Modify: `src/renderer/src/components/TreeDndContext.tsx`
- Modify: `src/renderer/src/components/TreeDragOverlay.tsx`
- Modify: `src/renderer/src/components/TreeDropSlot.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Modify: `tests/treeDrag.test.tsx`

- [ ] Add a failing drag test that crosses the viewport and hides the internal overlay/drop feedback.
- [ ] Track pointer position in `onDragMove` and expose an outside class/state.
- [ ] Disable internal insertion gaps and overlay while outside, preserving the native preview.
- [ ] Restore insertion feedback if the pointer re-enters before drop.
- [ ] Re-run drag tests.

### Task 7: Add Markdown H3-H5

**Files:**
- Modify: `src/renderer/src/components/MarkdownToolbar.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Modify: `tests/markdownToolbar.test.tsx`

- [ ] Add failing tests for heading levels 3, 4, and 5.
- [ ] Add compact H3-H5 toolbar controls using Tiptap `toggleHeading`.
- [ ] Ensure the toolbar remains horizontally usable in narrow windows.
- [ ] Re-run toolbar and Markdown clipboard tests.

### Task 8: Verify and release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Run `rtk npm test`, `rtk npm run typecheck`, `rtk npm run build`, and `rtk npm run smoke`.
- [ ] Increment the patch version and run `rtk npm run dist -- --publish never`.
- [ ] Run the packaged executable through `scripts/smoke.cjs` and confirm no preload or renderer errors.
- [ ] Review and commit the complete diff.
- [ ] Push the branch and release tag, then verify the GitHub Release contains the installer.
