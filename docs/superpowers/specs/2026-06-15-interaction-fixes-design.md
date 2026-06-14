# Interaction Fixes Design

## Scope

This revision fixes five focused interaction problems without changing the
storage format or reminder model.

## Creation Flow

- Choosing "New Note" immediately creates one untitled note and opens its
  editor.
- Choosing "New Todo" immediately creates one untitled todo and opens its
  editor.
- Creation does not show a title dialog. The title remains editable in the
  editor header.
- Renderer state treats the main-process item-changed broadcast as an upsert,
  so the item returned from IPC cannot produce a duplicate card.

## Todo Input

- Each todo task uses a plain single-line text input.
- Todo tasks retain independent completion and reminder controls.
- Existing Markdown-looking task text remains plain text; no data migration is
  required because the existing string field can still store it.

## Detached Windows

- Detached editors show a close button instead of a panel-style back button.
- Closing only closes the detached window and returns the item to the main
  panel. It never deletes the item.
- The editor header is the draggable window region. Interactive title and
  button controls remain non-draggable.
- The existing persistent bounds and live data synchronization stay intact.

## Verification

- Component tests cover creation upsert behavior, direct creation without a
  title dialog, plain todo inputs, and detached close controls.
- Detached window service tests continue to verify that user closure clears
  the detached state.
- Type checking, the full test suite, production build, and Electron smoke
  launch must pass.
