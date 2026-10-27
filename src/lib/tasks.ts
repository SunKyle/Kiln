import type { Task, Priority } from '@/types'

const rank: Record<Priority, number> = { high: 0, med: 1, low: 2 }

export function activeTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done)
}

export function dueOn(tasks: Task[], day: string): Task[] {
  return tasks.filter((t) => !t.done && t.due === day)
}

/** Active tasks whose due date is strictly before `day` (YYYY-MM-DD). */
export function overdueTasks(tasks: Task[], day: string): Task[] {
  return tasks.filter((t) => !t.done && !!t.due && t.due < day)
}

/** Tasks whose title matches `q` (case-insensitive). Blank query = no filtering. */
export function searchTasks(tasks: Task[], q: string): Task[] {
  const s = q.trim().toLowerCase()
  if (!s) return tasks
  return tasks.filter((t) => t.title.toLowerCase().includes(s))
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => rank[a.priority] - rank[b.priority])
}
