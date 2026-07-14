import { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import type {
  FolderItem,
  OrderedNodeRef,
  StickyItem
} from '../../../shared/models'
import type {
  DetachWindowOptions,
  DragPreviewPayload
} from '../../../shared/electronApi'
import {
  resolveTreeDrop,
  resolveTreeDragOutcome,
  siblingReferences,
  pointOutsideViewport,
  type TreeDropPosition
} from '../lib/treeDrag'
import {
  TreeDragOverlay,
  type ActiveTreeDrag
} from './TreeDragOverlay'

export function TreeDndContext({
  items,
  folders,
  onReorder,
  onDetachItem,
  onDetachFolder,
  onDragStart,
  onDragStateChange,
  children
}: React.PropsWithChildren<{
  items: StickyItem[]
  folders: FolderItem[]
  onReorder(parentFolderId: string | null, nodes: OrderedNodeRef[]): void
  onDetachItem(item: StickyItem, options?: DetachWindowOptions): void
  onDetachFolder(folder: FolderItem, options?: DetachWindowOptions): void
  onDragStart?(): void
  onDragStateChange?(active: boolean): void
}>): React.JSX.Element {
  const [active, setActive] = useState<ActiveTreeDrag | null>(null)
  const [outside, setOutside] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )
  const propsRef = useRef({
    items, folders, onReorder, onDetachItem, onDetachFolder,
    onDragStart, onDragStateChange
  })
  propsRef.current = {
    items, folders, onReorder, onDetachItem, onDetachFolder,
    onDragStart, onDragStateChange
  }

  const handleStart = useCallback((event: DragStartEvent): void => {
    const data = event.active.data.current as ActiveTreeDrag | undefined
    if (!data) return
    setActive(data)
    setOutside(false)
    window.stickyApi?.window.startDragPreview?.(toDragPreviewPayload(data))
    propsRef.current.onDragStart?.()
    propsRef.current.onDragStateChange?.(true)
  }, [])

  const handleEnd = useCallback((event: DragEndEvent): void => {
    const data = event.active.data.current as ActiveTreeDrag | undefined
    setActive(null)
    setOutside(false)
    window.stickyApi?.window.stopDragPreview?.()
    propsRef.current.onDragStateChange?.(false)
    if (!data) return

    const activator = event.activatorEvent
    const start =
      activator instanceof MouseEvent
        ? { x: activator.clientX, y: activator.clientY }
        : activator instanceof TouchEvent && activator.touches[0]
          ? {
              x: activator.touches[0].clientX,
              y: activator.touches[0].clientY
            }
          : null
    const outside = start
      ? pointOutsideViewport(
          { x: start.x + event.delta.x, y: start.y + event.delta.y },
          { width: window.innerWidth, height: window.innerHeight }
        )
      : false
    const drop = event.over?.data.current?.position as
      | TreeDropPosition
      | undefined
    const outcome = resolveTreeDragOutcome(outside, Boolean(drop))

    if (outcome === 'detach') {
      if (data.node.kind === 'item') {
        const item = propsRef.current.items.find((entry) => entry.id === data.node.id)
        if (item) propsRef.current.onDetachItem(item, { atCursor: true })
      } else {
        const folder = propsRef.current.folders.find(
          (entry) => entry.id === data.node.id
        )
        if (folder) propsRef.current.onDetachFolder(folder, { atCursor: true })
      }
      return
    }

    if (outcome === 'drop' && drop) {
      const siblings = siblingReferences(
        propsRef.current.items,
        propsRef.current.folders,
        drop.parentFolderId
      )
      const resolved = resolveTreeDrop(data.node, drop, siblings)
      if (resolved) {
        propsRef.current.onReorder(resolved.parentFolderId, resolved.orderedNodes)
      }
    }
  }, [])

  const handleMove = useCallback((event: DragMoveEvent): void => {
    const start = pointerStart(event.activatorEvent)
    if (!start) return
    setOutside(pointOutsideViewport(
      { x: start.x + event.delta.x, y: start.y + event.delta.y },
      { width: window.innerWidth, height: window.innerHeight }
    ))
  }, [])

  const handleCancel = useCallback(() => {
    setActive(null)
    setOutside(false)
    window.stickyApi?.window.stopDragPreview?.()
    propsRef.current.onDragStateChange?.(false)
  }, [])

  const visual = treeDragVisualState(Boolean(active), outside)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleStart}
      onDragMove={handleMove}
      onDragCancel={handleCancel}
      onDragEnd={handleEnd}
    >
      <div className={visual.className}>{children}</div>
      <DragOverlay dropAnimation={null}>
        {active && visual.showOverlay ? <TreeDragOverlay active={active} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function pointerStart(event: Event): { x: number; y: number } | null {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY }
  }
  if (event instanceof TouchEvent && event.touches[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
  return null
}

export function treeDragVisualState(
  active: boolean,
  outside: boolean
): { className: string; showOverlay: boolean } {
  return {
    className: outside ? 'tree-dnd-surface outside-drag' : 'tree-dnd-surface',
    showOverlay: active && !outside
  }
}

export function toDragPreviewPayload(active: ActiveTreeDrag): DragPreviewPayload {
  if (active.kind === 'folder') {
    return {
      kind: 'folder',
      title: active.folder.title || '无标题文件夹'
    }
  }
  return {
    kind: 'item',
    itemType: active.item.type,
    title: active.item.title || '无标题',
    headerColor: active.item.headerColor,
    bodyTheme: active.item.bodyTheme
  }
}
