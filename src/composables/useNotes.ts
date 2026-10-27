import { ref } from 'vue'
import { notesDb } from '@/lib/db'
import { newId } from '@/lib/id'
import type { Note } from '@/types'

export function useNotes() {
  const notes = ref<Note[]>([])
  const loading = ref(true)

  async function refresh() {
    try {
      notes.value = await notesDb.all()
    } finally {
      loading.value = false
    }
  }
  async function save(input: { id?: string; title: string; body?: string; tags?: string[] }) {
    const title = input.title.trim()
    if (!title) return
    const note: Note = {
      id: input.id ?? newId(),
      title,
      body: input.body ?? '',
      tags: input.tags ?? [],
      updatedAt: Date.now(),
    }
    await notesDb.put(note)
    await refresh()
    return note
  }
  async function remove(id: string) {
    await notesDb.del(id)
    await refresh()
  }

  void refresh()

  return { notes, loading, save, remove, refresh }
}
