export const ipcChannels = {
  notesList: 'notes:list',
  notesCreate: 'notes:create',
  notesUpdate: 'notes:update',
  notesDelete: 'notes:delete',
  configGet: 'config:get',
  configUpdate: 'config:update',
  windowExpand: 'window:expand',
  windowScheduleCollapse: 'window:schedule-collapse',
  windowCancelCollapse: 'window:cancel-collapse',
  windowHide: 'window:hide',
  windowSuspendAutoHide: 'window:suspend-auto-hide',
  openEditor: 'app:open-editor'
} as const

