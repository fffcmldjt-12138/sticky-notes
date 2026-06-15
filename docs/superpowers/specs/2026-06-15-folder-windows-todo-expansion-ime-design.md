# Folder Windows, Todo Expansion, and IME Input Design

## Goal

Improve panel and detached-window behavior in four related areas:

1. Notes and todos inside folders can still be dragged outside the panel to become detached windows.
2. A folder can be dragged outside the panel to become a persistent detached folder window.
3. Todo cards on the main panel can expand to show every task and persist that state.
4. Todo task input behaves correctly with Chinese IME composition and asynchronous store updates.

## Confirmed Behavior

### Folder contents and detached item windows

- A note or todo title inside a folder remains an internal drag target for mixed ordering.
- If the drag ends outside the panel bounds, the item becomes its existing detached note/todo window.
- Internal drops continue to reorder or move the item without creating a window.

### Detached folder windows

- Dragging a folder title bar outside the panel creates one folder window.
- The window shows the complete folder subtree, up to the existing three-level nesting limit.
- Folder entries remain title-only in the tree.
- Clicking a note or todo switches the same folder window to the existing full editor.
- Returning from the editor restores the folder tree in the same window.
- Closing the window marks the folder as attached.
- Folder window position and size are saved and restored on the next application start.
- Repeated detach requests focus the existing folder window instead of creating duplicates.
- Deleting a folder closes its detached window before promoting its contents to the parent.

### Main-panel todo expansion

- Every todo stores a `panelExpanded` boolean in `notes.json`.
- Collapsed cards keep the current compact presentation and show at most three tasks.
- Expanded cards show every task.
- A clear expand/collapse button appears in the todo card header or summary area.
- Toggling expansion does not enter the editor and does not start a drag.
- Existing completion checkboxes continue to work in both states.

### IME-safe todo input

- Each task row owns a local text draft.
- `compositionstart` marks the field as composing.
- `onChange` updates only the local draft while composing.
- `compositionend` sends one committed update with the final composed text.
- Non-IME input is saved with a short debounce.
- Incoming task changes update the draft only when the field is not composing and not holding a newer unsaved local value.
- Blur flushes pending text before the row can be reordered or unmounted.

The Windows candidate bar shown in the screenshot is expected IME UI. The bug is the app feeding intermediate composition text through asynchronous persistence and then replacing it with stale state.

## Data Model

Extend `TodoItem`:

```ts
export interface TodoItem extends BaseItem {
  type: 'todo'
  tasks: TodoTask[]
  panelExpanded: boolean
}
```

Extend `FolderItem`:

```ts
export interface FolderItem {
  id: string
  title: string
  parentFolderId: string | null
  order: number
  collapsed: boolean
  detached: boolean
  windowBounds: WindowBounds | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}
```

`NotesFile` remains version 3. Normalization supplies:

- `panelExpanded: false` for existing todos.
- `detached: false` and `windowBounds: null` for existing folders.

This avoids a file-version migration whose only purpose would be additive defaults.

## Main Process Architecture

Create `FolderWindowService` instead of adding folder branches to `DetachedWindowService`.

Responsibilities:

- Own a `Map<folderId, window>`.
- Validate and clamp saved bounds.
- Create/focus/close folder windows.
- Debounce bounds persistence through `NoteStore.updateFolder`.
- Restore folders whose `detached` field is true.
- Avoid changing detached state during application shutdown.

Add IPC operations:

```ts
window.detachFolder(folderId)
window.attachFolder(folderId)
```

The BrowserWindow URL uses:

```text
?mode=folder&id=<folder-id>
```

The main process restores detached item windows and detached folder windows after stores and IPC are ready.

## Renderer Architecture

### Drag completion

Extract a shared helper:

```ts
export function endedOutsidePanel(
  clientX: number,
  clientY: number,
  width: number,
  height: number
): boolean
```

Use it from:

- `StickyCard`
- folder item title rows
- folder title bars

`FolderCard` receives:

```ts
onDetachItem(item: StickyItem): void
onDetachFolder(folder: FolderTreeNode): void
```

Stopping propagation on internal drops prevents an internal reorder from also detaching.

### Folder window page

Add `DetachedFolder`:

- Loads folders and items through existing IPC.
- Builds the subtree with `buildFolderTree`.
- Shows only the requested folder as the root.
- Keeps `selectedItemId` locally.
- Renders a compact tree when no item is selected.
- Renders `NoteEditor` or `TodoEditor` in the same window when selected.
- Editor back returns to the tree.
- Window close calls `attachFolder`.

### Todo card expansion

`TodoCard` receives `onToggleExpanded`.

The task slice is:

```ts
const visibleTasks = item.panelExpanded ? item.tasks : item.tasks.slice(0, 3)
```

The toggle button stops click and drag propagation before saving:

```ts
onSave(item.id, { panelExpanded: !item.panelExpanded })
```

### IME-safe task field

Move text persistence behavior into a focused `TodoTaskInput` component. It receives:

```ts
value: string
onCommit(value: string): void
```

This keeps drag, checkbox, reminder, and deadline logic in `TodoTaskRow`, while the text field independently handles composition and debounce.

## Error Handling

- Missing folder or deleted folder windows show an error state.
- Invalid drag IDs are ignored by the existing store validation.
- A failed detach request keeps the source card in the panel and reports through the existing alert path.
- A folder already detached is focused, not recreated.
- Pending task input is flushed on blur; a failed save leaves the local draft visible until a later parent refresh.

## Testing

Add focused tests for:

- Outside-boundary drag detection.
- Folder child item drag ending outside calls item detach.
- Folder title drag ending outside calls folder detach.
- Folder window service duplicate prevention, bounds persistence, restore, user close, and shutdown.
- Folder detached page tree-to-editor-to-tree navigation.
- Todo collapsed and expanded task counts and persisted toggle callback.
- IME composition sends no intermediate updates and commits exactly once.
- Parent refresh does not replace an active composition draft.
- Existing notes files receive all additive defaults.

Run the full test suite, typecheck, production build, NSIS packaging, and packaged graceful-exit smoke test.

## Out of Scope

- Editing folder names inside detached folder windows.
- Showing note body previews in the folder tree.
- More than three folder levels.
- Detaching each folder child into separate windows automatically.
- Replacing the operating system IME candidate window.
