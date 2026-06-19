import type {
  DraggableAttributes,
  DraggableSyntheticListeners
} from '@dnd-kit/core'

export function TreeDragHandle({
  label,
  attributes,
  listeners,
  decorative = false
}: {
  label: string
  attributes?: DraggableAttributes
  listeners?: DraggableSyntheticListeners
  decorative?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="tree-drag-handle"
      aria-label={label}
      tabIndex={decorative ? -1 : undefined}
      aria-hidden={decorative || undefined}
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  )
}
