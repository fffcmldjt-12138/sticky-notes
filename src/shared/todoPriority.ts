import type { TodoItem, TodoTask, TodoSubtask } from './models'

type PrioritizedTask = Pick<
  TodoTask | TodoSubtask,
  'completed' | 'importance' | 'urgency'
>

export function getTaskPriority(task: PrioritizedTask): number {
  if (task.importance === 'important' && task.urgency === 'urgent') return 0
  if (task.importance === 'important') return 1
  if (task.urgency === 'urgent') return 2
  return 3
}

export function getTodoPriority(todo: TodoItem): number {
  let priority = 4
  for (const task of todo.tasks) {
    if (!task.completed) priority = Math.min(priority, getTaskPriority(task))
    for (const child of task.children) {
      if (!child.completed) {
        priority = Math.min(priority, getTaskPriority(child))
      }
    }
  }
  return priority
}

export function sortTasksForDisplay(tasks: TodoTask[]): TodoTask[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      if (left.task.completed !== right.task.completed) {
        return left.task.completed ? 1 : -1
      }
      const rank = getTaskPriority(left.task) - getTaskPriority(right.task)
      return rank || left.index - right.index
    })
    .map(({ task }) => task)
}
