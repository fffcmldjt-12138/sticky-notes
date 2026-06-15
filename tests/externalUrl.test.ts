import { describe, expect, it } from 'vitest'
import { normalizeExternalUrl } from '../src/shared/externalUrl'

describe('normalizeExternalUrl', () => {
  it('accepts only HTTP and HTTPS links', () => {
    expect(normalizeExternalUrl('https://example.com/path')).toBe(
      'https://example.com/path'
    )
    expect(normalizeExternalUrl('http://example.com')).toBe('http://example.com/')
    expect(normalizeExternalUrl('file:///C:/secret.txt')).toBeNull()
    expect(normalizeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeExternalUrl('not a url')).toBeNull()
  })
})
