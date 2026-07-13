import { ipcMain } from 'electron'
import type { ReminderWindowAction } from '../../shared/electronApi'
import { ipcChannels } from '../../shared/ipcChannels'
import type { ReminderWindowService } from '../services/ReminderWindowService'

export function registerReminderIpc(service: ReminderWindowService): void {
  ipcMain.handle(
    ipcChannels.reminderWindowAction,
    (_event, action: ReminderWindowAction) => service.respond(action)
  )
}
