import { describe, expect, it } from 'vitest'
import { PanelVisibilityState } from '../src/main/services/PanelVisibilityState'

describe('PanelVisibilityState', () => {
  it('ignores repeated expand requests', () => {
    const state = new PanelVisibilityState(0)

    expect(state.requestExpand(100)).toBe(false)
    state.markCollapsed()
    expect(state.requestExpand(200)).toBe(true)
    expect(state.requestExpand(250)).toBe(false)
  })

  it('protects an expanded panel for 500ms', () => {
    const state = new PanelVisibilityState(0)
    state.markCollapsed()
    state.requestExpand(1000)

    expect(state.collapseDelay(1100, 100)).toBe(400)
    expect(state.collapseDelay(1600, 500)).toBe(500)
  })

  it('blocks collapse while suspended', () => {
    const state = new PanelVisibilityState(0)
    state.setSuspended(true)

    expect(state.collapseDelay(1000, 500)).toBeNull()
    state.setSuspended(false)
    expect(state.collapseDelay(1000, 500)).toBe(500)
  })

  it('marks one collapse transition only', () => {
    const state = new PanelVisibilityState(0)

    expect(state.markCollapsed()).toBe(true)
    expect(state.markCollapsed()).toBe(false)
  })
})
