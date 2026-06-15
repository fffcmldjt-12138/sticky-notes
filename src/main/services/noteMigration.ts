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
  const source = value as { version?: number; items?: unknown[]; folders?: unknown[] }
  if (source.version === 3) return normalizeVersion3(source)
  if (source.version === 2) return migrateVersion2(source)
  if (source.version !== 1) throw new Error(`Unsupported notes version: ${source.version}`)

  return {
    version: 3,
    folders: [],
    items: (source.items ?? []).map(migrateVersion1Item)
  }
}

function organizationFields(index: number) {
  return {
    parentFolderId: null,
    tags: [],
    order: index,
    deletedAt: null
  }
}

function migrateVersion1Item(value: unknown, index: number): StickyItem {
  const item = value as Record<string, unknown>
  const base = {
    id: String(item.id),
    title: String(item.title ?? ''),
    headerColor: normalizeColor(item.headerColor),
    bodyTheme: normalizeBodyTheme(item.bodyTheme),
    pinned: Boolean(item.pinned),
    detached: false,
    windowBounds: null,
    ...organizationFields(index),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt)
  }

  if (item.type === 'todo') {
    const contentMarkdown = String(item.contentMarkdown ?? '')
    return {
      ...base,
      type: 'todo',
      panelExpanded: false,
      tasks: contentMarkdown || item.remindAt
        ? [{
            id: `task_${randomUUID()}`,
            contentMarkdown,
            completed: Boolean(item.completed),
            remindAt: typeof item.remindAt === 'string' ? item.remindAt : null,
            reminded: Boolean(item.reminded),
            tags: [],
            deadlineAt: null,
            deadlineReminders: []
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

function migrateVersion2(source: { items?: unknown[] }): NotesFile {
  return {
    version: 3,
    folders: [],
    items: (source.items ?? []).map((value, index) => {
      const item = value as StickyItem
      const normalized = {
        ...item,
        headerColor: normalizeColor(item.headerColor),
        bodyTheme: normalizeBodyTheme(item.bodyTheme),
        detached: Boolean(item.detached),
        windowBounds: item.windowBounds ?? null,
        ...organizationFields(index)
      }
      return normalizeTodoTasks(normalized)
    })
  }
}

function normalizeVersion3(
  source: { items?: unknown[]; folders?: unknown[] }
): NotesFile {
  return {
    version: 3,
    folders: (source.folders ?? []).map((value, index) => {
      const folder = value as NotesFile['folders'][number]
      return {
        ...folder,
        parentFolderId: folder.parentFolderId ?? null,
        order: Number.isFinite(folder.order) ? folder.order : index,
        collapsed: Boolean(folder.collapsed),
        detached: Boolean(folder.detached),
        windowBounds: folder.windowBounds ?? null,
        deletedAt: folder.deletedAt ?? null
      }
    }),
    items: (source.items ?? []).map((value, index) => {
      const item = value as StickyItem
      const normalized = {
        ...item,
        headerColor: normalizeColor(item.headerColor),
        bodyTheme: normalizeBodyTheme(item.bodyTheme),
        detached: Boolean(item.detached),
        windowBounds: item.windowBounds ?? null,
        parentFolderId: item.parentFolderId ?? null,
        tags: Array.isArray(item.tags) ? item.tags : [],
        order: Number.isFinite(item.order) ? item.order : index,
        deletedAt: item.deletedAt ?? null
      }
      return normalizeTodoTasks(normalized)
    })
  }
}

function normalizeTodoTasks(item: StickyItem): StickyItem {
  if (item.type !== 'todo') return item
  return {
    ...item,
    panelExpanded: Boolean(item.panelExpanded),
    tasks: item.tasks.map((task) => ({
      ...task,
      tags: Array.isArray(task.tags) ? task.tags : [],
      deadlineAt: task.deadlineAt ?? null,
      deadlineReminders: Array.isArray(task.deadlineReminders)
        ? task.deadlineReminders
        : []
    }))
  }
}
