import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('todo editor narrow layout', () => {
  it('wraps task action buttons instead of overflowing the card', async () => {
    const css = await readFile(
      'src/renderer/src/styles/note-card.css',
      'utf8'
    )

    expect(css).toMatch(
      /\.task-setting-buttons\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*flex-wrap:\s*wrap;/s
    )
    expect(css).toMatch(
      /\.task-setting-buttons\s+>\s+\*\s*\{[^}]*max-width:\s*100%;/s
    )
  })

  it('keeps the subtask input in the middle column', async () => {
    const css = await readFile(
      'src/renderer/src/styles/note-card.css',
      'utf8'
    )

    expect(css).toMatch(
      /\.todo-subtask-row\s*>\s*\.task-content-input\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/s
    )
    expect(css).toMatch(
      /\.todo-subtask-row\s*>\s*\.task-delete-button\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1;/s
    )
  })

  it('gives subtasks a larger checkbox and moves their settings below the input row', async () => {
    const css = await readFile(
      'src/renderer/src/styles/note-card.css',
      'utf8'
    )

    expect(css).toMatch(
      /\.todo-subtask-row\s*>\s*input\[type="checkbox"\]\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;[^}]*width:\s*22px;[^}]*height:\s*22px;/s
    )
    expect(css).toMatch(
      /\.todo-subtask-row\s+\.subtask-settings\s*\{[^}]*grid-column:\s*2\s*\/\s*4;[^}]*grid-row:\s*2;/s
    )
  })
})
