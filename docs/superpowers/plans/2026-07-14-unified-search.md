# Unified Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide deterministic local search and smart filters across notes, tasks, subtasks, folders, tags, schedules, and attachment names without adding a database.

**Architecture:** A main-process `SearchService` owns an in-memory normalized index built from `NoteStore` snapshots. Domain events incrementally update affected documents, while restore/import and folder hierarchy changes request a full rebuild. The renderer receives typed result summaries through IPC and swaps the normal tree for a focused search view without losing panel state.

**Tech Stack:** Electron IPC, TypeScript, React, Vitest, Testing Library

---

### Task 1: Search domain types and text normalization

**Files:**
- Create: `src/shared/search.ts`
- Create: `tests/searchNormalization.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Cover Unicode lowercasing, full-width/half-width normalization, collapsed whitespace, Markdown syntax removal for snippets, and AND keyword splitting:

```ts
expect(normalizeSearchText('  Ｃ＃\n 复习 ')).toBe('c# 复习')
expect(parseSearchTerms('C#  构造函数')).toEqual(['c#', '构造函数'])
```

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/searchNormalization.test.ts`

Expected: FAIL because `src/shared/search.ts` does not exist.

- [ ] **Step 3: Define search contracts and helpers**

```ts
export type SearchEntityType = 'note' | 'todo-task' | 'todo-subtask' | 'folder'

export interface SearchQuery {
  text: string
  types: SearchEntityType[]
  completion: 'all' | 'open' | 'completed'
  time: 'all' | 'today' | 'overdue' | 'next-seven-days' | 'recent'
  priorities: Array<'important-urgent' | 'important-normal' | 'normal-urgent' | 'normal-normal'>
  pinnedOnly: boolean
  tags: string[]
  folderIds: string[]
  includeDeleted: boolean
}

export interface SearchResult {
  key: string
  type: SearchEntityType
  itemId?: string
  taskId?: string
  subtaskId?: string
  folderId?: string
  title: string
  snippet: string
  matchedField: 'title' | 'tag' | 'body' | 'folder' | 'attachment'
  updatedAt: string
  score: number
}
```

Use `value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim()` and a small Markdown-to-text helper that removes formatting markers while retaining link labels and URLs.

- [ ] **Step 4: Run tests and commit**

Run: `rtk npm test -- tests/searchNormalization.test.ts`

```powershell
rtk git add src/shared/search.ts tests/searchNormalization.test.ts
rtk git commit -m "feat: define deterministic local search contracts"
```

### Task 2: In-memory index and query engine

**Files:**
- Create: `src/main/services/SearchService.ts`
- Create: `tests/searchService.test.ts`

- [ ] **Step 1: Write failing search tests**

Use fixtures containing notes, parent tasks, subtasks, tags, nested folders, image filenames, deleted entities, schedules, pinned items, and all four quadrants. Test:

- every indexed field;
- AND terms;
- title > tag > body score;
- same-category OR and cross-category AND filters;
- local-day boundaries;
- default recycle exclusion;
- deterministic sorting.

```ts
expect(service.search({ ...emptyQuery, text: '构造 默认' }))
  .toMatchObject([{ itemId: 'note_1', matchedField: 'body' }])
```

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/searchService.test.ts`

Expected: FAIL because `SearchService` does not exist.

- [ ] **Step 3: Implement normalized documents and folder paths**

Use an internal document shape:

```ts
interface SearchDocument extends SearchResult {
  normalizedTitle: string
  normalizedTags: string
  normalizedBody: string
  normalizedFolder: string
  normalizedAttachments: string
  completed?: boolean
  pinned: boolean
  priority?: string
  dueAt?: string
  deleted: boolean
  folderAncestors: string[]
}
```

Build one document per note, todo task, todo subtask, and folder. A todo card title is included in task/subtask title context but does not create a duplicate result. Extract attachment names from Markdown image/link labels and `asset://local/` URL basenames; do not open image or PDF contents. Generate snippets from the first matching field with 32 characters of context on each side. Derive task due time through the existing shared schedule helper so reminder and search boundaries agree.

- [ ] **Step 4: Implement query and sorting**

All parsed terms must match at least one searchable field on the same document. Apply filters before scoring. Sort pinned item results first, then todo priority, score, updated time descending, and stable key ascending.

- [ ] **Step 5: Run tests and commit**

Run: `rtk npm test -- tests/searchService.test.ts tests/searchNormalization.test.ts`

```powershell
rtk git add src/main/services/SearchService.ts tests/searchService.test.ts
rtk git commit -m "feat: add in-memory search index and filters"
```

### Task 3: Incremental index updates and full rebuilds

**Files:**
- Modify: `src/main/services/SearchService.ts`
- Modify: `src/main/main.ts`
- Modify: `tests/searchService.test.ts`
- Create: `tests/searchIntegration.test.ts`

- [ ] **Step 1: Write failing update tests**

Assert an item change replaces only its item/task/subtask documents, deletion removes ordinary results, folder rename refreshes descendant paths, and import/restore rebuilds everything.

```ts
search.updateItem(changedTodo, folders)
expect(search.debugReindexedKeys()).toEqual([
  'todo-task:todo_1:task_1',
  'todo-subtask:todo_1:task_1:child_1'
])
```

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/searchService.test.ts tests/searchIntegration.test.ts`

Expected: FAIL because only full construction exists.

- [ ] **Step 3: Connect domain broadcasts to index updates**

Initialize once from `await notes.getSnapshot()`. Before broadcasting successful item changes, call `search.updateItem`. Folder create/update/move/delete calls `search.rebuild(await notes.getSnapshot())` because descendant paths may change. Data restore/import also rebuilds from a fresh snapshot before the full-refresh broadcast.

- [ ] **Step 4: Run tests and commit**

Run: `rtk npm test -- tests/searchService.test.ts tests/searchIntegration.test.ts`

```powershell
rtk git add src/main/services/SearchService.ts src/main/main.ts tests/searchService.test.ts tests/searchIntegration.test.ts
rtk git commit -m "feat: keep search index synchronized with local data"
```

### Task 4: Search IPC and preload API

**Files:**
- Create: `src/main/ipc/searchIpc.ts`
- Modify: `src/shared/ipcChannels.ts`
- Modify: `src/shared/electronApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/main.ts`
- Create: `tests/searchIpc.test.ts`

- [ ] **Step 1: Write failing IPC tests**

Verify typed query forwarding, result return, malformed query rejection, and no filesystem exposure.

```ts
expect(search.search).toHaveBeenCalledWith(expect.objectContaining({
  text: '作业',
  includeDeleted: false
}))
```

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/searchIpc.test.ts`

Expected: FAIL because search IPC does not exist.

- [ ] **Step 3: Expose a single query method**

```ts
search: {
  query(query: SearchQuery): Promise<SearchResult[]>
}
```

Validate enum values and array lengths in the main process. Limit text to 500 characters and result count to 200. Return summaries only, never full note bodies.

- [ ] **Step 4: Run IPC tests and typecheck**

Run:

```powershell
rtk npm test -- tests/searchIpc.test.ts
rtk npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
rtk git add src/main/ipc/searchIpc.ts src/shared/ipcChannels.ts src/shared/electronApi.ts src/preload/index.ts src/main/main.ts tests/searchIpc.test.ts
rtk git commit -m "feat: expose local search through typed IPC"
```

### Task 5: Search controls and smart filters

**Files:**
- Create: `src/renderer/src/components/SearchBar.tsx`
- Create: `src/renderer/src/components/SearchFilters.tsx`
- Create: `src/renderer/src/pages/SearchPanel.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Create: `tests/searchPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

Cover opening search, 150 ms input debounce, loading/empty/error states, Today/Overdue/Next 7 Days/Important Urgent/Recent smart filters, removable filter chips, and accessible labels.

```tsx
fireEvent.click(screen.getByRole('button', { name: '已逾期' }))
expect(onQuery).toHaveBeenCalledWith(expect.objectContaining({ time: 'overdue' }))
```

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/searchPanel.test.tsx`

Expected: FAIL because search components do not exist.

- [ ] **Step 3: Build compact search UI**

`SearchBar` uses a search icon, clear icon, and close icon with tooltips. `SearchFilters` uses a menu for option sets and chips for active filters. `SearchPanel` owns the query request sequence and ignores stale results. Do not render cards inside a card or add explanatory feature copy.

- [ ] **Step 4: Run component tests and commit**

Run: `rtk npm test -- tests/searchPanel.test.tsx`

```powershell
rtk git add src/renderer/src/components/SearchBar.tsx src/renderer/src/components/SearchFilters.tsx src/renderer/src/pages/SearchPanel.tsx src/renderer/src/styles/sticky-panel.css tests/searchPanel.test.tsx
rtk git commit -m "feat: add compact search and smart-filter UI"
```

### Task 6: Panel integration and state restoration

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/StickyPanel.tsx`
- Modify: `src/renderer/src/styles/sticky-panel.css`
- Create: `tests/appSearch.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Test that search replaces the tree, no-query mode shows smart filters, closing search restores folder collapse state and list scroll position, and newly received item broadcasts trigger a current-query refresh without closing search.

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/appSearch.test.tsx tests/folderPanel.test.tsx`

Expected: FAIL because `App` has no search mode.

- [ ] **Step 3: Add search mode without a new route**

Store:

```ts
const [searchOpen, setSearchOpen] = useState(false)
const panelScrollRef = useRef(0)
```

Before opening search, capture `.card-list.scrollTop`. On close, render `StickyPanel` with the same item/folder state and restore scroll in `requestAnimationFrame`. Do not mutate folder `collapsed` values when searching.

- [ ] **Step 4: Run integration tests and commit**

Run: `rtk npm test -- tests/appSearch.test.tsx tests/folderPanel.test.tsx`

```powershell
rtk git add src/renderer/src/App.tsx src/renderer/src/pages/StickyPanel.tsx src/renderer/src/styles/sticky-panel.css tests/appSearch.test.tsx
rtk git commit -m "feat: integrate search without losing panel state"
```

### Task 7: Result navigation

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/TodoEditor.tsx`
- Modify: `src/renderer/src/components/TodoTaskRow.tsx`
- Modify: `src/renderer/src/components/TodoSubtaskRow.tsx`
- Modify: `src/renderer/src/components/NoteEditor.tsx`
- Modify: `tests/appSearch.test.tsx`
- Modify: `tests/todoEditor.test.tsx`

- [ ] **Step 1: Write failing navigation tests**

Click note, task, subtask, and folder results. Assert notes open with a visible search-term indicator but unchanged cursor; task results expand and focus the exact row; folder results exit search and scroll the matching folder into view.

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/appSearch.test.tsx tests/todoEditor.test.tsx`

Expected: FAIL because result IDs are not routed into editors.

- [ ] **Step 3: Add explicit navigation targets**

```ts
interface EditorTarget {
  itemId: string
  taskId?: string
  subtaskId?: string
  searchText?: string
}
```

Pass the target into editors. Todo rows expose stable `data-task-id` and `data-subtask-id`, expand before focus, then call `scrollIntoView({ block: 'nearest' })`. Note editor renders a compact “搜索：…” indicator and does not alter selection.

- [ ] **Step 4: Run tests and commit**

Run: `rtk npm test -- tests/appSearch.test.tsx tests/todoEditor.test.tsx tests/editorFocus.test.tsx`

```powershell
rtk git add src/renderer/src/App.tsx src/renderer/src/components/TodoEditor.tsx src/renderer/src/components/TodoTaskRow.tsx src/renderer/src/components/TodoSubtaskRow.tsx src/renderer/src/components/NoteEditor.tsx tests/appSearch.test.tsx tests/todoEditor.test.tsx tests/editorFocus.test.tsx
rtk git commit -m "feat: navigate search results to exact todo rows"
```

### Task 8: Internal external-capture boundary

**Files:**
- Create: `src/main/services/ExternalCaptureService.ts`
- Create: `tests/externalCaptureService.test.ts`
- Modify: `src/shared/models.ts`

- [ ] **Step 1: Write failing idempotency and validation tests**

Test note/todo creation, target-folder validation, tag normalization, duplicate external request IDs, and rejection of attachment paths outside explicitly supplied files.

```ts
const first = await capture.capture({ source: 'test', externalId: '42', type: 'note', body: 'x' })
const retry = await capture.capture({ source: 'test', externalId: '42', type: 'note', body: 'x' })
expect(retry.id).toBe(first.id)
expect(store.create).toHaveBeenCalledTimes(1)
```

- [ ] **Step 2: Run and verify failure**

Run: `rtk npm test -- tests/externalCaptureService.test.ts`

Expected: FAIL because the internal service does not exist.

- [ ] **Step 3: Implement the internal-only service**

Define persisted metadata and the request explicitly:

```ts
export interface ExternalCaptureMetadata {
  source: string
  externalId: string
  capturedAt: string
}

export interface ExternalCaptureRequest {
  source: string
  externalId: string
  type: NoteType
  title?: string
  body: string
  tags?: string[]
  parentFolderId?: string | null
  attachmentPaths?: string[]
}
```

Add optional `externalCapture?: ExternalCaptureMetadata` to `BaseItem`; migration normalizes missing metadata to `undefined`. Keep an in-memory idempotency map seeded from this metadata on existing items. Call only `NoteStore` domain methods; do not add IPC, HTTP, named pipes, CLI, URL schemes, or settings. Because generic attachments are outside this release, reject non-empty `attachmentPaths` with a typed `UNSUPPORTED_ATTACHMENT` error rather than silently dropping them.

- [ ] **Step 4: Run tests and commit**

Run: `rtk npm test -- tests/externalCaptureService.test.ts tests/noteStore.test.ts`

```powershell
rtk git add src/main/services/ExternalCaptureService.ts src/shared/models.ts tests/externalCaptureService.test.ts
rtk git commit -m "feat: reserve an idempotent external capture boundary"
```

### Task 9: Search release gate

**Files:**
- Modify: `README.md`
- Modify: `tests/appLazyLoading.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Keep search code split from initial panel bundle**

Lazy-load `SearchPanel` from `App.tsx` and extend `appLazyLoading.test.ts` to assert it remains a separate renderer chunk.

- [ ] **Step 2: Run full verification**

Run:

```powershell
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk npm run dist -- --publish never
rtk pwsh -NoProfile -Command '$env:SMOKE_GRACEFUL_EXIT="1"; rtk npm run smoke -- "release\win-unpacked\轻量便签.exe"'
```

Expected: all tests pass; build output contains a separate SearchPanel chunk; installer and packaged smoke exit 0 without renderer/preload errors.

- [ ] **Step 3: Update user documentation**

Document searchable fields, smart filters, recycle exclusion, first-version matching limits, and the absence of cloud or semantic search.

- [ ] **Step 4: Commit**

```powershell
rtk git add README.md src/renderer/src/App.tsx tests/appLazyLoading.test.ts package.json package-lock.json
rtk git commit -m "docs: document unified local search"
```
