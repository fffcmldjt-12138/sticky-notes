# Todo Settings Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify each todo row and move reminder and deadline controls into button-anchored popovers.

**Architecture:** Keep `TodoTaskRow` responsible for row state and selection of the active popover. Extract reminder and deadline draft forms into focused components that only emit patches when the user saves or clears. Reuse the existing task data and update callbacks without changing main-process persistence or scheduling.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS.

---

### Task 1: Reminder Popover

**Files:**
- Create: `src/renderer/src/components/ReminderPopover.tsx`
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Test: `tests/todoEditor.test.tsx`

- [ ] Add a failing test proving reminder inputs are absent initially and appear after clicking “提醒”.
- [ ] Add tests for save, clear, cancel, outside click, and `Escape`.
- [ ] Implement a local reminder draft and emit `{ remindAt, reminded: false }` only on save or clear.
- [ ] Run `npm test -- tests/todoEditor.test.tsx`.

### Task 2: Deadline Popover

**Files:**
- Create: `src/renderer/src/components/DeadlinePopover.tsx`
- Modify: `src/renderer/src/components/DeadlineReminderPicker.tsx`
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Test: `tests/todoEditor.test.tsx`

- [ ] Add a failing test proving DDL controls are absent initially and appear after clicking “DDL”.
- [ ] Add tests for deadline save, reminder preset selection, clear, cancel, outside click, and `Escape`.
- [ ] Keep deadline and reminder changes in local draft state until save.
- [ ] Ensure opening one popover closes the other.
- [ ] Run `npm test -- tests/todoEditor.test.tsx`.

### Task 3: Compact Row Styling

**Files:**
- Modify: `src/renderer/src/styles/note-card.css`
- Test: `tests/todoEditor.test.tsx`

- [ ] Add assertions for the dedicated large checkbox class and exactly two settings buttons per task.
- [ ] Align drag handle, checkbox, input, and delete button in one row.
- [ ] Place the two settings buttons below the input and style active summaries.
- [ ] Position popovers next to their trigger without increasing row height.
- [ ] Run focused tests and type checking.

### Task 4: Release Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run smoke`.
- [ ] Build and launch-check the Windows package.
