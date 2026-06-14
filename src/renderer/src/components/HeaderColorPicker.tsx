import type { HeaderColor } from '../../../shared/models'

const colors: HeaderColor[] = ['#f2c94c', '#5b8def', '#55b985', '#e783a8']

export function HeaderColorPicker({
  value,
  onChange
}: {
  value: HeaderColor
  onChange(value: HeaderColor): void
}): React.JSX.Element {
  return (
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
    </div>
  )
}
