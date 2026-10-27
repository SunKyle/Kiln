import type { Task } from '@/types'
import { dayKey } from './stats'
import { sortByPriority } from './tasks'

export interface CalCell {
  /** Local calendar day, YYYY-MM-DD — the join key against Task.due. */
  key: string
  /** Day-of-month number to print. */
  day: number
  /** False for the leading/trailing days that bleed in from the neighbouring months. */
  inMonth: boolean
  /** 0 = Monday … 6 = Sunday, so the view can tint the weekend without recomputing. */
  weekday: number
}

/**
 * A fixed 6×7 month grid, Monday-first.
 *
 * Always 42 cells: a grid that grows and shrinks between 5 and 6 rows makes the whole
 * page jump, and this one is anchored to the day list next to it.
 *
 * @param year  full year
 * @param month 0-based month, matching `Date` (0 = January)
 */
export function monthGrid(year: number, month: number): CalCell[] {
  const first = new Date(year, month, 1)
  // Date#getDay() is Sunday-first; shift so Monday owns column 0.
  const lead = (first.getDay() + 6) % 7
  const cells: CalCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - lead + i) // setDate-style arithmetic keeps DST honest
    cells.push({
      key: dayKey(d.getTime()),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      weekday: (d.getDay() + 6) % 7,
    })
  }
  return cells
}

/** Move a YYYY-MM-DD key by whole days. Parsing at midnight local keeps the DST steps honest. */
export function addDays(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  d.setDate(d.getDate() + delta)
  return dayKey(d.getTime())
}

/** The Monday that owns this day — the anchor for a week row. Sunday folds back to Monday. */
export function mondayOf(key: string): string {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dayKey(d.getTime())
}

/**
 * Seven cells starting at `mondayKey`.
 *
 * The same shape as a slice of monthGrid so the view pipes either density through one
 * renderer; every day is `inMonth` because a week never bleeds across a month boundary
 * in this layout — the month tint is a month-mode idea only.
 */
export function weekGrid(mondayKey: string): CalCell[] {
  const cells: CalCell[] = []
  for (let i = 0; i < 7; i++) {
    const key = addDays(mondayKey, i)
    const d = new Date(`${key}T00:00:00`)
    cells.push({ key, day: d.getDate(), inMonth: true, weekday: i })
  }
  return cells
}

/** The month block that a given day belongs to, ready for monthGrid(year, month). */
export function monthAnchor(key: string): { year: number; month: number } {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  }
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Shift a (year, month) pair by whole months, wrapping the year. */
export function addMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + month + delta
  return { year: Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 }
}

/**
 * Slide a day key by whole months, clamped to the target month's last day.
 *
 * `new Date(2026, 1, 31)` would quietly become 3 March; the month pager must not
 * skip a whole month because the anchor day does not exist there.
 */
export function shiftMonths(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  const { year, month } = addMonth(d.getFullYear(), d.getMonth(), delta)
  const last = new Date(year, month + 1, 0).getDate() // day 0 of the next month = that month's end
  return dayKey(new Date(year, month, Math.min(d.getDate(), last)).getTime())
}

/**
 * Every dated task bucketed by its due date, open work first and then finished work —
 * a completed task still earns a struck-through line in the week cell, it just never
 * competes for attention with what is still owed.
 */
export function byDue(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.due) continue
    const bucket = map.get(t.due)
    if (bucket) bucket.push(t)
    else map.set(t.due, [t])
  }
  // stable sort: priority order from lib/tasks survives the open/done split inside each bucket
  for (const [key, rows] of map) map.set(key, sortByPriority(rows).sort((a, b) => Number(a.done) - Number(b.done)))
  return map
}

/** Every task that carries this due date, done ones included — the day panel shows both. */
export function tasksOn(tasks: Task[], day: string): Task[] {
  return tasks.filter((t) => t.due === day)
}

/** Active tasks with no due date at all. Without a home of their own they vanish from a calendar. */
export function unscheduled(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done && !t.due)
}

/** A task is overdue when it is still open and its due date lies strictly before today. */
export function isOverdue(task: Task, todayKey: string): boolean {
  return !task.done && !!task.due && task.due < todayKey
}

/** Whole days between two YYYY-MM-DD keys (negative when `to` is earlier than `from`). */
export function dayGap(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`)
  const b = Date.parse(`${to}T00:00:00`)
  return Math.round((b - a) / 86_400_000)
}
