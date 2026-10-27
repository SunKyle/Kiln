import { ref, watch, type Ref } from 'vue'

export function useLocalStorage<T>(key: string, initial: T): Ref<T> {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  }

  const data = ref(read()) as Ref<T>

  watch(
    data,
    (v) => {
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* storage full or unavailable — keep in-memory */
      }
    },
    { deep: true },
  )

  return data
}
