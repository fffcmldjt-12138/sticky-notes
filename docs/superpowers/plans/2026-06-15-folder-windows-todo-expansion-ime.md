# Folder Windows, Todo Expansion, and IME Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add detachable persistent folder windows, restore item detaching from folder rows, persist main-panel todo expansion, and make task text input safe for Chinese IME.

**Architecture:** Keep item windows in `DetachedWindowService` and add a parallel `FolderWindowService` with folder-specific persistence and rendering. Additive fields are normalized into existing version 3 data. Renderer drag behavior shares one outside-boundary helper, while task composition is isolated in a small controlled input component.

**Tech Stack:** Electron, React 19, TypeScript, Vite, Vitest, Testing Library, dnd-kit

---

### Task 1: Add persistent folder and todo presentation fields

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/noteMigration.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `tests/noteMigration.test.ts`
- Modify: `tests/folderStore.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Add expectations that an existing version 3 todo receives `panelExpanded: false` and an existing folder receives:

```ts
{
  detached: false,
  windowBounds: null
}
```

Add a store test that `updateFolder(folder.id, { detached: true, windowBounds })` persists both values.

- [ ] **Step 2: Run tests and verify the additive fields are missing**

Run:

```powershell
npx vitest run tests/noteMigration.test.ts tests/folderStore.test.ts
```

Expected: FAIL because `TodoItem`, `FolderItem`, and normalization do not yet provide the new fields.

- [ ] **Step 3: Extend the shared types**

Add:

```ts
export interface TodoItem extends BaseItem {
  type: 'todo'
  tasks: TodoTask[]
  panelExpanded: boolean
}

export interface FolderItem {
  // existing fields
  detached: boolean
  windowBounds: WindowBounds | null
}
```

Extend `FolderPatch` with `'detached' | 'windowBounds'` and `StickyItemPatch` with `'panelExpanded'`.

- [ ] **Step 4: Normalize and create defaults**

In `noteMigration.ts`, normalize missing fields:

```ts
panelExpanded: item.type === 'todo' ? Boolean(item.panelExpanded) : undefined
```

Normalize folders with:

```ts
detached: Boolean(folder.detached),
windowBounds: folder.windowBounds ?? null
```

In `NoteStore.create`, give todos `panelExpanded: false`. In `createFolder`, give folders `detached: false` and `windowBounds: null`.

- [ ] **Step 5: Run focused tests and typecheck**

```powershell
npx vitest run tests/noteMigration.test.ts tests/folderStore.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/shared/models.ts src/main/services/noteMigration.ts src/main/services/NoteStore.ts tests/noteMigration.test.ts tests/folderStore.test.ts
git commit -m "feat: persist folder windows and todo expansion"
```

### Task 2: Restore detach behavior for folder contents

**Files:**
- Create: `src/renderer/src/lib/dragBoundary.ts`
- Create: `tests/dragBoundary.test.ts`
- Modify: `src/renderer/src/components/StickyCard.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `tests/folderPanel.test.tsx`

- [ ] **Step 1: Write failing boundary and folder-row tests**

Test:

```ts
expect(endedOutsidePanel(-1, 20, 360, 800)).toBe(true)
expect(endedOutsidePanel(120, 200, 360, 800)).toBe(false)
```

Render a folder containing a note, fire `dragEnd` on the folder item title with an outside coordinate, and expect `onDetachItem(note)` once.

- [ ] **Step 2: Run tests and verify missing behavior**

```powershell
npx vitest run tests/dragBoundary.test.ts tests/folderPanel.test.tsx
```

Expected: FAIL because the helper and detach callback do not exist.

- [ ] **Step 3: Add the shared boundary helper**

Implement:

```ts
export function endedOutsidePanel(
  clientX: number,
  clientY: number,
  width: number,
  height: number
): boolean {
  return clientX <= 0 || clientY <= 0 || clientX >= width || clientY >= height
}
```

Use it in `StickyCard`.

- [ ] **Step 4: Wire item and folder drag completion**

Extend `FolderCard` props:

```ts
onDetachItem(item: StickyItem): void
onDetachFolder(folder: FolderTreeNode): void
```

On folder item title `dragEnd`, call `onDetachItem(item)` only when outside. On folder title `dragEnd`, call `onDetachFolder(node)` only when outside. Pass callbacks recursively and through `StickyPanel`.

In `App.tsx`, item detach calls existing:

```ts
window.stickyApi.window.detach(item.id)
```

Folder detach will call the IPC introduced in Task 4.

- [ ] **Step 5: Run focused tests**

```powershell
npx vitest run tests/dragBoundary.test.ts tests/folderPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/renderer/src/lib/dragBoundary.ts src/renderer/src/components/StickyCard.tsx src/renderer/src/components/FolderCard.tsx src/renderer/src/pages/StickyPanel.tsx src/renderer/src/App.tsx tests/dragBoundary.test.ts tests/folderPanel.test.tsx
git commit -m "fix: detach items dragged from folders"
```

### Task 3: Implement the folder window service

**Files:**
- Create: `src/main/services/FolderWindowService.ts`
- Create: `tests/folderWindow.test.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/ipc/windowIpc.ts`
- Modify: `src/main/ipc/noteIpc.ts`
- Modify: `src/main/ipc/folderIpc.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Write failing service tests**

Model tests after `tests/detachedWindow.test.ts`:

- first detach creates one window and stores `{ detached: true, windowBounds }`;
- repeated detach focuses the same window;
- move/resize debounces `updateFolder(id, { windowBounds })`;
- user close stores `{ detached: false, windowBounds }`;
- `beginShutdown()` prevents clearing detached state;
- `restore()` opens every active folder with `detached: true`.

- [ ] **Step 2: Run the service test**

```powershell
npx vitest run tests/folderWindow.test.ts
```

Expected: FAIL because `FolderWindowService` does not exist.

- [ ] **Step 3: Implement `FolderWindowService`**

Use a folder-specific store:

```ts
interface FolderWindowStore {
  updateFolder(id: string, patch: FolderPatch): Promise<FolderItem | null>
}
```

Use the existing `ensureVisibleBounds` helper and the same map/timer lifecycle as `DetachedWindowService`, with default bounds `380 x 520`.

- [ ] **Step 4: Add IPC and preload methods**

Add channels:

```ts
windowDetachFolder: 'window:detach-folder',
windowAttachFolder: 'window:attach-folder'
```

Add API:

```ts
detachFolder(folderId: string): Promise<void>
attachFolder(folderId: string): Promise<void>
```

Update `registerWindowIpc` to load the folder through `notes.listFolders()` before detaching.

- [ ] **Step 5: Create and restore folder BrowserWindows**

In `main.ts`, instantiate `FolderWindowService` with a BrowserWindow factory whose URL is:

```ts
const query = `mode=folder&id=${encodeURIComponent(folder.id)}`
```

Use the existing preload and renderer entry. Restore after startup:

```ts
await folderWindows.restore(await notes.listFolders())
```

Call `folderWindows.beginShutdown()` in `before-quit`.

When folder deletion succeeds, call `folderWindows.closeForDelete(folderId)` before broadcasting refreshed data.

- [ ] **Step 6: Run service tests and typecheck**

```powershell
npx vitest run tests/folderWindow.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/main/services/FolderWindowService.ts src/main/main.ts src/main/ipc/windowIpc.ts src/main/ipc/noteIpc.ts src/main/ipc/folderIpc.ts src/shared/ipcChannels.ts src/shared/electronApi.ts src/preload/index.ts tests/folderWindow.test.ts
git commit -m "feat: add persistent folder windows"
```

### Task 4: Add the detached folder renderer

**Files:**
- Create: `src/renderer/src/pages/DetachedFolder.tsx`
- Create: `tests/detachedFolder.test.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`

- [ ] **Step 1: Write failing navigation tests**

Mock `notes.list()` and `folders.list()` with a root folder, nested folder, note, and todo.

Assert:

- the full subtree is rendered;
- clicking the note shows `NoteEditor`;
- clicking back returns to the folder tree;
- clicking close calls `window.attachFolder(folderId)`.

- [ ] **Step 2: Run the renderer test**

```powershell
npx vitest run tests/detachedFolder.test.tsx
```

Expected: FAIL because `DetachedFolder` and folder mode routing do not exist.

- [ ] **Step 3: Route folder mode**

In `App.tsx`:

```ts
const mode = params.get('mode')
const id = params.get('id')
if (mode === 'folder' && id) return <DetachedFolder folderId={id} />
if (mode === 'detached' && id) return <DetachedEditor itemId={id} />
```

- [ ] **Step 4: Implement the folder tree page**

`DetachedFolder` loads items/folders, locates the requested root in `buildFolderTree`, and renders a window header plus recursive `FolderCard`.

Keep:

```ts
const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
```

When selected, reuse the same save/task methods as `DetachedEditor`, but editor `onBack` sets `selectedItemId(null)` instead of attaching the folder.

- [ ] **Step 5: Add compact window styles**

Add `.detached-folder-shell`, `.detached-folder-header`, and `.detached-folder-tree` with full-height scrolling and draggable header. Buttons and tree contents remain `no-drag`.

- [ ] **Step 6: Run focused tests**

```powershell
npx vitest run tests/detachedFolder.test.tsx tests/detachedEditor.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/renderer/src/pages/DetachedFolder.tsx src/renderer/src/App.tsx src/renderer/src/components/FolderCard.tsx src/renderer/src/styles/sticky-panel.css tests/detachedFolder.test.tsx
git commit -m "feat: browse and edit detached folders"
```

### Task 5: Persist todo card expansion

**Files:**
- Modify: `src/renderer/src/components/TodoCard.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Create: `tests/todoCard.test.tsx`

- [ ] **Step 1: Write failing card tests**

Create a todo with five tasks.

Assert collapsed mode renders three task labels, expanded mode renders all five, and clicking the toggle calls:

```ts
onToggleExpanded(true)
```

without calling `onOpen`.

- [ ] **Step 2: Run the card test**

```powershell
npx vitest run tests/todoCard.test.tsx
```

Expected: FAIL because no expansion control exists.

- [ ] **Step 3: Implement visible task selection**

In `TodoCard`:

```ts
const visibleTasks = item.panelExpanded
  ? item.tasks
  : item.tasks.slice(0, 3)
```

Add an expand/collapse button when tasks exist. Stop pointer/click propagation so it does not open or drag the card.

- [ ] **Step 4: Persist through `App`**

Add `onToggleTodoExpanded(item, expanded)` to `StickyPanel`. Save with:

```ts
save(item.id, { panelExpanded: expanded })
```

- [ ] **Step 5: Run focused tests**

```powershell
npx vitest run tests/todoCard.test.tsx tests/folderPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/renderer/src/components/TodoCard.tsx src/renderer/src/pages/StickyPanel.tsx src/renderer/src/App.tsx src/renderer/src/styles/note-card.css tests/todoCard.test.tsx
git commit -m "feat: expand todo cards on the panel"
```

### Task 6: Make task input safe for Chinese IME

**Files:**
- Create: `src/renderer/src/components/TodoTaskInput.tsx`
- Create: `tests/todoTaskInput.test.tsx`
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Modify: `src/renderer/src/styles/note-card.css`

- [ ] **Step 1: Write failing composition tests**

Render `TodoTaskInput` with `value=""`.

Fire:

```ts
compositionStart
change({ target: { value: 'w' } })
change({ target: { value: '我' } })
```

Assert `onCommit` has not run. Fire `compositionEnd` with final value `我`, then assert exactly one commit.

Add a fake-timer test proving ordinary input commits once after the debounce. Add a rerender test proving a stale parent value does not overwrite an active composition draft.

- [ ] **Step 2: Run the input tests**

```powershell
npx vitest run tests/todoTaskInput.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the local draft component**

Use refs for:

```ts
const composingRef = useRef(false)
const dirtyRef = useRef(false)
const timerRef = useRef<number | null>(null)
```

Rules:

- `onChange`: set draft; if not composing, schedule a 300 ms commit.
- `onCompositionStart`: cancel timer and mark composing.
- `onCompositionEnd`: mark not composing, use `event.currentTarget.value`, and commit once.
- `onBlur`: flush a non-composing dirty draft.
- `useEffect([value])`: update draft only when not composing and not dirty.
- cleanup: clear timer.

- [ ] **Step 4: Replace the direct task input**

In `TodoTaskRow`, replace the controlled `<input>` with:

```tsx
<TodoTaskInput
  value={task.contentMarkdown}
  onCommit={(contentMarkdown) => onUpdate({ contentMarkdown })}
/>
```

Keep `task-content-input` class and accessible label.

- [ ] **Step 5: Run focused tests**

```powershell
npx vitest run tests/todoTaskInput.test.tsx tests/todoEditor.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/renderer/src/components/TodoTaskInput.tsx src/renderer/src/components/TodoTaskRow.tsx src/renderer/src/styles/note-card.css tests/todoTaskInput.test.tsx
git commit -m "fix: preserve Chinese IME task input"
```

### Task 7: Verify, package, and publish

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

- [ ] **Step 1: Update documentation and version**

Document folder windows, todo card expansion, and IME-safe input. Bump the minor version:

```powershell
npm version 0.5.0 --no-git-tag-version
```

- [ ] **Step 2: Run full verification**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: all tests pass and build exits 0.

- [ ] **Step 3: Build the installer**

```powershell
npm run dist
```

Expected installer:

```text
release/StickyNotes-0.5.0-Setup.exe
```

- [ ] **Step 4: Run packaged graceful-exit smoke test**

```powershell
cmd /c "set SMOKE_GRACEFUL_EXIT=1&&node scripts\smoke.cjs release\win-unpacked\轻量便签.exe"
```

Expected:

```text
gracefulExit=true exitCode=0 stderrLength=0
```

- [ ] **Step 5: Commit and push**

```powershell
git add package.json package-lock.json README.md src tests
git commit -m "feat: add folder windows and stable todo input"
git push origin codex/desktop-sticky-notes
git push origin HEAD:main
```
