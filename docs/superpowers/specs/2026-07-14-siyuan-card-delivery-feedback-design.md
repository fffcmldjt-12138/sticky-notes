# SiYuan Card Delivery Feedback Design

## Goal

Make one-way SiYuan delivery visible and self-explanatory from the main note card, without relying on a context menu or requiring the user to open SiYuan to confirm success.

## Interaction

- Remove `发送到思源` from the note context menu.
- Add a compact SiYuan delivery button beside the note title in the card header.
- Do not show the button on todo cards.
- Stop the button click from opening the editor or starting a card drag.
- While sending, disable the button and show a sending state.
- After success, show an `已发送` state on the button and a temporary panel notification containing the note title.
- If the note changes after delivery, show a `需再次发送` state.
- On failure, keep the note unchanged, restore a retryable button state, and show the concrete error in a temporary panel notification.

## Structure

- `StickyCard` gains an optional header action slot so the shared note/todo header structure remains consistent.
- `NoteCard` owns the note-only delivery button and reports success or failure through callbacks supplied by the parent panel.
- `App` and `DetachedFolder` call the existing typed SiYuan IPC API, update their local item state from the returned note, and render a lightweight toast notification.
- The existing editor delivery button remains available because it is useful while finishing a note.

## Feedback

Only one toast is visible at a time. It disappears automatically after a short delay and can be replaced immediately by a newer result. Success and failure use restrained visual differences rather than modal dialogs.

## Testing

- Note cards expose the header delivery button; todo cards do not.
- The context menu no longer exposes SiYuan delivery.
- Clicking the header button does not open the editor.
- Success updates the card state and shows a success toast.
- Failure shows an error toast and leaves the button retryable.
