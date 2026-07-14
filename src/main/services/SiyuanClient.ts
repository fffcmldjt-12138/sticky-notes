export interface SiyuanNotebook {
  id: string
  name: string
  closed: boolean
}

interface SiyuanResponse<T> {
  code: number
  msg: string
  data: T
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

export class SiyuanClient {
  private readonly endpoint: string
  private readonly token: string
  private readonly fetchImpl: FetchImpl

  constructor({
    endpoint,
    token,
    fetchImpl = fetch
  }: {
    endpoint: string
    token: string
    fetchImpl?: FetchImpl
  }) {
    this.endpoint = normalizeSiyuanEndpoint(endpoint)
    this.token = token.trim()
    this.fetchImpl = fetchImpl
  }

  getVersion(): Promise<string> {
    return this.postJson('/api/system/version', {})
  }

  async listNotebooks(): Promise<SiyuanNotebook[]> {
    const result = await this.postJson<{ notebooks: SiyuanNotebook[] }>(
      '/api/notebook/lsNotebooks',
      {}
    )
    return result.notebooks
  }

  getIdsByHPath(notebook: string, path: string): Promise<string[]> {
    return this.postJson('/api/filetree/getIDsByHPath', { notebook, path })
  }

  createDocument(
    notebook: string,
    path: string,
    markdown: string
  ): Promise<string> {
    return this.postJson('/api/filetree/createDocWithMd', {
      notebook,
      path,
      markdown
    })
  }

  async uploadAsset(
    fileName: string,
    mimeType: string,
    bytes: Uint8Array
  ): Promise<string> {
    const form = new FormData()
    form.append('assetsDirPath', '/assets/')
    const uploadBytes = Uint8Array.from(bytes)
    form.append('file[]', new Blob([uploadBytes], { type: mimeType }), fileName)
    const response = await this.fetchImpl(`${this.endpoint}/api/asset/upload`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: form
    })
    const result = await parseResponse<{
      errFiles: string[]
      succMap: Record<string, string>
    }>(response)
    const path = result.succMap[fileName]
    if (!path) {
      throw new Error(
        result.errFiles.includes(fileName)
          ? `思源未能上传图片：${fileName}`
          : `思源没有返回图片地址：${fileName}`
      )
    }
    return path
  }

  private async postJson<T>(path: string, body: object): Promise<T> {
    const headers = this.authHeaders()
    headers.set('Content-Type', 'application/json')
    const response = await this.fetchImpl(`${this.endpoint}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    return parseResponse<T>(response)
  }

  private authHeaders(): Headers {
    const headers = new Headers()
    if (this.token) headers.set('Authorization', `Token ${this.token}`)
    return headers
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`思源请求失败：HTTP ${response.status}`)
  const payload = await response.json() as SiyuanResponse<T>
  if (payload.code !== 0) {
    throw new Error(payload.msg || `思源请求失败：${payload.code}`)
  }
  return payload.data
}
import { normalizeSiyuanEndpoint } from '../../shared/siyuan'
