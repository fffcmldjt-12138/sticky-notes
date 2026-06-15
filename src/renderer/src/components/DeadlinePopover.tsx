import { useState } from 'react'
import type {
  DeadlineReminder,
  BodyTheme,
  TodoTaskPatch
} from '../../../shared/models'
import { DeadlineReminderPicker } from './DeadlineReminderPicker'
import { AnchoredPopover } from './AnchoredPopover'
import { DateTimePicker } from './DateTimePicker'

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function DeadlinePopover({
  deadlineAt,
  reminders,
  anchor,
  bodyTheme,
  onSave,
  onClose
}: {
  deadlineAt: string | null
  reminders: DeadlineReminder[]
  anchor: HTMLElement | null
  bodyTheme: BodyTheme
  onSave(patch: TodoTaskPatch): void
  onClose(): void
}): React.JSX.Element {
  const [deadlineDraft, setDeadlineDraft] = useState(toLocalInput(deadlineAt))
  const [reminderDraft, setReminderDraft] = useState(reminders)

  return (
    <AnchoredPopover
      anchor={anchor}
      className={`deadline-popover body-${bodyTheme}`}
      ariaLabel="DDL 设置"
      onClose={onClose}
    >
      <strong>截止时间</strong>
      <DateTimePicker
        label="DDL 时间"
        value={deadlineDraft}
        onChange={setDeadlineDraft}
      />
      <span className="task-popover-label">提前提醒</span>
      <DeadlineReminderPicker
        value={reminderDraft}
        onChange={setReminderDraft}
      />
      <div className="task-popover-actions">
        <button
          type="button"
          className="danger"
          onClick={() => {
            onSave({ deadlineAt: null, deadlineReminders: [] })
            onClose()
          }}
          aria-label="清除 DDL"
        >
          清除
        </button>
        <span />
        <button type="button" onClick={onClose}>取消</button>
        <button
          type="button"
          className="primary-button"
          disabled={!deadlineDraft}
          onClick={() => {
            if (!deadlineDraft) return
            onSave({
              deadlineAt: new Date(deadlineDraft).toISOString(),
              deadlineReminders: reminderDraft
            })
            onClose()
          }}
          aria-label="保存 DDL"
        >
          保存
        </button>
      </div>
    </AnchoredPopover>
  )
}
