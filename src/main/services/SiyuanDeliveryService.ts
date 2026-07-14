import type {
  MutationResult,
  NoteItem,
  NotesFile,
  SiyuanDelivery
} from '../../shared/models'
import type { SiyuanSendResult } from '../../shared/electronApi'
import { noteContentFingerprint } from '../../shared/siyuan'

interface NoteRepository {
  getSnapshot(): Promise<NotesFile>
  recordSiyuanDelivery(
    id: string,
    delivery: SiyuanDelivery
  ): Promise<MutationResult<NoteItem>>
}

interface DeliveryAssets {
  readUrl(url: string): Promise<{
    fileName: string
    mimeType: string
    bytes: Uint8Array
  }>
}

interface DeliveryClient {
  getIdsByHPath(notebook: string, path: string): Promise<string[]>
  uploadAsset(fileName: string, mimeType: string, bytes: Uint8Array): Promise<string>
  createDocument(notebook: string, path: string, markdown: string): Promise<string>
}

export class SiyuanDeliveryService {
  private readonly active = new Map<string, Promise<SiyuanSendResult>>()

  constructor(private readonly dependencies: {
    notes: NoteRepository
    assets: DeliveryAssets
    client: DeliveryClient
    now?: () => Date
  }) {}

  fingerprint(note: Pick<NoteItem, 'title' | 'contentMarkdown'>): string {
    return noteContentFingerprint(note)
  }

  send(noteId: string, notebookId: string): Promise<SiyuanSendResult> {
    const current = this.active.get(noteId)
    if (current) return current
    const operation = this.sendOnce(noteId, notebookId).finally(() => {
      this.active.delete(noteId)
    })
    this.active.set(noteId, operation)
    return operation
  }

  private async sendOnce(
    noteId: string,
    notebookId: string
  ): Promise<SiyuanSendResult> {
    const snapshot = await this.dependencies.notes.getSnapshot()
    const item = snapshot.items.find((candidate) => candidate.id === noteId)
    if (!item || item.type !== 'note' || item.deletedAt) {
      throw new Error('找不到要发送的笔记')
    }
    if (!item.title.trim() && !item.contentMarkdown.trim()) {
      throw new Error('空白笔记不能发送到思源')
    }

    const contentFingerprint = this.fingerprint(item)
    if (
      item.siyuanDelivery?.notebookId === notebookId &&
      item.siyuanDelivery.contentFingerprint === contentFingerprint
    ) {
      return {
        status: 'already-sent',
        documentId: item.siyuanDelivery.documentId,
        item
      }
    }

    let markdown = item.contentMarkdown
    const uploaded = new Map<string, string>()
    for (const url of collectLocalAssetUrls(markdown)) {
      const asset = await this.dependencies.assets.readUrl(url)
      let target = uploaded.get(asset.fileName)
      if (!target) {
        target = await this.dependencies.client.uploadAsset(
          asset.fileName,
          asset.mimeType,
          asset.bytes
        )
        uploaded.set(asset.fileName, target)
      }
      markdown = markdown.split(url).join(target)
    }

    const title = sanitizeTitle(item.title) || `无标题便签 ${formatCompactDate(this.now())}`
    const path = await this.availablePath(notebookId, title)
    const documentId = await this.dependencies.client.createDocument(
      notebookId,
      path,
      withSourceFooter(markdown, item.createdAt)
    )
    const delivery: SiyuanDelivery = {
      notebookId,
      documentId,
      sentAt: this.now().toISOString(),
      contentFingerprint
    }
    const recorded = await this.dependencies.notes.recordSiyuanDelivery(
      item.id,
      delivery
    )
    if (recorded.status !== 'ok') throw new Error('笔记发送成功，但本地状态记录失败')
    return { status: 'sent', documentId, item: recorded.value }
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date()
  }

  private async availablePath(notebookId: string, title: string): Promise<string> {
    const original = `/${title}`
    if (!(await this.dependencies.client.getIdsByHPath(notebookId, original)).length) {
      return original
    }
    const resend = `/${title}（来自便签 ${formatCompactDate(this.now())}）`
    let candidate = resend
    let sequence = 2
    while ((await this.dependencies.client.getIdsByHPath(notebookId, candidate)).length) {
      candidate = `${resend}-${sequence}`
      sequence += 1
    }
    return candidate
  }
}

function collectLocalAssetUrls(markdown: string): string[] {
  return [...new Set(
    [...markdown.matchAll(/asset:\/\/local\/[^\s)"'>]+/g)].map((match) => match[0])
  )]
}

function sanitizeTitle(value: string): string {
  return value
    .replace(/[\\/]/g, '／')
    .replace(/[\u0000-\u001f]/g, ' ')
    .trim()
    .slice(0, 120)
}

function formatCompactDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '')
}

function withSourceFooter(markdown: string, createdAt: string): string {
  const body = markdown.trimEnd()
  const footer = `---\n\n来源：轻量便签  \n记录时间：${createdAt}`
  return body ? `${body}\n\n${footer}` : footer
}
