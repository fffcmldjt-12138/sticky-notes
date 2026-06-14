import { contextBridge, ipcRenderer } from 'electron'
import type { StickyApi } from '../shared/electronApi'
import type { AppConfig, NoteType, StickyItemPatch } from '../shared/models'
import { ipcChannels } from '../shared/ipcChannels'

const api: StickyApi = {
  notes: {
    list: () => ipcRenderer.invoke(ipcChannels.notesList),
    create: (type) => ipcRenderer.invoke(ipcChannels.notesCreate, type),
    update: (id, patch) => ipcRenderer.invoke(ipcChannels.notesUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(ipcChannels.notesDelete, id)
  },
  config: {
    get: () => ipcRenderer.invoke(ipcChannels.configGet),
    update: (patch: Partial<Omit<AppConfig, 'version'>>) =>
      ipcRenderer.invoke(ipcChannels.configUpdate, patch)
  },
  window: {
    expand: () => ipcRenderer.send(ipcChannels.windowExpand),
    scheduleCollapse: () => ipcRenderer.send(ipcChannels.windowScheduleCollapse),
    cancelCollapse: () => ipcRenderer.send(ipcChannels.windowCancelCollapse),
    hide: () => ipcRenderer.send(ipcChannels.windowHide),
    suspendAutoHide: (value) =>
      ipcRenderer.send(ipcChannels.windowSuspendAutoHide, value)
  },
  onOpenEditor: (callback: (type: NoteType) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, type: NoteType): void =>
      callback(type)
    ipcRenderer.on(ipcChannels.openEditor, listener)
    return () => ipcRenderer.removeListener(ipcChannels.openEditor, listener)
  }
}

contextBridge.exposeInMainWorld('stickyApi', api)

