// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SaveStatus } from '../src/renderer/src/components/SaveStatus'

describe('SaveStatus', () => {
  it('offers recovery actions for a conflict', () => {
    const retry = vi.fn()
    const copy = vi.fn()
    const loadLatest = vi.fn()
    render(<SaveStatus state="conflict" onRetry={retry} onCopy={copy} onLoadLatest={loadLatest} />)

    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    fireEvent.click(screen.getByRole('button', { name: '复制' }))
    fireEvent.click(screen.getByRole('button', { name: '载入最新' }))
    expect(retry).toHaveBeenCalled()
    expect(copy).toHaveBeenCalled()
    expect(loadLatest).toHaveBeenCalled()
  })
})
