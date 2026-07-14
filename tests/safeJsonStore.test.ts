import {
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SafeJsonStore } from '../src/main/services/SafeJsonStore'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rename: vi.fn(actual.rename),
    rm: vi.fn(actual.rm)
  }
})

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

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
    vi.mocked(rm).mockClear()
    vi.mocked(rename).mockClear()
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

  it('keeps a following explicit write after initializing a missing file', async () => {
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 3 }),
      validateStoredValue
    )

    const pendingRead = store.read()
    const explicitWrite = store.write({ value: 9 })

    await Promise.all([pendingRead, explicitWrite])
    expect(await store.read()).toEqual({ value: 9 })
  })

  it('returns the validated persistence round-trip for a default value', async () => {
    const initial = { value: 3 }
    let validatedValue: StoredValue | undefined
    const store = new SafeJsonStore(
      filePath,
      () => initial,
      (value) => {
        const storedValue = validateStoredValue(value)
        validatedValue = { value: storedValue.value }
        return validatedValue
      }
    )

    const result = await store.read()

    expect(result).toBe(validatedValue)
    expect(result).not.toBe(initial)
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(result)
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

  it('reports backup failures without preventing the formal write', async () => {
    const diagnostic = vi.fn(async () => {
      throw new Error('diagnostic failed')
    })
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue,
      async () => {
        throw new Error('change backup failed')
      },
      async () => {
        throw new Error('daily backup failed')
      },
      diagnostic
    )
    await writeFile(filePath, '{"value":1}', 'utf8')

    await expect(store.write({ value: 6 })).resolves.toBeUndefined()
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ value: 6 })
    expect(diagnostic).toHaveBeenCalledTimes(2)
    expect(await readdir(directory)).toEqual(['data.json'])
  })

  it('snapshots the old value before rename and the new value after rename', async () => {
    const snapshots: Array<{ phase: string; value: StoredValue }> = []
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue,
      async (_currentPath, value) => {
        snapshots.push({ phase: 'change', value })
      },
      async (_currentPath, value) => {
        snapshots.push({ phase: 'daily', value })
      }
    )
    await writeFile(filePath, '{"value":1}', 'utf8')

    await store.write({ value: 2 })

    expect(snapshots).toEqual([
      { phase: 'change', value: { value: 1 } },
      { phase: 'daily', value: { value: 2 } }
    ])
  })

  it('does not create a daily snapshot when the formal rename fails', async () => {
    const afterReplace = vi.fn()
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue,
      undefined,
      afterReplace
    )
    await writeFile(filePath, '{"value":1}', 'utf8')
    vi.mocked(rename).mockRejectedValueOnce(new Error('rename failed'))

    await expect(store.write({ value: 2 })).rejects.toThrow('rename failed')
    expect(afterReplace).not.toHaveBeenCalled()
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ value: 1 })
  })

  it('preserves the primary error when temporary cleanup also fails', async () => {
    const primaryError = new Error('replacement failed')
    const cleanupError = new Error('cleanup failed')
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue
    )
    await writeFile(filePath, '{"value":1}', 'utf8')
    vi.mocked(rename).mockRejectedValueOnce(primaryError)
    vi.mocked(rm).mockRejectedValueOnce(cleanupError)

    await expect(store.write({ value: 6 })).rejects.toBe(primaryError)
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

  it('moves an invalid formal file aside before safely restoring a candidate', async () => {
    const preservedPath = join(directory, 'data.json.corrupt-hash')
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue
    )
    await writeFile(filePath, '{broken', 'utf8')

    await store.replaceInvalid({ value: 8 }, preservedPath)

    expect(await readFile(preservedPath, 'utf8')).toBe('{broken')
    expect(await store.read()).toEqual({ value: 8 })
  })

  it('rolls the invalid formal file back when recovery replacement fails', async () => {
    const preservedPath = join(directory, 'data.json.corrupt-hash')
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue
    )
    await writeFile(filePath, '{broken', 'utf8')
    const actualFs = await vi.importActual<typeof import('node:fs/promises')>(
      'node:fs/promises'
    )
    vi.mocked(rename)
      .mockImplementationOnce(actualFs.rename)
      .mockRejectedValueOnce(new Error('replacement failed'))

    await expect(
      store.replaceInvalid({ value: 8 }, preservedPath)
    ).rejects.toThrow('replacement failed')

    expect(await readFile(filePath, 'utf8')).toBe('{broken')
    await expect(readFile(preservedPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('validates a recovery candidate before moving the invalid formal file', async () => {
    const preservedPath = join(directory, 'data.json.corrupt-hash')
    const store = new SafeJsonStore(
      filePath,
      () => ({ value: 0 }),
      validateStoredValue
    )
    await writeFile(filePath, '{broken', 'utf8')

    await expect(
      store.replaceInvalid({ value: -1 }, preservedPath)
    ).rejects.toThrow('invalid')

    expect(await readFile(filePath, 'utf8')).toBe('{broken')
    await expect(readFile(preservedPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
