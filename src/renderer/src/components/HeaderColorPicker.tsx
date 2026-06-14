import type { HeaderColor } from '../../../shared/models'

const colors: HeaderColor[] = ['yellow', 'blue', 'green', 'pink']

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
          className={`color-dot color-${color} ${value === color ? 'selected' : ''}`}
          aria-label={color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}

