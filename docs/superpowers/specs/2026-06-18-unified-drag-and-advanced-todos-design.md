# Unified Drag And Advanced Todos Design

## Goal

Improve long-term interaction stability by replacing mixed native drag behavior
with one dnd-kit based system, while extending todos with quadrants, subtasks,
unified scheduling, recurrence, pinning, and complete folder interactions.

## Scope

This change includes:

- Unified drag and drop in the main panel and detached folder windows.
- Moving items and folders into folders, out to their parent level, and between
  sibling positions.
- Dragging an item or folder outside an application window to detach it without
  changing its folder membership.
- Per-task urgency and importance.
- One level of subtasks with independent scheduling and quadrant fields.
- Unified time, reminder, and recurrence settings.
- Pinning notes and todo cards.
- Folder creation actions and context menus in both panel and folder windows.
- Completed-task strike-through styling.
- Context-menu viewport collision handling.
- Fixes for clicks being mistaken for drag attempts.

Cloud sync, Siyuan sync, databases, holiday calendars, and task completion
history remain out of scope.

## Interaction Architecture

### Unified drag system

All in-app reordering uses dnd-kit. Native draggable elements are removed from
cards and folder rows.

Each draggable node has:

- A stable identity containing node kind and ID.
- A dedicated drag handle.
- A 6-pixel pointer activation threshold.
- Its current parent folder ID.
- A drag overlay representing the moving node.

Drop targets are:

- Explicit insertion zones between siblings.
- Folder bodies for moving into a folder.
- Parent-level exit zones for moving out one level.

Insertion zones expand and highlight while a compatible node is dragged over
them. This provides a visible gap instead of requiring a precise drop on a thin
line.

The drag controller calculates one move operation and sends it through the
existing folder reorder IPC. It must reject cycles and moves that would make a
folder tree deeper than three levels.

Dragging beyond the Electron window boundary detaches the node into a persistent
window. Detaching does not modify `parentFolderId`, so closing the detached
window returns the node to its original folder location.

### Click reliability

Only drag handles register dnd-kit listeners. Card headers, folder titles,
checkboxes, inputs, and context-menu actions remain ordinary click targets.
Transient overlays and menus unmount when dismissed or when a drag begins.

This removes the current native browser behavior where small pointer movement
on an entirely draggable card suppresses its click event.

## Context Menus

Context menus measure themselves after mounting and clamp their fixed position
inside the viewport with a small edge margin. They can flip left or upward when
opened near the bottom or right edge.

The shared card menu adds pin and unpin. Folder-child notes and todos use the
same card menu as top-level cards. Folder rows use a folder menu with:

- Rename.
- New note.
- New todo.
- New child folder when depth is below three.
- Delete.

Detached folder windows expose the same item and folder menus.

Menu dismissal listeners are attached only while the menu exists and are fully
removed on close. No transparent pointer-blocking layer remains.

## Folder Creation

Every expanded folder has a compact create action. Detached folder windows also
have a create button in their header.

The folder create menu receives the target folder ID and offers:

- New note.
- New todo.
- New child folder when the target depth is less than three.

At depth three, the child-folder action is hidden. The main-process store still
validates the maximum depth and returns a user-visible error if another entry
point attempts to create a fourth level.

New notes and todos are created directly in the target folder. New folders use
the target folder as `parentFolderId`.

## Todo Data Model

Each `TodoTask` gains:

- `importance`: `important | normal`.
- `urgency`: `urgent | normal`.
- `children`: a list of one-level `TodoSubtask` records.
- `schedule`: nullable schedule settings.

Each subtask has its own:

- ID and content.
- Completion state.
- Importance and urgency.
- Schedule settings.
- Tags.

Subtasks cannot contain children.

### Schedule model

The schedule contains:

- `mode`: `point | range`.
- `startAt`: ISO timestamp.
- `endAt`: ISO timestamp or null.
- `reminders`: selected offsets relative to the effective due time.
- `repeat`: `none | daily | weekly | weekdays`.

For a point schedule, `startAt` is the effective due time. For a range,
`endAt` is the final deadline and reminder reference.

Reminder offsets support:

- At due time.
- Common presets such as six hours, one day, and three days before.
- User-defined minute, hour, or day offsets.
- Multiple selections.

Each reminder stores its delivery state for the current occurrence. The data
migration converts legacy `remindAt`, `deadlineAt`, and `deadlineReminders`
values into the new schedule as closely as possible.

### Recurrence

Initial recurrence options are:

- None.
- Daily.
- Weekly.
- Weekdays.

Holiday-aware recurrence is deferred.

After a recurring occurrence reaches its effective due time, the reminder
service advances it to the next valid occurrence and clears completion and
reminder-delivery state. No historical completion record is retained.

For weekday recurrence, Saturday and Sunday are skipped. Weekly recurrence
preserves the weekday and local time.

## Todo Editing

Each task row contains:

- Drag handle.
- Completion checkbox.
- Content input.
- Quadrant control.
- One unified `时间设置` button.
- Subtask toggle and add action.
- Delete action.

The scheduling popover has three sections:

1. Time: point or range and date-time fields.
2. Reminder: preset and custom multiple selections.
3. Repeat: none, daily, weekly, or weekdays.

Subtasks render indented below their parent. They use the same editing controls
except that they cannot add another nesting level.

Completed parent tasks and completed subtasks display strike-through text and
reduced contrast in both editor and panel views.

## Quadrant And Card Ordering

Task priority ranks are:

1. Important and urgent.
2. Important and not urgent.
3. Urgent and not important.
4. Normal.

Within each todo card, incomplete parents are shown by priority rank while
preserving manual order inside the same rank. Completed tasks follow incomplete
tasks. Subtasks remain grouped under their parent.

At the top-level main panel:

1. Pinned notes and todo cards appear first.
2. Unpinned todo cards are ranked by their highest incomplete task or subtask.
3. Remaining notes, folders, and equal-ranked todos preserve manual sibling
   order.

Pinning affects only notes and todo cards and does not change folder membership.
Inside a folder, pinned notes and todos appear before unpinned sibling items.
Folders cannot be pinned.

Manual reorder updates `order`; ranking is a display rule layered over that
stored order.

## Main-Process Responsibilities

The main process remains responsible for:

- JSON migration and persistence.
- Folder-depth and cycle validation.
- Atomic move and reorder operations.
- Task and subtask CRUD.
- Reminder delivery and recurrence advancement.
- Detached-window creation and persisted geometry.

The renderer remains responsible for:

- dnd-kit interaction state and visual feedback.
- Menus, editors, popovers, and validation messages.
- Display sorting for pin and quadrant priority.
- Calling main-process operations through preload IPC only.

## Error Handling

- Invalid folder moves display the store error and leave the visual order
  unchanged.
- Drag cancellation performs no write.
- If a detached-window request fails, the node stays in place and an alert is
  shown.
- Invalid or incomplete schedules cannot be confirmed.
- A range end must be later than its start.
- Recurrence calculations operate in local time and persist resulting ISO
  timestamps.
- Menu position calculation always clamps to the current viewport.

## Migration

`notes.json` receives a new schema version. Migration:

- Adds quadrant defaults to every existing task.
- Adds empty subtask lists.
- Converts legacy reminders and deadlines to schedule data.
- Preserves titles, content, completion, tags, folders, ordering, pin state,
  detached state, and window bounds.
- Keeps a backup before upgrading older schema versions.

## Testing

Automated tests cover:

- Moving notes, todos, and folders into and out of folders.
- Moving out one level and preventing a fourth folder level.
- Detaching from any folder depth without changing membership.
- Expanded insertion zones and drag cancellation.
- Clicks that do not activate dragging below the threshold.
- Context menus clamped inside all viewport edges.
- Context menus for items nested in folders and detached folder windows.
- Folder-local creation and depth-three menu behavior.
- Pin ordering and quadrant ordering at panel and card level.
- Task and one-level subtask CRUD and completion styling.
- Point and range schedules.
- Multiple reminder offsets.
- Daily, weekly, and weekday recurrence advancement.
- Legacy data migration.
- Full typecheck, renderer tests, main-process tests, production build, package,
  and packaged-app smoke launch.

