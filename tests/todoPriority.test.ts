import { describe, expect, it } from 'vitest'
import type { TodoItem, TodoTask } from '../src/shared/models'
import {
  getTaskPriority,
  getTodoPriority,
  sortTasksForDisplay
} from '../src/shared/todoPriority'

function task(
  id: string,
  importance: TodoTask['importance'],
  urgency: TodoTask['urgency'],
  completed = false
): TodoTask {
  return {
    id,
    contentMarkdown: id,
    completed,
    tags: [],
    importance,
    urgency,
    children: [],
    schedule: null
  }
}

describe('todo priority', () => {
  it('ranks the four quadrants', () => {
    expect(getTaskPriority(task('a', 'important', 'urgent'))).toBe(0)
    expect(getTaskPriority(task('b', 'important', 'normal'))).toBe(1)
    expect(getTaskPriority(task('c', 'normal', 'urgent'))).toBe(2)
    expect(getTaskPriority(task('d', 'normal', 'normal'))).toBe(3)
  })

  it('uses child priority for the todo card', () => {
    const parent = task('parent', 'normal', 'normal')
    parent.children.push({
      id: 'child',
      contentMarkdown: 'child',
      completed: false,
      tags: [],
      importance: 'important',
      urgency: 'urgent',
      schedule: null
    })
    const todo = { type: 'todo', tasks: [parent] } as TodoItem

    expect(getTodoPriority(todo)).toBe(0)
  })

  it('sorts incomplete tasks by quadrant and completed tasks last', () => {
    const tasks = [
      task('normal', 'normal', 'normal'),
      task('done', 'important', 'urgent', true),
      task('urgent', 'important', 'urgent')
    ]

    expect(sortTasksForDisplay(tasks).map(({ id }) => id)).toEqual([
      'urgent',
      'normal',
      'done'
    ])
  })
})
