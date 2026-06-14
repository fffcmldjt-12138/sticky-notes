// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from '../src/renderer/src/components/MarkdownEditor'

describe('MarkdownEditor', () => {
  it('keeps a formatting toolbar visible and renders Markdown immediately', async () => {
    render(<MarkdownEditor value="## Heading" onChange={vi.fn()} />)

    expect(screen.getByRole('toolbar')).toBeVisible()
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
