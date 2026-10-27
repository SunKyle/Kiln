import { computed } from 'vue'
import { useLocalStorage } from './useLocalStorage'
import { newId } from '@/lib/id'
import type { Task, Priority } from '@/types'

export function useTasks() {
  const tasks = useLocalStorage<Task[]>('kiln.tasks', [])

  function add(title: string, priority: Priority = 'med', due?: string) {
    const t = title.trim()
    if (!t) return
    tasks.value.push({ id: newId(), title: t, done: false, priority, due, createdAt: Date.now() })
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
