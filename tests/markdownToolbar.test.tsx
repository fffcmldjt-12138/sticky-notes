// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownToolbar } from '../src/renderer/src/components/MarkdownToolbar'

function fakeEditor() {
  const toggleHeading = vi.fn(() => chain)
  const chain = {
    focus: () => chain,
    setParagraph: () => chain,
    toggleHeading,
    toggleBold: () => chain,
    toggleItalic: () => chain,
    toggleStrike: () => chain,
    toggleBulletList: () => chain,
    toggleOrderedList: () => chain,
    sinkListItem: () => chain,
    toggleBlockquote: () => chain,
    toggleCode: () => chain,
    toggleCodeBlock: () => chain,
    extendMarkRange: () => chain,
    setLink: () => chain,
    unsetLink: () => chain,
    undo: () => chain,
    redo: () => chain,
    run: vi.fn()
  }

  return {
    chain: () => chain,
    isActive: () => false,
    getAttributes: () => ({}),
    toggleHeading
  }
}

describe('MarkdownToolbar', () => {
  it('groups controls so narrow editors do not collapse into one crowded row', () => {
    const { container } = render(
      <MarkdownToolbar editor={fakeEditor() as never} onInsertImage={vi.fn()} />
    )

    expect(container.querySelectorAll('.markdown-toolbar-group')).toHaveLength(4)
    expect(container.querySelector('[aria-label="文本格式"]')).toBeInTheDocument()
    expect(container.querySelector('[aria-label="列表和引用"]')).toBeInTheDocument()
    expect(container.querySelector('[aria-label="插入内容"]')).toBeInTheDocument()
    expect(container.querySelector('[aria-label="历史操作"]')).toBeInTheDocument()
  })

  it.each([
    ['H3', 3],
    ['H4', 4],
    ['H5', 5]
  ])('applies %s heading formatting', (label, level) => {
    const editor = fakeEditor()
    render(
      <MarkdownToolbar editor={editor as never} onInsertImage={vi.fn()} />
    )

    fireEvent.mouseDown(screen.getByRole('button', { name: label }))

    expect(editor.toggleHeading).toHaveBeenCalledWith({ level })
  })
})
