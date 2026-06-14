# Interaction Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicate creation, simplify todo input, and make detached windows close and drag naturally.

**Architecture:** Keep persistence and IPC unchanged. Move renderer list writes through a shared upsert helper, create items directly from the create menu, render todo task strings with native inputs, and distinguish panel navigation from detached-window closure through editor props and CSS classes.

**Tech Stack:** Electron, React, TypeScript, Vitest, Testing Library.

---

### Task 1: Creation State

**Files:**
- Create: `src/renderer/src/lib/itemList.ts`
- Modify: `src/renderer/src/App.tsx`
- Test: `tests/itemList.test.ts`

- [ ] Write a failing test proving that inserting the same item twice produces one list entry.
- [ ] Run `npm test -- tests/itemList.test.ts` and verify the helper is missing.
- [ ] Add `upsertItem(items, changed)` and use it for both IPC broadcasts and create responses.
- [ ] Change create-menu actions to call `createItem(type)` directly, without `TitleDialog`.
- [ ] Run the focused test and commit.

### Task 2: Plain Todo Inputs

**Files:**
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Modify: `tests/todoEditor.test.tsx`

- [ ] Change the existing test to require two plain task text inputs and no Markdown editors.
- [ ] Run `npm test -- tests/todoEditor.test.tsx` and verify it fails against the current editor.
- [ ] Replace `MarkdownEditor` with a controlled single-line input that updates `contentMarkdown`.
- [ ] Adjust task-row layout styles and run the focused test.

### Task 3: Detached Close And Drag

**Files:**
- Modify: `src/renderer/src/components/NoteEditor.tsx`
- Modify: `src/renderer/src/components/TodoEditor.tsx`
- Modify: `src/renderer/src/pages/DetachedEditor.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Test: `tests/detachedEditor.test.tsx`

- [ ] Add failing tests requiring a close button in detached mode and a draggable editor header class.
- [ ] Run `npm test -- tests/detachedEditor.test.tsx` and verify failure.
- [ ] Add an editor `detached` presentation flag, render close instead of back, and keep delete separate.
- [ ] Mark detached headers draggable while preserving interactive controls as non-draggable.
- [ ] Run focused tests and commit.

### Task 4: Full Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run smoke`.
- [ ] Bump the patch version, package the Windows installer, and smoke-test the packaged executable.
- [ ] Commit release metadata and confirm a clean worktree.
