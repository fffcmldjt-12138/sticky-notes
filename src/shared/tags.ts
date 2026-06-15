import type { StickyItem } from './models'

export function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').toLocaleLowerCase()
}

export function extractTags(value: string): string[] {
  const tags: string[] = []
  const pattern = /(?:^|[\s(（【])#([\p{L}\p{N}_-]{1,32})/gu
  for (const match of value.matchAll(pattern)) {
    const tag = normalizeTag(match[1])
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  return tags
}

export function mergeTags(
  ...groups: Array<readonly string[] | undefined>
): string[] {
  const result: string[] = []
  for (const value of groups.flatMap((group) => group ?? [])) {
    const tag = normalizeTag(value)
    if (tag && !result.includes(tag)) result.push(tag)
  }
  return result
}

export function getItemTags(item: StickyItem): string[] {
  const contentTags = item.type === 'note'
    ? extractTags(item.contentMarkdown)
    : item.tasks.flatMap((task) => extractTags(task.contentMarkdown))
  return mergeTags(item.tags ?? [], contentTags)
}
