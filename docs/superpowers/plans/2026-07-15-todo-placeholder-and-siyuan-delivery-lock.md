# Todo Placeholder and SiYuan Delivery Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure deleting the final todo task produces a real editable replacement task, and let users persistently block selected notes from SiYuan delivery.

**Architecture:** Keep the todo minimum-task invariant inside `NoteStore` so the renderer never depends on an unpersisted placeholder after deletion. Store the delivery lock on `NoteItem`, expose it through the existing revisioned item update path, render it in the shared delivery button, and enforce it again in `SiyuanDeliveryService` before any network or asset work.

**Tech Stack:** Electron, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Make the final todo task replacement atomic

**Files:**
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/renderer/src/components/TodoEditor.tsx`
- Test: `tests/noteStore.test.ts`
- Test: `tests/todoEditor.test.tsx`

- [ ] **Step 1: Write failing store tests**

Add tests proving that deleting the sole task returns one new blank task with a different persisted ID, while deleting one of two tasks leaves only the existing survivor.

```ts
const deleted = await store.deleteTodoTask(todo.id, original.id)
expect(deleted.status).toBe('ok')
if (deleted.status !== 'ok') throw new Error('expected ok')
expect(deleted.value.tasks).toHaveLength(1)
expect(deleted.value.tasks[0]).toMatchObject({ contentMarkdown: '', completed: false })
expect(deleted.value.tasks[0].id).not.toBe(original.id)
```

- [ ] **Step 2: Verify the store test fails**

Run: `rtk npm test -- tests/noteStore.test.ts`

Expected: FAIL because the current deletion stores an empty task array.

- [ ] **Step 3: Implement the store invariant**

Change `deleteTodoTask` to calculate the remaining tasks once and insert `createTodoTask()` only when the result is empty.

```ts
const remaining = todo.tasks.filter((task) => task.id !== taskId)
return { ...todo, tasks: remaining.length ? remaining : [createTodoTask()] }
```

- [ ] **Step 4: Write a failing editor regression test**

Render a one-task editor in a stateful harness. Make `onDeleteTask` rerender with a replacement persisted task, type into the replacement, advance the debounce timer, and assert `onUpdateTask` receives the replacement ID and content.

- [ ] **Step 5: Verify the editor test fails before renderer cleanup**

Run: `rtk npm test -- tests/todoEditor.test.tsx`

Expected: FAIL if a stale pending task remains or the replacement does not accept a save.

- [ ] **Step 6: Remove stale placeholder behavior minimally**

Keep compatibility for genuinely empty legacy todos, but reset/clear pending task state whenever the authoritative item replaces or removes that task. Normal deletion must render the task returned by `deleteTodoTask`, not a retained pending-only task.

- [ ] **Step 7: Verify Task 1**

Run: `rtk npm test -- tests/noteStore.test.ts tests/todoEditor.test.tsx`

Expected: PASS.

### Task 2: Persist the delivery lock safely

**Files:**
- Modify: `src/shared/models.ts`
- Modify: `src/main/services/NoteStore.ts`
- Modify: `src/main/services/noteMigration.ts`
- Modify: `src/main/services/storageValidators.ts`
- Modify: `src/main/services/DataArchiveService.ts`
- Test: `tests/noteMigration.test.ts`
- Test: `tests/storageValidators.test.ts`
- Test: `tests/noteStore.test.ts`
- Update: note fixtures that construct `NoteItem`

- [ ] **Step 1: Write failing model-boundary tests**

Assert that new notes default to `siyuanDeliveryDisabled: false`, legacy notes migrate to false, and archive validation accepts only a boolean field.

```ts
expect(created).toMatchObject({
  type: 'note',
  siyuanDeliveryDisabled: false
})
```

- [ ] **Step 2: Verify tests fail**

Run: `rtk npm test -- tests/noteStore.test.ts tests/noteMigration.test.ts tests/storageValidators.test.ts`

Expected: FAIL because the field does not exist.

- [ ] **Step 3: Add the field and patch support**

Add `siyuanDeliveryDisabled: boolean` to `NoteItem`, allow it in `StickyItemPatch`, initialize it to false for new notes, and upgrade `NotesFile` from version 6 to 7. Migrate version 6 with a protected backup, normalize the missing field with `Boolean(note.siyuanDeliveryDisabled)`, update archive manifests to version 7, and require the field in validated version 7 data.

- [ ] **Step 4: Update typed fixtures mechanically**

Add `siyuanDeliveryDisabled: false` to every `NoteItem` test fixture. Do not add it to todos.

- [ ] **Step 5: Verify Task 2**

Run: `rtk npm test -- tests/noteStore.test.ts tests/noteMigration.test.ts tests/storageValidators.test.ts`

Expected: PASS.

### Task 3: Enforce and display the delivery lock

**Files:**
- Modify: `src/main/services/SiyuanDeliveryService.ts`
- Modify: `src/renderer/src/components/SiyuanDeliveryButton.tsx`
- Modify: `src/renderer/src/styles/note-card.css`
- Test: `tests/siyuanDeliveryService.test.ts`
- Test: `tests/siyuanDeliveryButton.test.tsx`

- [ ] **Step 1: Write failing service and button tests**

Service test: mark a note blocked, call `send`, expect rejection with `该笔记已禁止投送到思源`, and assert asset/client mocks were not called.

Button test: render a blocked note and expect a disabled button named `已禁止投送到思源` with a lock icon/state class.

- [ ] **Step 2: Verify tests fail**

Run: `rtk npm test -- tests/siyuanDeliveryService.test.ts tests/siyuanDeliveryButton.test.tsx`

Expected: FAIL because blocked notes are still deliverable and the button has no lock state.

- [ ] **Step 3: Add defense in depth**

In `sendOnce`, check the flag immediately after validating the note identity and before blank-content, fingerprint, asset, or API work.

```ts
if (item.siyuanDeliveryDisabled) {
  throw new Error('该笔记已禁止投送到思源')
}
```

- [ ] **Step 4: Render the locked button**

Use Lucide `Lock`, set `disabled={true}`, label/title to `已禁止投送到思源`, and apply a subdued `.delivery-disabled` style. The blocked state takes precedence over sending, retry, changed, and already-sent labels.

- [ ] **Step 5: Verify Task 3**

Run: `rtk npm test -- tests/siyuanDeliveryService.test.ts tests/siyuanDeliveryButton.test.tsx`

Expected: PASS.

### Task 4: Add the reversible context-menu action everywhere

**Files:**
- Modify: `src/renderer/src/components/CardContextMenu.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/DetachedFolder.tsx`
- Test: `tests/cardActions.test.tsx`
- Test: `tests/detachedFolder.test.tsx`

- [ ] **Step 1: Write failing menu and wiring tests**

Assert note menus show `禁止投送到思源` or `允许投送到思源` from current state, todos show neither, and invoking the action sends a revisioned update containing the toggled boolean in both main and detached-folder contexts.

- [ ] **Step 2: Verify tests fail**

Run: `rtk npm test -- tests/cardActions.test.tsx tests/detachedFolder.test.tsx`

Expected: FAIL because no delivery-lock action exists.

- [ ] **Step 3: Add the shared action**

Extend `CardAction` with:

```ts
| { type: 'siyuan-delivery-disabled'; disabled: boolean }
```

Render the menu item only for notes. In both action handlers call the existing revisioned `save` function with `{ siyuanDeliveryDisabled: action.disabled }`.

- [ ] **Step 4: Verify Task 4**

Run: `rtk npm test -- tests/cardActions.test.tsx tests/detachedFolder.test.tsx tests/appCreation.test.tsx`

Expected: PASS.

### Task 5: Full verification and release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Run all checks**

```powershell
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk npm run smoke
rtk git diff --check
```

Expected: all commands pass; the development-only Electron CSP warning may still appear during smoke testing.

- [ ] **Step 2: Bump the patch version and build the installer**

Run `rtk npm version patch --no-git-tag-version`, then `rtk npm run dist`.

- [ ] **Step 3: Commit, push, and publish**

Commit the implementation, push `codex/desktop-sticky-notes` and fast-forward `main`, then create the matching GitHub Release with the generated NSIS installer attached.
