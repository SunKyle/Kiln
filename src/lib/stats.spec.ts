import { describe, it, expect } from 'vitest'
import type { Task } from '@/types'
import { dayKey, dueBetween, createdSeries, completionRate } from './stats'

const DAY = 86_400_000

const task = (o: Partial<Task> = {}): Task => ({
  id: Math.random().toString(36).slice(2),
  title: 't',
  done: false,
  priority: 'med',
  createdAt: 0,
  ...o,
})

describe('dayKey', () => {
  it('formats local calendar day as YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 27, 13, 0, 0) // Oct is month index 9
    expect(dayKey(d.getTime())).toBe('2026-10-27')
  })
})

describe('dueBetween', () => {
  it('keeps only active tasks with a due date inside the window', () => {
    const tasks = [
      task({ due: '2026-10-27' }),
      task({ due: '2026-10-30' }),
      task({ due: '2026-11-05' }), // past the window
      task({ due: '2026-10-28', done: true }), // done → excluded
      task(), // no due → excluded
    ]
    const hit = dueBetween(tasks, '2026-10-27', '2026-10-31')
    expect(hit.map((t) => t.due).sort()).toEqual(['2026-10-27', '2026-10-30'])
  })
})

describe('createdSeries', () => {
  const now = new Date(2026, 9, 27, 12, 0, 0).getTime()

  it('buckets creations by trailing days, oldest → newest (last is today)', () => {
    const tasks = [
      task({ createdAt: now }), // today
      task({ createdAt: now - DAY }), // yesterday
      task({ createdAt: now - DAY }), // yesterday
      task({ createdAt: now - 3 * DAY }), // 3 days ago
      task({ createdAt: now - 99 * DAY }), // far outside window
    ]
    expect(createdSeries(tasks, 7, now)).toEqual([0, 0, 0, 1, 0, 2, 1])
    //              index:  d-6 d-5 d-4 d-3 d-2 d-1 today
  })

  it('clamps future timestamps into today bucket', () => {
    expect(createdSeries([task({ createdAt: now + DAY })], 7, now)).toEqual([0, 0, 0, 0, 0, 0, 1])
  })

  it('returns all zeros for an empty list', () => {
    expect(createdSeries([], 7, now)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe('completionRate', () => {
  it('is 0 for an empty list', () => {
    expect(completionRate([])).toBe(0)
  })
  it('rounds the done share to a whole percent', () => {
    const tasks = [task({ done: true }), task({ done: true }), task(), task(), task()]
    expect(completionRate(tasks)).toBe(40)
  })
})
