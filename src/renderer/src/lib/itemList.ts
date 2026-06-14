import type { StickyItem } from '../../../shared/models'

export function upsertItem(items: StickyItem[], changed: StickyItem): StickyItem[] {
  const index = items.findIndex((item) => item.id === changed.id)
  if (index < 0) return [changed, ...items]

  return items.map((item) => item.id === changed.id ? changed : item)
}
