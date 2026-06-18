import { useDndContext, useDroppable } from '@dnd-kit/core'
import type { TreeDropPosition } from '../lib/treeDrag'

export function TreeDropZone({
  id,
  position,
  parentExit = false
}: {
  id: string
  position: TreeDropPosition
  parentExit?: boolean
}): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { position }
  })
  const { active } = useDndContext()

  return (
    <div
      ref={setNodeRef}
      className={[
        'mixed-drop-marker',
        active ? 'drag-active' : '',
        isOver ? 'active' : '',
        parentExit ? 'parent-exit' : ''
      ].filter(Boolean).join(' ')}
    >
      {parentExit ? '移到上一级' : ''}
    </div>
  )
}
