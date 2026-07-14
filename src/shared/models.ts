export type BodyTheme = 'light' | 'dark'
export type NoteType = 'note' | 'todo'
export type HeaderColor = `#${string}`

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface AssetReference {
  fileName: string
  mimeType: string
  url: string
}

export interface SiyuanDelivery {
  notebookId: string
  documentId: string
  sentAt: string
  contentFingerprint: string
}

export interface BaseItem {
  id: string
  revision: number
  type: NoteType
  title: string
  headerColor: HeaderColor
  bodyTheme: BodyTheme
  pinned: boolean
  detached: boolean
  windowBounds: WindowBounds | null
  parentFolderId: string | null
  tags: string[]
  order: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NoteItem extends BaseItem {
  type: 'note'
  contentMarkdown: string
  siyuanDelivery: SiyuanDelivery | null
}

export type TaskImportance = 'important' | 'normal'
export type TaskUrgency = 'urgent' | 'normal'
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'weekdays'

export interface TaskReminder {
  id: string
  offsetMinutes: number
  remindedAt: string | null
  snoozedUntil?: string | null
}

export interface TodoSchedule {
  mode: 'point' | 'range'
  startAt: string
  endAt: string | null
  reminders: TaskReminder[]
  repeat: TaskRepeat
}

export interface TodoSubtask {
  id: string
  contentMarkdown: string
  completed: boolean
  importance: TaskImportance
  urgency: TaskUrgency
  tags: string[]
  schedule: TodoSchedule | null
}

export interface TodoTask {
  id: string
  contentMarkdown: string
  completed: boolean
  tags: string[]
  importance: TaskImportance
  urgency: TaskUrgency
  children: TodoSubtask[]
  schedule: TodoSchedule | null
  remindAt?: string | null
  reminded?: boolean
  deadlineAt?: string | null
  deadlineReminders?: DeadlineReminder[]
}

export interface DeadlineReminder {
  id: string
  offsetMinutes: number
  remindedAt: string | null
}

export interface TodoItem extends BaseItem {
  type: 'todo'
  tasks: TodoTask[]
  panelExpanded: boolean
}

export type StickyItem = NoteItem | TodoItem

export type MutationResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'not-found' }
  | { status: 'conflict'; current: T }

export interface OrderedNodeRef {
  kind: 'item' | 'folder'
  id: string
}

export interface FolderItem {
  id: string
  revision: number
  title: string
  parentFolderId: string | null
  order: number
  collapsed: boolean
  detached: boolean
  windowBounds: WindowBounds | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export type FolderPatch = Partial<
  Pick<
    FolderItem,
    | 'title'
    | 'parentFolderId'
    | 'order'
    | 'collapsed'
    | 'detached'
    | 'windowBounds'
    | 'deletedAt'
  >
>

export interface NotesFile {
  version: 6
  items: StickyItem[]
  folders: FolderItem[]
}

export interface RecycleContents {
  items: StickyItem[]
  folders: FolderItem[]
}

export interface AppConfig {
  version: 1
  autoLaunch: boolean
  panelPosition: 'right'
  alwaysOnTop: boolean
  recentHeaderColors?: HeaderColor[]
  siyuan?: {
    endpoint: string
    inboxNotebookId: string | null
  }
}

export type StickyItemPatch = Partial<
  Pick<
    StickyItem,
    | 'title'
    | 'headerColor'
    | 'bodyTheme'
    | 'pinned'
    | 'detached'
    | 'windowBounds'
    | 'parentFolderId'
    | 'tags'
    | 'order'
    | 'deletedAt'
    | 'updatedAt'
  >
> & {
  contentMarkdown?: string
  panelExpanded?: boolean
}

export type TodoTaskPatch = Partial<
  Pick<
    TodoTask,
    | 'contentMarkdown'
    | 'completed'
    | 'tags'
    | 'importance'
    | 'urgency'
    | 'children'
    | 'schedule'
    | 'remindAt'
    | 'reminded'
    | 'deadlineAt'
    | 'deadlineReminders'
  >
>

export type TodoSubtaskPatch = Partial<
  Pick<
    TodoSubtask,
    | 'contentMarkdown'
    | 'completed'
    | 'tags'
    | 'importance'
    | 'urgency'
    | 'schedule'
  >
>
