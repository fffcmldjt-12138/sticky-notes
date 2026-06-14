# Sticky Notes Design

## Summary

Build a Windows 10/11 desktop sticky notes application using Electron, React,
TypeScript, and Vite. The application is a single right-side panel with Note
and Todo cards, local JSON persistence, Markdown input and preview, reminders,
tray controls, and optional launch at login.

## Architecture

The Electron main process owns files, windows, tray controls, notifications,
and login settings. A context-isolated preload exposes a narrow typed API.
React owns the compact card-flow interface and never accesses Node directly.

Data is stored in versioned `notes.json` and `config.json` files under
Electron's user-data directory. Writes use a temporary file followed by an
atomic replacement. The renderer autosaves edits through IPC.

## Interface

The 360px panel opens against the current display's right work area. It
collapses to an 8px edge after a short pointer-leave delay and expands when the
pointer enters that edge. Editors and menus suspend automatic collapse.

Cards have one of four colored headers and only light or dark body surfaces.
The primary view is a compact card flow. Selecting a card replaces the list
with the relevant Note or Todo editor.

## Behavior

Notes support title, Markdown, preview, color, theme, edit, and deletion.
Todos add completion and reminder time. Due incomplete reminders trigger a
system notification once. Changing a reminder resets its reminded state.

Closing the window hides it. The tray owns show, hide, new Note, new Todo,
launch-at-login, and quit actions. Only quit terminates the application.

