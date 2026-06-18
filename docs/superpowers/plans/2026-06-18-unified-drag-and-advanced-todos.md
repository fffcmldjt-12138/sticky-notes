# Unified Drag And Advanced Todos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mixed native drag behavior with one stable dnd-kit tree interaction and add per-task quadrants, one-level subtasks, unified scheduling, recurrence, pinning, and complete folder actions.

**Architecture:** Persist a version-4 notes schema with normalized task schedules and subtasks. Keep move validation, recurrence advancement, persistence, and notifications in the main process; expose focused IPC methods; keep display ranking and dnd-kit interaction state in small renderer helpers and components.

**Tech Stack:** Electron, React 19, TypeScript, Vite, dnd-kit, Vitest, Testing Library, JSON persistence.

---

### Task 1: Version-4 Todo Model And Migration

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/noteMigration.ts`
- Modify: `src/main/services/NoteStore.ts`
- Test: `tests/noteMigration.test.ts`
- Test: `tests/noteStore.test.ts`

- [ ] **Step 1: Write failing migration tests**

Add cases proving version 3 tasks become version 4 with:

```ts
expect(task).toMatchObject({
  importance: 'normal',
  urgency: 'normal',
  children: [],
  schedule: null
})
expect(result.version).toBe(4)
```

Add a legacy reminder/deadline case expecting a `TodoSchedule` whose effective
due time is the former deadline and whose reminder offsets preserve existing
deadline reminders.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
rtk npx vitest run tests/noteMigration.test.ts tests/noteStore.test.ts
```

Expected: TypeScript or assertions fail because schema version 4 and new fields
do not exist.

- [ ] **Step 3: Define the version-4 types**

Add:

```ts
export type TaskImportance = 'important' | 'normal'
export type TaskUrgency = 'urgent' | 'normal'
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'weekdays'

export interface TaskReminder {
  id: string
  offsetMinutes: number
  remindedAt: string | null
}

export interface TodoSchedule {
  mode: 'point' | 'range'
  startAt: string
  endAt: string | null
  reminders: TaskReminder[]
  repeat: TaskRepeat
}

export interface TodoSubtask {
  id: string
  contentMarkdown: string
  completed: boolean
  importance: TaskImportance
  urgency: TaskUrgency
  tags: string[]
  schedule: TodoSchedule | null
}
```

Replace task legacy schedule fields with `importance`, `urgency`, `children`,
and `schedule`. Change `NotesFile.version` to `4`, and extend task/subtask patch
types.

- [ ] **Step 4: Implement migration and defaults**

Normalize versions 1-4 into version 4. Convert a legacy deadline to a point
schedule; if only `remindAt` exists, use it as a point schedule with an at-time
reminder. Preserve completion, tags, and reminder delivery where representable.
Update store initialization and new task defaults.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```powershell
rtk npx vitest run tests/noteMigration.test.ts tests/noteStore.test.ts
rtk npm run typecheck
rtk git add src/shared/models.ts src/main/services/noteMigration.ts src/main/services/NoteStore.ts tests/noteMigration.test.ts tests/noteStore.test.ts
rtk git commit -m "feat: migrate todos to advanced schedule model"
```

### Task 2: Subtask Store APIs And IPC

**Files:**
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/noteIpc.ts`
- Modify: `src/main/services/NoteStore.ts`
- Test: `tests/noteStore.test.ts`

- [ ] **Step 1: Write failing subtask CRUD tests**

Test add, update, delete, and reject nested-child semantics:

```ts
const child = await store.addTodoSubtask(todo.id, task.id, '细化任务')
expect(child?.contentMarkdown).toBe('细化任务')
const updated = await store.updateTodoSubtask(todo.id, task.id, child!.id, {
  importance: 'important'
})
expect(updated?.tasks[0].children[0].importance).toBe('important')
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk npx vitest run tests/noteStore.test.ts
```

Expected: methods do not exist.

- [ ] **Step 3: Implement store methods**

Add `addTodoSubtask`, `updateTodoSubtask`, and `deleteTodoSubtask`. New subtasks
receive defaults and are stored only inside a parent task.

- [ ] **Step 4: Expose APIs through IPC**

Add channels and preload methods:

```ts
addTodoSubtask(todoId, taskId, contentMarkdown?)
updateTodoSubtask(todoId, taskId, subtaskId, patch)
deleteTodoSubtask(todoId, taskId, subtaskId)
```

Broadcast the updated todo through existing `itemChanged`.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
rtk npx vitest run tests/noteStore.test.ts
rtk npm run typecheck
rtk git add src/shared src/preload/index.ts src/main/ipc/noteIpc.ts src/main/services/NoteStore.ts tests/noteStore.test.ts
rtk git commit -m "feat: add one-level todo subtasks"
```

### Task 3: Priority Ranking And Recurrence

**Files:**
- Create: `src/shared/todoPriority.ts`
- Create: `src/main/services/taskSchedule.ts`
- Modify: `src/main/services/ReminderService.ts`
- Test: `tests/todoPriority.test.ts`
- Test: `tests/taskSchedule.test.ts`
- Modify: `tests/reminderService.test.ts`

- [ ] **Step 1: Write priority tests**

Test the rank order, completed tasks after incomplete tasks, child priority
contributing to a card, and pinned nodes ahead of ranked nodes:

```ts
expect(getTaskPriority({ importance: 'important', urgency: 'urgent' })).toBe(0)
expect(getTaskPriority({ importance: 'normal', urgency: 'normal' })).toBe(3)
```

- [ ] **Step 2: Write recurrence tests**

Use fixed local dates to prove:

- Daily advances one day.
- Weekly advances seven days.
- Weekdays skips Saturday and Sunday.
- Range duration is preserved.
- Reminder delivery state resets.

- [ ] **Step 3: Verify RED**

Run:

```powershell
rtk npx vitest run tests/todoPriority.test.ts tests/taskSchedule.test.ts tests/reminderService.test.ts
```

Expected: helper modules are missing and reminder service still uses legacy
fields.

- [ ] **Step 4: Implement pure helpers**

`todoPriority.ts` exports task rank, todo-card rank, stable task sorting, and
stable sibling display sorting. `taskSchedule.ts` exports effective due time and
`advanceRecurringSchedule(schedule)`.

- [ ] **Step 5: Update reminder service**

Iterate parent tasks and subtasks. Deliver each pending schedule reminder.
When a recurring due time has passed, advance the schedule, reset completion,
and clear each `remindedAt`. Non-recurring tasks remain due and do not reset.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
rtk npx vitest run tests/todoPriority.test.ts tests/taskSchedule.test.ts tests/reminderService.test.ts
rtk npm run typecheck
rtk git add src/shared/todoPriority.ts src/main/services/taskSchedule.ts src/main/services/ReminderService.ts tests
rtk git commit -m "feat: rank and repeat todo tasks"
```

### Task 4: Atomic Folder-Local Creation And Move Semantics

**Files:**
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/noteIpc.ts`
- Test: `tests/folderStore.test.ts`

- [ ] **Step 1: Write failing creation and move tests**

Test:

- Create note/todo directly in a target folder.
- Move item/folder from nested folder to its parent.
- Reorder operation keeps all untouched siblings.
- Fourth-level folder creation and subtree move are rejected.
- Detach operations do not modify `parentFolderId`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk npx vitest run tests/folderStore.test.ts
```

- [ ] **Step 3: Extend creation API**

Change:

```ts
create(type: NoteType, title?: string, parentFolderId?: string | null)
```

Validate the target folder and assign `order` in that target. Expose the third
argument through IPC and preload.

- [ ] **Step 4: Harden reorder semantics**

Keep `reorderChildren(parentFolderId, orderedNodes)` as the single atomic move
API. Ensure it captures source parents before mutation, validates folder cycles
and subtree depth, updates moved parents, appends omitted target siblings, and
renumbers source and target siblings.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
rtk npx vitest run tests/folderStore.test.ts tests/folderWindow.test.ts tests/detachedWindow.test.ts
rtk npm run typecheck
rtk git add src/main/services/NoteStore.ts src/main/ipc/noteIpc.ts src/shared/electronApi.ts src/preload/index.ts tests/folderStore.test.ts
rtk git commit -m "feat: create and move nodes within folders"
```

### Task 5: Context Menu Collision And Complete Folder Actions

**Files:**
- Create: `src/renderer/src/lib/floatingPosition.ts`
- Modify: `src/renderer/src/components/CardContextMenu.tsx`
- Modify: `src/renderer/src/components/FolderContextMenu.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Test: `tests/cardActions.test.tsx`
- Modify: `tests/folderPanel.test.tsx`
- Modify: `tests/detachedFolder.test.tsx`

- [ ] **Step 1: Write failing collision and nested-menu tests**

Test a 190x300 menu requested near the lower-right corner clamps inside an
800x600 viewport. Test right-clicking a folder child opens the card menu, and
right-clicking a nested folder opens rename/create/delete actions.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk npx vitest run tests/cardActions.test.tsx tests/folderPanel.test.tsx tests/detachedFolder.test.tsx
```

- [ ] **Step 3: Implement positioning helper and menu actions**

Use a menu ref and layout effect to calculate:

```ts
left = Math.min(Math.max(margin, requestedX), viewportWidth - width - margin)
top = Math.min(Math.max(margin, requestedY), viewportHeight - height - margin)
```

Add card pin/unpin and folder create actions. Pass item context menus through
recursive `FolderCard`. Ensure dismissal listeners are removed on unmount.

- [ ] **Step 4: Add folder-local create flows**

Track target folder ID and depth in `App` and `DetachedFolder`. Reuse
`CreateMenu`; hide child-folder creation at depth 3 and surface store errors.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
rtk npx vitest run tests/cardActions.test.tsx tests/folderPanel.test.tsx tests/detachedFolder.test.tsx
rtk npm run typecheck
rtk git add src/renderer tests
rtk git commit -m "feat: complete folder menus and local creation"
```

### Task 6: Unified dnd-kit Tree Dragging

**Files:**
- Create: `src/renderer/src/lib/treeDrag.ts`
- Create: `src/renderer/src/components/TreeDragHandle.tsx`
- Create: `src/renderer/src/components/TreeDropZone.tsx`
- Create: `src/renderer/src/components/TreeDragOverlay.tsx`
- Modify: `src/renderer/src/components/StickyCard.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Test: `tests/treeDrag.test.ts`
- Modify: `tests/folderPanel.test.tsx`
- Modify: `tests/detachedFolder.test.tsx`

- [ ] **Step 1: Write failing drag-operation tests**

Pure tests cover:

```ts
resolveTreeDrop(active, { type: 'between', parentId, index })
resolveTreeDrop(active, { type: 'inside-folder', folderId })
resolveTreeDrop(active, { type: 'parent-exit', parentId })
```

Assert the returned `parentFolderId` and complete ordered sibling list.

- [ ] **Step 2: Write interaction tests**

Assert cards are not native draggable, only handles expose drag attributes,
drop zones receive an active class, and a normal header click still calls edit.

- [ ] **Step 3: Verify RED**

Run:

```powershell
rtk npx vitest run tests/treeDrag.test.ts tests/folderPanel.test.tsx tests/detachedFolder.test.tsx
```

- [ ] **Step 4: Implement one DndContext**

Create a pointer sensor with `{ distance: 6 }`, keyboard sensor, drag overlay,
explicit insertion zones, folder-inside targets, and parent-exit targets.
Remove all HTML `draggable`, `dataTransfer`, and native drag handlers.

- [ ] **Step 5: Preserve outside-window detach**

Track pointer coordinates during active dnd-kit dragging. On drag end with no
drop target and coordinates beyond the viewport, call item/folder detach while
leaving folder membership unchanged.

- [ ] **Step 6: Add expanded drop feedback**

Active target zones grow to at least 24px with a blue insertion line and nearby
layout displacement. Non-active zones remain compact.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
rtk npx vitest run tests/treeDrag.test.ts tests/folderPanel.test.tsx tests/detachedFolder.test.tsx tests/dragBoundary.test.ts
rtk npm run typecheck
rtk git add src/renderer tests
rtk git commit -m "refactor: unify panel dragging with dnd-kit"
```

### Task 7: Advanced Todo Editor And Unified Schedule Popover

**Files:**
- Create: `src/renderer/src/components/TaskQuadrantPicker.tsx`
- Create: `src/renderer/src/components/TaskSchedulePopover.tsx`
- Create: `src/renderer/src/components/TodoSubtaskRow.tsx`
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Modify: `src/renderer/src/components/TodoEditor.tsx`
- Modify: `src/renderer/src/components/TodoCard.tsx`
- Modify: `src/renderer/src/pages/DetachedEditor.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Test: `tests/taskSchedulePopover.test.tsx`
- Modify: `tests/todoEditor.test.tsx`
- Modify: `tests/todoCard.test.tsx`

- [ ] **Step 1: Write failing editor tests**

Test quadrant selection, add/edit/delete one-level subtask, no nested add
control, one `时间设置` button, completed strike-through class, and task display
order by priority.

- [ ] **Step 2: Write failing schedule popover tests**

Test point/range selection, range validation, multiple reminder offsets,
custom offsets, and recurrence values `none`, `daily`, `weekly`, `weekdays`.

- [ ] **Step 3: Verify RED**

Run:

```powershell
rtk npx vitest run tests/todoEditor.test.tsx tests/todoCard.test.tsx tests/taskSchedulePopover.test.tsx
```

- [ ] **Step 4: Implement focused components**

Replace separate reminder and DDL buttons with one schedule button and popover.
Keep the existing IME-safe `TodoTaskInput`. Render children beneath each task
and connect new preload methods.

- [ ] **Step 5: Apply completed and quadrant styles**

Completed text uses `text-decoration: line-through` and reduced opacity.
Quadrant controls use compact labels and do not turn the whole task row into a
large colored background.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
rtk npx vitest run tests/todoEditor.test.tsx tests/todoCard.test.tsx tests/taskSchedulePopover.test.tsx tests/todoTaskInput.test.tsx
rtk npm run typecheck
rtk git add src/renderer tests
rtk git commit -m "feat: add quadrants subtasks and unified scheduling"
```

### Task 8: Pin And Priority Display Ordering

**Files:**
- Modify: `src/shared/todoPriority.ts`
- Modify: `src/renderer/src/lib/folderTree.ts`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/components/CardContextMenu.tsx`
- Test: `tests/todoPriority.test.ts`
- Modify: `tests/folderTree.test.ts`
- Modify: `tests/folderPanel.test.tsx`

- [ ] **Step 1: Write failing ordering tests**

Assert:

- Pinned items precede all unpinned siblings.
- Important-urgent todo cards precede lower-ranked unpinned todos.
- Folders retain their relative manual order.
- Equal rank preserves `order`.
- Pinning does not modify `parentFolderId`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
rtk npx vitest run tests/todoPriority.test.ts tests/folderTree.test.ts tests/folderPanel.test.tsx
```

- [ ] **Step 3: Apply display sorting**

Sort each sibling entry list using pin and todo rank while retaining persisted
`order` as the stable tie-breaker. Context-menu pin calls the existing item
update API.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
rtk npx vitest run tests/todoPriority.test.ts tests/folderTree.test.ts tests/folderPanel.test.tsx
rtk npm run typecheck
rtk git add src/shared/todoPriority.ts src/renderer tests
rtk git commit -m "feat: prioritize pinned and urgent cards"
```

### Task 9: Release Verification

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Update documentation and version**

Document unified drag handles, nested folder movement, pinning, quadrants,
subtasks, schedule ranges, reminders, and recurrence. Bump version from `0.5.0`
to `0.6.0`:

```powershell
rtk npm version 0.6.0 --no-git-tag-version
```

- [ ] **Step 2: Run complete verification**

```powershell
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk npm run dist
rtk cmd /c "set SMOKE_GRACEFUL_EXIT=1&&node scripts\smoke.cjs release\win-unpacked\轻量便签.exe"
rtk git diff --check
```

Expected: all tests pass, typecheck and build exit 0, installer
`release/StickyNotes-0.6.0-Setup.exe` exists, and packaged smoke exits 0 without
stderr.

- [ ] **Step 3: Commit release**

```powershell
rtk git add README.md package.json package-lock.json
rtk git commit -m "chore: release version 0.6.0"
```

