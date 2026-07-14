// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiyuanSettingsPanel } from '../src/renderer/src/pages/SiyuanSettingsPanel'

describe('SiyuanSettingsPanel', () => {
  it('saves settings and reports the detected inbox', async () => {
    const updateSettings = vi.fn(async () => ({
      endpoint: 'http://localhost:6806', inboxNotebookId: null,
      inboxNotebookName: '00 收件箱' as const, hasToken: true
    }))
    const testConnection = vi.fn(async () => ({
      version: '3.7.1', notebookId: 'inbox', notebookName: '00 收件箱'
    }))
    Object.defineProperty(window, 'stickyApi', {
      configurable: true,
      value: {
        siyuan: {
          getSettings: vi.fn(async () => ({
            endpoint: 'http://127.0.0.1:6806', inboxNotebookId: null,
            inboxNotebookName: '00 收件箱', hasToken: false
          })),
          updateSettings,
          testConnection
        }
      }
    })
    render(<SiyuanSettingsPanel onBack={vi.fn()} />)

    const endpoint = await screen.findByLabelText('思源服务地址')
    fireEvent.change(endpoint, { target: { value: 'http://localhost:6806' } })
    fireEvent.change(screen.getByLabelText('API Token'), {
      target: { value: 'secret' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({
      endpoint: 'http://localhost:6806', token: 'secret'
    }))
    expect(testConnection).toHaveBeenCalledOnce()
    expect(await screen.findByText(/已连接.*3.7.1.*00 收件箱/)).toBeInTheDocument()
  })
})
