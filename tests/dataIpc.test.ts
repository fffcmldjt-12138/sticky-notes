import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  handle: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  openPath: vi.fn(),
  fromWebContents: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: electron.handle },
  dialog: {
    showOpenDialog: electron.showOpenDialog,
    showSaveDialog: electron.showSaveDialog
  },
  shell: { openPath: electron.openPath },
  BrowserWindow: { fromWebContents: electron.fromWebContents }
}))

import { registerDataIpc } from '../src/main/ipc/dataIpc'
import { ipcChannels } from '../src/shared/ipcChannels'
import type { NotesFile } from '../src/shared/models'

const snapshot: NotesFile = { version: 5, items: [], folders: [] }

function setup() {
  const summary = {
    id: 'a'.repeat(43),
    kind: 'protected' as const,
    createdAt: '2026-07-14T00:00:00.000Z',
    size: 100
  }
  const dependencies = {
    userDataPath: 'C:\\sticky-data',
    backups: {
      createNotesBackup: vi.fn().mockResolvedValue(summary),
      listNotesBackups: vi.fn().mockResolvedValue([summary]),
      resolveValidNotesBackup: vi.fn().mockResolvedValue({
        summary,
        value: snapshot
      })
    },
    archives: {
      exportArchive: vi.fn(),
      inspectImport: vi.fn().mockResolvedValue({
        inspectionId: 'inspection',
        itemCount: 1,
        folderCount: 2,
        assetCount: 3,
        orphanAssetCount: 1,
        expiresAt: '2026-07-14T01:00:00.000Z'
      }),
      cancelInspection: vi.fn(),
      confirmImport: vi.fn()
    },
    notes: {
      getSnapshot: vi.fn().mockResolvedValue(snapshot),
      replaceSnapshot: vi.fn()
    },
    assets: {
      restoreReferenced: vi.fn().mockResolvedValue(0),
      findMissingReferenced: vi.fn().mockResolvedValue([])
    },
    detachedWindows: {
      freezeForDataReplacement: vi.fn(),
      reconcile: vi.fn()
    },
    folderWindows: {
      freezeForDataReplacement: vi.fn(),
      reconcile: vi.fn()
    },
    broadcast: vi.fn()
  }
  registerDataIpc(dependencies as never)
  const handler = (channel: string, ...args: unknown[]) => {
    const registered = electron.handle.mock.calls.find(
      ([candidate]) => candidate === channel
    )?.[1] as (...values: unknown[]) => Promise<unknown>
    return registered(...args)
  }
  return { dependencies, handler, summary }
}

describe('data IPC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    electron.openPath.mockResolvedValue('')
    electron.fromWebContents.mockReturnValue(undefined)
  })

  it('keeps renderer values path-free and rejects forged backup ids', async () => {
    const { dependencies, handler, summary } = setup()
    expect(await handler(ipcChannels.dataListBackups, { sender: {} }))
      .toEqual([summary])
    expect(summary).not.toHaveProperty('path')

    dependencies.backups.resolveValidNotesBackup.mockRejectedValueOnce(
      new Error('Unknown backup ID')
    )
    await expect(handler(
      ipcChannels.dataRestoreBackup,
      { sender: {} },
      'forged'
    )).rejects.toThrow(/backup/i)
    expect(dependencies.notes.replaceSnapshot).not.toHaveBeenCalled()
  })

  it('returns false or null when archive dialogs are canceled', async () => {
    electron.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })
    electron.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    const { dependencies, handler } = setup()

    await expect(handler(ipcChannels.dataExportArchive, { sender: {} }))
      .resolves.toBe(false)
    await expect(handler(ipcChannels.dataInspectImport, { sender: {} }))
      .resolves.toBeNull()
    expect(dependencies.archives.exportArchive).not.toHaveBeenCalled()
    expect(dependencies.archives.inspectImport).not.toHaveBeenCalled()
  })

  it('throws when opening the data directory reports an error', async () => {
    electron.openPath.mockResolvedValue('Access denied')
    const { handler } = setup()

    await expect(handler(ipcChannels.dataOpenDirectory, { sender: {} }))
      .rejects.toThrow('Access denied')
  })

  it('freezes old windows, restores assets, reconciles, and broadcasts once', async () => {
    const { dependencies, handler, summary } = setup()

    await handler(
      ipcChannels.dataRestoreBackup,
      { sender: {} },
      summary.id
    )

    expect(dependencies.detachedWindows.freezeForDataReplacement).toHaveBeenCalledOnce()
    expect(dependencies.folderWindows.freezeForDataReplacement).toHaveBeenCalledOnce()
    expect(dependencies.assets.restoreReferenced).toHaveBeenCalledOnce()
    expect(dependencies.notes.replaceSnapshot).toHaveBeenCalledWith(snapshot, 'restore')
    expect(dependencies.detachedWindows.reconcile).toHaveBeenCalledWith(snapshot.items)
    expect(dependencies.folderWindows.reconcile).toHaveBeenCalledWith(snapshot.folders)
    expect(dependencies.broadcast).toHaveBeenCalledOnce()
    expect(dependencies.broadcast).toHaveBeenCalledWith('restore')
  })

  it('rejects a backup with still-missing assets before replacement', async () => {
    const { dependencies, handler, summary } = setup()
    dependencies.assets.findMissingReferenced.mockResolvedValueOnce(['missing.png'])

    await expect(handler(
      ipcChannels.dataRestoreBackup,
      { sender: {} },
      summary.id
    )).rejects.toThrow(/missing|缺失/i)

    expect(dependencies.notes.replaceSnapshot).not.toHaveBeenCalled()
    expect(dependencies.detachedWindows.reconcile).toHaveBeenCalledWith(snapshot.items)
    expect(dependencies.broadcast).not.toHaveBeenCalled()
  })

  it('cancels inspections and broadcasts only successful imports', async () => {
    const { dependencies, handler } = setup()

    await handler(ipcChannels.dataCancelImport, { sender: {} }, 'inspection')
    expect(dependencies.archives.cancelInspection).toHaveBeenCalledWith('inspection')

    await handler(ipcChannels.dataConfirmImport, { sender: {} }, 'inspection')
    expect(dependencies.archives.confirmImport).toHaveBeenCalledWith('inspection')
    expect(dependencies.broadcast).toHaveBeenCalledOnce()
    expect(dependencies.broadcast).toHaveBeenCalledWith('import')
  })

  it('reconciles the rollback snapshot and does not broadcast failed imports', async () => {
    const { dependencies, handler } = setup()
    dependencies.archives.confirmImport.mockRejectedValueOnce(new Error('failed'))

    await expect(handler(
      ipcChannels.dataConfirmImport,
      { sender: {} },
      'inspection'
    )).rejects.toThrow('failed')

    expect(dependencies.detachedWindows.reconcile).toHaveBeenCalledWith(snapshot.items)
    expect(dependencies.folderWindows.reconcile).toHaveBeenCalledWith(snapshot.folders)
    expect(dependencies.broadcast).not.toHaveBeenCalled()
  })
})
