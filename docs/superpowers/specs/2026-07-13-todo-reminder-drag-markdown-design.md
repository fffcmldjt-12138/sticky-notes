# Todo Completion, Strong Reminder, Drag, and Markdown Design

## Goal

Improve todo completion behavior, make reminders difficult to miss, expose
custom reminder configuration clearly, remove panel sorting feedback once a
drag leaves the application, and support Markdown headings through level five.

## Todo completion

- Subtasks are visible and directly checkable from the main todo card.
- A task with children is complete only when every child is complete.
- Completing the last incomplete child completes the parent task.
- Reopening any child reopens the parent task.
- Checking or unchecking a parent with children applies the same state to all
  of its children, preventing contradictory parent/child states.
- The canonical rule is enforced in `NoteStore`, so panel, editor, detached
  windows, and future clients cannot diverge.

## Strong reminders

Windows `Notification` remains enabled to produce the operating system's
default notification sound and retain an entry in Notification Center. In
addition, the main process opens one centered, always-on-top reminder window
and flashes its taskbar entry. The window displays the todo text and deadline
with three actions: open the todo, acknowledge, or snooze for 5, 10, or 30
minutes.

Snooze state is persisted on the specific reminder as an absolute ISO time.
Restarting the application therefore does not lose a snoozed reminder.
Multiple reminders are queued and shown one at a time rather than opening
overlapping windows.

## Reminder editor

The existing preset and custom reminder logic remains. Selected reminders are
rendered as removable chips beneath the controls. Adding a duplicate or invalid
custom reminder produces inline feedback. Multiple custom reminders are
supported and saved together.

## Drag behavior

The tree drag context tracks whether the current pointer is outside the panel
viewport. While inside, existing sorting gaps and the React drag overlay remain.
Once outside, internal drop indicators, layout displacement, and the React
overlay are suppressed; only the native desktop preview follows the pointer.
Returning inside restores normal sorting feedback before drop.

## Markdown headings

The Markdown toolbar exposes H1 through H5. H3, H4, and H5 use Tiptap heading
levels and serialize to `###`, `####`, and `#####` without changing the sticky
note's independent title bar.

## Testing and release

- Store tests cover parent/child completion in both directions.
- Card tests cover visible subtask checkboxes and callbacks.
- Reminder service/window tests cover persisted snooze, queueing, and actions.
- Schedule popover tests cover custom reminder chips, duplicates, and removal.
- Drag tests cover the inside/outside transition and suppressed panel overlay.
- Toolbar tests cover H3-H5 commands and Markdown serialization boundaries.
- Full tests, type checking, production build, source smoke, packaged smoke,
  installer creation, Git push, and GitHub Release verification are required.
