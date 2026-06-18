import { describe, expect, it } from 'vitest'
import { clampFloatingPosition } from '../src/renderer/src/lib/floatingPosition'

describe('clampFloatingPosition', () => {
  it('keeps a menu inside the lower-right viewport edge', () => {
    expect(clampFloatingPosition(
      { x: 790, y: 590 },
      { width: 190, height: 300 },
      { width: 800, height: 600 },
      8
    )).toEqual({ x: 602, y: 292 })
  })

  it('keeps a menu inside the upper-left viewport edge', () => {
    expect(clampFloatingPosition(
      { x: -20, y: -10 },
      { width: 190, height: 100 },
      { width: 800, height: 600 },
      8
    )).toEqual({ x: 8, y: 8 })
  })
})
