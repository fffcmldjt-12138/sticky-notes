export type BodyTheme = 'light' | 'dark'
export type NoteType = 'note' | 'todo'
export type HeaderColor = `#${string}`

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
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
}

export interface TodoItem extends BaseItem {
  type: 'todo'
  tasks: TodoTask[]
}

export type StickyItem = NoteItem | TodoItem

export interface NotesFile {
  version: 2
  items: StickyItem[]
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
    | 'updatedAt'
  >
> & {
  contentMarkdown?: string
}

export type TodoTaskPatch = Partial<
  Pick<TodoTask, 'contentMarkdown' | 'completed' | 'remindAt' | 'reminded'>
>

