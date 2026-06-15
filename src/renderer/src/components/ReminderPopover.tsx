import { useState } from 'react'
import type { BodyTheme, TodoTaskPatch } from '../../../shared/models'
import { AnchoredPopover } from './AnchoredPopover'
import { DateTimePicker } from './DateTimePicker'

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function ReminderPopover({
  value,
  anchor,
  bodyTheme,
  onSave,
  onClose
}: {
  value: string | null
  anchor: HTMLElement | null
  bodyTheme: BodyTheme
  onSave(patch: TodoTaskPatch): void
  onClose(): void
}): React.JSX.Element {
  const [draft, setDraft] = useState(toLocalInput(value))

  return (
    <AnchoredPopover
      anchor={anchor}
      className={`reminder-popover body-${bodyTheme}`}
      ariaLabel="提醒设置"
      onClose={onClose}
    >
      <strong>提醒时间</strong>
      <DateTimePicker label="提醒时间" value={draft} onChange={setDraft} />
      <div className="task-popover-actions">
        <button
          type="button"
          className="danger"
          onClick={() => {
            onSave({ remindAt: null, reminded: false })
            onClose()
          }}
          aria-label="清除提醒"
        >
          清除
        </button>
        <span />
        <button type="button" onClick={onClose}>取消</button>
        <button
          type="button"
          className="primary-button"
          disabled={!draft}
          onClick={() => {
            if (!draft) return
            onSave({
              remindAt: new Date(draft).toISOString(),
              reminded: false
            })
            onClose()
          }}
          aria-label="保存提醒"
        >
          保存
        </button>
      </div>
    </AnchoredPopover>
  )
}
