# V3 Organization And Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable media-rich note editing, task deadlines, three-level folders, tags, and a seven-day recycle bin.

**Architecture:** Migrate `notes.json` to a flat version-3 model containing items and folders. Keep filesystem, notifications, local media, and recycle cleanup in the Electron main process behind IPC. Keep renderer state normalized by IDs and render folders as a derived tree.

**Tech Stack:** Electron, React, TypeScript, TipTap, JSON files, Vitest, Testing Library, dnd-kit.

---

## Phase 1: Editor Reliability, Links, Images, Numbering, Tags

### Task 1: Version 3 Item Migration

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/noteMigration.ts`
- Modify: `src/main/services/NoteStore.ts`
- Test: `tests/noteMigration.test.ts`

- [ ] Add a failing migration test requiring version 2 items to receive
  `parentFolderId`, `tags`, `order`, and `deletedAt`.
- [ ] Run `npm test -- tests/noteMigration.test.ts` and verify failure.
- [ ] Add version-3 types and normalize version-2 data into the new fields.
- [ ] Preserve existing IDs, Markdown, tasks, colors, window bounds, and dates.
- [ ] Run focused migration and store tests.

### Task 2: Stable Editor State And Scrolling

**Files:**
- Modify: `src/renderer/src/components/MarkdownEditor.tsx`
- Modify: `src/renderer/src/components/NoteEditor.tsx`
- Modify: `src/renderer/src/components/TodoEditor.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Test: `tests/markdownEditor.test.tsx`
- Test: `tests/detachedEditor.test.tsx`

- [ ] Add failing tests proving equal external values do not call
  `setContent`, and the colored header renders plain title text.
- [ ] Run the focused tests and verify failure.
- [ ] Track the latest local Markdown in a ref and only replace editor content
  when an actually different remote value arrives.
- [ ] Move editable title and compact color control below the draggable header.
- [ ] Apply `min-height: 0` through the editor layout and make only the content
  viewport scroll.
- [ ] Run focused tests.

### Task 3: External Links And Multilevel Numbering

**Files:**
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/windowIpc.ts`
- Modify: `src/renderer/src/components/MarkdownEditor.tsx`
- Modify: `src/renderer/src/components/MarkdownToolbar.tsx`
- Test: `tests/markdownEditor.test.tsx`

- [ ] Add failing tests for URL autolinking, external-link IPC, and a separate
  multilevel numbered-list toolbar command.
- [ ] Add `shell.openExternal` behind a validated HTTP/HTTPS IPC handler.
- [ ] Enable Link autolinking and route Ctrl-click link activation through IPC.
- [ ] Add a multilevel numbering command that creates or sinks an ordered list
  item without changing normal bullet-list behavior.
- [ ] Run focused tests and type checking.

### Task 4: Local Image Assets

**Files:**
- Create: `src/main/services/AssetService.ts`
- Create: `src/main/ipc/assetIpc.ts`
- Modify: `src/main/main.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/components/MarkdownEditor.tsx`
- Modify: `src/renderer/src/components/MarkdownToolbar.tsx`
- Test: `tests/assetService.test.ts`

- [ ] Add failing tests for copying an image into the asset directory with a
  generated stable filename.
- [ ] Add validated image MIME/extension handling and an `asset://` protocol.
- [ ] Add IPC for selecting an image and importing clipboard/drop files.
- [ ] Add TipTap image support and toolbar selection, paste, and drop handlers.
- [ ] Store Markdown references as `asset://<asset-id>`.
- [ ] Run asset and editor tests.

### Task 5: Tags

**Files:**
- Create: `src/shared/tags.ts`
- Create: `src/renderer/src/components/TagEditor.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/NoteEditor.tsx`
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Test: `tests/tags.test.ts`

- [ ] Add failing tests extracting unique normalized hashtags from Markdown
  and plain task text.
- [ ] Implement tag extraction without treating Markdown headings as tags.
- [ ] Add manual item tags and merge them with extracted content tags.
- [ ] Add clickable panel tag filters.
- [ ] Run tag, editor, and panel tests.

## Phase 2: Todo Deadlines And Multiple Advance Reminders

### Task 6: Deadline Data And Migration

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/noteMigration.ts`
- Modify: `src/main/services/NoteStore.ts`
- Test: `tests/noteMigration.test.ts`
- Test: `tests/noteStore.test.ts`

- [ ] Add failing tests requiring task `deadlineAt`,
  `deadlineReminders`, and `tags`.
- [ ] Normalize existing tasks with empty deadline values.
- [ ] Reset delivered deadline reminders when the deadline or offsets change.
- [ ] Run migration and store tests.

### Task 7: Deadline Reminder Scheduler

**Files:**
- Modify: `src/main/services/ReminderService.ts`
- Test: `tests/reminderService.test.ts`

- [ ] Add failing tests for several offsets on one deadline, completed-task
  suppression, and no duplicate delivery.
- [ ] Trigger reminders at `deadlineAt - offsetMinutes`.
- [ ] Persist delivery timestamps independently for each selected offset.
- [ ] Run reminder tests.

### Task 8: Todo Deadline Interface

**Files:**
- Create: `src/renderer/src/components/DeadlineReminderPicker.tsx`
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Modify: `src/renderer/src/components/TodoCard.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Test: `tests/todoEditor.test.tsx`

- [ ] Add failing tests for DDL input, preset multi-select, custom offsets, and
  approaching/overdue state classes.
- [ ] Render ordinary reminder and DDL separately.
- [ ] Add 3-day, 1-day, 6-hour presets and custom minute/hour/day offsets.
- [ ] Add neutral, approaching, and overdue visual states.
- [ ] Run todo tests.

## Phase 3: Folders, Recycle Bin, And Asset Cleanup

### Task 9: Folder Store And Depth Validation

**Files:**
- Create: `src/main/services/FolderStore.ts`
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/main/services/noteMigration.ts`
- Test: `tests/folderStore.test.ts`

- [ ] Add failing tests for create, rename, collapse, move, reorder, and
  maximum depth three.
- [ ] Store folders flat and validate ancestor chains before moves.
- [ ] Add item parent-folder and order updates.
- [ ] Run folder and migration tests.

### Task 10: Folder IPC And Panel Tree

**Files:**
- Create: `src/main/ipc/folderIpc.ts`
- Create: `src/renderer/src/components/FolderCard.tsx`
- Create: `src/renderer/src/lib/folderTree.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/main.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Test: `tests/folderTree.test.ts`

- [ ] Add failing tree tests for three levels, descendant counts, and title-only
  child item rendering.
- [ ] Add folder CRUD/move IPC.
- [ ] Render root items and folders as a tree.
- [ ] Add drag/drop for item/folder movement and visible invalid-depth errors.
- [ ] Run tree and interaction tests.

### Task 11: Recycle Bin

**Files:**
- Create: `src/main/services/RecycleService.ts`
- Create: `src/main/ipc/recycleIpc.ts`
- Create: `src/renderer/src/pages/RecycleBinPanel.tsx`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/renderer/src/pages/SettingsPanel.tsx`
- Modify: `src/shared/electronApi.ts`
- Test: `tests/recycleService.test.ts`

- [ ] Add failing tests for soft delete, restore, seven-day expiration, and
  empty recycle bin.
- [ ] Replace hard item deletion with `deletedAt`.
- [ ] Exclude deleted items from normal lists and include them in recycle IPC.
- [ ] Add settings recycle-bin view, restore, and empty actions.
- [ ] Run recycle and existing delete tests.

### Task 12: Asset Reference Cleanup

**Files:**
- Modify: `src/main/services/AssetService.ts`
- Modify: `src/main/services/RecycleService.ts`
- Modify: `src/renderer/src/pages/SettingsPanel.tsx`
- Test: `tests/assetService.test.ts`

- [ ] Add failing tests proving shared assets remain and unreferenced assets
  enter the asset recycle directory.
- [ ] Scan active and recycled Markdown references.
- [ ] Restore assets with restored notes and purge expired asset trash.
- [ ] Add "clean unused images" in settings.
- [ ] Run asset and recycle tests.

### Task 13: Release Verification

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run smoke`.
- [ ] Package the Windows installer and smoke-test `release/win-unpacked`.
- [ ] Commit release metadata and confirm a clean worktree.
