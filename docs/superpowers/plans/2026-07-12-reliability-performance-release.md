# Reliability, Performance, and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair data recovery, reminders, renderer loading, folder synchronization, and publish a verified Windows release.

**Architecture:** Keep file ownership and system integration in Electron's main process, expose narrow events through preload, and keep renderer state synchronized from those events. Split only heavyweight renderer components so the common panel path stays responsive.

**Tech Stack:** Electron, TypeScript, React, Vite, Vitest, electron-builder, GitHub Actions

---

### Task 1: Recover damaged notes safely

**Files:**
- Modify: `src/main/services/NoteStore.ts`
- Test: `tests/noteStore.test.ts`

- [ ] Add tests proving malformed JSON is backed up and replaced with version 4.
- [ ] Run `rtk npm test -- tests/noteStore.test.ts` and confirm the new test fails.
- [ ] Implement recovery without overwriting valid unknown schema versions.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Make reminders single-flight and actionable

**Files:**
- Modify: `src/main/services/ReminderService.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/services/WindowService.ts`
- Test: `tests/reminderService.test.ts`
- Test: `tests/windowService.test.ts`

- [ ] Add a deferred-store test proving concurrent `check()` calls share one run.
- [ ] Add a test proving reminder activation shows the panel and targets the todo.
- [ ] Run focused tests and confirm the expected failures.
- [ ] Add a `checkInFlight` promise and clear it in `finally`.
- [ ] Route notification click and reminder broadcasts through a main-process show/open method.
- [ ] Re-run focused tests.

### Task 3: Synchronize folder lifecycle state

**Files:**
- Modify: `src/main/services/FolderWindowService.ts`
- Modify: `src/main/ipc/folderIpc.ts`
- Modify: `src/main/main.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/renderer/src/App.tsx`
- Test: `tests/folderWindow.test.ts`
- Test: `tests/folderIpc.test.ts`

- [ ] Add failing tests for folder updates emitted after detach and close.
- [ ] Add a folder-changed IPC event and preload subscription.
- [ ] Update panel folder state from events.
- [ ] Re-run focused tests.

### Task 4: Split the heavy editor bundle

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DetachedEditor.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Test: `tests/appLazyLoading.test.tsx`

- [ ] Add a source-level or component test proving NoteEditor is loaded lazily.
- [ ] Convert heavy editors and secondary settings UI to `React.lazy` with compact Suspense fallbacks.
- [ ] Run component tests and production build.
- [ ] Compare generated chunk sizes and confirm Tiptap is outside the initial renderer chunk.

### Task 5: Verify, package, and publish

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Run `rtk npm test`, `rtk npm run typecheck`, `rtk npm run build`, and `rtk npm run smoke`.
- [ ] Increment the patch version and run `rtk npm run dist -- --publish never`.
- [ ] Launch or inspect the packaged application and verify the installer artifact exists.
- [ ] Review the complete diff, stage intended files, and commit.
- [ ] Push the branch, create and push `v<version>`, then verify the GitHub Release contains the installer.
