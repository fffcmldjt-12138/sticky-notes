# Sticky Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working lightweight Windows sticky notes panel.

**Architecture:** Electron main services own operating-system and persistence
behavior. A typed preload bridge connects those services to a React card-flow
renderer.

**Tech Stack:** Electron, electron-vite, React, TypeScript, Vitest, react-markdown

---

### Task 1: Shared contracts and stores

- [ ] Define discriminated Note and Todo models and IPC contracts.
- [ ] Test and implement versioned atomic JSON stores.
- [ ] Test and implement create, update, delete, and reminder reset behavior.

### Task 2: Window, tray, config, and reminders

- [ ] Test window expanded and collapsed bounds calculations.
- [ ] Implement the right-edge BrowserWindow lifecycle and auto-hide bridge.
- [ ] Implement tray controls, config persistence, login settings, and notifications.

### Task 3: Renderer

- [ ] Implement the compact card-flow panel and create menu.
- [ ] Implement Note and Todo editors with debounced autosave.
- [ ] Add Markdown preview, color picker, body theme, completion, and reminders.

### Task 4: Verification

- [ ] Run tests, type checking, and production build.
- [ ] Inspect the final diff against the approved design.

