import type { AppConfig } from '../../shared/models'
import { normalizeSiyuanEndpoint } from '../../shared/siyuan'
import type {
  SiyuanConnectionResult,
  SiyuanSendResult,
  SiyuanSettings,
  SiyuanSettingsPatch
} from '../../shared/electronApi'
import { AssetService } from './AssetService'
import { ConfigStore } from './ConfigStore'
import { NoteStore } from './NoteStore'
import { SiyuanClient } from './SiyuanClient'
import { SiyuanCredentialStore } from './SiyuanCredentialStore'
import { SiyuanDeliveryService } from './SiyuanDeliveryService'

const defaultSiyuanConfig = {
  endpoint: 'http://127.0.0.1:6806',
  inboxNotebookId: null as string | null
}

export class SiyuanService {
  private readonly active = new Map<string, Promise<SiyuanSendResult>>()
  private deliveryQueue: Promise<void> = Promise.resolve()
  private readonly clientFactory: (settings: {
    endpoint: string
    token: string
  }) => SiyuanClient

  constructor(private readonly dependencies: {
    config: ConfigStore
    credentials: Pick<SiyuanCredentialStore, 'getToken' | 'setToken' | 'hasToken'>
    notes: NoteStore
    assets: AssetService
    clientFactory?: (settings: { endpoint: string; token: string }) => SiyuanClient
    now?: () => Date
  }) {
    this.clientFactory = dependencies.clientFactory ?? ((settings) =>
      new SiyuanClient(settings))
  }

  async getSettings(): Promise<SiyuanSettings> {
    const config = await this.dependencies.config.get()
    const siyuan = config.siyuan ?? defaultSiyuanConfig
    return {
      endpoint: siyuan.endpoint,
      inboxNotebookId: siyuan.inboxNotebookId,
      inboxNotebookName: '00 收件箱',
      hasToken: await this.dependencies.credentials.hasToken()
    }
  }

  async updateSettings(patch: SiyuanSettingsPatch): Promise<SiyuanSettings> {
    const current = await this.dependencies.config.get()
    const currentSiyuan = current.siyuan ?? defaultSiyuanConfig
    if (patch.token !== undefined) {
      await this.dependencies.credentials.setToken(patch.token)
    }
    const endpoint = normalizeSiyuanEndpoint(
      patch.endpoint ?? currentSiyuan.endpoint
    )
    await this.dependencies.config.update({
      siyuan: {
        endpoint,
        inboxNotebookId:
          endpoint === currentSiyuan.endpoint
            ? currentSiyuan.inboxNotebookId
            : null
      }
    })
    return this.getSettings()
  }

  async testConnection(): Promise<SiyuanConnectionResult> {
    const { client, config } = await this.createClient()
    const [version, notebooks] = await Promise.all([
      client.getVersion(),
      client.listNotebooks()
    ])
    const inbox = notebooks.find(
      (notebook) => notebook.name === '00 收件箱' && !notebook.closed
    )
    if (!inbox) throw new Error('没有找到已打开的“00 收件箱”笔记本')
    await this.dependencies.config.update({
      siyuan: {
        endpoint: config.endpoint,
        inboxNotebookId: inbox.id
      }
    })
    return { version, notebookId: inbox.id, notebookName: inbox.name }
  }

  sendNote(noteId: string): Promise<SiyuanSendResult> {
    const current = this.active.get(noteId)
    if (current) return current
    const operation = this.enqueueDelivery(() => this.sendNoteOnce(noteId)).finally(() => {
      this.active.delete(noteId)
    })
    this.active.set(noteId, operation)
    return operation
  }

  private enqueueDelivery<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.deliveryQueue.then(operation)
    this.deliveryQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private async sendNoteOnce(noteId: string): Promise<SiyuanSendResult> {
    await this.assertDeliveryAllowed(noteId)
    const config = await this.getSiyuanConfig()
    const token = await this.dependencies.credentials.getToken()
    const client = this.clientFactory({ endpoint: config.endpoint, token })
    const inbox = (await client.listNotebooks()).find(
      (notebook) => notebook.name === '00 收件箱' && !notebook.closed
    )
    if (!inbox) throw new Error('没有找到已打开的“00 收件箱”笔记本')
    if (config.inboxNotebookId !== inbox.id) {
      await this.dependencies.config.update({
        siyuan: { endpoint: config.endpoint, inboxNotebookId: inbox.id }
      })
    }
    const delivery = new SiyuanDeliveryService({
      notes: this.dependencies.notes,
      assets: this.dependencies.assets,
      client,
      now: this.dependencies.now
    })
    return delivery.send(noteId, inbox.id)
  }

  private async assertDeliveryAllowed(noteId: string): Promise<void> {
    const snapshot = await this.dependencies.notes.getSnapshot()
    const item = snapshot.items.find((candidate) => candidate.id === noteId)
    if (!item || item.type !== 'note' || item.deletedAt) {
      throw new Error('找不到要发送的笔记')
    }
    if (item.siyuanDeliveryDisabled) {
      throw new Error('该笔记已禁止投送到思源')
    }
  }

  private async createClient(): Promise<{
    client: SiyuanClient
    config: NonNullable<AppConfig['siyuan']>
  }> {
    const config = await this.getSiyuanConfig()
    const token = await this.dependencies.credentials.getToken()
    return {
      client: this.clientFactory({ endpoint: config.endpoint, token }),
      config
    }
  }

  private async getSiyuanConfig(): Promise<NonNullable<AppConfig['siyuan']>> {
    return (await this.dependencies.config.get()).siyuan ?? defaultSiyuanConfig
  }
}
