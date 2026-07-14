export type StorageSource = 'notes' | 'config'

export class UnsupportedDataVersionError extends Error {
  readonly code = 'UNSUPPORTED_DATA_VERSION'

  constructor(
    readonly source: StorageSource,
    readonly version: unknown
  ) {
    super(`Unsupported ${source} version: ${String(version)}`)
    this.name = 'UnsupportedDataVersionError'
  }
}

export class DataUnavailableError extends Error {
  readonly code = 'DATA_UNAVAILABLE'

  constructor(
    readonly source: StorageSource,
    cause: unknown
  ) {
    super(`${source} data is unavailable`, { cause })
    this.name = 'DataUnavailableError'
  }
}
