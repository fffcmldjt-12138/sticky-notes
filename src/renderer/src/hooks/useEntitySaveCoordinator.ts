import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutationResult } from '../../../shared/models'

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict'

interface EntitySaveCoordinatorOptions<P, E extends { revision: number }> {
  remoteEntity: E
  save(
    expectedRevision: number,
    patch: P
  ): Promise<MutationResult<E>>
  mergePatches?(current: P, incoming: P): P
  recoverConflict?(current: E, failedPatch: P): P | null | undefined
}

export interface EntitySaveCoordinator<P, E extends { revision: number }> {
  enqueue(patch: P): Promise<MutationResult<E>>
  retry(): Promise<MutationResult<E> | null>
  discardPending(): void
  state: SaveState
  remoteRevision: number
}

interface Waiter<E> {
  resolve(result: MutationResult<E>): void
  reject(error: unknown): void
}

export function useEntitySaveCoordinator<
  P extends object,
  E extends { revision: number }
>({
  remoteEntity,
  save,
  mergePatches,
  recoverConflict
}: EntitySaveCoordinatorOptions<P, E>): EntitySaveCoordinator<P, E> {
  const saveRef = useRef(save)
  const mergeRef = useRef(mergePatches)
  const recoverConflictRef = useRef(recoverConflict)
  const revisionRef = useRef(remoteEntity.revision)
  const pendingRef = useRef<P | null>(null)
  const failedRef = useRef<P | null>(null)
  const waitersRef = useRef<Waiter<E>[]>([])
  const runningRef = useRef(false)
  const [state, setState] = useState<SaveState>('idle')
  const [remoteRevision, setRemoteRevision] = useState(remoteEntity.revision)

  saveRef.current = save
  mergeRef.current = mergePatches
  recoverConflictRef.current = recoverConflict

  useEffect(() => {
    if (remoteEntity.revision <= revisionRef.current) return
    revisionRef.current = remoteEntity.revision
    setRemoteRevision(remoteEntity.revision)
  }, [remoteEntity])

  const drain = useCallback(async (): Promise<MutationResult<E> | null> => {
    if (runningRef.current || failedRef.current) return null
    runningRef.current = true
    let lastResult: MutationResult<E> | null = null

    try {
      while (pendingRef.current) {
        const patch = pendingRef.current
        const waiters = waitersRef.current
        pendingRef.current = null
        waitersRef.current = []
        setState('saving')

        try {
          const result = await saveRef.current(revisionRef.current, patch)
          lastResult = result
          waiters.forEach(({ resolve }) => resolve(result))
          if (result.status !== 'ok') {
            if (result.status === 'conflict') {
              const recovered = recoverConflictRef.current?.(result.current, patch)
              if (recovered !== undefined) {
                const pending = pendingRef.current
                revisionRef.current = result.current.revision
                setRemoteRevision(result.current.revision)
                failedRef.current = null
                if (recovered !== null) {
                  pendingRef.current = pending
                    ? mergeRef.current?.(recovered, pending) ?? Object.assign({}, recovered, pending)
                    : recovered
                }
                setState('idle')
                continue
              }
            }
            failedRef.current = patch
            setState(result.status === 'conflict' ? 'conflict' : 'failed')
            break
          }
          revisionRef.current = result.value.revision
          setRemoteRevision(result.value.revision)
          setState('saved')
        } catch (error) {
          failedRef.current = patch
          waiters.forEach(({ reject }) => reject(error))
          setState('failed')
          break
        }
      }
    } finally {
      runningRef.current = false
    }
    return lastResult
  }, [])

  const enqueue = useCallback((patch: P): Promise<MutationResult<E>> => {
    pendingRef.current = pendingRef.current
      ? mergeRef.current?.(pendingRef.current, patch) ?? {
          ...pendingRef.current,
          ...patch
        }
      : patch
    const promise = new Promise<MutationResult<E>>((resolve, reject) => {
      waitersRef.current.push({ resolve, reject })
    })
    void drain()
    return promise
  }, [drain])

  const retry = useCallback(async (): Promise<MutationResult<E> | null> => {
    if (!failedRef.current) return null
    pendingRef.current = pendingRef.current
      ? mergeRef.current?.(failedRef.current, pendingRef.current) ?? {
          ...failedRef.current,
          ...pendingRef.current
        }
      : failedRef.current
    failedRef.current = null
    setState('idle')
    return drain()
  }, [drain])

  const discardPending = useCallback(() => {
    pendingRef.current = null
    failedRef.current = null
    waitersRef.current = []
    setState('idle')
  }, [])

  return { enqueue, retry, discardPending, state, remoteRevision }
}
