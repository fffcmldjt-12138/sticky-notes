import { join } from 'node:path'
import { SafeJsonStore } from './SafeJsonStore'

interface CredentialFile {
  version: 1
  encryptedToken: string | null
}

export interface StringProtector {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

export class SiyuanCredentialStore {
  private readonly file: SafeJsonStore<CredentialFile>

  constructor(userDataPath: string, private readonly protector: StringProtector) {
    this.file = new SafeJsonStore(
      join(userDataPath, 'siyuan-credentials.json'),
      () => ({ version: 1, encryptedToken: null }),
      validateCredentialFile
    )
  }

  async getToken(): Promise<string> {
    const value = await this.file.read()
    if (!value.encryptedToken) return ''
    if (!this.protector.isEncryptionAvailable()) {
      throw new Error('当前系统无法解密思源 API Token')
    }
    return this.protector.decryptString(
      Buffer.from(value.encryptedToken, 'base64')
    )
  }

  async setToken(token: string): Promise<void> {
    const normalized = token.trim()
    if (!normalized) {
      await this.file.write({ version: 1, encryptedToken: null })
      return
    }
    if (!this.protector.isEncryptionAvailable()) {
      throw new Error('当前系统无法安全保存思源 API Token')
    }
    await this.file.write({
      version: 1,
      encryptedToken: this.protector.encryptString(normalized).toString('base64')
    })
  }

  async hasToken(): Promise<boolean> {
    return Boolean((await this.file.read()).encryptedToken)
  }
}

function validateCredentialFile(value: unknown): CredentialFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid credential file')
  const candidate = value as Partial<CredentialFile>
  if (
    candidate.version !== 1 ||
    (candidate.encryptedToken !== null && typeof candidate.encryptedToken !== 'string')
  ) {
    throw new Error('Invalid credential file')
  }
  return value as CredentialFile
}
