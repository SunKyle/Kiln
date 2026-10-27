import { describe, it, expect } from 'vitest'
import { activeTasks, sortByPriority, dueOn } from './tasks'
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
})
