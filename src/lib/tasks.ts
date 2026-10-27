import type { Task, Priority } from '@/types'

const rank: Record<Priority, number> = { high: 0, med: 1, low: 2 }

export function activeTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done)
}

export function dueOn(tasks: Task[], day: string): Task[] {
  return tasks.filter((t) => !t.done && t.due === day)
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => rank[a.priority] - rank[b.priority])
}
