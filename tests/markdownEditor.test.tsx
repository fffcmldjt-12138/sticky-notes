// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  MarkdownEditor,
  shouldApplyExternalMarkdown
} from '../src/renderer/src/components/MarkdownEditor'

describe('MarkdownEditor', () => {
  it('does not reapply a value that was just emitted by the local editor', () => {
    expect(
      shouldApplyExternalMarkdown('## Local', '## Local', '## Local')
    ).toBe(false)
    expect(
      shouldApplyExternalMarkdown('## Local', '## Local', '## Remote')
    ).toBe(true)
  })

  it('does not replace content while the editor is focused', () => {
    expect(
      shouldApplyExternalMarkdown(
        '正在输入的新内容',
        '上一次已保存',
        '迟到的旧内容',
        true
      )
    ).toBe(false)
  })

  it('keeps a formatting toolbar visible and renders Markdown immediately', async () => {
    render(<MarkdownEditor value="## Heading" onChange={vi.fn()} />)

    expect(screen.getByRole('toolbar')).toBeVisible()
    expect(screen.getByRole('button', { name: '1.1' })).toBeVisible()
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading')
    })
  })

  it('serializes edited rich content back to Markdown', async () => {
    const onChange = vi.fn()
    render(<MarkdownEditor value="Paragraph" onChange={onChange} />)

    await screen.findByRole('textbox')
    fireEvent.mouseDown(screen.getByRole('button', { name: 'H2' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls.at(-1)?.[0]).toContain('## Paragraph')
    })
  })
})
