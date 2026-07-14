import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { SafeJsonStore } from '../src/main/services/SafeJsonStore'

interface StoredValue {
  value: number
}

function validateStoredValue(value: unknown): StoredValue {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('value' in value) ||
    typeof value.value !== 'number' ||
    value.value < 0
  ) {
    throw new Error('invalid')
  }

  return value as StoredValue
}

describe('SafeJsonStore', () => {
  let directory: string
  let filePath: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-safe-json-'))
    filePath = join(directory, 'data.json')
  })

  it('serializes overlapping writes in invocation order', async () => {
    let releaseFirstReplace: (() => void) | undefined
    const firstReplaceStarted = new Promise<void>((resolve) => {
      releaseFirstReplace = resolve
    })
    let unblockFirstReplace: (() => void) | undefined
    const firstReplaceBlocked = new Promise<void>((resolve) => {
      unblockFirstReplace = resolve
    })
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue,
      async (_currentPath, currentValue) => {
        if (currentValue.value === 0) {
          releaseFirstReplace?.()
          await firstReplaceBlocked
        }
      }
    )
    await writeFile(filePath, '{"value":0}', 'utf8')

    const firstWrite = store.write({ value: 1 })
    await firstReplaceStarted
    const secondWrite = store.write({ value: 2 })
    unblockFirstReplace?.()

    await Promise.all([firstWrite, secondWrite])
    expect(await store.read()).toEqual({ value: 2 })
  })

  it('does not replace the formal file when candidate validation fails', async () => {
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue
    )
    await writeFile(filePath, '{"value":1}', 'utf8')

    await expect(store.write({ value: -1 })).rejects.toThrow('invalid')
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ value: 1 })
  })

  it('does not overwrite a corrupt formal file', async () => {
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue
    )
    await writeFile(filePath, '{broken', 'utf8')

    await expect(store.write({ value: 2 })).rejects.toBeInstanceOf(SyntaxError)
    expect(await readFile(filePath, 'utf8')).toBe('{broken')
  })

  it('creates and persists the default only when the file is missing', async () => {
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 3 }),
      validateStoredValue
    )

    expect(await store.read()).toEqual({ value: 3 })
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ value: 3 })
  })

  it('propagates an ENOENT-coded validation error while reading', async () => {
    const validationError = Object.assign(new Error('validation failed'), {
      code: 'ENOENT'
    })
    let defaultCalls = 0
    const store = new SafeJsonStore(
      filePath,
      () => {
        defaultCalls += 1
        return { value: 0 }
      },
      (value) => {
        const storedValue = validateStoredValue(value)
        if (storedValue.value === 1) {
          throw validationError
        }
        return storedValue
      }
    )
    await writeFile(filePath, '{"value":1}', 'utf8')

    await expect(store.read()).rejects.toBe(validationError)
    expect(defaultCalls).toBe(0)
    expect(await readFile(filePath, 'utf8')).toBe('{"value":1}')
  })

  it('propagates an ENOENT-coded validation error from an existing file', async () => {
    const validationError = Object.assign(new Error('validation failed'), {
      code: 'ENOENT'
    })
    let beforeReplaceCalls = 0
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      (value) => {
        const storedValue = validateStoredValue(value)
        if (storedValue.value === 1) {
          throw validationError
        }
        return storedValue
      },
      async () => {
        beforeReplaceCalls += 1
      }
    )
    await writeFile(filePath, '{"value":1}', 'utf8')

    await expect(store.write({ value: 2 })).rejects.toBe(validationError)
    expect(beforeReplaceCalls).toBe(0)
    expect(await readFile(filePath, 'utf8')).toBe('{"value":1}')
    expect(await readdir(directory)).toEqual(['data.json'])
  })

  it('does not call beforeReplace when the formal file is missing', async () => {
    let beforeReplaceCalls = 0
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue,
      async () => {
        beforeReplaceCalls += 1
      }
    )

    await store.write({ value: 4 })

    expect(beforeReplaceCalls).toBe(0)
    expect(await readdir(directory)).toEqual(['data.json'])
  })

  it('waits for queued writes before reading', async () => {
    let releaseReplace: (() => void) | undefined
    const replaceBlocked = new Promise<void>((resolve) => {
      releaseReplace = resolve
    })
    let replaceStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      replaceStarted = resolve
    })
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue,
      async () => {
        replaceStarted?.()
        await replaceBlocked
      }
    )
    await writeFile(filePath, '{"value":0}', 'utf8')

    const pendingWrite = store.write({ value: 4 })
    await started
    const pendingRead = store.read()
    releaseReplace?.()

    await expect(pendingRead).resolves.toEqual({ value: 4 })
    await pendingWrite
  })

  it('continues processing writes after a failed write', async () => {
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue
    )
    await writeFile(filePath, '{"value":1}', 'utf8')

    const failedWrite = store.write({ value: -1 })
    const successfulWrite = store.write({ value: 5 })

    await expect(failedWrite).rejects.toThrow('invalid')
    await expect(successfulWrite).resolves.toBeUndefined()
    expect(await store.read()).toEqual({ value: 5 })
  })

  it('cleans up its temporary file when replacement preparation fails', async () => {
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue,
      async () => {
        throw new Error('backup failed')
      }
    )
    await writeFile(filePath, '{"value":1}', 'utf8')

    await expect(store.write({ value: 6 })).rejects.toThrow('backup failed')
    expect(await readdir(directory)).toEqual(['data.json'])
  })

  it('replaces an existing file using the real filesystem', async () => {
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue
    )
    await writeFile(filePath, '{"value":1}', 'utf8')

    await store.write({ value: 7 })

    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ value: 7 })
    expect(await readdir(directory)).toEqual(['data.json'])
  })
})
