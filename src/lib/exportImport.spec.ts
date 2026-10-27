import { describe, it, expect } from 'vitest'
import { serialize, deserialize } from './exportImport'

describe('export/import backup', () => {
  it('round-trips data', () => {
    const data = { tasks: [{ id: '1', title: 'a', done: false, priority: 'med' as const, createdAt: 0 }], notes: [], tools: [] }
    const restored = deserialize(serialize(data))
    expect(restored.tasks).toHaveLength(1)
    expect(restored.tasks[0].title).toBe('a')
  })
  it('is tolerant of a bare payload', () => {
    const restored = deserialize(JSON.stringify({ tasks: [], notes: [{ id: 'n' }], tools: 'oops' }))
    expect(restored.notes).toHaveLength(1)
    expect(restored.tools).toEqual([])
  })
})
