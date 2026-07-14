import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutationResult } from '../../../shared/models'
import type {
  EntitySaveCoordinator,
  SaveState
} from './useEntitySaveCoordinator'

interface PersistedFieldOptions<T, P extends object, E extends { revision: number }> {
  remoteValue: T
  makePatch(value: T): P
  coordinator: EntitySaveCoordinator<P, E>
  delayMs?: number
}

export interface PersistedField<T> {
  draft: T
  change(value: T): void
  flush(): Promise<MutationResult<unknown> | null>
  retry(): Promise<void>
  discardLocal(): void
  state: SaveState
  onCompositionStart(): void
  onCompositionEnd(): Promise<MutationResult<unknown> | null>
}

export function usePersistedField<
  T,
  P extends object,
  E extends { revision: number }
>({
  remoteValue,
  makePatch,
  coordinator,
  delayMs = 500
}: PersistedFieldOptions<T, P, E>): PersistedField<T> {
  const [draft, setDraft] = useState(remoteValue)
  const [state, setState] = useState<SaveState>('idle')
  const draftRef = useRef(remoteValue)
  const remoteRef = useRef(remoteValue)
  const dirtyRef = useRef(false)
  const composingRef = useRef(false)
  const sequenceRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushRef = useRef<() => Promise<MutationResult<E> | null>>(async () => null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const flush = useCallback(async (): Promise<MutationResult<E> | null> => {
    clearTimer()
    if (!dirtyRef.current || composingRef.current) return null
    const sentSequence = sequenceRef.current
    const sentValue = draftRef.current
    setState('saving')
    try {
      const result = await coordinator.enqueue(makePatch(sentValue))
      if (result.status === 'ok' && sequenceRef.current === sentSequence) {
        dirtyRef.current = false
        remoteRef.current = sentValue
        setState('saved')
      } else if (result.status === 'conflict') {
        setState('conflict')
      } else if (result.status !== 'ok') {
        setState('failed')
      }
      return result
    } catch {
      setState('failed')
      return null
    }
  }, [clearTimer, coordinator, makePatch])
  flushRef.current = flush

  const schedule = useCallback(() => {
    clearTimer()
    if (composingRef.current) return
    timerRef.current = setTimeout(() => void flushRef.current(), delayMs)
  }, [clearTimer, delayMs])

  const change = useCallback((value: T) => {
    draftRef.current = value
    dirtyRef.current = true
    sequenceRef.current += 1
    setDraft(value)
    setState('idle')
    schedule()
  }, [schedule])

  useEffect(() => {
    if (Object.is(remoteRef.current, remoteValue)) return
    remoteRef.current = remoteValue
    if (dirtyRef.current && !Object.is(draftRef.current, remoteValue)) {
      setState('conflict')
      return
    }
    dirtyRef.current = false
    draftRef.current = remoteValue
    setDraft(remoteValue)
    setState('idle')
  }, [coordinator.remoteRevision, remoteValue])

  useEffect(() => clearTimer, [clearTimer])

  const retry = useCallback(async () => {
    const result = await coordinator.retry()
    if (result?.status === 'ok') {
      dirtyRef.current = false
      remoteRef.current = draftRef.current
      setState('saved')
    } else if (result?.status === 'conflict') {
      setState('conflict')
    } else if (result) {
      setState('failed')
    }
  }, [coordinator])

  const discardLocal = useCallback(() => {
    clearTimer()
    dirtyRef.current = false
    draftRef.current = remoteRef.current
    setDraft(remoteRef.current)
    setState('idle')
    coordinator.discardPending()
  }, [clearTimer, coordinator])

  const onCompositionStart = useCallback(() => {
    composingRef.current = true
    clearTimer()
  }, [clearTimer])

  const onCompositionEnd = useCallback(async () => {
    composingRef.current = false
    return flushRef.current()
  }, [])

  return {
    draft,
    change,
    flush: flush as PersistedField<T>['flush'],
    retry,
    discardLocal,
    state,
    onCompositionStart,
    onCompositionEnd: onCompositionEnd as PersistedField<T>['onCompositionEnd']
  }
}
