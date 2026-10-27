import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useLocalStorage } from './useLocalStorage'

beforeEach(() => localStorage.clear())

describe('useLocalStorage', () => {
  it('persists and reflects writes', async () => {
    const n = useLocalStorage('k', { count: 0 })
    n.value.count = 3
    await nextTick()
    expect(JSON.parse(localStorage.getItem('k')!)).toEqual({ count: 3 })
  })
  it('falls back to initial on corrupt json', () => {
    localStorage.setItem('bad', '{not json')
    const v = useLocalStorage('bad', 'safe')
    expect(v.value).toBe('safe')
  })
})
