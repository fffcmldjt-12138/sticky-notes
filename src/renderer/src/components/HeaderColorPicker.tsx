import type { HeaderColor } from '../../../shared/models'

const colors: HeaderColor[] = [
  '#f2c94c',
  '#f2994a',
  '#eb5757',
  '#e783a8',
  '#bb6bd9',
  '#6c63d9',
  '#5b8def',
  '#56ccf2',
  '#55b985',
  '#9ccc65',
  '#a97c50',
  '#8b95a5'
]

export function HeaderColorPicker({
  value,
  onChange,
  compact = false
}: {
  value: HeaderColor
  onChange(value: HeaderColor): void
  compact?: boolean
}): React.JSX.Element {
  const picker = (
    <div className="color-picker" aria-label="头部颜色">
      {colors.map((color) => (
        <button
          key={color}
          className={`color-dot ${value === color ? 'selected' : ''}`}
          style={{ backgroundColor: color, color }}
          aria-label={color}
          onClick={() => onChange(color)}
        />
      ))}
      <label className="custom-color-button" title="自由取色">
        +
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value as HeaderColor)}
        />
      </label>
    </div>
  )

  if (compact) {
    return (
      <details className="compact-color-picker">
        <summary aria-label="选择头部颜色" style={{ backgroundColor: value }} />
        <div className="compact-color-popover">{picker}</div>
      </details>
    )
  }

  return (
    picker
  )
}
