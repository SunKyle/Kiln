import { computed } from 'vue'
import { useLocalStorage } from './useLocalStorage'
import { newId } from '@/lib/id'
import { dayKey } from '@/lib/stats'
import type { Task, Priority } from '@/types'

export function useTasks() {
  const tasks = useLocalStorage<Task[]>('kiln.tasks', [])

  /**
   * Every task lands on a day. A missing or malformed due date is not "unscheduled" —
   * it means today. The rule lives here, at the only write path, so no caller can skip it.
   */
  function dated(due?: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(due ?? '') ? (due as string) : dayKey(Date.now())
  }

  function add(title: string, priority: Priority = 'med', due?: string) {
    const t = title.trim()
    if (!t) return
    tasks.value.push({ id: newId(), title: t, done: false, priority, due: dated(due), createdAt: Date.now() })
  }
  function toggle(id: string) {
    const task = tasks.value.find((x) => x.id === id)
    if (task) task.done = !task.done
  }
  function remove(id: string) {
    tasks.value = tasks.value.filter((x) => x.id !== id)
  }

  const active = computed(() => tasks.value.filter((t) => !t.done))
  const doneCount = computed(() => tasks.value.filter((t) => t.done).length)

  return { tasks, add, toggle, remove, active, doneCount }
}
