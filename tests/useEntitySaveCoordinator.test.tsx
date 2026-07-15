// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEntitySaveCoordinator } from '../src/renderer/src/hooks/useEntitySaveCoordinator'

describe('useEntitySaveCoordinator', () => {
  it('serializes field patches with the latest confirmed revision', async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ status: 'ok', value: { id: 'n1', revision: 2 } })
      .mockResolvedValueOnce({ status: 'ok', value: { id: 'n1', revision: 3 } })
    const { result } = renderHook(() => useEntitySaveCoordinator({
      remoteEntity: { id: 'n1', revision: 1 }, save
    }))

    await act(async () => {
      await Promise.all([
        result.current.enqueue({ title: 'title' }),
        result.current.enqueue({ contentMarkdown: 'body' })
      ])
    })

    expect(save).toHaveBeenNthCalledWith(1, 1, { title: 'title' })
    expect(save).toHaveBeenNthCalledWith(2, 2, { contentMarkdown: 'body' })
  })

  it('retains a failed patch for retry', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('disk failed'))
      .mockResolvedValueOnce({ status: 'ok', value: { id: 'n1', revision: 2 } })
    const { result } = renderHook(() => useEntitySaveCoordinator({
      remoteEntity: { id: 'n1', revision: 1 }, save
    }))

    await act(async () => {
      await expect(result.current.enqueue({ title: 'kept' })).rejects.toThrow(
        'disk failed'
      )
    })
    expect(result.current.state).toBe('failed')

    await act(async () => { await result.current.retry() })
    expect(save).toHaveBeenLastCalledWith(1, { title: 'kept' })
    expect(result.current.state).toBe('saved')
  })

  it('uses a custom merge for queued entity commands', async () => {
    let resolveFirst!: (value: unknown) => void
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce({ status: 'ok', value: { id: 'n1', revision: 3 } })
    const { result } = renderHook(() => useEntitySaveCoordinator({
      remoteEntity: { id: 'n1', revision: 1 },
      save,
      mergePatches: (
        left: { operations: string[] },
        right: { operations: string[] }
      ) => ({ operations: [...left.operations, ...right.operations] })
    }))

    let first!: Promise<unknown>
    let second!: Promise<unknown>
    let third!: Promise<unknown>
    act(() => {
      first = result.current.enqueue({ operations: ['title'] })
      second = result.current.enqueue({ operations: ['task'] })
      third = result.current.enqueue({ operations: ['subtask'] })
    })
    await act(async () => {
      resolveFirst({ status: 'ok', value: { id: 'n1', revision: 2 } })
      await Promise.all([first, second, third])
    })

    expect(save).toHaveBeenNthCalledWith(2, 2, {
      operations: ['task', 'subtask']
    })
  })

  it('retries only the valid remainder of a conflicted batch', async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({
        status: 'conflict',
        current: { id: 'n1', revision: 2 }
      })
      .mockResolvedValueOnce({ status: 'ok', value: { id: 'n1', revision: 3 } })
    const { result } = renderHook(() => useEntitySaveCoordinator({
      remoteEntity: { id: 'n1', revision: 1 },
      save,
      recoverConflict: (_current, patch: { operations: string[] }) => ({
        operations: patch.operations.filter((operation) => operation !== 'deleted-task')
      })
    }))

    await act(async () => {
      await result.current.enqueue({
        operations: ['deleted-task', 'title-change']
      })
    })

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenNthCalledWith(2, 2, {
      operations: ['title-change']
    })
  })
})
