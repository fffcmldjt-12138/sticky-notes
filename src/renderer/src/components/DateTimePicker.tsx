import { useEffect, useState } from 'react'

function splitValue(value: string): {
  date: string
  hour: string
  minute: string
} {
  const [date = '', time = '09:00'] = value.split('T')
  const [hour = '09', minute = '00'] = time.split(':')
  return { date, hour, minute }
}

export function DateTimePicker({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange(value: string): void
}): React.JSX.Element {
  const prefix = label.startsWith('DDL') ? 'DDL' : '提醒'
  const ariaPrefix = prefix === 'DDL' ? 'DDL ' : prefix
  const [draft, setDraft] = useState(() => splitValue(value))

  useEffect(() => setDraft(splitValue(value)), [value])

  return (
    <div className="date-time-picker" aria-label={label}>
      <input
        type="date"
        aria-label={`${ariaPrefix}日期`}
        value={draft.date}
        onChange={(event) =>
          setDraft((current) => ({ ...current, date: event.target.value }))
        }
      />
      <div className="time-scroll-columns">
        <label>
          <span>小时</span>
          <select
            aria-label={`${ariaPrefix}小时`}
            size={5}
            value={draft.hour}
            onChange={(event) =>
              setDraft((current) => ({ ...current, hour: event.target.value }))
            }
          >
            {Array.from({ length: 24 }, (_, hour) => {
              const option = String(hour).padStart(2, '0')
              return <option key={option} value={option}>{option}</option>
            })}
          </select>
        </label>
        <label>
          <span>分钟</span>
          <select
            aria-label={`${ariaPrefix}分钟`}
            size={5}
            value={draft.minute}
            onChange={(event) =>
              setDraft((current) => ({ ...current, minute: event.target.value }))
            }
          >
            {Array.from({ length: 60 }, (_, minute) => {
              const option = String(minute).padStart(2, '0')
              return <option key={option} value={option}>{option}</option>
            })}
          </select>
        </label>
      </div>
      <div className="date-time-actions">
        <button type="button" onClick={() => setDraft(splitValue(value))}>
          取消选择
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!draft.date}
          aria-label={`确认${prefix}时间`}
          onClick={() =>
            onChange(`${draft.date}T${draft.hour}:${draft.minute}`)
          }
        >
          确认时间
        </button>
      </div>
    </div>
  )
}
