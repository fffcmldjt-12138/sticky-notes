import { ipcMain } from 'electron'
import { ipcChannels } from '../../shared/ipcChannels'
import type { UndoService } from '../services/UndoService'

export function registerUndoIpc(undo: UndoService): void {
  ipcMain.handle(ipcChannels.undoLatest, () => undo.latest())
  ipcMain.handle(ipcChannels.undoExecute, () => undo.undo())
}
