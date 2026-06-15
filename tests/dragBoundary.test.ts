import { describe, expect, it } from 'vitest'
import { endedOutsidePanel } from '../src/renderer/src/lib/dragBoundary'

describe('endedOutsidePanel', () => {
  it('detects coordinates outside every panel edge', () => {
    expect(endedOutsidePanel(-1, 20, 360, 800)).toBe(true)
    expect(endedOutsidePanel(120, -1, 360, 800)).toBe(true)
    expect(endedOutsidePanel(360, 20, 360, 800)).toBe(true)
    expect(endedOutsidePanel(120, 800, 360, 800)).toBe(true)
    expect(endedOutsidePanel(120, 200, 360, 800)).toBe(false)
  })
})
