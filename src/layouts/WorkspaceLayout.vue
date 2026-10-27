<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useTasks } from '@/composables/useTasks'
import { useNotes } from '@/composables/useNotes'
import { useTools } from '@/composables/useTools'
import { notesDb } from '@/lib/db'
import { serialize, deserialize, download } from '@/lib/exportImport'
import type { KilnData } from '@/types'

const route = useRoute()
const title = computed(() => (route.meta.title as string) || '工作台')

const now = new Date()
const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now)

const { tasks } = useTasks()
const { notes, refresh } = useNotes()
const { tools } = useTools()
const fileEl = ref<HTMLInputElement | null>(null)

async function doExport() {
  await refresh()
  const json = serialize({ tasks: tasks.value, notes: notes.value, tools: tools.value })
  download(`kiln-backup-${now.toISOString().slice(0, 10)}.json`, json)
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const data: KilnData = deserialize(await file.text())
    tasks.value = data.tasks
    tools.value = data.tools
    for (const n of data.notes) await notesDb.put(n)
    await refresh()
  } catch {
    alert('备份文件解析失败，请确认是 Kiln 导出的 JSON。')
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <div class="shell" :class="{ 'shell-fit': route.name === 'dashboard' }">
    <aside class="rail">
      <RouterLink class="logo" to="/" title="Kiln">K</RouterLink>
      <nav class="nav">
        <RouterLink class="ico" to="/" title="仪表盘">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
        </RouterLink>
        <RouterLink class="ico" to="/tasks" title="任务待办">
          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
        </RouterLink>
        <RouterLink class="ico" to="/notes" title="笔记知识库">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>
        </RouterLink>
        <RouterLink class="ico" to="/tools" title="工具导航">
          <svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.3 2.3-2.1-.6-.6-2.1z" /></svg>
        </RouterLink>
      </nav>
      <div class="spacer" />
      <div class="avatar" title="本地 · 无账户">K</div>
    </aside>

    <main class="main">
      <div class="topbar">
        <div class="tb-head">
          <h1 class="title">{{ title }}<span class="when">{{ today }}</span></h1>
        </div>
        <div v-if="route.name !== 'dashboard'" class="tb-actions">
          <button class="btn" @click="doExport">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            导出
          </button>
          <button class="btn btn-plum" @click="fileEl?.click()">导入</button>
          <input ref="fileEl" type="file" accept="application/json,.json" hidden @change="onImportFile" />
        </div>
      </div>

      <RouterView />
    </main>
  </div>
</template>
