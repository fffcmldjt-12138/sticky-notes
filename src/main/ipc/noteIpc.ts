import { ipcMain } from 'electron'
import type { NoteType, StickyItemPatch } from '../../shared/models'
import { ipcChannels } from '../../shared/ipcChannels'
import type { NoteStore } from '../services/NoteStore'

export function registerNoteIpc(store: NoteStore): void {
  ipcMain.handle(ipcChannels.notesList, () => store.list())
  ipcMain.handle(ipcChannels.notesCreate, (_event, type: NoteType) => store.create(type))
  ipcMain.handle(
    ipcChannels.notesUpdate,
    (_event, id: string, patch: StickyItemPatch) => store.update(id, patch)
  )
  ipcMain.handle(ipcChannels.notesDelete, (_event, id: string) => store.delete(id))
}

