import type { StickyApi } from '../shared/electronApi'

declare global {
  interface Window {
    stickyApi: StickyApi
  }
}

export {}

