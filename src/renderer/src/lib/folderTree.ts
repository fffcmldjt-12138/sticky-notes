import type { FolderItem, StickyItem } from '../../../shared/models'

export interface FolderTreeNode extends FolderItem {
  children: FolderTreeNode[]
  items: StickyItem[]
  descendantItemCount: number
}

export function buildFolderTree(
  folders: FolderItem[],
  items: StickyItem[]
): { folders: FolderTreeNode[]; rootItems: StickyItem[] } {
  const activeFolders = folders
    .filter((folder) => !folder.deletedAt)
    .sort((a, b) => a.order - b.order)
  const nodes = new Map<string, FolderTreeNode>(
    activeFolders.map((folder) => [
      folder.id,
      { ...folder, children: [], items: [], descendantItemCount: 0 }
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
    node.descendantItemCount =
      node.items.length +
      node.children.reduce((total, child) => total + count(child), 0)
    return node.descendantItemCount
  }
  roots.forEach(count)
  rootItems.sort((a, b) => a.order - b.order)

  return { folders: roots, rootItems }
}
