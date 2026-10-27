import type { Task } from '@/types'

const DAY = 86_400_000

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Active (not-done) tasks whose due date falls within [from, to], inclusive (YYYY-MM-DD). */
export function dueBetween(tasks: Task[], from: string, to: string): Task[] {
  return tasks.filter((t) => !t.done && t.due && t.due >= from && t.due <= to)
}

/**
 * Counts of tasks created per day for the trailing `days` days, oldest → newest.
 * The last bucket is "today" (the day `now` falls on). Future timestamps clamp to
 * the newest bucket; anything older than the window is ignored.
 */
export function createdSeries(tasks: Task[], days: number, now: number): number[] {
  const buckets = new Array<number>(days).fill(0)
  for (const t of tasks) {
    let daysAgo = Math.floor((now - t.createdAt) / DAY)
    if (daysAgo < 0) daysAgo = 0 // clock drift / future → counts as today
    if (daysAgo >= days) continue // older than window
    buckets[days - 1 - daysAgo] += 1
  }
  return buckets
}

/** Percentage of tasks completed, rounded to whole numbers; 0 for an empty list. */
export function completionRate(tasks: Task[]): number {
  if (tasks.length === 0) return 0
  const done = tasks.filter((t) => t.done).length
  return Math.round((done / tasks.length) * 100)
}
