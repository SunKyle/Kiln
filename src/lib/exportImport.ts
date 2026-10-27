import type { KilnData } from '@/types'

const EMPTY: KilnData = { tasks: [], notes: [], tools: [] }

export function serialize(data: KilnData): string {
  return JSON.stringify({ app: 'kiln', version: 1, exportedAt: Date.now(), data }, null, 2)
}

export function deserialize(raw: string): KilnData {
  const parsed = JSON.parse(raw)
  const d = (parsed && parsed.data) || parsed || {}
  return {
    tasks: Array.isArray(d.tasks) ? d.tasks : EMPTY.tasks,
    notes: Array.isArray(d.notes) ? d.notes : EMPTY.notes,
    tools: Array.isArray(d.tools) ? d.tools : EMPTY.tools,
  }
}

export function download(filename: string, text: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
