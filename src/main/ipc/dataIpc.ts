import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { NotesFile } from '../../shared/models'
import { ipcChannels } from '../../shared/ipcChannels'
import type { AssetService } from '../services/AssetService'
import type { BackupService } from '../services/BackupService'
import type { DataArchiveService } from '../services/DataArchiveService'
import type { DetachedWindowService } from '../services/DetachedWindowService'
import type { FolderWindowService } from '../services/FolderWindowService'
import type { NoteStore } from '../services/NoteStore'

interface DataIpcDependencies {
  userDataPath: string
  backups: BackupService
  archives: DataArchiveService
  notes: NoteStore
  assets: AssetService
  detachedWindows: DetachedWindowService
  folderWindows: FolderWindowService
  broadcast(reason: 'restore' | 'import'): void
}

export function registerDataIpc(dependencies: DataIpcDependencies): void {
  const {
    userDataPath,
    backups,
    archives,
    notes,
    assets,
    detachedWindows,
    folderWindows,
    broadcast
  } = dependencies

  const reconcile = async (snapshot: NotesFile): Promise<void> => {
    await Promise.all([
      detachedWindows.reconcile(snapshot.items),
      folderWindows.reconcile(snapshot.folders)
    ])
  }

  const replaceData = async (
    reason: 'restore' | 'import',
    operation: () => Promise<void>
  ): Promise<void> => {
    detachedWindows.freezeForDataReplacement()
    folderWindows.freezeForDataReplacement()
    try {
      await operation()
      const snapshot = await notes.getSnapshot()
      await reconcile(snapshot)
      broadcast(reason)
    } catch (error) {
      const current = await notes.getSnapshot()
      await reconcile(current)
      throw error
    }
  }

  ipcMain.handle(ipcChannels.dataOpenDirectory, async () => {
    const error = await shell.openPath(userDataPath)
    if (error) throw new Error(error)
  })

  ipcMain.handle(ipcChannels.dataCreateBackup, async () =>
    backups.createNotesBackup(await notes.getSnapshot())
  )
  ipcMain.handle(ipcChannels.dataListBackups, () => backups.listNotesBackups())

  ipcMain.handle(
    ipcChannels.dataRestoreBackup,
    async (_event, backupId: string) => {
      const resolved = await backups.resolveValidNotesBackup(backupId)
      const candidate = resolved.value as NotesFile
      await replaceData('restore', async () => {
        await assets.restoreReferenced(markdownValues(candidate))
        const missing = await assets.findMissingReferenced(candidate)
        if (missing.length) {
          throw new Error(`Missing referenced assets: ${missing.join(', ')}`)
        }
        await notes.replaceSnapshot(candidate, 'restore')
      })
    }
  )

  ipcMain.handle(ipcChannels.dataExportArchive, async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options: Electron.SaveDialogOptions = {
      title: '导出完整数据包',
      defaultPath: join(userDataPath, 'sticky-notes-data.zip'),
      filters: [{ name: 'ZIP 数据包', extensions: ['zip'] }]
    }
    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return false
    await archives.exportArchive(result.filePath)
    return true
  })

  ipcMain.handle(ipcChannels.dataInspectImport, async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options: Electron.OpenDialogOptions = {
      title: '选择数据包',
      properties: ['openFile'],
      filters: [{ name: 'ZIP 数据包', extensions: ['zip'] }]
    }
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    return archives.inspectImport(result.filePaths[0])
  })

  ipcMain.handle(
    ipcChannels.dataCancelImport,
    (_event, inspectionId: string) => archives.cancelInspection(inspectionId)
  )
  ipcMain.handle(
    ipcChannels.dataConfirmImport,
    (_event, inspectionId: string) => replaceData(
      'import',
      () => archives.confirmImport(inspectionId)
    )
  )
}

function markdownValues(notes: NotesFile): string[] {
  return notes.items.flatMap((item) => item.type === 'note'
    ? [item.contentMarkdown]
    : item.tasks.flatMap((task) => [
        task.contentMarkdown,
        ...task.children.map((child) => child.contentMarkdown)
      ]))
}
