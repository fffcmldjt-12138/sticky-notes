import type {
  FolderItem,
  OrderedNodeRef,
  StickyItem
} from '../../../shared/models'

export interface TreeDropPosition {
  parentFolderId: string | null
  index: number
}

export function resolveTreeDrop(
  active: OrderedNodeRef,
  drop: TreeDropPosition,
  targetSiblings: OrderedNodeRef[]
): {
  parentFolderId: string | null
  orderedNodes: OrderedNodeRef[]
} | null {
  const currentIndex = targetSiblings.findIndex(
    (node) => node.kind === active.kind && node.id === active.id
  )
  const orderedNodes = targetSiblings.filter(
    (node) => node.kind !== active.kind || node.id !== active.id
  )
  let index = Math.min(Math.max(0, drop.index), orderedNodes.length)
  if (currentIndex >= 0 && currentIndex < drop.index) index -= 1
  orderedNodes.splice(Math.max(0, index), 0, active)

  const unchanged =
    currentIndex >= 0 &&
    orderedNodes.every(
      (node, nodeIndex) =>
        node.kind === targetSiblings[nodeIndex]?.kind &&
        node.id === targetSiblings[nodeIndex]?.id
    )
  if (unchanged) return null
  return { parentFolderId: drop.parentFolderId, orderedNodes }
}

export function siblingReferences(
  items: StickyItem[],
  folders: FolderItem[],
  parentFolderId: string | null
): OrderedNodeRef[] {
  return [
    ...items
      .filter(
        (item) => !item.deletedAt && item.parentFolderId === parentFolderId
      )
      .map((item) => ({ kind: 'item' as const, id: item.id, order: item.order })),
    ...folders
      .filter(
        (folder) =>
          !folder.deletedAt && folder.parentFolderId === parentFolderId
      )
      .map((folder) => ({
        kind: 'folder' as const,
        id: folder.id,
        order: folder.order
      }))
  ]
    .sort((left, right) => left.order - right.order)
    .map(({ kind, id }) => ({ kind, id }))
}

export function draggableId(node: OrderedNodeRef): string {
  return `${node.kind}:${node.id}`
}

export function pointOutsideViewport(
  point: { x: number; y: number },
  viewport: { width: number; height: number }
): boolean {
  return (
    point.x < 0 ||
    point.y < 0 ||
    point.x > viewport.width ||
    point.y > viewport.height
  )
}
