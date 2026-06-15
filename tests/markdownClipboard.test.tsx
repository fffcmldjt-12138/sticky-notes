import { describe, expect, it, vi } from 'vitest'
import { writeMarkdownSelection } from '../src/renderer/src/components/MarkdownEditor'

describe('writeMarkdownSelection', () => {
  it('writes the selected document slice as Markdown text', () => {
    const setData = vi.fn()
    const serialize = vi.fn(() => '## Selected heading')
    const editor = {
      state: {
        selection: {
          empty: false,
          content: () => ({
            content: {
              toJSON: () => [
                {
                  type: 'heading',
                  attrs: { level: 2 },
                  content: [{ type: 'text', text: 'Selected heading' }]
                }
              ]
            }
          })
        }
      },
      markdown: { serialize }
    }
    const event = {
      clipboardData: { setData },
      preventDefault: vi.fn()
    }

    expect(writeMarkdownSelection(editor, event)).toBe(true)
    expect(serialize).toHaveBeenCalledWith({
      type: 'doc',
      content: expect.any(Array)
    })
    expect(setData).toHaveBeenCalledWith('text/plain', '## Selected heading')
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('leaves the browser copy behavior alone for an empty selection', () => {
    const event = {
      clipboardData: { setData: vi.fn() },
      preventDefault: vi.fn()
    }
    const editor = {
      state: { selection: { empty: true } },
      markdown: { serialize: vi.fn() }
    }

    expect(writeMarkdownSelection(editor, event)).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
