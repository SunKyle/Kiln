import { describe, it, expect } from 'vitest'
import type { Task } from '@/types'
import {
  monthGrid,
  addMonth,
  addDays,
  mondayOf,
  weekGrid,
  monthAnchor,
  shiftMonths,
  byDue,
  tasksOn,
  unscheduled,
  isOverdue,
  dayGap,
} from './calendar'

const task = (o: Partial<Task> = {}): Task => ({
  id: Math.random().toString(36).slice(2),
  title: 't',
  done: false,
  priority: 'med',
  createdAt: 0,
  ...o,
})

describe('monthGrid', () => {
  it('always returns 42 cells starting on Monday', () => {
    const cells = monthGrid(2026, 9) // October 2026 starts on a Thursday
    expect(cells).toHaveLength(42)
    expect(cells[0].key).toBe('2026-09-28') // the Monday before the 1st
    expect(cells[0].weekday).toBe(0)
    expect(cells[6].weekday).toBe(6) // Sunday closes the row
    expect(cells[7].weekday).toBe(0) // and the next row reopens on Monday
  })

  it('marks the bleed-in days from neighbouring months', () => {
    const cells = monthGrid(2026, 9)
    expect(cells.slice(0, 3).every((c) => !c.inMonth)).toBe(true)
    expect(cells[3].key).toBe('2026-10-01')
    expect(cells[3].inMonth).toBe(true)
    expect(cells[33].key).toBe('2026-10-31')
    expect(cells[34].inMonth).toBe(false)
  })

  it('still starts on Monday when the month opens on Monday', () => {
    // 2026-06-01 is a Monday, so lead is 0 and nothing bleeds in from May
    const cells = monthGrid(2026, 5)
    expect(cells[0].key).toBe('2026-06-01')
    expect(cells[0].inMonth).toBe(true)
  })

  it('exposes today as a joinable YYYY-MM-DD key', () => {
    const cells = monthGrid(2026, 9)
    const tue = cells.find((c) => c.key === '2026-10-27')
    expect(tue?.day).toBe(27)
    expect(tue?.weekday).toBe(1) // Tuesday in a Monday-first grid
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-27', 5)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('hands back a key it cannot read instead of poisoning the grid with NaN', () => {
    expect(addDays('not-a-date', 3)).toBe('not-a-date')
  })
})

describe('mondayOf', () => {
  it('folds a Tuesday back to the Monday that owns it', () => {
    expect(mondayOf('2026-10-27')).toBe('2026-10-26')
  })
  it('leaves Monday where it is', () => {
    expect(mondayOf('2026-10-26')).toBe('2026-10-26')
  })
  it('pulls Sunday back to the same Monday, never forward', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26')
  })
})

describe('weekGrid', () => {
  it('lays out seven Monday-first days, the span the prototype shows', () => {
    const cells = weekGrid('2026-10-26')
    expect(cells.map((c) => c.key)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
    expect(cells.map((c) => c.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(cells[6].day).toBe(1) // the row bleeds into the next month but still prints 1
  })
  it('keeps every day in play — the month tint is a month-mode idea', () => {
    expect(weekGrid('2026-10-26').every((c) => c.inMonth)).toBe(true)
  })
})

describe('monthAnchor', () => {
  it('reads the month block a day belongs to', () => {
    expect(monthAnchor('2026-10-27')).toEqual({ year: 2026, month: 9 })
    expect(monthAnchor('2026-11-01')).toEqual({ year: 2026, month: 10 })
  })
  it('wraps the year going back', () => {
    expect(monthAnchor('2027-01-01')).toEqual({ year: 2027, month: 0 })
  })
  it('falls back to the live month on garbage', () => {
    const now = new Date()
    expect(monthAnchor('nope')).toEqual({ year: now.getFullYear(), month: now.getMonth() })
  })
})

describe('addMonth', () => {
  it('wraps forward into a new year', () => {
    expect(addMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
  })
  it('wraps backward into the previous year', () => {
    expect(addMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
  })
  it('is a no-op at zero', () => {
    expect(addMonth(2026, 9, 0)).toEqual({ year: 2026, month: 9 })
  })
})

describe('byDue', () => {
  it('buckets every dated task by day and drops the undated ones', () => {
    const tasks = [
      task({ due: '2026-10-27' }),
      task({ due: '2026-10-27' }),
      task({ due: '2026-10-28' }),
      task({ due: '2026-10-27', done: true }), // finished, but it still gets a line in the day
      task(), // no due date — never lands on the grid
    ]
    const map = byDue(tasks)
    expect([...map.keys()].sort()).toEqual(['2026-10-27', '2026-10-28'])
    expect(map.get('2026-10-27')).toHaveLength(3)
    expect(map.get('2026-10-28')).toHaveLength(1)
  })

  it('puts open work ahead of finished work, and high priority on top inside each group', () => {
    const map = byDue([
      task({ due: '2026-10-27', priority: 'low', done: true }),
      task({ due: '2026-10-27', priority: 'low' }),
      task({ due: '2026-10-27', priority: 'high' }),
      task({ due: '2026-10-27', priority: 'high', done: true }),
    ])
    expect(map.get('2026-10-27')?.map((t) => `${t.priority}${t.done ? '·' : ''}`)).toEqual([
      'high',
      'low',
      'high·',
      'low·',
    ])
  })
})

describe('shiftMonths', () => {
  it('keeps the day of month when it exists', () => {
    expect(shiftMonths('2026-10-27', 1)).toBe('2026-11-27')
    expect(shiftMonths('2026-10-27', -1)).toBe('2026-09-27')
  })
  it('clamps to the last day instead of overflowing into the next month', () => {
    expect(shiftMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(shiftMonths('2028-01-31', 1)).toBe('2028-02-29') // leap year
  })
  it('wraps the year both ways', () => {
    expect(shiftMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(shiftMonths('2026-01-15', -1)).toBe('2025-12-15')
  })
})

describe('tasksOn', () => {
  it('includes finished tasks so the day panel can show them struck through', () => {
    const tasks = [task({ due: '2026-10-27' }), task({ due: '2026-10-27', done: true }), task({ due: '2026-10-28' })]
    expect(tasksOn(tasks, '2026-10-27')).toHaveLength(2)
  })
})

describe('unscheduled', () => {
  it('catches open tasks with no due date, and only those', () => {
    const tasks = [task(), task({ due: '' }), task({ done: true }), task({ due: '2026-10-27' })]
    const out = unscheduled(tasks)
    expect(out).toHaveLength(2)
    expect(out.every((t) => !t.done && !t.due)).toBe(true)
  })
})

describe('isOverdue', () => {
  it('is true strictly before today', () => {
    expect(isOverdue(task({ due: '2026-10-26' }), '2026-10-27')).toBe(true)
    expect(isOverdue(task({ due: '2026-10-27' }), '2026-10-27')).toBe(false)
    expect(isOverdue(task({ due: '2026-10-28' }), '2026-10-27')).toBe(false)
  })
  it('never flags finished or undated work', () => {
    expect(isOverdue(task({ due: '2026-10-26', done: true }), '2026-10-27')).toBe(false)
    expect(isOverdue(task(), '2026-10-27')).toBe(false)
  })
})

describe('dayGap', () => {
  it('counts whole days and goes negative in the past', () => {
    expect(dayGap('2026-10-27', '2026-10-27')).toBe(0)
    expect(dayGap('2026-10-25', '2026-10-27')).toBe(2)
    expect(dayGap('2026-11-01', '2026-10-27')).toBe(-5)
  })
})
