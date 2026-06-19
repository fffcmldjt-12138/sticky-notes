import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import type {
  FolderItem,
  OrderedNodeRef,
  StickyItem
} from '../../../shared/models'
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
  onDetachItem(item: StickyItem): void
  onDetachFolder(folder: FolderItem): void
  onDragStart?(): void
  onDragStateChange?(active: boolean): void
}>): React.JSX.Element {
  const [active, setActive] = useState<ActiveTreeDrag | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  )
  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders]
  )

  function handleStart(event: DragStartEvent): void {
    const data = event.active.data.current as ActiveTreeDrag | undefined
    if (!data) return
    setActive(data)
    onDragStart?.()
    onDragStateChange?.(true)
  }

  function handleEnd(event: DragEndEvent): void {
    const data = event.active.data.current as ActiveTreeDrag | undefined
    setActive(null)
    onDragStateChange?.(false)
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
        const item = itemById.get(data.node.id)
        if (item) onDetachItem(item)
      } else {
        const folder = folderById.get(data.node.id)
        if (folder) onDetachFolder(folder)
      }
      return
    }

    if (outcome === 'drop' && drop) {
      const siblings = siblingReferences(
        items,
        folders,
        drop.parentFolderId
      )
      const resolved = resolveTreeDrop(data.node, drop, siblings)
      if (resolved) {
        onReorder(resolved.parentFolderId, resolved.orderedNodes)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleStart}
      onDragCancel={() => {
        setActive(null)
        onDragStateChange?.(false)
      }}
      onDragEnd={handleEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active ? <TreeDragOverlay active={active} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
