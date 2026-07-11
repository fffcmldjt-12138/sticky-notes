import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('renderer bundle boundaries', () => {
  it('loads the Tiptap note editor through a lazy import', async () => {
    const app = await readFile('src/renderer/src/App.tsx', 'utf8')

    expect(app).not.toContain("import { NoteEditor } from './components/NoteEditor'")
    expect(app).toContain("import('./components/NoteEditor')")
    expect(app).toContain('<Suspense')
  })
})
