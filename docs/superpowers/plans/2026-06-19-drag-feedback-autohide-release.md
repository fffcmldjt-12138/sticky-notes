# Drag Feedback, Auto-Hide Stability, And GitHub Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make full card/folder headers draggable with a visible card overlay, stop right-edge auto-hide flicker, and publish versioned installers through GitHub Releases.

**Architecture:** Extend the existing dnd-kit tree context so headers own drag listeners and the overlay receives full node metadata. Replace repeated bounds calls in `WindowService` with a small guarded state machine. Add a tag-triggered GitHub Actions release workflow and publish `v0.6.2` assets.

**Tech Stack:** Electron, React, TypeScript, dnd-kit, Vitest, GitHub Actions, GitHub CLI.

---

### Task 1: Full Header Dragging And Visual Overlay

**Files:**
- Modify: `src/renderer/src/components/StickyCard.tsx`
- Modify: `src/renderer/src/components/FolderCard.tsx`
- Modify: `src/renderer/src/components/TreeDndContext.tsx`
- Create: `src/renderer/src/components/TreeDragOverlay.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Modify: `tests/folderPanel.test.tsx`
- Modify: `tests/treeDrag.test.ts`

- [ ] Write failing tests that card and folder header elements expose dnd-kit
  drag attributes, while nested buttons stop pointer propagation.
- [ ] Write a failing overlay test expecting type, title, and header color.
- [ ] Run `rtk npx vitest run tests/folderPanel.test.tsx tests/treeDrag.test.ts`
  and confirm the new assertions fail.
- [ ] Move listeners and attributes from `TreeDragHandle` to header/title bar.
  Keep the visual handle as a decorative affordance with
  `pointer-events: none`.
- [ ] Add `TreeDragOverlay` receiving node kind, title, header color, and body
  theme. Render it through `DragOverlay` with `dropAnimation={null}`.
- [ ] Stop pointer propagation on open, toggle, and create buttons.
- [ ] Run focused tests and `rtk npm run typecheck`.
- [ ] Commit with `git commit -m "fix: restore natural header dragging"`.

### Task 2: Drag Auto-Hide Suspension

**Files:**
- Modify: `src/renderer/src/components/TreeDndContext.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `tests/folderPanel.test.tsx`

- [ ] Write failing tests proving drag start calls a suspension callback and
  drag end/cancel always calls a resume callback.
- [ ] Run the focused test and confirm failure.
- [ ] Add `onDragStateChange(active: boolean)` to `TreeDndContext` and
  `StickyPanel`.
- [ ] In `App`, merge drag-active state into `suspendAutoHide`.
- [ ] Run focused tests and typecheck.
- [ ] Commit with `git commit -m "fix: suspend auto hide while dragging"`.

### Task 3: Guarded Window Auto-Hide State Machine

**Files:**
- Create: `src/main/services/PanelVisibilityState.ts`
- Modify: `src/main/services/WindowService.ts`
- Test: `tests/panelVisibilityState.test.ts`
- Modify: `tests/windowGeometry.test.ts`

- [ ] Write failing tests for:
  - repeated expand producing one transition;
  - collapse delayed until 500ms after expand;
  - suspension cancelling collapse;
  - repeated collapse scheduling one timer.
- [ ] Run `rtk npx vitest run tests/panelVisibilityState.test.ts` and confirm
  the module is missing.
- [ ] Implement `PanelVisibilityState` with `expanded`, `collapsing`, and
  `collapsed`, plus protection deadline and pending-collapse state.
- [ ] Inject the state into `WindowService`; apply bounds only when transition
  methods return a new target.
- [ ] Use `window.setBounds(bounds, false)` for both expand and collapse.
- [ ] Run focused tests, full typecheck, and commit with
  `git commit -m "fix: stabilize right edge auto hide"`.

### Task 4: GitHub Release Automation

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Add workflow triggered by `push.tags: ['v*']` on `windows-latest`.
- [ ] Configure steps:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: npm
- run: npm ci
- run: npm test
- run: npm run typecheck
- run: npm run dist
- uses: softprops/action-gh-release@v2
  with:
    files: |
      release/StickyNotes-*-Setup.exe
      release/StickyNotes-*-Setup.exe.blockmap
```

- [ ] Set workflow permission `contents: write`.
- [ ] Document GitHub Releases download location and tag-based publishing.
- [ ] Bump version to `0.6.2` using
  `rtk npm version 0.6.2 --no-git-tag-version`.
- [ ] Run full tests, typecheck, build, dist, packaged smoke, and
  `rtk git diff --check`.
- [ ] Commit release files with
  `git commit -m "chore: release version 0.6.2"`.

### Task 5: Publish Release

**Files:**
- Asset: `release/StickyNotes-0.6.2-Setup.exe`
- Asset: `release/StickyNotes-0.6.2-Setup.exe.blockmap`

- [ ] Push feature branch and `main`.
- [ ] Create and push annotated tag `v0.6.2`.
- [ ] Create GitHub Release:

```powershell
rtk gh release create v0.6.2 `
  release/StickyNotes-0.6.2-Setup.exe `
  release/StickyNotes-0.6.2-Setup.exe.blockmap `
  --repo fffcmldjt-12138/sticky-notes `
  --title "轻量便签 v0.6.2" `
  --notes "改进表头拖拽反馈并修复右侧自动隐藏闪烁。"
```

- [ ] Verify with
  `rtk gh release view v0.6.2 --repo fffcmldjt-12138/sticky-notes`.
- [ ] Confirm both asset names and the public release URL.

