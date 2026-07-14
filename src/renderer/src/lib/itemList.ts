import type { StickyItem } from '../../../shared/models'
import { upsertNewer } from './entityEvents'

export function upsertItem(items: StickyItem[], changed: StickyItem): StickyItem[] {
  return upsertNewer(items, changed)
}
