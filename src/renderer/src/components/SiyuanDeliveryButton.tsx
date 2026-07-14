import { useEffect, useState } from 'react'
import { Check, LoaderCircle, RefreshCw, Send } from 'lucide-react'
import type { NoteItem } from '../../../shared/models'
import { hasNoteChangedSinceDelivery } from '../../../shared/siyuan'

export function SiyuanDeliveryButton({
  note,
  onSend,
  compact = false
}: {
  note: NoteItem
  onSend(): Promise<unknown>
  compact?: boolean
}): React.JSX.Element {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const changed = hasNoteChangedSinceDelivery(note)
  const alreadySent = Boolean(note.siyuanDelivery) && !changed

  useEffect(() => {
    if (note.siyuanDelivery) setError('')
  }, [note.siyuanDelivery])

  const label = sending
    ? '发送中...'
    : error
      ? '重试发送到思源'
      : changed
        ? '再次发送到思源'
        : alreadySent
          ? '已发送到思源'
          : '发送到思源'

  async function send(): Promise<void> {
    if (sending || alreadySent) return
    setSending(true)
    setError('')
    try {
      await onSend()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`siyuan-delivery-control ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        className={`${compact ? 'siyuan-card-send-button' : 'secondary-button siyuan-send-button'}`}
        disabled={sending || alreadySent}
        aria-label={label}
        title={label}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          void send()
        }}
      >
        {compact
          ? sending
            ? <LoaderCircle size={16} aria-hidden="true" />
            : alreadySent
              ? <Check size={16} aria-hidden="true" />
              : changed || error
                ? <RefreshCw size={16} aria-hidden="true" />
                : <Send size={16} aria-hidden="true" />
          : label}
      </button>
      {error && !compact && (
        <span className="siyuan-delivery-error" role="status">{error}</span>
      )}
    </div>
  )
}
