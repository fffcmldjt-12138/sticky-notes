// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataManagementPanel } from '../src/renderer/src/pages/DataManagementPanel'

const summary = {
  id: 'backup-id',
  kind: 'protected' as const,
  createdAt: '2026-07-14T08:00:00.000Z',
  size: 1024
}

function installApi() {
  const data = {
    openDirectory: vi.fn().mockResolvedValue(undefined),
    createBackup: vi.fn().mockResolvedValue(summary),
    listBackups: vi.fn().mockResolvedValue([summary]),
    restoreBackup: vi.fn().mockResolvedValue(undefined),
    exportArchive: vi.fn().mockResolvedValue(true),
    inspectImport: vi.fn().mockResolvedValue({
      inspectionId: 'inspection-id',
      itemCount: 4,
      folderCount: 2,
      assetCount: 3,
      orphanAssetCount: 1,
      expiresAt: '2026-07-14T09:00:00.000Z'
    }),
    cancelImport: vi.fn().mockResolvedValue(undefined),
    confirmImport: vi.fn().mockResolvedValue(undefined)
  }
  Object.defineProperty(window, 'stickyApi', {
    configurable: true,
    value: { data }
  })
  return data
}

describe('DataManagementPanel', () => {
  beforeEach(() => installApi())

  it('creates and restores backups through inline status and confirmation', async () => {
    render(<DataManagementPanel onBack={vi.fn()} />)
    await screen.findByText(/1 KB/)

    fireEvent.click(screen.getByRole('button', { name: '立即备份' }))
    expect(await screen.findByRole('status')).toHaveTextContent('备份已创建')

    fireEvent.click(screen.getByRole('button', { name: '恢复此备份' }))
    expect(screen.getByText(/将替换当前便签数据/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认恢复' }))

    await waitFor(() => {
      expect(window.stickyApi.data.restoreBackup).toHaveBeenCalledWith('backup-id')
    })
    expect(screen.getByRole('status')).toHaveTextContent('已从备份恢复')
  })

  it('shows import counts and can cancel without replacing data', async () => {
    render(<DataManagementPanel onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '选择导入文件' }))

    expect(await screen.findByText('4 项内容')).toBeInTheDocument()
    expect(screen.getByText('2 个文件夹')).toBeInTheDocument()
    expect(screen.getByText('3 个附件')).toBeInTheDocument()
    expect(screen.getByText('1 个未引用附件')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '取消导入' }))
    await waitFor(() => {
      expect(window.stickyApi.data.cancelImport).toHaveBeenCalledWith('inspection-id')
    })
    expect(screen.queryByText('4 项内容')).not.toBeInTheDocument()
  })

  it('disables repeated actions while an operation is pending', async () => {
    let finish: (() => void) | undefined
    vi.mocked(window.stickyApi.data.createBackup).mockImplementation(
      () => new Promise((resolve) => {
        finish = () => resolve(summary)
      })
    )
    render(<DataManagementPanel onBack={vi.fn()} />)
    const button = screen.getByRole('button', { name: '立即备份' })

    fireEvent.click(button)
    expect(button).toBeDisabled()
    finish?.()
    await waitFor(() => expect(button).not.toBeDisabled())
  })
})
