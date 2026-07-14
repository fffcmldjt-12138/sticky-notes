// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEntitySaveCoordinator } from '../src/renderer/src/hooks/useEntitySaveCoordinator'
import { usePersistedField } from '../src/renderer/src/hooks/usePersistedField'

describe('usePersistedField', () => {
  it('keeps a dirty draft when a newer remote value arrives', () => {
    const save = vi.fn()
    const { result, rerender } = renderHook(
      ({ remote }) => {
        const coordinator = useEntitySaveCoordinator({ remoteEntity: remote, save })
        return usePersistedField({
          remoteValue: remote.title,
          makePatch: (title: string) => ({ title }),
          coordinator,
          delayMs: 10_000
        })
      },
      { initialProps: { remote: { id: 'n1', title: 'old', revision: 1 } } }
    )

    act(() => result.current.change('local'))
    rerender({ remote: { id: 'n1', title: 'remote', revision: 2 } })

    expect(result.current.draft).toBe('local')
    expect(result.current.state).toBe('conflict')
  })

  it('does not save while composing and flushes at composition end', async () => {
    const save = vi.fn().mockResolvedValue({
      status: 'ok', value: { id: 'n1', title: '拼音', revision: 2 }
    })
    const { result } = renderHook(() => {
      const coordinator = useEntitySaveCoordinator({
        remoteEntity: { id: 'n1', title: '', revision: 1 }, save
      })
      return usePersistedField({
        remoteValue: '', makePatch: (title: string) => ({ title }), coordinator
      })
    })

    act(() => {
      result.current.onCompositionStart()
      result.current.change('拼音')
    })
    expect(save).not.toHaveBeenCalled()
    await act(async () => { await result.current.onCompositionEnd() })
    expect(save).toHaveBeenCalledTimes(1)
  })
})
