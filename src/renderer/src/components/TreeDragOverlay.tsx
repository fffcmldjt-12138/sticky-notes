import type {
  FolderItem,
  OrderedNodeRef,
  StickyItem
} from '../../../shared/models'

export type ActiveTreeDrag =
  | {
      kind: 'item'
      node: OrderedNodeRef & { kind: 'item' }
      item: StickyItem
    }
  | {
      kind: 'folder'
      node: OrderedNodeRef & { kind: 'folder' }
      folder: FolderItem
    }

export function TreeDragOverlay({
  active
}: {
  active: ActiveTreeDrag
}): React.JSX.Element {
  if (active.kind === 'folder') {
    return (
      <div className="tree-drag-overlay folder-preview" data-testid="tree-drag-overlay">
        <span className="tree-drag-grip">⠿</span>
        <strong>文件夹 {active.folder.title}</strong>
      </div>
    )
  }

  return (
    <div
      className={`tree-drag-overlay card-preview body-${active.item.bodyTheme}`}
      data-testid="tree-drag-overlay"
      style={{
        '--drag-header-color': active.item.headerColor
      } as React.CSSProperties}
    >
      <div className="tree-drag-preview-header">
        <span className="tree-drag-grip">⠿</span>
        <span className="type-badge">
          {active.item.type === 'note' ? '笔记' : '待办'}
        </span>
        <strong>{active.item.title || '无标题'}</strong>
      </div>
      <div className="tree-drag-preview-body">松开后拖出为小窗</div>
    </div>
  )
}
