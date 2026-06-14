import { useEffect } from 'react'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { MarkdownToolbar } from './MarkdownToolbar'

export function MarkdownEditor({
  value,
  onChange,
  compact = false
}: {
  value: string
  onChange(value: string): void
  compact?: boolean
}): React.JSX.Element | null {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false }
      }),
      Markdown
    ],
    content: value,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: compact ? 'markdown-prosemirror compact' : 'markdown-prosemirror',
        role: 'textbox',
        'aria-label': 'Markdown 编辑器'
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getMarkdown())
    }
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getMarkdown() === value) return
    editor.commands.setContent(editor.markdown!.parse(value), { emitUpdate: false })
  }, [editor, value])

  if (!editor) return null

  return (
    <div className={`markdown-editor-shell ${compact ? 'compact' : ''}`}>
      <MarkdownToolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="markdown-syntax-hint">
        # 标题 · **粗体** · *斜体* · - 列表 · &gt; 引用 · `代码`
      </div>
    </div>
  )
}
