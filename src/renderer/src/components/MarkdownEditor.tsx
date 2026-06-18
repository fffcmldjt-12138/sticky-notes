import { useEffect, useRef } from 'react'
import { Markdown } from '@tiptap/markdown'
import type { JSONContent } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { MarkdownToolbar } from './MarkdownToolbar'

export function shouldApplyExternalMarkdown(
  currentValue: string,
  lastEmittedValue: string,
  incomingValue: string,
  isFocused = false
): boolean {
  if (isFocused) return false
  return incomingValue !== currentValue && incomingValue !== lastEmittedValue
}

interface MarkdownCopyEditor {
  state: {
    selection: {
      empty: boolean
      content(): {
        content: {
          toJSON(): JSONContent[]
        }
      }
    }
  }
  markdown?: {
    serialize(content: JSONContent): string
  }
}

interface MarkdownClipboardEvent {
  clipboardData: {
    setData(type: string, value: string): void
  } | null
  preventDefault(): void
}

export function writeMarkdownSelection(
  editor: MarkdownCopyEditor,
  event: MarkdownClipboardEvent
): boolean {
  if (editor.state.selection.empty || !editor.markdown || !event.clipboardData) {
    return false
  }
  const content = editor.state.selection.content().content.toJSON()
  const markdown = editor.markdown.serialize({ type: 'doc', content })
  event.clipboardData.setData('text/plain', markdown)
  event.preventDefault()
  return true
}

export function MarkdownEditor({
  value,
  onChange,
  compact = false
}: {
  value: string
  onChange(value: string): void
  compact?: boolean
}): React.JSX.Element | null {
  const lastEmittedValue = useRef(value)
  const editorRef = useRef<Editor | null>(null)

  async function importImage(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) return
    const asset = await window.stickyApi.assets.importImageData(
      new Uint8Array(await file.arrayBuffer()),
      file.type
    )
    editorRef.current
      ?.chain()
      .focus()
      .setImage({ src: asset.url, alt: file.name || '本地图片' })
      .run()
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: 'https'
        }
      }),
      Image.configure({
        allowBase64: false,
        inline: false
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
      },
      handleClick: (_view, _position, event) => {
        if (!event.ctrlKey && !event.metaKey) return false
        const target = event.target
        if (!(target instanceof Element)) return false
        const href = target.closest('a')?.getAttribute('href')
        if (!href) return false
        void window.stickyApi.window.openExternal(href)
        return true
      },
      handleDOMEvents: {
        copy: (_view, event) => {
          const currentEditor = editorRef.current
          return currentEditor
            ? writeMarkdownSelection(currentEditor, event)
            : false
        }
      },
      handlePaste: (_view, event) => {
        const file = [...(event.clipboardData?.files ?? [])]
          .find((candidate) => candidate.type.startsWith('image/'))
        if (!file) return false
        event.preventDefault()
        void importImage(file)
        return true
      },
      handleDrop: (_view, event) => {
        const file = [...(event.dataTransfer?.files ?? [])]
          .find((candidate) => candidate.type.startsWith('image/'))
        if (!file) return false
        event.preventDefault()
        void importImage(file)
        return true
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const markdown = currentEditor.getMarkdown()
      lastEmittedValue.current = markdown
      onChange(markdown)
    }
  })

  useEffect(() => {
    editorRef.current = editor
    return () => {
      editorRef.current = null
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    if (
      !shouldApplyExternalMarkdown(
        editor.getMarkdown(),
        lastEmittedValue.current,
        value,
        editor.isFocused
      )
    ) {
      return
    }
    editor.commands.setContent(editor.markdown!.parse(value), { emitUpdate: false })
    lastEmittedValue.current = value
  }, [editor, value])

  if (!editor) return null

  return (
    <div className={`markdown-editor-shell ${compact ? 'compact' : ''}`}>
      <MarkdownToolbar
        editor={editor}
        onInsertImage={() => {
          void window.stickyApi.assets.selectImage().then((asset) => {
            if (!asset) return
            editor.chain().focus().setImage({
              src: asset.url,
              alt: asset.fileName
            }).run()
          })
        }}
      />
      <EditorContent editor={editor} />
      <div className="markdown-syntax-hint">
        # 标题 · **粗体** · *斜体* · - 列表 · &gt; 引用 · `代码`
      </div>
    </div>
  )
}
