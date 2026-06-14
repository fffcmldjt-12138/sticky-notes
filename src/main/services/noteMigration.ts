import { randomUUID } from 'node:crypto'
import type {
  BodyTheme,
  HeaderColor,
  NotesFile,
  StickyItem
} from '../../shared/models'

const DEFAULT_HEADER_COLOR: HeaderColor = '#f2c94c'
const legacyColors: Record<string, HeaderColor> = {
  yellow: '#f2c94c',
  blue: '#5b8def',
  green: '#55b985',
  pink: '#e783a8'
}

function normalizeColor(value: unknown): HeaderColor {
  if (typeof value !== 'string') return DEFAULT_HEADER_COLOR
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase() as HeaderColor
  return legacyColors[value] ?? DEFAULT_HEADER_COLOR
}

function normalizeBodyTheme(value: unknown): BodyTheme {
  return value === 'dark' ? 'dark' : 'light'
}

export function migrateNotesFile(value: unknown): NotesFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid notes file')
  const source = value as { version?: number; items?: unknown[] }
  if (source.version === 2) return normalizeVersion2(source)
  if (source.version !== 1) throw new Error(`Unsupported notes version: ${source.version}`)

  return {
    version: 2,
    items: (source.items ?? []).map(migrateVersion1Item)
  }
}

function migrateVersion1Item(value: unknown): StickyItem {
  const item = value as Record<string, unknown>
  const base = {
    id: String(item.id),
    title: String(item.title ?? ''),
    headerColor: normalizeColor(item.headerColor),
    bodyTheme: normalizeBodyTheme(item.bodyTheme),
    pinned: Boolean(item.pinned),
    detached: false,
    windowBounds: null,
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt)
  }

  if (item.type === 'todo') {
    const contentMarkdown = String(item.contentMarkdown ?? '')
    return {
      ...base,
      type: 'todo',
      tasks: contentMarkdown || item.remindAt
        ? [{
            id: `task_${randomUUID()}`,
            contentMarkdown,
            completed: Boolean(item.completed),
            remindAt: typeof item.remindAt === 'string' ? item.remindAt : null,
            reminded: Boolean(item.reminded)
          }]
        : []
    }
  }

  return {
    ...base,
    type: 'note',
    contentMarkdown: String(item.contentMarkdown ?? ''),
    syncedToSiyuan: false
  }
}

function normalizeVersion2(source: { items?: unknown[] }): NotesFile {
  return {
    version: 2,
    items: (source.items ?? []).map((value) => {
      const item = value as StickyItem
      return {
        ...item,
        headerColor: normalizeColor(item.headerColor),
        bodyTheme: normalizeBodyTheme(item.bodyTheme),
        detached: Boolean(item.detached),
        windowBounds: item.windowBounds ?? null
      }
    })
  }
}

