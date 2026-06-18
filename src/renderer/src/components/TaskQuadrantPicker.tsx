import type {
  TaskImportance,
  TaskUrgency
} from '../../../shared/models'

export function TaskQuadrantPicker({
  importance,
  urgency,
  ariaLabel,
  onChange
}: {
  importance: TaskImportance
  urgency: TaskUrgency
  ariaLabel: string
  onChange(importance: TaskImportance, urgency: TaskUrgency): void
}): React.JSX.Element {
  const value = `${importance}-${urgency}`
  return (
    <select
      className="task-quadrant-picker"
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => {
        const [nextImportance, nextUrgency] = event.target.value.split('-') as [
          TaskImportance,
          TaskUrgency
        ]
        onChange(nextImportance, nextUrgency)
      }}
    >
      <option value="important-urgent">重要且紧急</option>
      <option value="important-normal">重要不紧急</option>
      <option value="normal-urgent">紧急不重要</option>
      <option value="normal-normal">普通</option>
    </select>
  )
}
