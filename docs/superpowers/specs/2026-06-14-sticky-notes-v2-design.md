# Sticky Notes V2 Design

## Summary

Upgrade the desktop sticky notes application to fix the first-release
interaction defects and add multi-task Todo cards, an immediately formatted
Markdown editor, richer header colors, card context menus, named creation, and
detachable persistent editing windows.

The application remains local-first. The main process owns files, reminders,
windows, and synchronization. Renderer windows edit the same versioned JSON
data through typed IPC.

## Data Model And Migration

`notes.json` advances to version 2. Before migration, the application creates a
timestamped backup. A failed migration preserves the original file and reports
the error instead of replacing it with empty data.

Notes keep a Markdown string. Todos become titled lists:

```ts
interface TodoTask {
  id: string
  contentMarkdown: string
  completed: boolean
  remindAt: string | null
  reminded: boolean
}

interface TodoItem extends BaseItem {
  type: 'todo'
  tasks: TodoTask[]
}
```

Each sticky item also stores:

```ts
interface DetachedWindowState {
  detached: boolean
  windowBounds: { x: number; y: number; width: number; height: number } | null
}
```

Header colors are validated CSS hex values. Version 1 values map from yellow,
blue, green, and pink to their existing visual hex values. Existing single
Todo content, completion, and reminder fields migrate into one `tasks[]` entry.

## Main Panel

Note and Todo cards use one shared card shell and header component so their
header dimensions, padding, rounded corners, badge alignment, and title
baseline are identical.

Left click opens the editor. Right click opens an application context menu:

- Edit
- Detach as window or return to panel
- Rename
- Change header color
- Toggle light or dark body
- Delete
- Add task for Todo cards

The context menu closes on outside click or Escape. Destructive actions require
confirmation.

Creating a Note or Todo first requests a title. A non-empty title creates the
item and opens its editor. Cancel creates nothing.

Settings and editor navigation controls are explicitly excluded from the
Electron draggable region. This fixes back and delete controls being swallowed
by window dragging.

## Editing

The editor uses TipTap with Markdown parsing and serialization. JSON continues
to store Markdown rather than HTML.

The toolbar remains visible and provides headings, bold, italic,
strikethrough, bullet and ordered lists, blockquote, inline code, code block,
link, undo, and redo.

Markdown input rules immediately convert prefixes such as `## `, `- `, `> `,
and fenced code into formatted blocks. The active block may expose its Markdown
meaning through the toolbar and block indicator; users are not forced into a
separate preview mode.

Todo editors display an ordered list of tasks. Each row has an independent
checkbox, TipTap task content editor, reminder time, delete action, and drag
handle. Tasks can be added and reordered. Changing one reminder resets only
that task's `reminded` flag.

## Colors

The color picker offers 12 coordinated preset colors, a native free color
picker, and recently used colors. Only the card header uses this color. The
body remains restricted to light or dark themes.

Invalid stored colors fall back to the default yellow during migration or
load-time validation.

## Detached Windows

A Note or complete Todo list can be dragged out of the main panel to create a
small independent editing window. The right-click detach action provides the
same behavior and is the accessibility fallback.

Detached windows:

- are always on top;
- can move and resize;
- directly edit the same item as the main panel;
- debounce-save their bounds;
- close by returning the item to the main panel, without deleting it;
- restore on the next application launch;
- are constrained back into a visible display work area when monitor geometry
  changes.

Only one detached window exists per item. Repeated detach requests focus the
existing window. Deleting an item closes its detached window before deleting
the data.

The main process broadcasts item changes to all renderer windows. Renderers
merge the updated item into local state, preventing stale main-panel and
detached-window views.

## Reminders

The reminder service scans every Todo task. It notifies only when the task has a
reminder, is incomplete, is due, and has not already been reminded. After a
notification it marks that task as reminded.

Startup checks overdue tasks before the periodic timer begins.

## Error Handling

File writes remain serialized and atomic. Migration creates a backup before
writing version 2. Window creation failure leaves the item attached. A failed
drag operation does not mutate detached state.

Renderer errors show a compact non-blocking message while preserving the
current editor state. Data errors are never handled by silently clearing the
notes file.

## Acceptance Criteria

- Settings and editor back controls work reliably.
- Note and Todo headers are visually identical.
- Right-click edit, detach, rename, color, theme, add-task, and delete actions
  work as applicable.
- New items receive a user-entered title before creation.
- Todo cards contain multiple independently completable and remindable tasks.
- Todo tasks can be reordered.
- The Markdown toolbar remains visible and Markdown prefixes format
  immediately.
- Preset and arbitrary header colors persist without coloring the body.
- Detached windows edit live data, restore after restart, and return to the
  panel when closed.
- Version 1 data migrates to version 2 without loss and retains a backup.
- Tests, type checking, build, installer packaging, and Windows smoke tests
  pass.
