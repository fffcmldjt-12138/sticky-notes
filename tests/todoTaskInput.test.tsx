// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TodoTaskInput } from '../src/renderer/src/components/TodoTaskInput'

afterEach(() => vi.useRealTimers())

describe('TodoTaskInput', () => {
  it('does not save IME intermediate text and commits the final text once', () => {
    const onCommit = vi.fn()
    render(<TodoTaskInput value="" onCommit={onCommit} />)
    const input = screen.getByLabelText('任务内容')

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'w' } })
    fireEvent.change(input, { target: { value: '我' } })
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.compositionEnd(input, { data: '我' })
    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith('我')
  })

  it('debounces ordinary input into one commit', async () => {
    vi.useFakeTimers()
    const onCommit = vi.fn()
    render(<TodoTaskInput value="" onCommit={onCommit} />)
    const input = screen.getByLabelText('任务内容')

    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ab' } })
    expect(onCommit).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith('ab')
  })

  it('does not replace a composed draft with a stale parent value', () => {
    const onCommit = vi.fn()
    const view = render(<TodoTaskInput value="old" onCommit={onCommit} />)
    const input = screen.getByLabelText('任务内容')

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '新内容' } })
    view.rerender(<TodoTaskInput value="old" onCommit={onCommit} />)

    expect(input).toHaveValue('新内容')
    fireEvent.compositionEnd(input, { data: '新内容' })
    view.rerender(<TodoTaskInput value="old" onCommit={onCommit} />)
    expect(input).toHaveValue('新内容')
  })

  it('flushes pending ordinary input on blur', () => {
    vi.useFakeTimers()
    const onCommit = vi.fn()
    render(<TodoTaskInput value="" onCommit={onCommit} />)
    const input = screen.getByLabelText('任务内容')

    fireEvent.change(input, { target: { value: 'blurred' } })
    fireEvent.blur(input)

    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith('blurred')
  })

  it('keeps accepting edits while a previous save acknowledgement is pending', async () => {
    vi.useFakeTimers()
    const onCommit = vi.fn()
    render(<TodoTaskInput value="" onCommit={onCommit} />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: 'first' } })
    await vi.advanceTimersByTimeAsync(300)
    expect(onCommit).toHaveBeenCalledWith('first')

    fireEvent.change(input, { target: { value: 'first plus' } })
    expect(input).toHaveValue('first plus')

    await vi.advanceTimersByTimeAsync(300)
    expect(onCommit).toHaveBeenLastCalledWith('first plus')
  })
})
