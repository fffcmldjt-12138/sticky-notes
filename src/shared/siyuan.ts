import type { NoteItem } from './models'

export function normalizeSiyuanEndpoint(value: string): string {
  const url = new URL(value.trim() || 'http://127.0.0.1:6806')
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('思源服务地址必须使用 HTTP 或 HTTPS')
  }
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
  if (url.protocol === 'http:' && !loopbackHosts.has(url.hostname.toLowerCase())) {
    throw new Error('非本机思源服务必须使用 HTTPS')
  }
  return url.toString().replace(/\/$/, '')
}

export function noteContentFingerprint(
  note: Pick<NoteItem, 'title' | 'contentMarkdown'>
): string {
  const value = `${note.title.length}:${note.title}\n${note.contentMarkdown}`
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `f1:${value.length}:${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`
}

export function hasNoteChangedSinceDelivery(note: NoteItem): boolean {
  return Boolean(
    note.siyuanDelivery &&
    note.siyuanDelivery.contentFingerprint !== noteContentFingerprint(note)
  )
}
