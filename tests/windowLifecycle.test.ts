import { describe, expect, it } from 'vitest'
import { WindowLifecycle } from '../src/main/services/WindowLifecycle'

describe('WindowLifecycle', () => {
  it('prevents close only before shutdown and is idempotent', () => {
    const lifecycle = new WindowLifecycle()

    expect(lifecycle.shouldHideOnClose()).toBe(true)
    expect(lifecycle.beginShutdown()).toBe(true)
    expect(lifecycle.beginShutdown()).toBe(false)
    expect(lifecycle.shouldHideOnClose()).toBe(false)
  })
})
