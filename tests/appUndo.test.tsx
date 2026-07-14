// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UndoToast } from '../src/renderer/src/App'

describe('UndoToast', () => {
  it('shows the latest action and executes undo', () => {
    const onUndo = vi.fn()
    render(<UndoToast label="删除便签" onUndo={onUndo} />)

    expect(screen.getByText('删除便签')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(onUndo).toHaveBeenCalledOnce()
  })
})
