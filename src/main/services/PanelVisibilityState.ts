const EXPANDED_PROTECTION_MS = 500

export class PanelVisibilityState {
  private state: 'expanded' | 'collapsed' = 'expanded'
  private protectedUntil: number
  private suspended = false

  constructor(now: number) {
    this.protectedUntil = now + EXPANDED_PROTECTION_MS
  }

  requestExpand(now: number): boolean {
    if (this.state === 'expanded') return false
    this.state = 'expanded'
    this.protectedUntil = now + EXPANDED_PROTECTION_MS
    return true
  }

  collapseDelay(now: number, baseDelay: number): number | null {
    if (this.suspended || this.state === 'collapsed') return null
    return Math.max(baseDelay, this.protectedUntil - now)
  }

  markCollapsed(): boolean {
    if (this.state === 'collapsed') return false
    this.state = 'collapsed'
    return true
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended
  }
}
