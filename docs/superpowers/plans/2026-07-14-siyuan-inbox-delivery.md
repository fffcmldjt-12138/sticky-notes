# SiYuan Inbox Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user send one completed note, including its local images and Markdown links, into the root of the SiYuan `00 收件箱` notebook without implementing synchronization.

**Architecture:** The renderer only triggers typed IPC calls. The Electron main process owns credentials, reads the latest persisted note and local images, calls the SiYuan kernel API, rewrites uploaded image URLs, creates a new Markdown document, and records the latest successful delivery on the note. Re-sending changed content creates a new document rather than overwriting SiYuan content.

**Tech Stack:** Electron, TypeScript, React, Vitest, SiYuan kernel HTTP API, Electron `safeStorage`.

---

### Task 1: Persist delivery metadata

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/noteMigration.ts`
- Modify: `src/main/services/storageValidators.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/main/services/DataArchiveService.ts`
- Test: `tests/noteMigration.test.ts`
- Test: `tests/noteStore.test.ts`
- Test: `tests/storageValidators.test.ts`

- [ ] Write failing tests for migrating v5 notes to v6 and recording a delivery without overwriting note content.
- [ ] Run the focused tests and verify the expected failures.
- [ ] Add `SiyuanDelivery`, replace the unused sync placeholder, migrate v5 to v6, validate it, and add a dedicated store mutation.
- [ ] Update archive metadata to notes version 6 and run focused persistence/archive tests.

### Task 2: Implement the SiYuan API and delivery pipeline

**Files:**
- Create: `src/main/services/SiyuanClient.ts`
- Create: `src/main/services/SiyuanCredentialStore.ts`
- Create: `src/main/services/SiyuanDeliveryService.ts`
- Modify: `src/main/services/AssetService.ts`
- Test: `tests/siyuanClient.test.ts`
- Test: `tests/siyuanCredentialStore.test.ts`
- Test: `tests/siyuanDeliveryService.test.ts`
- Test: `tests/assetService.test.ts`

- [ ] Write failing tests for connection discovery, asset upload mapping, Markdown rewriting, duplicate-click coalescing, unchanged-content suppression, changed-content re-send, and missing-image errors.
- [ ] Run the tests and verify they fail because the services do not exist.
- [ ] Implement the minimal typed client and encrypted credential store.
- [ ] Implement delivery: snapshot note, upload each referenced image once, rewrite URLs, create a unique inbox document, then persist delivery metadata.
- [ ] Run focused service tests until green.

### Task 3: Expose settings and send actions through IPC

**Files:**
- Create: `src/main/ipc/siyuanIpc.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/main.ts`
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/ConfigStore.ts`
- Modify: `src/main/services/storageValidators.ts`
- Test: `tests/siyuanIpc.test.ts`
- Test: `tests/preloadDataApi.test.ts`
- Test: `tests/configStore.test.ts`

- [ ] Write failing IPC, preload, and config tests.
- [ ] Run them and verify expected failures.
- [ ] Add endpoint/inbox settings, connection testing, token updates, and note-send IPC handlers.
- [ ] Register the service graph in the main process and run focused tests.

### Task 4: Add the lightweight UI

**Files:**
- Create: `src/renderer/src/pages/SiyuanSettingsPanel.tsx`
- Create: `src/renderer/src/components/SiyuanDeliveryButton.tsx`
- Modify: `src/renderer/src/pages/SettingsPanel.tsx`
- Modify: `src/renderer/src/components/NoteEditor.tsx`
- Modify: `src/renderer/src/components/NoteCard.tsx`
- Modify: `src/renderer/src/components/CardContextMenu.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Modify: `src/renderer/src/styles/global.css`
- Modify: `src/renderer/src/styles/note-card.css`
- Test: `tests/siyuanSettingsPanel.test.tsx`
- Test: `tests/siyuanDeliveryButton.test.tsx`
- Test: `tests/cardActions.test.tsx`

- [ ] Write failing tests for settings, sending after autosave, note-only menu visibility, and sent/changed status.
- [ ] Run the tests and verify expected failures.
- [ ] Implement compact settings and send controls without changing detached-window density.
- [ ] Run focused renderer tests until green.

### Task 5: Verify and package

**Files:**
- Modify only if verification exposes a defect.

- [ ] Run `rtk npm test`.
- [ ] Run `rtk npm run typecheck`.
- [ ] Run `rtk npm run build`.
- [ ] Run `rtk npm run smoke`.
- [ ] Review `git diff --check` and the final diff for scope.

