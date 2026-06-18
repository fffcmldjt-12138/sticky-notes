import type {
  DraggableAttributes,
  DraggableSyntheticListeners
} from '@dnd-kit/core'

export function TreeDragHandle({
  label,
  attributes,
  listeners
}: {
  label: string
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="tree-drag-handle"
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  )
}
