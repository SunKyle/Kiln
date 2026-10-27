<script setup lang="ts">
import { RouterLink } from 'vue-router'
import KpiCard from '@/components/KpiCard.vue'
import { useTasks } from '@/composables/useTasks'
import { useNotes } from '@/composables/useNotes'
import { useTools } from '@/composables/useTools'

const { active } = useTasks()
const { notes } = useNotes()
const { tools } = useTools()
</script>

<template>
  <section class="grid cols-3 reveal">
    <KpiCard label="待办任务" :value="active.length" unit="项" foot="进行中 · 点击进入任务模块" variant="white" />
    <KpiCard label="知识库笔记" :value="notes.length" unit="篇" foot="正文存本地 IndexedDB" variant="plum" />
    <KpiCard label="常用工具" :value="tools.length" unit="个" foot="导航台已就绪" variant="orange" />
  </section>

  <section class="card reveal" style="animation-delay: 0.12s">
    <h3 class="section-title" style="color: var(--ink); margin: 0 0 8px">这套工作台现在能做什么</h3>
    <p class="muted" style="line-height: 1.6; max-width: 60ch">
      四个模块已经接通：任务待办、笔记知识库、工具导航，以及这块信息聚合仪表盘。数据是本地优先的——
      任务和工具走 localStorage，笔记走 IndexedDB，顶部「导出/导入」可以随时把它们打包成一份 JSON 备份。
      部署到 Vercel 后，外部信息流（天气 / RSS / 日历）通过 <code>api/</code> 的无服务器函数代理，绕开浏览器 CORS。
    </p>
    <div class="row" style="margin-top: 14px">
      <RouterLink class="btn btn-plum" to="/tasks">去建一条任务</RouterLink>
      <RouterLink class="btn" to="/notes">写第一篇笔记</RouterLink>
      <RouterLink class="btn" to="/tools">整理工具台</RouterLink>
    </div>
  </section>
</template>
