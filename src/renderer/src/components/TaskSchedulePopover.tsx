import { useState } from 'react'
import type {
  BodyTheme,
  TaskReminder,
  TaskRepeat,
  TodoSchedule
} from '../../../shared/models'
import { AnchoredPopover } from './AnchoredPopover'

const presets = [
  { label: '当天', offsetMinutes: 0 },
  { label: '提前 6 小时', offsetMinutes: 360 },
  { label: '提前 1 天', offsetMinutes: 1440 },
  { label: '提前 3 天', offsetMinutes: 4320 }
]

export function TaskSchedulePopover({
  value,
  anchor,
  bodyTheme,
  onSave,
  onClose
}: {
  value: TodoSchedule | null
  anchor: HTMLElement | null
  bodyTheme: BodyTheme
  onSave(value: TodoSchedule | null): void
  onClose(): void
}): React.JSX.Element {
  const [mode, setMode] = useState<TodoSchedule['mode']>(
    value?.mode ?? 'point'
  )
  const [startAt, setStartAt] = useState(toLocalInput(value?.startAt))
  const [endAt, setEndAt] = useState(toLocalInput(value?.endAt))
  const [reminders, setReminders] = useState<TaskReminder[]>(
    value?.reminders ?? []
  )
  const [repeat, setRepeat] = useState<TaskRepeat>(value?.repeat ?? 'none')
  const [customAmount, setCustomAmount] = useState('1')
  const [customUnit, setCustomUnit] =
    useState<'minutes' | 'hours' | 'days'>('hours')
  const [error, setError] = useState('')
  const [reminderFeedback, setReminderFeedback] = useState('')

  function togglePreset(offsetMinutes: number): void {
    setReminders((current) =>
      current.some((reminder) => reminder.offsetMinutes === offsetMinutes)
        ? current.filter((reminder) => reminder.offsetMinutes !== offsetMinutes)
        : [...current, {
            id: `preset-${offsetMinutes}`,
            offsetMinutes,
            remindedAt: null
          }]
    )
  }

  function save(): void {
    if (!startAt) {
      setError('请选择开始时间')
      return
    }
    if (mode === 'range' && (!endAt || new Date(endAt) <= new Date(startAt))) {
      setError('结束时间必须晚于开始时间')
      return
    }
    onSave({
      mode,
      startAt: new Date(startAt).toISOString(),
      endAt: mode === 'range' ? new Date(endAt).toISOString() : null,
      reminders: reminders.map((reminder) => ({
        ...reminder,
        remindedAt: null
      })),
      repeat
    })
    onClose()
  }

  function addCustomReminder(): void {
    const amount = Number(customAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setReminderFeedback('请输入大于 0 的提前时间')
      return
    }
    const factor =
      customUnit === 'days' ? 1440 : customUnit === 'hours' ? 60 : 1
    const offsetMinutes = Math.round(amount * factor)
    if (reminders.some((reminder) => reminder.offsetMinutes === offsetMinutes)) {
      setReminderFeedback('这个提前提醒已经添加')
      return
    }
    setReminderFeedback('')
    setReminders((current) => [...current, {
      id: `custom-${offsetMinutes}`,
      offsetMinutes,
      remindedAt: null
    }])
  }

  return (
    <AnchoredPopover
      anchor={anchor}
      ariaLabel="时间设置"
      className={`schedule-popover body-${bodyTheme}`}
      onClose={onClose}
    >
      <section className="schedule-section">
        <strong>时间</strong>
        <div className="segmented small">
          <button
            type="button"
            className={mode === 'point' ? 'active' : ''}
            onClick={() => setMode('point')}
          >
            时间点
          </button>
          <button
            type="button"
            className={mode === 'range' ? 'active' : ''}
            onClick={() => setMode('range')}
          >
            时间段
          </button>
        </div>
        <label>
          <span>开始</span>
          <input
            type="datetime-local"
            aria-label="开始时间"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
          />
        </label>
        {mode === 'range' && (
          <label>
            <span>结束</span>
            <input
              type="datetime-local"
              aria-label="结束时间"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
            />
          </label>
        )}
      </section>
      <section className="schedule-section">
        <strong>提醒</strong>
        <div className="deadline-presets">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.offsetMinutes}
              className={reminders.some(
                (reminder) =>
                  reminder.offsetMinutes === preset.offsetMinutes
              ) ? 'active' : ''}
              onClick={() => togglePreset(preset.offsetMinutes)}
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
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
          />
          <select
            aria-label="自定义提前单位"
            value={customUnit}
            onChange={(event) =>
              setCustomUnit(event.target.value as typeof customUnit)
            }
          >
            <option value="minutes">分钟</option>
            <option value="hours">小时</option>
            <option value="days">天</option>
          </select>
          <button type="button" onClick={addCustomReminder}>添加提前提醒</button>
        </div>
        {reminders.length > 0 && (
          <div className="selected-reminders" aria-label="已添加提醒">
            {[...reminders]
              .sort((left, right) => left.offsetMinutes - right.offsetMinutes)
              .map((reminder) => {
                const label = formatReminderOffset(reminder.offsetMinutes)
                return (
                  <span className="selected-reminder-chip" key={reminder.id}>
                    {label}
                    <button
                      type="button"
                      aria-label={`删除${label}`}
                      onClick={() => {
                        setReminders((current) =>
                          current.filter((entry) => entry.id !== reminder.id)
                        )
                        setReminderFeedback('')
                      }}
                    >
                      ×
                    </button>
                  </span>
                )
              })}
          </div>
        )}
        {reminderFeedback && (
          <p className="reminder-feedback" role="status">{reminderFeedback}</p>
        )}
      </section>
      <section className="schedule-section">
        <strong>重复</strong>
        <select
          aria-label="重复"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value as TaskRepeat)}
        >
          <option value="none">不重复</option>
          <option value="daily">每天</option>
          <option value="weekly">每周</option>
          <option value="weekdays">工作日</option>
        </select>
      </section>
      {error && <p className="schedule-error">{error}</p>}
      <div className="task-popover-actions">
        <button
          type="button"
          className="danger"
          onClick={() => {
            onSave(null)
            onClose()
          }}
        >
          清除
        </button>
        <span />
        <button type="button" onClick={onClose}>取消</button>
        <button
          type="button"
          className="primary-button"
          onClick={save}
        >
          保存
        </button>
      </div>
    </AnchoredPopover>
  )
}

function toLocalInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatReminderOffset(minutes: number): string {
  if (minutes === 0) return '当天'
  if (minutes % 1440 === 0) return `提前 ${minutes / 1440} 天`
  if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`
  return `提前 ${minutes} 分钟`
}
