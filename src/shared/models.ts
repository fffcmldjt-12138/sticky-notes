export type HeaderColor = 'yellow' | 'blue' | 'green' | 'pink'
export type BodyTheme = 'light' | 'dark'
export type NoteType = 'note' | 'todo'

export interface BaseItem {
  id: string
  type: NoteType
  title: string
  contentMarkdown: string
  headerColor: HeaderColor
  bodyTheme: BodyTheme
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface NoteItem extends BaseItem {
  type: 'note'
  syncedToSiyuan: false
}

export interface TodoItem extends BaseItem {
  type: 'todo'
  completed: boolean
  remindAt: string | null
  reminded: boolean
}

export type StickyItem = NoteItem | TodoItem

export interface NotesFile {
  version: 1
  items: StickyItem[]
}

export interface AppConfig {
  version: 1
  autoLaunch: boolean
  panelPosition: 'right'
  alwaysOnTop: boolean
}

export type StickyItemPatch = Partial<
  Pick<
    StickyItem,
    | 'title'
    | 'contentMarkdown'
    | 'headerColor'
    | 'bodyTheme'
    | 'pinned'
    | 'updatedAt'
  >
> & {
  completed?: boolean
  remindAt?: string | null
  reminded?: boolean
}

