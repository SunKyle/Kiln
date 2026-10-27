import { useLocalStorage } from './useLocalStorage'
import { newId } from '@/lib/id'
import type { Tool } from '@/types'

const SEED: Tool[] = [
  { id: newId(), name: 'GitHub', url: 'https://github.com', category: '开发' },
  { id: newId(), name: 'Vercel', url: 'https://vercel.com', category: '部署' },
  { id: newId(), name: 'Figma', url: 'https://figma.com', category: '设计' },
  { id: newId(), name: 'DeepL', url: 'https://deepl.com', category: '效率' },
]

export function useTools() {
  const tools = useLocalStorage<Tool[]>('kiln.tools', SEED)

  function add(name: string, url: string, category: string) {
    const n = name.trim()
    if (!n || !url.trim()) return
    tools.value.push({ id: newId(), name: n, url: url.trim(), category: category.trim() || '其他' })
  }
  function remove(id: string) {
    tools.value = tools.value.filter((t) => t.id !== id)
  }

  return { tools, add, remove }
}
