# Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local data writes recoverable, add versioned backups and complete ZIP import/export, and expose safe data-management controls without introducing a database.

**Architecture:** Replace permissive JSON fallback behavior with a validated `SafeJsonStore`, backed by a focused `BackupService`. `NoteStore` and `ConfigStore` remain domain owners, while a new `DataArchiveService` and IPC layer handle user-initiated backup, restore, import, export, and data-directory actions in the main process.

**Tech Stack:** Electron, TypeScript, Node.js filesystem APIs, React, Vitest, `archiver`, `unzipper`

---

### Task 1: Notes schema version 5 and revision migration

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/noteMigration.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `tests/noteMigration.test.ts`
- Modify: `tests/noteStore.test.ts`

- [ ] **Step 1: Write failing migration tests**

Add assertions that every migrated item and folder has `revision: 1`, version 4 migrates to 5, and newly created entities start at revision 1:

```ts
it('migrates version 4 entities to revisioned version 5', () => {
  const result = migrateNotesFile(version4Fixture)
  expect(result.version).toBe(5)
  expect(result.items[0].revision).toBe(1)
  expect(result.folders[0].revision).toBe(1)
})
```

- [ ] **Step 2: Run tests and verify the schema test fails**

Run: `rtk npm test -- tests/noteMigration.test.ts tests/noteStore.test.ts`

Expected: FAIL because `revision` and notes version 5 do not exist.

- [ ] **Step 3: Add revision fields and version 5 migration**

Change the shared types and migration entry point:

```ts
export interface BaseItem {
  revision: number
  // existing fields
}

export interface FolderItem {
  revision: number
  // existing fields
}

export interface NotesFile {
  version: 5
  items: StickyItem[]
  folders: FolderItem[]
}
```

Normalize every entity with:

```ts
revision: Number.isInteger(entity.revision) && entity.revision > 0
  ? entity.revision
  : 1
```

Update `NoteStore` defaults and creation methods to write version 5 and revision 1. Do not increment revisions yet; that belongs to the stability plan.

- [ ] **Step 4: Run migration and store tests**

Run: `rtk npm test -- tests/noteMigration.test.ts tests/noteStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/shared/models.ts src/main/services/noteMigration.ts src/main/services/NoteStore.ts tests/noteMigration.test.ts tests/noteStore.test.ts
rtk git commit -m "feat: migrate notes data to revisioned version 5"
```

### Task 2: Validated and serialized JSON persistence

**Files:**
- Create: `src/main/services/SafeJsonStore.ts`
- Create: `tests/safeJsonStore.test.ts`

- [ ] **Step 1: Write failing persistence tests**

Cover serialized writes, temporary-file validation, missing-file defaults, and preserving a corrupt formal file:

```ts
it('serializes overlapping writes in invocation order', async () => {
  const store = createStore()
  await Promise.all([store.write({ value: 1 }), store.write({ value: 2 })])
  expect(await store.read()).toEqual({ value: 2 })
})

it('does not replace the formal file when validation fails', async () => {
  await expect(store.write({ value: -1 })).rejects.toThrow('invalid')
  expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ value: 1 })
})
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `rtk npm test -- tests/safeJsonStore.test.ts`

Expected: FAIL because `SafeJsonStore` does not exist.

- [ ] **Step 3: Implement `SafeJsonStore`**

Use a validator and per-instance promise queue:

```ts
export class SafeJsonStore<T> {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    readonly filePath: string,
    private readonly createDefault: () => T,
    private readonly validate: (value: unknown) => T,
    private readonly beforeReplace?: (
      currentPath: string,
      currentValue: T
    ) => Promise<void>
  ) {}

  write(value: T): Promise<void> {
    const operation = this.writeQueue.then(() => this.writeNow(value))
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }
}
```

`writeNow` must create a uniquely named temporary file in the same directory, write formatted JSON, read it back, call `validate`, invoke `beforeReplace` only when the formal file exists, then rename the temporary file. Always remove the temporary file in `finally` when it still exists. `read` may create a default only for `ENOENT`; parse or validation failures must be thrown unchanged.

- [ ] **Step 4: Run persistence tests**

Run: `rtk npm test -- tests/safeJsonStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/main/services/SafeJsonStore.ts tests/safeJsonStore.test.ts
rtk git commit -m "feat: add validated serialized JSON storage"
```

### Task 3: Rolling backups and startup recovery

**Files:**
- Create: `src/main/services/BackupService.ts`
- Create: `tests/backupService.test.ts`
- Modify: `src/main/services/SafeJsonStore.ts`

- [ ] **Step 1: Write failing backup tests**

Test 20 change snapshots, 30 daily snapshots, five config snapshots, seven-day protected copies, newest-valid recovery, and ignoring temporary files:

```ts
it('recovers the newest valid notes backup', async () => {
  await backups.recordSnapshot('notes', validOlder)
  await backups.recordSnapshot('notes', invalidNewer)
  expect(await backups.findNewestValid('notes', validateNotes)).toEqual(validOlder)
})
```

- [ ] **Step 2: Run the backup test and verify it fails**

Run: `rtk npm test -- tests/backupService.test.ts`

Expected: FAIL because `BackupService` does not exist.

- [ ] **Step 3: Implement backup naming, retention, and recovery selection**

Use this metadata shape:

```ts
export type BackupKind = 'change' | 'daily' | 'protected'

export interface BackupEntry {
  path: string
  source: 'notes' | 'config'
  kind: BackupKind
  createdAt: string
  size: number
}
```

Store files under `backups/<source>/<kind>/YYYY-MM-DDTHH-mm-ss-SSS.json`. Create a daily backup only when no valid daily file exists for the current local date. Sort by parsed timestamp, not filesystem enumeration order. Retain exactly the limits from the design.

- [ ] **Step 4: Integrate backup callback into `SafeJsonStore`**

Before replacing a valid formal file, call:

```ts
await backupService.beforeReplace('notes', currentPath, currentValue)
```

Backup failure is reported through an injected diagnostic callback and does not reject the formal write. Validation or formal replacement failure still rejects.

- [ ] **Step 5: Run backup and persistence tests**

Run: `rtk npm test -- tests/backupService.test.ts tests/safeJsonStore.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
rtk git add src/main/services/BackupService.ts src/main/services/SafeJsonStore.ts tests/backupService.test.ts tests/safeJsonStore.test.ts
rtk git commit -m "feat: add rolling local backups and recovery selection"
```

### Task 4: Wire safe storage into notes and config

**Files:**
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/main/services/ConfigStore.ts`
- Modify: `src/main/main.ts`
- Delete: `src/main/services/JsonFileStore.ts`
- Modify: `tests/noteStore.test.ts`
- Modify: `tests/configStore.test.ts`
- Create: `tests/startupRecovery.test.ts`

- [ ] **Step 1: Write failing recovery integration tests**

Test that corrupt notes restore from the newest valid backup, corrupt originals are preserved, and no valid backup produces a typed `DataUnavailableError` instead of overwriting files.

```ts
await expect(store.list()).rejects.toMatchObject({ code: 'DATA_UNAVAILABLE' })
expect(await pathExists(`${notesPath}.corrupt`)).toBe(true)
```

- [ ] **Step 2: Run integration tests and verify failure**

Run: `rtk npm test -- tests/startupRecovery.test.ts tests/configStore.test.ts tests/noteStore.test.ts`

Expected: FAIL because stores still use the old fallback behavior.

- [ ] **Step 3: Inject `BackupService` and validators**

Construct stores with one shared backup service:

```ts
const backups = new BackupService(join(app.getPath('userData'), 'backups'))
const notes = new NoteStore(app.getPath('userData'), backups)
const config = new ConfigStore(app.getPath('userData'), backups)
```

`NoteStore.ensureInitialized` must migrate and validate before writing version 5. On parse or validation failure, preserve the corrupt file, restore the newest valid backup, then rerun migration. Config recovery follows the same sequence with its own validator and default only when the file is absent. After both stores use `SafeJsonStore`, remove `JsonFileStore.ts`.

Add main-process-only snapshot methods for archive, recovery, and later search indexing:

```ts
getSnapshot(): Promise<NotesFile>
replaceSnapshot(value: NotesFile, reason: 'restore' | 'import'): Promise<void>
```

`getSnapshot` returns a structured clone after pending mutations finish. `replaceSnapshot` validates version 5, waits for the mutation queue, creates a protected backup, writes through `SafeJsonStore`, and never becomes part of preload IPC directly.

- [ ] **Step 4: Run integration tests**

Run: `rtk npm test -- tests/startupRecovery.test.ts tests/configStore.test.ts tests/noteStore.test.ts tests/noteMigration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/main/services/NoteStore.ts src/main/services/ConfigStore.ts src/main/main.ts tests/startupRecovery.test.ts tests/configStore.test.ts tests/noteStore.test.ts
rtk git rm src/main/services/JsonFileStore.ts
rtk git commit -m "feat: recover notes and config from valid backups"
```

### Task 5: Data archive export and secure import

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/main/services/DataArchiveService.ts`
- Create: `tests/dataArchiveService.test.ts`

- [ ] **Step 1: Install streaming ZIP dependencies**

Run:

```powershell
rtk npm install archiver unzipper
rtk npm install -D @types/archiver
```

Expected: dependencies added without audit errors that block installation.

- [ ] **Step 2: Write failing archive tests**

Cover manifest creation, attachment round trip, invalid JSON, absolute paths, `../` traversal, symlinks, and no mutation before confirmation:

```ts
await expect(service.inspectImport(traversalZip)).rejects.toThrow('不安全路径')
expect(await readFile(notesPath, 'utf8')).toBe(originalNotes)
```

- [ ] **Step 3: Run archive tests and verify failure**

Run: `rtk npm test -- tests/dataArchiveService.test.ts`

Expected: FAIL because `DataArchiveService` does not exist.

- [ ] **Step 4: Implement export, inspection, and replacement**

Use a versioned manifest:

```ts
interface DataArchiveManifest {
  format: 'sticky-notes-data'
  version: 1
  exportedAt: string
  notesVersion: 5
  itemCount: number
  folderCount: number
  assetCount: number
}
```

`inspectImport` extracts to a generated temporary directory, rejects entries whose normalized path escapes that directory or whose type is symbolic link, validates manifest and notes, then returns counts plus an opaque inspection ID. `confirmImport(id)` creates a protected backup, replaces data and assets, and deletes the temporary directory. Expire unconfirmed inspections after one hour.

- [ ] **Step 5: Run archive tests**

Run: `rtk npm test -- tests/dataArchiveService.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
rtk git add package.json package-lock.json src/main/services/DataArchiveService.ts tests/dataArchiveService.test.ts
rtk git commit -m "feat: export and securely import local data archives"
```

### Task 6: Data-management IPC and settings UI

**Files:**
- Create: `src/main/ipc/dataIpc.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/main.ts`
- Create: `src/renderer/src/pages/DataManagementPanel.tsx`
- Modify: `src/renderer/src/pages/SettingsPanel.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DetachedEditor.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Create: `tests/dataIpc.test.ts`
- Create: `tests/dataManagementPanel.test.tsx`

- [ ] **Step 1: Write failing IPC and component tests**

Assert backup listing, manual backup, restore confirmation, export dialog cancellation, import inspection counts, opening the data directory, and a full refresh callback after restore/import.

```tsx
fireEvent.click(screen.getByRole('button', { name: '立即备份' }))
await screen.findByText('备份已创建')
expect(window.stickyApi.data.createBackup).toHaveBeenCalled()
```

- [ ] **Step 2: Run tests and verify failure**

Run: `rtk npm test -- tests/dataIpc.test.ts tests/dataManagementPanel.test.tsx`

Expected: FAIL because the data API and panel do not exist.

- [ ] **Step 3: Add typed preload API and main-process handlers**

Expose only explicit methods:

```ts
data: {
  openDirectory(): Promise<void>
  createBackup(): Promise<BackupSummary>
  listBackups(): Promise<BackupSummary[]>
  restoreBackup(path: string): Promise<void>
  exportArchive(): Promise<boolean>
  inspectImport(): Promise<ImportSummary | null>
  confirmImport(inspectionId: string): Promise<void>
}
```

Define the renderer-safe summaries in `electronApi.ts`:

```ts
export interface BackupSummary {
  path: string
  kind: 'change' | 'daily' | 'protected'
  createdAt: string
  size: number
}

export interface ImportSummary {
  inspectionId: string
  itemCount: number
  folderCount: number
  assetCount: number
}
```

Use Electron `dialog` in the main process. Never pass an arbitrary renderer path into filesystem methods except a backup path returned by `listBackups`, validated against the backup root.

Add a `dataReloaded` broadcast and `onDataReloaded` preload subscription. After restore/import, the main process reloads stores, then broadcasts once; main, detached item, and detached folder windows refetch their complete snapshots. Do not rely only on the settings panel callback because other windows may be open.

- [ ] **Step 4: Build the unframed settings subpage**

`DataManagementPanel` uses full-width settings rows, a compact backup list, confirmation dialogs for restore/import, and inline success/error status. Do not nest cards. On successful restore/import call `onDataChanged`, which reloads items and folders.

- [ ] **Step 5: Run IPC and component tests**

Run: `rtk npm test -- tests/dataIpc.test.ts tests/dataManagementPanel.test.tsx tests/configStore.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
rtk git add src/main/ipc/dataIpc.ts src/shared/ipcChannels.ts src/shared/electronApi.ts src/preload/index.ts src/main/main.ts src/renderer/src/pages/DataManagementPanel.tsx src/renderer/src/pages/SettingsPanel.tsx src/renderer/src/App.tsx src/renderer/src/pages/DetachedEditor.tsx src/renderer/src/pages/DetachedFolder.tsx src/renderer/src/styles/sticky-panel.css tests/dataIpc.test.ts tests/dataManagementPanel.test.tsx
rtk git commit -m "feat: add local data management controls"
```

### Task 7: Safe unused-asset audit

**Files:**
- Modify: `src/main/services/AssetService.ts`
- Modify: `src/main/services/RecycleService.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/main/ipc/recycleIpc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/pages/DataManagementPanel.tsx`
- Modify: `tests/assetService.test.ts`
- Modify: `tests/recycleService.test.ts`

- [ ] **Step 1: Write failing audit tests**

Test that references in active notes and recoverable deleted notes are protected, files younger than seven days are protected, and the scan returns count and bytes before deletion.

```ts
expect(await service.auditUnusedAssets()).toEqual({ count: 2, bytes: 4096 })
expect(await service.cleanUnusedAssets()).toEqual({ count: 2, bytes: 4096 })
```

- [ ] **Step 2: Run asset tests and verify failure**

Run: `rtk npm test -- tests/assetService.test.ts tests/recycleService.test.ts`

Expected: FAIL because the current API deletes immediately and returns only a count.

- [ ] **Step 3: Implement audit then explicit cleanup**

Parse `asset://local/<id>.<ext>` references from note Markdown and every retained recycle item. Compare canonical filenames with the asset directory. Return `{ count, bytes }`; only delete after a separate confirmed IPC call. Keep the existing recycle-area behavior for images when applicable.

- [ ] **Step 4: Update the data panel and run tests**

Run: `rtk npm test -- tests/assetService.test.ts tests/recycleService.test.ts tests/dataManagementPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/main/services/AssetService.ts src/main/services/RecycleService.ts src/shared/electronApi.ts src/main/ipc/recycleIpc.ts src/preload/index.ts src/renderer/src/pages/DataManagementPanel.tsx tests/assetService.test.ts tests/recycleService.test.ts tests/dataManagementPanel.test.tsx
rtk git commit -m "feat: audit assets before confirmed cleanup"
```

### Task 8: Recovery notices and privacy-safe diagnostics

**Files:**
- Create: `src/main/services/DiagnosticsService.ts`
- Create: `tests/diagnosticsService.test.ts`
- Modify: `src/main/main.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DataManagementPanel.tsx`
- Create: `tests/appRecoveryNotice.test.tsx`

- [ ] **Step 1: Write failing redaction and recovery-notice tests**

Verify logs contain operation type, entity ID, revision, path category, and stack while rejecting fields named `contentMarkdown`, `title`, `tags`, or raw filesystem paths. Verify automatic recovery produces a one-time renderer notice with backup time and an Open Data Directory action. Verify no valid backup renders a read-only fault page and does not create a replacement notes file.

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/diagnosticsService.test.ts tests/appRecoveryNotice.test.tsx`

Expected: FAIL because diagnostics and recovery notices do not exist.

- [ ] **Step 3: Implement redacted diagnostic events**

```ts
export interface DiagnosticEvent {
  at: string
  operation: string
  entityId?: string
  revision?: number
  pathCategory?: 'notes' | 'config' | 'backup' | 'asset' | 'archive'
  errorName?: string
  stack?: string
}
```

Write newline-delimited JSON under `logs/diagnostics.jsonl`, rotate at 2 MB, and retain three files. Expose an export operation that creates a ZIP containing redacted logs, app/OS versions, notes counts, notes schema version, and backup summaries, never user text or attachments.

- [ ] **Step 4: Broadcast startup state and render notices**

Add a renderer-safe `StartupDataState` union with `ok`, `recovered`, and `unavailable`. The main process caches it before windows load; the renderer requests it through IPC. `recovered` shows a dismissible notice. `unavailable` replaces normal content with a fault page containing Open Data Directory and Export Diagnostics commands only.

- [ ] **Step 5: Run tests and commit**

Run: `rtk npm test -- tests/diagnosticsService.test.ts tests/appRecoveryNotice.test.tsx tests/dataManagementPanel.test.tsx`

```powershell
rtk git add src/main/services/DiagnosticsService.ts src/main/main.ts src/shared/ipcChannels.ts src/shared/electronApi.ts src/preload/index.ts src/renderer/src/App.tsx src/renderer/src/pages/DataManagementPanel.tsx tests/diagnosticsService.test.ts tests/appRecoveryNotice.test.tsx
rtk git commit -m "feat: surface recovery state and redacted diagnostics"
```

### Task 9: Data-safety release gate

**Files:**
- Modify: `README.md`
- Modify: `scripts/smoke.cjs`
- Create: `tests/fixtures/notes-v4.json`

- [ ] **Step 1: Add legacy migration and packaged smoke fixtures**

Make `scripts/smoke.cjs` accept `SMOKE_USER_DATA_FIXTURE`, copy the version 4 fixture into the temporary user data directory, launch the app, and fail on recovery/preload/renderer errors.

- [ ] **Step 2: Run the complete verification suite**

Run:

```powershell
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk npm run dist -- --publish never
rtk pwsh -NoProfile -Command '$env:SMOKE_GRACEFUL_EXIT="1"; $env:SMOKE_USER_DATA_FIXTURE="tests\fixtures\notes-v4.json"; rtk npm run smoke -- "release\win-unpacked\轻量便签.exe"'
```

Expected: all tests pass, build and installer exit 0, packaged smoke reports `gracefulExit=true`, and stderr contains no fatal renderer error.

- [ ] **Step 3: Update documentation**

Document backup location, retention, export/import behavior, recovery notice, and the fact that import is a complete replacement.

- [ ] **Step 4: Commit**

```powershell
rtk git add README.md scripts/smoke.cjs tests/fixtures/notes-v4.json
rtk git commit -m "test: verify data recovery in packaged builds"
```
