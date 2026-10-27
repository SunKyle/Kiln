import { describe, it, expect } from 'vitest'
import { activeTasks, sortByPriority, dueOn, overdueTasks, searchTasks } from './tasks'
import type { Task } from '@/types'

const t = (o: Partial<Task> = {}): Task => ({
  id: Math.random().toString(),
  title: 'x',
  done: false,
  priority: 'med',
  createdAt: 0,
  ...o,
})

describe('task utils', () => {
  it('filters active tasks', () => {
    const list = [t({ done: true }), t(), t({ done: true }), t()]
    expect(activeTasks(list)).toHaveLength(2)
  })
  it('sorts high before low', () => {
    const list = [t({ priority: 'low' }), t({ priority: 'high' }), t({ priority: 'med' })]
    expect(sortByPriority(list).map((x) => x.priority)).toEqual(['high', 'med', 'low'])
  })
  it('finds tasks due on a day', () => {
    const list = [t({ due: '2026-10-27' }), t({ due: '2026-10-28' })]
    expect(dueOn(list, '2026-10-27')).toHaveLength(1)
  })
  it('marks only undone dated tasks as overdue', () => {
    const list = [
      t({ due: '2026-10-26' }), // past due -> counts
      t({ due: '2026-10-27' }), // today -> does not count
      t({ due: '2026-10-26', done: true }), // finished -> does not count
      t(), // no due date -> never counts
    ]
    expect(overdueTasks(list, '2026-10-27')).toHaveLength(1)
  })
  it('searches titles case-insensitively, blank query is a no-op', () => {
    const list = [t({ title: 'Fix API timeout' }), t({ title: '写周报' })]
    expect(searchTasks(list, 'api')).toHaveLength(1)
    expect(searchTasks(list, '周报')).toHaveLength(1)
    expect(searchTasks(list, '  ')).toHaveLength(2)
    expect(searchTasks(list, '')).toBe(list)
  })
})
