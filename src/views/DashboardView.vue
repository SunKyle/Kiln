<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useTasks } from '@/composables/useTasks'
import { useNotes } from '@/composables/useNotes'
import { useTools } from '@/composables/useTools'
import { activeTasks } from '@/lib/tasks'
import { dayKey, dueBetween, createdSeries, completionRate } from '@/lib/stats'

const { tasks } = useTasks()
const { notes } = useNotes()
const { tools } = useTools()
const router = useRouter()

const now = Date.now()
const activeCount = computed(() => activeTasks(tasks.value).length)
const doneCount = computed(() => tasks.value.length - activeCount.value)
const dueThisWeek = computed(() =>
  dueBetween(tasks.value, dayKey(now), dayKey(now + 7 * 86_400_000)).length,
)
const rate = computed(() => completionRate(tasks.value))

const series = computed(() => createdSeries(tasks.value, 7, now))
const weekCreated = computed(() => series.value.reduce((a, b) => a + b, 0))

const recentNotes = computed(() =>
  [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3),
)
const topTools = computed(() => tools.value.slice(0, 4))

// ---- chart geometry (viewBox 0 0 620 190) ----
const geometry = computed(() => {
  const s = series.value
  const max = Math.max(1, ...s)
  const n = s.length
  const pts = s.map((v, i) => {
    const x = n > 1 ? 10 + (i * 600) / (n - 1) : 310
    const y = 150 - (v / max) * 100
    return { x, y, v }
  })
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},170 L${pts[0].x.toFixed(1)},170 Z`
  return { pts, line, area }
})

const search = (e: Event) => {
  const q = (e.target as HTMLInputElement).value.trim()
  router.push({ path: '/tasks', query: q ? { q } : {} })
}
</script>

<template>
  <div class="dash">
    <!-- ===== main column ===== -->
    <div class="dash-col">
      <!-- hero row: brand focus card + two live KPIs -->
      <section class="hero-row reveal">
        <RouterLink class="card hero-img" to="/tasks">
          <svg class="leaf" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <path d="M85 15C50 20 25 45 20 85c40-5 62-30 65-70z" fill="#9DB07C" opacity=".55" />
            <path d="M20 85C45 60 65 45 85 15" stroke="#E7EAD9" stroke-width="1.5" opacity=".6" />
          </svg>
          <span class="go" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H8M17 7v9" /></svg>
          </span>
          <div class="tag">本周到期</div>
          <div class="name">{{ dueThisWeek }} 项待办</div>
        </RouterLink>

        <RouterLink class="card kpi kpi-cream" to="/tasks">
          <div class="lab">待办任务</div>
          <div class="num">{{ activeCount }}<span class="unit"> 项</span></div>
          <div class="foot">已完成 {{ doneCount }} 项</div>
        </RouterLink>

        <RouterLink class="card kpi kpi-plum" to="/notes">
          <div class="lab">知识库</div>
          <div class="num">{{ notes.length }}<span class="unit"> 篇</span></div>
          <div class="foot">正文存本地 IndexedDB</div>
        </RouterLink>
      </section>

      <!-- tabs -->
      <nav class="tabs reveal" style="animation-delay: .06s">
        <RouterLink class="tab" to="/">总览</RouterLink>
        <RouterLink class="tab" to="/tasks">任务</RouterLink>
        <RouterLink class="tab" to="/notes">笔记</RouterLink>
        <RouterLink class="tab" to="/tools">工具</RouterLink>
      </nav>

      <!-- trend chart -->
      <section class="card chart-card reveal" style="animation-delay: .1s">
        <div class="chart-head">
          <div>
            <div class="big">{{ weekCreated }}</div>
            <div class="sub">近 7 天新建任务 · 完成率 <b>{{ rate }}%</b></div>
          </div>
          <div class="select">Weekly</div>
        </div>
        <svg class="chart-svg" viewBox="0 0 620 190" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#C79A5B" stop-opacity=".28" />
              <stop offset="100%" stop-color="#C79A5B" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="150" x2="620" y2="150" stroke="#EDEDED" stroke-width="1" />
          <line x1="0" y1="100" x2="620" y2="100" stroke="#F2F2F2" stroke-width="1" />
          <line x1="0" y1="50" x2="620" y2="50" stroke="#F2F2F2" stroke-width="1" />
          <path :d="geometry.area" fill="url(#area)" />
          <path :d="geometry.line" fill="none" stroke="#C79A5B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
          <circle
            v-for="(p, i) in geometry.pts"
            :key="i"
            :cx="p.x"
            :cy="p.y"
            :r="i === geometry.pts.length - 1 ? 5 : 3.5"
            :fill="i === geometry.pts.length - 1 ? '#C79A5B' : '#fff'"
            stroke="#C79A5B"
            stroke-width="2.4"
          />
        </svg>
        <div class="chart-foot">
          <div class="legend">
            <span><i style="background:#C79A5B"></i>新建趋势</span>
            <span><i style="background:#E2E2E2"></i>基线</span>
          </div>
          <div class="avg">日均 {{ (weekCreated / 7).toFixed(1) }}</div>
        </div>
      </section>

      <!-- stats row -->
      <div class="stats-title reveal" style="animation-delay: .14s">本地统计</div>
      <section class="stats-row reveal" style="animation-delay: .16s">
        <div class="stat s-plum"><div class="lab">进行中</div><div class="v">{{ activeCount }}</div></div>
        <RouterLink class="stat s-orange" to="/notes"><div class="lab">笔记</div><div class="v">{{ notes.length }}</div></RouterLink>
        <RouterLink class="stat s-cream" to="/tools"><div class="lab">工具</div><div class="v">{{ tools.length }}</div></RouterLink>
      </section>
    </div>

    <!-- ===== side panel ===== -->
    <aside class="side reveal" style="animation-delay: .08s">
      <div>
        <div class="side-head">
          <div><div class="k">Quick Access</div><h2>常用工具</h2></div>
          <RouterLink class="more" to="/tools">全部 →</RouterLink>
        </div>
        <div class="prod-row">
          <a
            v-for="(t, i) in topTools"
            :key="t.id"
            class="prod"
            :class="i % 2 ? 'p-sage' : 'p-pink'"
            :href="t.url"
            target="_blank"
            rel="noopener"
          >
            <div class="thumb"><span class="glyph">{{ t.name.slice(0, 1).toUpperCase() }}</span></div>
            <div class="cat">{{ t.category || '链接' }}</div>
            <div class="nm">{{ t.name }}</div>
          </a>
        </div>
      </div>

      <div>
        <div class="side-head">
          <div><div class="k">This week</div><h2>最近笔记</h2></div>
          <RouterLink class="more" to="/notes">本周</RouterLink>
        </div>
        <div v-if="recentNotes.length" class="notes">
          <RouterLink v-for="(n, i) in recentNotes" :key="n.id" class="note" to="/notes">
            <div class="av" :class="'a' + ((i % 3) + 1)">◈</div>
            <div class="txt">
              <div class="t">{{ n.title || '无标题' }}</div>
              <div class="s">{{ n.tags?.length ? n.tags.join(' · ') : '未分类' }}</div>
            </div>
          </RouterLink>
        </div>
        <p v-else class="empty">还没有笔记。</p>
      </div>

      <div class="side-foot">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input placeholder="搜索任务、笔记、工具…" @keyup.enter="search" />
      </div>
    </aside>
  </div>
</template>
