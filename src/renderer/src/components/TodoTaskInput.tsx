import { useEffect, useRef, useState } from 'react'

const SAVE_DELAY = 300

export function TodoTaskInput({
  value,
  onCommit
}: {
  value: string
  onCommit(value: string): void
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const composingRef = useRef(false)
  const dirtyRef = useRef(false)
  const awaitingAckRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const lastCommittedRef = useRef(value)
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  useEffect(() => {
    if (composingRef.current) return

    if (awaitingAckRef.current) {
      if (value === lastCommittedRef.current) {
        awaitingAckRef.current = false
        dirtyRef.current = false
        setDraft(value)
      }
      return
    }

    if (dirtyRef.current) return

    lastCommittedRef.current = value
    setDraft(value)
  }, [value])

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    },
    []
  )

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const commit = (next: string): void => {
    clearTimer()
    if (awaitingAckRef.current && next === lastCommittedRef.current) {
      dirtyRef.current = false
      return
    }

    dirtyRef.current = false
    awaitingAckRef.current = true
    lastCommittedRef.current = next
    onCommitRef.current(next)
  }

  const scheduleCommit = (next: string): void => {
    clearTimer()
    timerRef.current = window.setTimeout(() => commit(next), SAVE_DELAY)
  }

  return (
    <input
      className="task-content-input"
      aria-label="任务内容"
      type="text"
      value={draft}
      onCompositionStart={() => {
        clearTimer()
        composingRef.current = true
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false
        const next = event.currentTarget.value
        setDraft(next)
        dirtyRef.current = true
        commit(next)
      }}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)

        if (composingRef.current) {
          dirtyRef.current = true
          return
        }

        if (awaitingAckRef.current && next === lastCommittedRef.current) {
          dirtyRef.current = false
          return
        }

        dirtyRef.current = true
        scheduleCommit(next)
      }}
      onBlur={() => {
        if (!composingRef.current && dirtyRef.current) {
          commit(draft)
        }
      }}
    />
  )
}
