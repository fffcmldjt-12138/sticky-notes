# V3 Organization And Editor Design

## Goals

V3 improves daily editing and organization while keeping the application
local, lightweight, and JSON-backed. It adds stable rich Markdown behavior,
local images, tags, task deadlines, nested folders, and a seven-day recycle
bin.

## Data Model

`notes.json` advances to version 3 and keeps folders and items in flat arrays.
Tree relationships use IDs instead of deeply nested JSON.

Every note and todo adds:

- `parentFolderId: string | null`
- `tags: string[]`
- `order: number`
- `deletedAt: string | null`

Folders contain:

- `id`
- `title`
- `parentFolderId`
- `order`
- `collapsed`
- `createdAt`
- `updatedAt`
- `deletedAt`

Folder nesting is limited to three levels. Moving a folder or item must verify
the target depth before saving.

Todo tasks retain plain-text content and add:

- `tags: string[]`
- `deadlineAt: string | null`
- `deadlineReminders: DeadlineReminder[]`

A deadline reminder stores a stable ID, an offset in minutes, and the
notification time already delivered. Presets include 3 days, 1 day, and
6 hours. Users may select several presets and add custom offsets.

The existing `remindAt` remains a separate one-time reminder.

## Editor Layout

The colored header is a drag surface. It displays the synchronized title as
plain, non-selectable text. It never contains an editable input.

The controls below the header contain:

- compact header color control on the left
- editable title field
- body theme control
- item tag control

Changing the title updates both the editor field and the header text.

The content editor owns its scroll area. External store broadcasts must not
replace editor content when the incoming Markdown is equal to the current
local draft. This preserves selection and scroll position during autosave.

## Markdown, Links, And Images

Notes support:

- existing immediate Markdown formatting
- automatically detected URL links
- selected-text link creation from the toolbar
- opening links in the system default browser
- a separate multilevel numbered-list command
- pasted, dropped, and file-selected local images

Image files are copied into `<userData>/assets`. The renderer accesses them
through an application-controlled protocol rather than unrestricted file
URLs. Markdown stores stable asset references.

Inline hashtags matching `#标签` are extracted from note Markdown and todo
task text. Extracted tags merge with manually assigned item tags and are
clickable filters in the panel.

## Todo Presentation And Reminders

Each task uses a compact card:

1. drag handle, completion checkbox, plain-text content, delete action
2. ordinary reminder time and deadline
3. selectable deadline-reminder offsets
4. task tags

Deadline status uses theme-aware neutral, approaching, and overdue states.
Colors are not fixed to the reference-image annotations.

The reminder service triggers:

- the existing one-time reminder when `remindAt` is reached
- every selected deadline reminder when
  `deadlineAt - offsetMinutes` is reached

Completed tasks do not notify. Changing the deadline or selected offsets
resets the affected delivered state.

## Folder Interaction

The main panel renders the folder hierarchy and root items.

- Folders can be expanded or collapsed.
- Expanded folders display child item title bars only; item content stays
  hidden.
- Collapsed folders display title and descendant item count.
- Notes, todos, and folders can be reordered or moved by drag and drop.
- Invalid moves beyond three levels are rejected with a visible message.
- Clicking an item title opens its editor.

## Recycle Bin And Asset Lifecycle

Deleting an item or folder soft-deletes it by setting `deletedAt`. Deleted
folders include their descendants in the recycle-bin view.

Items remain recoverable for seven days. Restore returns the item and its
assets. Permanent deletion occurs when:

- the seven-day retention expires, or
- the user empties the recycle bin.

Asset cleanup scans active and recycled note Markdown. An unreferenced local
asset moves into the asset recycle directory. It is permanently removed after
the same retention period. Shared assets are never removed while referenced.

Settings provides:

- recycle-bin view and restore
- empty recycle bin
- clean unused local images

## Delivery Order

1. Editor reliability and media: layout, scrolling, selection stability,
   links, local images, multilevel numbering, and tags.
2. Todo deadlines: deadline fields, multiple advance reminders, styling, and
   notification scheduling.
3. Organization and cleanup: three-level folders, drag/drop, recycle bin, and
   asset lifecycle.

Each delivery must include migration tests, behavior tests, type checking,
production build, and Electron smoke launch.
