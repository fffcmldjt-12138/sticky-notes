# Sticky Notes V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the desktop panel with reliable navigation, unified cards, context actions, titled creation, multi-task Todos, immediate Markdown formatting, richer colors, and persistent detachable editing windows.

**Architecture:** Migrate persistence to a version 2 discriminated model before changing UI consumers. Keep the main process as the single source of truth, broadcasting item changes to the panel and detached windows. Use focused renderer components for cards, menus, rich Markdown editing, Todo rows, and detached-window routing.

**Tech Stack:** Electron 42, electron-vite, React 19, TypeScript, Vitest, TipTap, dnd-kit, electron-builder

---

### Task 1: Version 2 Data Model And Migration

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/JsonFileStore.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/main/services/ReminderService.ts`
- Create: `src/main/services/noteMigration.ts`
- Modify: `tests/noteStore.test.ts`
- Modify: `tests/reminderService.test.ts`
- Create: `tests/noteMigration.test.ts`

- [ ] **Step 1: Write migration tests**

Add fixtures for a version 1 Note and Todo. Assert that migration:

```ts
expect(result.version).toBe(2)
expect(result.items[0]).toMatchObject({
  headerColor: '#f2c94c',
  detached: false,
  windowBounds: null
})
expect(result.items[1]).toMatchObject({
  type: 'todo',
  tasks: [{
    contentMarkdown: '- [ ] legacy task',
    completed: false,
    remindAt: '2026-06-14T20:00:00.000Z',
    reminded: false
  }]
})
```

Also assert that the original file is copied to
`notes.json.backup-<timestamp>` before the migrated file is written.

- [ ] **Step 2: Verify migration tests fail**

Run:

```powershell
npm test -- tests/noteMigration.test.ts
```

Expected: failure because version 2 types and `migrateNotesFile` do not exist.

- [ ] **Step 3: Define version 2 contracts**

Replace header color enums with validated hex strings and define:

```ts
interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

interface TodoTask {
  id: string
  contentMarkdown: string
  completed: boolean
  remindAt: string | null
  reminded: boolean
}
```

Add `detached` and `windowBounds` to the base item. Replace Todo-level
completion and reminder fields with `tasks: TodoTask[]`. Set `NotesFile.version`
to `2`.

- [ ] **Step 4: Implement migration and backup**

Implement `migrateNotesFile(value)` as a pure function. Map legacy colors:

```ts
const legacyColors = {
  yellow: '#f2c94c',
  blue: '#5b8def',
  green: '#55b985',
  pink: '#e783a8'
}
```

Teach `NoteStore` to inspect raw JSON, back up a version 1 file, migrate once,
and reject unsupported versions without clearing data.

- [ ] **Step 5: Update CRUD and reminder tests**

Change Todo creation assertions to expect `tasks: []`. Add store operations for:

```ts
addTodoTask(todoId, contentMarkdown)
updateTodoTask(todoId, taskId, patch)
deleteTodoTask(todoId, taskId)
reorderTodoTasks(todoId, orderedTaskIds)
```

Update reminder tests to prove only due incomplete tasks notify and only the
matching task receives `reminded: true`.

- [ ] **Step 6: Implement minimal store and reminder behavior**

Keep all changes inside the existing mutation queue. Reset `reminded` only when
that task's `remindAt` changes.

- [ ] **Step 7: Run domain verification**

Run:

```powershell
npm test -- tests/noteMigration.test.ts tests/noteStore.test.ts tests/reminderService.test.ts
npm run typecheck
```

Expected: all tests and type checks pass.

- [ ] **Step 8: Commit**

```powershell
git add src/shared/models.ts src/main/services tests
git commit -m "feat: migrate notes to v2 data model"
```

### Task 2: Navigation Fixes, Unified Cards, Named Creation, And Context Menu

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/SettingsPanel.tsx`
- Create: `src/renderer/src/components/StickyCard.tsx`
- Modify: `src/renderer/src/components/NoteCard.tsx`
- Modify: `src/renderer/src/components/TodoCard.tsx`
- Create: `src/renderer/src/components/CardContextMenu.tsx`
- Create: `src/renderer/src/components/TitleDialog.tsx`
- Modify: `src/renderer/src/components/CreateMenu.tsx`
- Modify: `src/renderer/src/components/HeaderColorPicker.tsx`
- Modify: `src/renderer/src/styles/global.css`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Modify: `src/renderer/src/styles/note-card.css`
- Create: `tests/cardActions.test.tsx`

- [ ] **Step 1: Add renderer test configuration and failing interaction tests**

Use jsdom for `tests/**/*.test.tsx`. Test that:

```tsx
fireEvent.click(screen.getByRole('button', { name: '返回' }))
expect(onBack).toHaveBeenCalled()
```

Test Note and Todo cards render the same `.sticky-card-header` structure. Test
right-click opens actions and Escape closes them. Test cancelling the title
dialog does not call create.

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm test -- tests/cardActions.test.tsx
```

Expected: failure because shared card, context menu, and title dialog are absent.

- [ ] **Step 3: Fix draggable regions**

Apply `-webkit-app-region: no-drag` to every interactive element within
`.panel-header` and `.editor-header`. Keep drag behavior only on empty header
space.

- [ ] **Step 4: Introduce one shared card shell**

`StickyCard` owns the outer element, header, body, pointer handlers, and context
menu anchor. Note and Todo cards provide only type-specific body content.

- [ ] **Step 5: Add named creation**

Opening either create action shows `TitleDialog`. Trim the title, reject empty
input, and pass the title into `notes.create(type, title)`.

- [ ] **Step 6: Add context actions**

Implement edit, rename, color, theme, delete, detach, and Todo add-task actions.
Close on outside pointer and Escape. Confirm card and task deletion.

- [ ] **Step 7: Expand color selection**

Render 12 preset hex colors, `<input type="color">`, and up to six recent
colors. Store recent colors in `config.json` via `recentHeaderColors`.

- [ ] **Step 8: Verify**

Run:

```powershell
npm test -- tests/cardActions.test.tsx
npm run typecheck
```

Expected: interaction tests and type checks pass.

- [ ] **Step 9: Commit**

```powershell
git add src/renderer src/shared tests package.json
git commit -m "feat: unify cards and add context actions"
```

### Task 3: Immediate Markdown Editor

**Files:**
- Modify: `package.json`
- Create: `src/renderer/src/components/MarkdownToolbar.tsx`
- Replace: `src/renderer/src/components/MarkdownEditor.tsx`
- Modify: `src/renderer/src/components/NoteEditor.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Create: `tests/markdownEditor.test.tsx`

- [ ] **Step 1: Install editor dependencies**

Install:

```powershell
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link tiptap-markdown
```

- [ ] **Step 2: Write failing editor tests**

Test toolbar visibility, Markdown initialization, and serialization:

```tsx
render(<MarkdownEditor value="## Heading" onChange={onChange} />)
expect(screen.getByRole('toolbar')).toBeVisible()
expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading')
```

Test heading, bullet list, blockquote, and fenced-code input rules with
TipTap commands rather than browser key simulation where jsdom is unreliable.

- [ ] **Step 3: Verify tests fail**

Run:

```powershell
npm test -- tests/markdownEditor.test.tsx
```

Expected: old textarea editor has no toolbar or immediate formatting.

- [ ] **Step 4: Implement TipTap editor**

Configure StarterKit, Link, and Markdown. Initialize from Markdown and emit
Markdown on updates. The toolbar permanently exposes heading levels, bold,
italic, strike, lists, quote, code, link, undo, and redo.

- [ ] **Step 5: Remove preview mode**

Replace the edit/preview switch in Note editor with the single immediate
formatting editor. Keep 500ms persistence debounce at the item editor level.

- [ ] **Step 6: Verify**

Run:

```powershell
npm test -- tests/markdownEditor.test.tsx
npm run typecheck
```

Expected: toolbar, parse, serialize, and input-rule tests pass.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json src/renderer tests
git commit -m "feat: add immediate markdown editing"
```

### Task 4: Multi-Task Todo Editor

**Files:**
- Modify: `package.json`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/main/ipc/noteIpc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/components/TodoEditor.tsx`
- Create: `src/renderer/src/components/TodoTaskRow.tsx`
- Modify: `src/renderer/src/components/TodoCard.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Create: `tests/todoEditor.test.tsx`

- [ ] **Step 1: Install drag sorting dependencies**

```powershell
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Write failing Todo editor tests**

Test add, complete, independent reminder, delete confirmation, and reorder:

```ts
expect(onUpdateTask).toHaveBeenCalledWith('task-2', {
  remindAt: expectedIso,
  reminded: false
})
```

Assert updating task 2 does not submit task 1 fields.

- [ ] **Step 3: Verify tests fail**

Run:

```powershell
npm test -- tests/todoEditor.test.tsx
```

Expected: old editor has one Todo-level checkbox and reminder.

- [ ] **Step 4: Extend typed IPC**

Expose add, update, delete, and reorder task calls from preload to NoteStore.
Broadcast the returned updated Todo after each mutation.

- [ ] **Step 5: Build task rows**

Each row contains drag handle, checkbox, compact TipTap Markdown editor,
datetime-local input, and delete button. Keep each task's reminder independent.

- [ ] **Step 6: Update Todo card summary**

Display task count, completion progress, up to three task rows, and nearest
incomplete reminder. Keep the shared card header unchanged.

- [ ] **Step 7: Verify**

Run:

```powershell
npm test -- tests/todoEditor.test.tsx tests/noteStore.test.ts tests/reminderService.test.ts
npm run typecheck
```

Expected: all Todo interaction and domain tests pass.

- [ ] **Step 8: Commit**

```powershell
git add package.json package-lock.json src tests
git commit -m "feat: support multi-task todo cards"
```

### Task 5: Detached Persistent Windows And Cross-Window Sync

**Files:**
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/main/services/WindowService.ts`
- Create: `src/main/services/DetachedWindowService.ts`
- Modify: `src/main/ipc/windowIpc.ts`
- Modify: `src/main/ipc/noteIpc.ts`
- Modify: `src/main/main.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/pages/DetachedEditor.tsx`
- Create: `tests/detachedWindow.test.ts`

- [ ] **Step 1: Write failing bounds and lifecycle tests**

Use injected window and display adapters. Test:

```ts
await service.detach(item)
await service.detach(item)
expect(factory.create).toHaveBeenCalledTimes(1)
expect(existing.focus).toHaveBeenCalled()
```

Test off-screen bounds are moved into the nearest work area. Test closing
updates `detached: false` without deleting the item.

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm test -- tests/detachedWindow.test.ts
```

Expected: `DetachedWindowService` does not exist.

- [ ] **Step 3: Implement window registry**

Maintain `Map<itemId, BrowserWindow>`. Create a frameless always-on-top,
resizable window loading `index.html?mode=detached&id=<itemId>`. Debounce move
and resize events and persist bounds through NoteStore.

- [ ] **Step 4: Implement safe restore and close**

At startup, restore all `detached` items. Clamp saved bounds into a current
display work area. On close, persist `detached: false`; during application quit,
preserve `detached: true` so windows restore next launch.

- [ ] **Step 5: Add cross-window broadcasts**

After every item mutation, send `notes:item-changed` to the panel and all
detached windows. Send `notes:item-deleted` before closing a deleted item's
window.

- [ ] **Step 6: Add renderer routing and drag detach**

Route query-string detached mode to `DetachedEditor`. In the main panel, start
card dragging after a pointer threshold. If release occurs outside panel
bounds, call detach; otherwise leave state unchanged. Keep context-menu detach
as the reliable alternative.

- [ ] **Step 7: Verify**

Run:

```powershell
npm test -- tests/detachedWindow.test.ts
npm run typecheck
```

Expected: registry, restore, bounds, close, and duplicate-detach tests pass.

- [ ] **Step 8: Commit**

```powershell
git add src tests
git commit -m "feat: add persistent detached note windows"
```

### Task 6: Full Regression, Packaging, And Windows Acceptance

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Test: `tests/**/*.test.ts`

- [ ] **Step 1: Run full automated verification**

```powershell
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: zero failures and zero whitespace errors.

- [ ] **Step 2: Perform Windows interaction acceptance**

Run `npm run dev` and verify:

1. Settings and editor back buttons work.
2. Note and Todo headers align exactly.
3. New Note/Todo title dialog works.
4. Right-click actions work.
5. Markdown toolbar remains visible and `## ` converts to heading.
6. Todo tasks independently complete, remind, delete, and reorder.
7. Preset and free colors persist.
8. Card drag and context action create one detached window.
9. Main and detached edits synchronize.
10. Closing and restarting restores detached windows.

- [ ] **Step 3: Test migration using a disposable user-data directory**

Launch with:

```powershell
release\win-unpacked\轻量便签.exe --user-data-dir="$env:TEMP\sticky-notes-v2-test"
```

Seed a version 1 `notes.json`, verify version 2 output and backup, then delete
the disposable directory.

- [ ] **Step 4: Package installer**

Increment the patch version and run:

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
npm run dist
```

Expected: a new `release/StickyNotes-<version>-Setup.exe`.

- [ ] **Step 5: Install and smoke test**

Uninstall the previous version, install the new NSIS package into the fixed
default local-app directory, launch it, and verify the process remains alive
for at least eight seconds with empty stderr.

- [ ] **Step 6: Update documentation and commit**

Document the v2 data migration, multi-task Todo model, immediate Markdown
editor, context menu, and detached-window behavior.

```powershell
git add README.md package.json package-lock.json tests
git commit -m "release: prepare sticky notes v2"
```
