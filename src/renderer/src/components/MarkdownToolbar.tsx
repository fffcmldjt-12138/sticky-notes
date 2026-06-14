import type { Editor } from '@tiptap/react'

export function MarkdownToolbar({
  editor
}: {
  editor: Editor
}): React.JSX.Element {
  const button = (
    label: string,
    title: string,
    active: boolean,
    action: () => void
  ): React.JSX.Element => (
    <button
      type="button"
      title={title}
      className={active ? 'active' : ''}
      onMouseDown={(event) => {
        event.preventDefault()
        action()
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="markdown-toolbar" role="toolbar" aria-label="Markdown 格式工具">
      {button('正文', '正文', editor.isActive('paragraph'), () =>
        editor.chain().focus().setParagraph().run()
      )}
      {button('H1', '一级标题：# ', editor.isActive('heading', { level: 1 }), () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run()
      )}
      {button('H2', '二级标题：## ', editor.isActive('heading', { level: 2 }), () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run()
      )}
      {button('B', '粗体：**文字**', editor.isActive('bold'), () =>
        editor.chain().focus().toggleBold().run()
      )}
      {button('I', '斜体：*文字*', editor.isActive('italic'), () =>
        editor.chain().focus().toggleItalic().run()
      )}
      {button('S', '删除线：~~文字~~', editor.isActive('strike'), () =>
        editor.chain().focus().toggleStrike().run()
      )}
      {button('•', '无序列表：- ', editor.isActive('bulletList'), () =>
        editor.chain().focus().toggleBulletList().run()
      )}
      {button('1.', '有序列表：1. ', editor.isActive('orderedList'), () =>
        editor.chain().focus().toggleOrderedList().run()
      )}
      {button('❯', '引用：> ', editor.isActive('blockquote'), () =>
        editor.chain().focus().toggleBlockquote().run()
      )}
      {button('</>', '行内代码：`代码`', editor.isActive('code'), () =>
        editor.chain().focus().toggleCode().run()
      )}
      {button('{ }', '代码块：```', editor.isActive('codeBlock'), () =>
        editor.chain().focus().toggleCodeBlock().run()
      )}
      {button('↶', '撤销', false, () => editor.chain().focus().undo().run())}
      {button('↷', '重做', false, () => editor.chain().focus().redo().run())}
    </div>
  )
}

