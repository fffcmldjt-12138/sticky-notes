# Interaction Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stale windows from overwriting newer data, preserve focus and IME drafts during broadcasts, expose truthful save states, and add bounded undo for destructive domain actions.

**Architecture:** Domain writes use optimistic revisions and typed mutation results. Editors keep remote snapshots separate from local drafts through a shared hook, while main, detached, and folder windows consume the same conflict and save-state contract. A main-process `UndoService` records inverse domain commands rather than renderer snapshots.

**Tech Stack:** Electron IPC, TypeScript discriminated unions, React hooks, Tiptap, Vitest, Testing Library

---

### Task 1: Revision-aware domain mutation results

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `tests/noteStore.test.ts`
- Modify: `tests/folderStore.test.ts`

- [ ] **Step 1: Write failing optimistic-concurrency tests**

Cover accepted updates, stale item updates, stale folder updates, and revision increments:

```ts
const first = await store.update('note_1', 1, { title: 'first' })
expect(first).toMatchObject({ status: 'ok', value: { revision: 2 } })

const stale = await store.update('note_1', 1, { title: 'stale' })
expect(stale).toMatchObject({
  status: 'conflict',
  current: { title: 'first', revision: 2 }
})
```

- [ ] **Step 2: Run store tests and verify failure**

Run: `rtk npm test -- tests/noteStore.test.ts tests/folderStore.test.ts`

Expected: FAIL because updates do not accept expected revisions or return typed conflicts.

- [ ] **Step 3: Define and implement mutation results**

Add:

```ts
export type MutationResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'not-found' }
  | { status: 'conflict'; current: T }
```

Change whole-item and folder patch methods to accept `expectedRevision`. On success set `revision: current.revision + 1` and update `updatedAt`. Task and subtask updates that include `contentMarkdown` also require the containing item's expected revision and return `MutationResult<TodoItem>`. Completion, priority, schedule, move, reorder, delete, restore, reminder, and window-bound commands apply to the current entity as discrete domain commands and increment its revision without replacing unrelated user-editable fields.

- [ ] **Step 4: Run store tests**

Run: `rtk npm test -- tests/noteStore.test.ts tests/folderStore.test.ts tests/recycleService.test.ts tests/reminderService.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/shared/models.ts src/main/services/NoteStore.ts tests/noteStore.test.ts tests/folderStore.test.ts tests/recycleService.test.ts tests/reminderService.test.ts
rtk git commit -m "feat: enforce optimistic revisions for local mutations"
```

### Task 2: Typed revision contract across IPC and preload

**Files:**
- Modify: `src/shared/electronApi.ts`
- Modify: `src/main/ipc/noteIpc.ts`
- Modify: `src/main/ipc/folderIpc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DetachedEditor.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Modify: `tests/folderIpc.test.ts`
- Create: `tests/noteIpc.test.ts`

- [ ] **Step 1: Write failing IPC tests**

Verify `expectedRevision` reaches the store, only successful values broadcast, and conflict results return without broadcasting stale data:

```ts
expect(store.update).toHaveBeenCalledWith('note_1', 3, { title: 'new' })
expect(events.changed).not.toHaveBeenCalled()
expect(result.status).toBe('conflict')
```

- [ ] **Step 2: Run IPC tests and verify failure**

Run: `rtk npm test -- tests/noteIpc.test.ts tests/folderIpc.test.ts`

Expected: FAIL because IPC uses nullable entity returns.

- [ ] **Step 3: Update the public renderer contract**

Change patch APIs to:

```ts
notes.update(
  id: string,
  expectedRevision: number,
  patch: StickyItemPatch
): Promise<MutationResult<StickyItem>>

folders.update(
  id: string,
  expectedRevision: number,
  patch: FolderPatch
): Promise<MutationResult<FolderItem>>

notes.updateTodoTask(
  todoId: string,
  taskId: string,
  expectedRevision: number | null,
  patch: TodoTaskPatch
): Promise<MutationResult<TodoItem>>

notes.updateTodoSubtask(
  todoId: string,
  taskId: string,
  subtaskId: string,
  expectedRevision: number | null,
  patch: TodoSubtaskPatch
): Promise<MutationResult<TodoItem>>
```

For task and subtask patches, `expectedRevision` is required when `contentMarkdown` is present and is `null` for discrete commands such as completion, priority, or schedule changes. The main IPC handler broadcasts only `status === 'ok'`. The preload forwards parameters without filesystem or merge logic. Update every renderer call site to pass its current entity revision and unwrap `status === 'ok'`; for this task, a conflict keeps the current renderer snapshot unchanged. Task 4 replaces that minimal fallback with visible draft-conflict handling.

- [ ] **Step 4: Run IPC and type checks**

Run:

```powershell
rtk npm test -- tests/noteIpc.test.ts tests/folderIpc.test.ts
rtk npm run typecheck
```

Expected: IPC tests and typecheck pass. No intermediate commit may leave renderer call sites on the old signature.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/shared/electronApi.ts src/main/ipc/noteIpc.ts src/main/ipc/folderIpc.ts src/preload/index.ts src/renderer/src/App.tsx src/renderer/src/pages/DetachedEditor.tsx src/renderer/src/pages/DetachedFolder.tsx tests/noteIpc.test.ts tests/folderIpc.test.ts tests
rtk git commit -m "feat: expose revision conflicts through IPC"
```

### Task 3: Shared entity save coordinator and local field drafts

**Files:**
- Create: `src/renderer/src/hooks/useEntitySaveCoordinator.ts`
- Create: `src/renderer/src/hooks/usePersistedField.ts`
- Create: `tests/useEntitySaveCoordinator.test.tsx`
- Create: `tests/usePersistedField.test.tsx`
- Create: `src/renderer/src/components/SaveStatus.tsx`
- Create: `tests/saveStatus.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Cover remote updates while clean, remote updates while dirty, save confirmation, stale save responses, failure retention, conflict retention, retry, and two fields saving in quick succession without sharing a stale revision:

```tsx
act(() => result.current.change('local'))
rerender({ remote: { value: 'remote-new', revision: 2 } })
expect(result.current.draft).toBe('local')
expect(result.current.remoteRevision).toBe(2)
expect(result.current.state).toBe('conflict')

await coordinator.current.enqueue({ title: 'new title' })
await coordinator.current.enqueue({ contentMarkdown: 'new body' })
expect(save).toHaveBeenNthCalledWith(1, 1, { title: 'new title' })
expect(save).toHaveBeenNthCalledWith(2, 2, { contentMarkdown: 'new body' })
```

- [ ] **Step 2: Run hook tests and verify failure**

Run: `rtk npm test -- tests/useEntitySaveCoordinator.test.tsx tests/usePersistedField.test.tsx tests/saveStatus.test.tsx`

Expected: FAIL because the hooks and component do not exist.

- [ ] **Step 3: Implement the coordinator and field hook contracts**

Use:

```ts
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict'

interface EntitySaveCoordinatorOptions<P, E extends { revision: number }> {
  remoteEntity: E
  save(
    expectedRevision: number,
    patch: P
  ): Promise<MutationResult<E>>
}

interface PersistedFieldOptions<
  T,
  P,
  E extends { revision: number }
> {
  remoteValue: T
  makePatch(value: T): P
  coordinator: EntitySaveCoordinator<P, E>
  delayMs?: number
}
```

The coordinator serializes patches and advances its confirmed revision from each successful result, preventing title and body saves from racing with the same revision. It ignores older remote entities and reports a real cross-window conflict when a save returns `status: 'conflict'`.

The field hook owns a monotonically increasing draft sequence so late responses cannot confirm newer text. It exposes `draft`, `change`, `flush`, `retry`, `discardLocal`, `state`, and composition handlers. The host reads `draft` when copying; neither hook accesses the clipboard or focuses DOM nodes.

- [ ] **Step 4: Implement save-state UI and run tests**

`SaveStatus` renders no text for idle, then `保存中…`, `已保存`, or an actionable failure/conflict row with Retry, Copy, and Load Latest buttons.

Run: `rtk npm test -- tests/useEntitySaveCoordinator.test.tsx tests/usePersistedField.test.tsx tests/saveStatus.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/renderer/src/hooks/useEntitySaveCoordinator.ts src/renderer/src/hooks/usePersistedField.ts src/renderer/src/components/SaveStatus.tsx tests/useEntitySaveCoordinator.test.tsx tests/usePersistedField.test.tsx tests/saveStatus.test.tsx
rtk git commit -m "feat: coordinate entity saves and preserve field drafts"
```

### Task 4: Note editor save and IME stability

**Files:**
- Modify: `src/renderer/src/components/NoteEditor.tsx`
- Modify: `src/renderer/src/components/MarkdownEditor.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DetachedEditor.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Modify: `tests/editorFocus.test.tsx`
- Modify: `tests/markdownEditor.test.tsx`
- Modify: `tests/detachedEditor.test.tsx`

- [ ] **Step 1: Add failing note/IME tests**

Assert composition defers saves, broadcasts do not replace dirty title/body, conflict controls retain text, and stale save completion does not move the cursor:

```tsx
fireEvent.compositionStart(editor)
fireEvent.input(editor, { target: { textContent: '拼音组合中' } })
vi.advanceTimersByTime(1000)
expect(onSave).not.toHaveBeenCalled()
fireEvent.compositionEnd(editor)
expect(onSave).toHaveBeenCalledTimes(1)
```

- [ ] **Step 2: Run editor tests and verify failure**

Run: `rtk npm test -- tests/editorFocus.test.tsx tests/markdownEditor.test.tsx tests/detachedEditor.test.tsx`

Expected: at least one new composition or conflict assertion fails.

- [ ] **Step 3: Integrate the save coordinator and field drafts**

Make `NoteEditor.onSave` asynchronous and revision-aware:

```ts
onSave(
  expectedRevision: number,
  patch: StickyItemPatch
): Promise<MutationResult<StickyItem>>
```

Use one entity coordinator shared by separate title and Markdown field hooks. `MarkdownEditor` forwards composition callbacks from the Tiptap editor root. Remote `item` changes update clean fields only. Remove the static “自动保存” label and render `SaveStatus`.

- [ ] **Step 4: Update all note hosts and run tests**

Main panel, detached item, and detached folder must return the IPC mutation result directly to the editor and replace their snapshots only on `ok` or explicit conflict resolution.

Run:

```powershell
rtk npm test -- tests/editorFocus.test.tsx tests/markdownEditor.test.tsx tests/detachedEditor.test.tsx tests/detachedFolder.test.tsx
rtk npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/renderer/src/components/NoteEditor.tsx src/renderer/src/components/MarkdownEditor.tsx src/renderer/src/App.tsx src/renderer/src/pages/DetachedEditor.tsx src/renderer/src/pages/DetachedFolder.tsx tests/editorFocus.test.tsx tests/markdownEditor.test.tsx tests/detachedEditor.test.tsx tests/detachedFolder.test.tsx
rtk git commit -m "fix: preserve note drafts focus and IME composition"
```

### Task 5: Todo editor immediate input and draft stability

**Files:**
- Modify: `src/renderer/src/components/TodoEditor.tsx`
- Modify: `src/renderer/src/components/TodoTaskInput.tsx`
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Modify: `src/renderer/src/components/TodoSubtaskRow.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DetachedEditor.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Modify: `tests/todoEditor.test.tsx`
- Modify: `tests/todoTaskInput.test.tsx`

- [ ] **Step 1: Write failing immediate-input tests**

Test that a new task row is locally present and focused before IPC resolves, composition does not save partial text, and task broadcasts do not recreate unrelated input nodes.

```tsx
fireEvent.click(screen.getByRole('button', { name: '新增待办' }))
expect(screen.getByLabelText('待办内容')).toHaveFocus()
expect(addTodoTaskPromise).not.toHaveResolved()
```

- [ ] **Step 2: Run todo tests and verify failure**

Run: `rtk npm test -- tests/todoEditor.test.tsx tests/todoTaskInput.test.tsx`

Expected: FAIL on immediate focus or composition behavior.

- [ ] **Step 3: Use stable local row IDs and draft hooks**

Create an optimistic row with `local_<uuid>`, render it immediately, and replace it with the persisted task ID when IPC resolves. Keep React keys based on task ID, never content. On create failure, keep the row and show retry. Use one item save coordinator with field hooks for task and subtask text updates so all text patches share the latest confirmed containing-item revision.

- [ ] **Step 4: Run todo, detached, and type tests**

Run:

```powershell
rtk npm test -- tests/todoEditor.test.tsx tests/todoTaskInput.test.tsx tests/detachedEditor.test.tsx tests/detachedFolder.test.tsx
rtk npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/renderer/src/components/TodoEditor.tsx src/renderer/src/components/TodoTaskInput.tsx src/renderer/src/components/TodoTaskRow.tsx src/renderer/src/components/TodoSubtaskRow.tsx src/renderer/src/App.tsx src/renderer/src/pages/DetachedEditor.tsx src/renderer/src/pages/DetachedFolder.tsx tests/todoEditor.test.tsx tests/todoTaskInput.test.tsx tests/detachedEditor.test.tsx tests/detachedFolder.test.tsx
rtk git commit -m "fix: make todo entry immediate and composition safe"
```

### Task 6: Cross-window refresh and selected-item stability

**Files:**
- Create: `src/renderer/src/lib/entityEvents.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DetachedEditor.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Modify: `tests/itemList.test.ts`
- Modify: `tests/detachedEditor.test.tsx`
- Modify: `tests/detachedFolder.test.tsx`

- [ ] **Step 1: Write failing event-reduction tests**

Verify older revisions are ignored, newer revisions update lists, dirty selected editors receive snapshots without losing drafts, and deleted selected entities close cleanly.

- [ ] **Step 2: Run event tests and verify failure**

Run: `rtk npm test -- tests/itemList.test.ts tests/detachedEditor.test.tsx tests/detachedFolder.test.tsx`

Expected: FAIL because current upsert logic does not compare revisions.

- [ ] **Step 3: Implement revision-aware event reduction**

```ts
export function acceptNewer<T extends { id: string; revision: number }>(
  current: T | undefined,
  incoming: T
): T {
  return !current || incoming.revision > current.revision ? incoming : current
}
```

All three window modes use this reducer. A full-refresh event from restore/import replaces collections regardless of revision and resets selected snapshots through explicit editor conflict handling.

- [ ] **Step 4: Run tests and commit**

Run: `rtk npm test -- tests/itemList.test.ts tests/detachedEditor.test.tsx tests/detachedFolder.test.tsx`

```powershell
rtk git add src/renderer/src/lib/entityEvents.ts src/renderer/src/App.tsx src/renderer/src/pages/DetachedEditor.tsx src/renderer/src/pages/DetachedFolder.tsx tests/itemList.test.ts tests/detachedEditor.test.tsx tests/detachedFolder.test.tsx
rtk git commit -m "fix: apply cross-window updates by revision"
```

### Task 7: Bounded domain undo

**Files:**
- Create: `src/main/services/UndoService.ts`
- Create: `tests/undoService.test.ts`
- Create: `src/main/ipc/undoIpc.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/main.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Create: `tests/appUndo.test.tsx`

- [ ] **Step 1: Write failing undo tests**

Cover maximum 20 entries, LIFO behavior, one-shot undo, inverse commands for delete/complete/move/pin, and clearing on shutdown:

```ts
await undo.push({ label: '删除笔记', execute: () => store.restoreItem('note_1') })
expect(await undo.undo()).toMatchObject({ status: 'ok', label: '删除笔记' })
expect(await undo.undo()).toMatchObject({ status: 'empty' })
```

- [ ] **Step 2: Run undo tests and verify failure**

Run: `rtk npm test -- tests/undoService.test.ts tests/appUndo.test.tsx`

Expected: FAIL because undo service and toast do not exist.

- [ ] **Step 3: Implement inverse-command recording**

Record undo only after the forward operation succeeds. Store IDs and the minimum prior fields required by the inverse operation, not entire renderer state. Expose `undo.latest()` and `undo.execute()` through IPC.

- [ ] **Step 4: Add an unobtrusive undo toast**

After supported actions, show a bottom status strip with the operation label, Undo button, and five-second dismissal. The command remains available through the button even if the visual strip rerenders; executing it broadcasts the restored entity.

- [ ] **Step 5: Run tests and commit**

Run: `rtk npm test -- tests/undoService.test.ts tests/appUndo.test.tsx tests/recycleService.test.ts`

```powershell
rtk git add src/main/services/UndoService.ts src/main/ipc/undoIpc.ts src/shared/ipcChannels.ts src/shared/electronApi.ts src/preload/index.ts src/main/main.ts src/renderer/src/App.tsx src/renderer/src/styles/sticky-panel.css tests/undoService.test.ts tests/appUndo.test.tsx
rtk git commit -m "feat: add bounded undo for domain actions"
```

### Task 8: Render-performance regression and release gate

**Files:**
- Modify: `src/renderer/src/components/NoteCard.tsx`
- Modify: `src/renderer/src/components/TodoCard.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Create: `tests/panelPerformance.test.tsx`
- Modify: `README.md`

- [ ] **Step 1: Write a render-count regression test**

Render 500 items and update one item. Instrument card render callbacks in the test and assert unrelated root cards do not all rerender. Include 1000 todo tasks and nested folders in fixture generation.

- [ ] **Step 2: Run the performance test and record the failing baseline**

Run: `rtk npm test -- tests/panelPerformance.test.tsx`

Expected: FAIL because broad prop identity changes rerender too many cards.

- [ ] **Step 3: Stabilize props and memoize leaf cards**

Wrap leaf cards with `React.memo`, pass IDs and stable callbacks where practical, memoize folder-tree construction, and update collections by ID. Do not introduce virtualization in this task.

- [ ] **Step 4: Run the full release gate**

Run:

```powershell
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk npm run dist -- --publish never
rtk pwsh -NoProfile -Command '$env:SMOKE_GRACEFUL_EXIT="1"; rtk npm run smoke -- "release\win-unpacked\轻量便签.exe"'
```

Expected: all tests pass, typecheck/build/dist exit 0, packaged smoke has no fatal renderer or preload errors.

- [ ] **Step 5: Document conflict, save state, and undo behavior and commit**

```powershell
rtk git add src/renderer/src/components/NoteCard.tsx src/renderer/src/components/TodoCard.tsx src/renderer/src/components/FolderCard.tsx src/renderer/src/pages/StickyPanel.tsx tests/panelPerformance.test.tsx README.md
rtk git commit -m "perf: stabilize panel rendering and document editor recovery"
```
