# Reliability, Performance, and Release Design

## Goal

Make the current desktop sticky-notes build resilient to damaged local data,
reliable when reminders fire, faster to become interactive, consistent across
panel and detached folder windows, and distributable through GitHub Releases.

## Architecture

### Data recovery

`NoteStore` remains responsible for schema migration. Initialization will read
through a recovery-aware path: malformed JSON is copied to a timestamped
`notes.json.corrupt-*` file and replaced with an empty version-4 document.
Recognized old schemas are backed up and migrated. A valid but unknown future
schema is preserved and rejected rather than silently overwritten.

### Reminders

`ReminderService.check()` will be single-flight so timer ticks cannot overlap.
The main process will own showing and focusing the panel when a reminder fires.
System notifications will open the corresponding todo when clicked, while the
renderer banner keeps its existing explicit View action.

### Renderer loading

Heavy editor and secondary page components will use React lazy imports. The
panel list and todo editor remain in the initial chunk; Tiptap and the note
editor move to an asynchronous chunk. Loading fallbacks stay compact and do
not alter the panel layout.

### Folder state

Folder create/update/delete and detached-window lifecycle changes will be
broadcast from the main process. Renderers will subscribe through preload and
update their folder lists without manual reloads.

### Release

After tests, type checking, production build, smoke test, and installer build,
the version will be incremented. All intended changes will be committed and
pushed to the existing branch. A `v<version>` tag will trigger the existing
GitHub Actions release workflow; the resulting GitHub Release must contain the
Windows installer before this work is considered complete.

## Error Handling

- Corrupt JSON is preserved before reset.
- Unknown schema versions are never destroyed automatically.
- Reminder failures release the single-flight lock in `finally`.
- Notification click handling tolerates closed or hidden panels.
- Folder broadcasts only occur after store operations succeed.

## Verification

- Regression tests cover corrupt-file recovery, future-version preservation,
  reminder single-flight behavior, notification-to-panel behavior, lazy editor
  loading, and folder broadcasts.
- Full unit/component suite, TypeScript, production build, Electron smoke test,
  and NSIS packaging must pass.
- Build output must contain a separate Tiptap/editor chunk and a smaller initial
  renderer chunk than the current 1.80 MB bundle.
- The pushed tag and GitHub Release assets are verified remotely.
