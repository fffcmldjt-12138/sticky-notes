# Drag Feedback, Auto-Hide Stability, And GitHub Release Design

## Goal

Restore natural header dragging with visible card feedback, prevent right-edge
auto-hide flicker, and publish Windows installers through GitHub Releases.

## Drag Interaction

- A note or todo's entire colored header starts dragging after the existing
  6-pixel activation threshold.
- A folder's entire title bar starts dragging under the same rule.
- Interactive controls inside headers stop pointer propagation so expand,
  create, and open actions remain ordinary clicks.
- Folder-child rows keep their dedicated handle because they do not have a
  full colored card header.
- The drag overlay renders a compact visual clone with type, title, header
  color, and body theme instead of a text-only label.
- The overlay remains attached to the pointer outside the renderer viewport.
  Releasing outside creates or focuses the detached window.
- Drag start suspends panel auto-hide; drag end or cancellation resumes it.

## Auto-Hide State

The main-process window service tracks `expanded`, `collapsing`, and `collapsed`.

- Repeated requests for the current state do nothing.
- Expanding starts a 500ms minimum-visible protection period.
- Collapse requests during the protection period are delayed until it expires.
- Collapse is scheduled only once and cancelled when the pointer returns.
- While auto-hide is suspended by editing, menus, dialogs, or dragging, no
  collapse executes.
- Bounds changes are applied once per transition without animation to avoid
  renderer enter/leave events repeatedly firing while the window moves.
- The collapsed 8-pixel hot edge remains visible and expands on pointer entry.

## GitHub Release

- Version is bumped to `0.6.2`.
- A tag `v0.6.2` identifies the release commit.
- GitHub Release assets include:
  - `StickyNotes-0.6.2-Setup.exe`
  - `StickyNotes-0.6.2-Setup.exe.blockmap`
- Generated installers remain outside Git tracking.
- A GitHub Actions workflow runs on `v*` tags, installs dependencies, tests,
  typechecks, builds the NSIS installer, and uploads both assets to the release.
- The current release is also created directly with the authenticated GitHub
  CLI after local verification.

## Verification

- Header pointer movement below 6 pixels remains a click.
- Header dragging exposes dnd-kit listeners and no longer requires the small
  handle.
- Header buttons do not start dragging.
- Drag overlay includes type/title/color visual information.
- Dragging suspends auto-hide and always resumes after end/cancel.
- Repeated expand and collapse calls produce one bounds transition.
- Collapse does not happen during the 500ms expanded protection period.
- Full tests, typecheck, build, package, packaged smoke launch, tag push, and
  GitHub Release asset verification succeed.

