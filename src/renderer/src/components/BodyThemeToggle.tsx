import type { BodyTheme } from '../../../shared/models'

export function BodyThemeToggle({
  value,
  onChange
}: {
  value: BodyTheme
  onChange(value: BodyTheme): void
}): React.JSX.Element {
  return (
    <div className="segmented small">
      <button className={value === 'light' ? 'active' : ''} onClick={() => onChange('light')}>
        白色
      </button>
      <button className={value === 'dark' ? 'active' : ''} onClick={() => onChange('dark')}>
        黑色
      </button>
    </div>
  )
}

