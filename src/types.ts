export type Priority = 'low' | 'med' | 'high'

export interface Task {
  id: string
  title: string
  done: boolean
  priority: Priority
  due?: string // YYYY-MM-DD
  createdAt: number
}

export interface Note {
  id: string
  title: string
  body: string
  tags: string[]
  updatedAt: number
}

export interface Tool {
  id: string
  name: string
  url: string
  category: string
}

export interface KilnData {
  tasks: Task[]
  notes: Note[]
  tools: Tool[]
}
