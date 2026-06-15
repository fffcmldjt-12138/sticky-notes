import type { FolderItem, StickyItem } from '../../../shared/models'

export interface FolderTreeNode extends FolderItem {
  children: FolderTreeNode[]
  items: StickyItem[]
  entries: FolderTreeEntry[]
  descendantItemCount: number
}

export type FolderTreeEntry =
  | { kind: 'item'; id: string; item: StickyItem }
  | { kind: 'folder'; id: string; folder: FolderTreeNode }

export function buildFolderTree(
  folders: FolderItem[],
  items: StickyItem[]
): {
  folders: FolderTreeNode[]
  rootItems: StickyItem[]
  entries: FolderTreeEntry[]
} {
  const activeFolders = folders
    .filter((folder) => !folder.deletedAt)
    .sort((a, b) => a.order - b.order)
  const nodes = new Map<string, FolderTreeNode>(
    activeFolders.map((folder) => [
      folder.id,
      {
        ...folder,
        children: [],
        items: [],
        entries: [],
        descendantItemCount: 0
      }
    ])
  )
  const roots: FolderTreeNode[] = []

  for (const folder of activeFolders) {
    const node = nodes.get(folder.id)!
    const parent = folder.parentFolderId
      ? nodes.get(folder.parentFolderId)
      : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const rootItems: StickyItem[] = []
  for (const item of items.filter((candidate) => !candidate.deletedAt)) {
    const parent = item.parentFolderId ? nodes.get(item.parentFolderId) : undefined
    if (parent) parent.items.push(item)
    else rootItems.push(item)
  }

  const count = (node: FolderTreeNode): number => {
    node.items.sort((a, b) => a.order - b.order)
    node.children.sort((a, b) => a.order - b.order)
    node.entries = mixedEntries(node.children, node.items)
    node.descendantItemCount =
      node.items.length +
      node.children.reduce((total, child) => total + count(child), 0)
    return node.descendantItemCount
  }
  roots.forEach(count)
  rootItems.sort((a, b) => a.order - b.order)

  return { folders: roots, rootItems, entries: mixedEntries(roots, rootItems) }
}

function mixedEntries(
  folders: FolderTreeNode[],
  items: StickyItem[]
): FolderTreeEntry[] {
  return [
    ...folders.map((folder) => ({
      kind: 'folder' as const,
      id: folder.id,
      folder,
      order: folder.order
    })),
    ...items.map((item) => ({
      kind: 'item' as const,
      id: item.id,
      item,
      order: item.order
    }))
  ]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...entry }) => entry)
}
