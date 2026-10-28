import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useTasks } from './useTasks'
import { dayKey } from '@/lib/stats'
import type { Task } from '@/types'

const today = dayKey(Date.now())
const stored = (): Task[] => JSON.parse(localStorage.getItem('kiln.tasks') ?? '[]') as Task[]

beforeEach(() => localStorage.clear())

describe('useTasks', () => {
  it('a task without a usable due date is filed on today, never on nothing', async () => {
    const { add } = useTasks()
    add('没给日期', 'med')
    add('给了空串', 'med', '')
    add('给了乱码', 'med', 'yesterday')
    add('排到将来', 'med', '2030-01-02')
    await nextTick() // the storage watcher flushes on the microtask queue
    expect(stored().map((t) => t.due)).toEqual([today, today, today, '2030-01-02'])
  })

  it('a blank title never reaches the store', async () => {
    const { add } = useTasks()
    add('   ', 'high')
    await nextTick()
    expect(stored()).toHaveLength(0)
  })
})
