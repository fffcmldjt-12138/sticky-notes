import type { StickyItem } from '../../../shared/models'
import type { FolderTreeNode } from '../lib/folderTree'

export function FolderCard({
  node,
  onOpenItem,
  onToggle,
  onMoveItem,
  onMoveFolder
}: {
  node: FolderTreeNode
  onOpenItem(item: StickyItem): void
  onToggle(node: FolderTreeNode): void
  onMoveItem(itemId: string, folderId: string): void
  onMoveFolder(folderId: string, parentFolderId: string): void
}): React.JSX.Element {
  return (
    <section
      className="folder-card"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const itemId = event.dataTransfer.getData('text/sticky-item')
        const folderId = event.dataTransfer.getData('text/sticky-folder')
        if (itemId) onMoveItem(itemId, node.id)
        if (folderId && folderId !== node.id) onMoveFolder(folderId, node.id)
      }}
    >
      <div
        className="folder-title-bar"
        draggable
        onDragStart={(event) => {
          event.stopPropagation()
          event.dataTransfer.setData('text/sticky-folder', node.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
      >
        <button
          className="folder-toggle"
          onClick={() => onToggle(node)}
          aria-label={node.collapsed ? '展开文件夹' : '收起文件夹'}
        >
          {node.collapsed ? '›' : '⌄'}
        </button>
        <span className="folder-title">文件夹 {node.title}</span>
        <small>{node.descendantItemCount}</small>
      </div>
      {!node.collapsed && (
        <div className="folder-contents">
          {node.items.map((item) => (
            <button
              key={item.id}
              className="folder-item-title"
              style={{ borderLeftColor: item.headerColor }}
              onClick={() => onOpenItem(item)}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/sticky-item', item.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
            >
              <span>{item.type === 'note' ? '笔记' : '待办'}</span>
              <strong>{item.title || '无标题'}</strong>
            </button>
          ))}
          {node.children.map((child) => (
            <FolderCard
              key={child.id}
              node={child}
              onOpenItem={onOpenItem}
              onToggle={onToggle}
              onMoveItem={onMoveItem}
              onMoveFolder={onMoveFolder}
            />
          ))}
        </div>
      )}
    </section>
  )
}
