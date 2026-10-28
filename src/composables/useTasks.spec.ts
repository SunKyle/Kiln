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

  it('an edit obeys the same rules as a new row', async () => {
    const { add, update, tasks } = useTasks()
    add('原话', 'med', '2030-01-02')
    await nextTick()
    const id = tasks.value[0].id

    update(id, { title: '  改过的话  ' }) // trimmed on the way in, like a new row
    await nextTick()
    expect(stored()[0].title).toBe('改过的话')

    update(id, { title: '   ' }) // an empty rewrite is refused, not an eraser
    update(id, { priority: 'high' }) // and a field you leave out stays where it was
    await nextTick()
    expect(stored()[0]).toMatchObject({ title: '改过的话', priority: 'high', due: '2030-01-02' })

    update(id, { due: 'no-such-day' }) // a due date still cannot land on nothing
    await nextTick()
    expect(stored()[0].due).toBe(today)
  })

  it('an edit aimed at a task that is not there changes nothing', async () => {
    const { add, update } = useTasks()
    add('活着', 'low')
    await nextTick()
    update('gone', { title: '改写别人', priority: 'high' })
    await nextTick()
    expect(stored().map((t) => `${t.title}/${t.priority}`)).toEqual(['活着/low'])
  })
})
