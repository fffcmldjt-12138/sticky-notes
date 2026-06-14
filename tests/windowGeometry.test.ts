import { describe, expect, it } from 'vitest'
import { getCollapsedBounds, getExpandedBounds } from '../src/main/services/windowGeometry'

describe('window geometry', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 }

  it('places the expanded panel against the right work-area edge', () => {
    expect(getExpandedBounds(workArea, 360)).toEqual({
      x: 1560,
      y: 0,
      width: 360,
      height: 1040
    })
  })

  it('leaves only the configured hot edge visible when collapsed', () => {
    expect(getCollapsedBounds(workArea, 360, 8)).toEqual({
      x: 1912,
      y: 0,
      width: 360,
      height: 1040
    })
  })
})

