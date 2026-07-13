import type { Editor } from '@tiptap/react'

export function MarkdownToolbar({
  editor,
  onInsertImage
}: {
  editor: Editor
  onInsertImage(): void
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
      <div className="markdown-toolbar-group" aria-label="文本格式">
        {button('正文', '正文', editor.isActive('paragraph'), () =>
          editor.chain().focus().setParagraph().run()
        )}
        {button('H1', '一级标题：# ', editor.isActive('heading', { level: 1 }), () =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        )}
        {button('H2', '二级标题：## ', editor.isActive('heading', { level: 2 }), () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        )}
        {button('H3', '三级标题：### ', editor.isActive('heading', { level: 3 }), () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        )}
        {button('H4', '四级标题：#### ', editor.isActive('heading', { level: 4 }), () =>
          editor.chain().focus().toggleHeading({ level: 4 }).run()
        )}
        {button('H5', '五级标题：##### ', editor.isActive('heading', { level: 5 }), () =>
          editor.chain().focus().toggleHeading({ level: 5 }).run()
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
      </div>
      <div className="markdown-toolbar-group" aria-label="列表和引用">
        {button('•', '无序列表：- ', editor.isActive('bulletList'), () =>
          editor.chain().focus().toggleBulletList().run()
        )}
        {button('1.', '有序列表：1. ', editor.isActive('orderedList'), () =>
          editor.chain().focus().toggleOrderedList().run()
        )}
        {button('1.1', '多级编号列表', false, () => {
          const chain = editor.chain().focus()
          if (!editor.isActive('orderedList')) chain.toggleOrderedList()
          chain.sinkListItem('listItem').run()
        })}
        {button('❯', '引用：> ', editor.isActive('blockquote'), () =>
          editor.chain().focus().toggleBlockquote().run()
        )}
      </div>
      <div className="markdown-toolbar-group" aria-label="插入内容">
        {button('</>', '行内代码：`代码`', editor.isActive('code'), () =>
          editor.chain().focus().toggleCode().run()
        )}
        {button('{ }', '代码块：```', editor.isActive('codeBlock'), () =>
          editor.chain().focus().toggleCodeBlock().run()
        )}
        {button('链接', '链接：[文字](地址)', editor.isActive('link'), () => {
          const previousUrl = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('请输入链接地址', previousUrl ?? 'https://')
          if (url === null) return
          if (!url.trim()) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
        })}
        {button('取消', '移除链接', false, () =>
          editor.chain().focus().extendMarkRange('link').unsetLink().run()
        )}
        {button('图片', '插入本地图片', false, onInsertImage)}
      </div>
      <div className="markdown-toolbar-group" aria-label="历史操作">
        {button('↶', '撤销', false, () => editor.chain().focus().undo().run())}
        {button('↷', '重做', false, () => editor.chain().focus().redo().run())}
      </div>
    </div>
  )
}
