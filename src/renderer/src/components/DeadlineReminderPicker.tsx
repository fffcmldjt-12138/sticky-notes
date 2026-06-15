import { useState } from 'react'
import type { DeadlineReminder } from '../../../shared/models'

const presets = [
  { label: '提前 3 天', minutes: 4320 },
  { label: '提前 1 天', minutes: 1440 },
  { label: '提前 6 小时', minutes: 360 }
]

export function DeadlineReminderPicker({
  value,
  onChange
}: {
  value: DeadlineReminder[]
  onChange(value: DeadlineReminder[]): void
}): React.JSX.Element {
  const [amount, setAmount] = useState('1')
  const [unit, setUnit] = useState<'minutes' | 'hours' | 'days'>('hours')

  function toggle(minutes: number): void {
    const exists = value.some((reminder) => reminder.offsetMinutes === minutes)
    onChange(exists
      ? value.filter((reminder) => reminder.offsetMinutes !== minutes)
      : [...value, {
          id: `preset-${minutes}`,
          offsetMinutes: minutes,
          remindedAt: null
        }]
    )
  }

  function addCustom(): void {
    const numeric = Number(amount)
    if (!Number.isFinite(numeric) || numeric <= 0) return
    const factor = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1
    const minutes = Math.round(numeric * factor)
    if (value.some((reminder) => reminder.offsetMinutes === minutes)) return
    onChange([...value, {
      id: `custom-${minutes}`,
      offsetMinutes: minutes,
      remindedAt: null
    }])
  }

  return (
    <div className="deadline-reminder-picker">
      <div className="deadline-presets">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.minutes}
            className={value.some(
              (reminder) => reminder.offsetMinutes === preset.minutes
            ) ? 'active' : ''}
            onClick={() => toggle(preset.minutes)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="custom-deadline-reminder">
        <input
          aria-label="自定义提前数值"
          type="number"
          min="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <select
          aria-label="自定义提前单位"
          value={unit}
          onChange={(event) => setUnit(event.target.value as typeof unit)}
        >
          <option value="minutes">分钟</option>
          <option value="hours">小时</option>
          <option value="days">天</option>
        </select>
        <button type="button" onClick={addCustom}>添加</button>
      </div>
    </div>
  )
}
