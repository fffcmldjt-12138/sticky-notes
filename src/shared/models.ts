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

export interface BaseItem {
  id: string
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
  syncedToSiyuan: false
}

export interface TodoTask {
  id: string
  contentMarkdown: string
  completed: boolean
  remindAt: string | null
  reminded: boolean
  tags: string[]
  deadlineAt: string | null
  deadlineReminders: DeadlineReminder[]
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

export interface OrderedNodeRef {
  kind: 'item' | 'folder'
  id: string
}

export interface FolderItem {
  id: string
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
  version: 3
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
    | 'remindAt'
    | 'reminded'
    | 'tags'
    | 'deadlineAt'
    | 'deadlineReminders'
  >
>
