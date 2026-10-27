<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useTasks } from '@/composables/useTasks'
import { useNotes } from '@/composables/useNotes'
import { useTools } from '@/composables/useTools'
import { activeTasks, overdueTasks } from '@/lib/tasks'
import { dayKey, dueBetween, createdSeries, completionRate } from '@/lib/stats'
import type { Task } from '@/types'

const DAY = 86_400_000
/** A task that is guaranteed to carry a due date (the lists below filter for it). */
type DueTask = Task & { due: string }

const { tasks } = useTasks()
const { notes } = useNotes()
const { tools } = useTools()
const router = useRouter()

const now = Date.now()
const today = dayKey(now)

const activeCount = computed(() => activeTasks(tasks.value).length)
const doneCount = computed(() => tasks.value.length - activeCount.value)
const lateTasks = computed(() => overdueTasks(tasks.value, today))
const weekTasks = computed(() => dueBetween(tasks.value, today, dayKey(now + 7 * DAY)))
const upcoming = computed<DueTask[]>(() =>
  [...lateTasks.value, ...weekTasks.value]
    .filter((t): t is DueTask => !!t.due)
    .slice(0, 3),
)
const rate = computed(() => completionRate(tasks.value))

const recentNotes = computed(() =>
  [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
)
const topTools = computed(() => tools.value.slice(0, 4))

// ---- chart time range (the top tabs were a second copy of the rail nav) ----
type RangeKey = '7d' | '30d' | 'all'
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d', label: '近 7 天', days: 7 },
  { key: '30d', label: '近 30 天', days: 30 },
  { key: 'all', label: '全部', days: 0 },
]
const range = ref<RangeKey>('7d')
const rangeLabel = computed(() => RANGES.find((r) => r.key === range.value)!.label)

const spanDays = computed(() => {
  const cfg = RANGES.find((r) => r.key === range.value)!
  if (cfg.days > 0) return cfg.days
  const times = tasks.value.map((t) => t.createdAt)
  if (times.length === 0) return 7
  const oldest = Math.min(...times)
  return Math.min(120, Math.max(2, Math.floor((now - oldest) / DAY) + 1))
})

const series = computed(() => createdSeries(tasks.value, spanDays.value, now))
const rangeTotal = computed(() => series.value.reduce((a, b) => a + b, 0))
const dailyAvg = computed(() => (rangeTotal.value / spanDays.value).toFixed(1))

// ---- geometry in real pixels: no stretched dots, no dead band ----
const PAD = { l: 30, r: 12, t: 14, b: 26 }
const plotEl = ref<HTMLElement | null>(null)
const box = ref({ w: 620, h: 220 })
let ro: ResizeObserver | undefined

const scale = computed(() => {
  const max = Math.max(1, ...series.value)
  const step = max <= 4 ? 1 : Math.ceil(max / 4)
  return { step, top: step * 4 }
})

const geometry = computed(() => {
  const { w, h } = box.value
  const s = series.value
  const iw = Math.max(10, w - PAD.l - PAD.r)
  const base = PAD.t + Math.max(10, h - PAD.t - PAD.b)
  const n = s.length
  const pts = s.map((v, i) => ({
    x: PAD.l + (n > 1 ? (i * iw) / (n - 1) : iw / 2),
    y: base - (v / scale.value.top) * (base - PAD.t),
    v,
  }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const area = pts.length ? `${line} L${last.x.toFixed(1)},${base} L${pts[0].x.toFixed(1)},${base} Z` : ''
  return { pts, line, area, base }
})

const ticks = computed(() => {
  const { step, top } = scale.value
  const usable = geometry.value.base - PAD.t
  const out: { v: number; y: number }[] = []
  for (let v = 0; v <= top; v += step) out.push({ v, y: geometry.value.base - (v / top) * usable })
  return out
})

const dateFmt = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })

const xLabels = computed(() => {
  const n = series.value.length
  if (n === 0) return []
  const idxs =
    n <= 8
      ? Array.from({ length: n }, (_, i) => i)
      : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1]
  return idxs.map((i) => ({
    i,
    x: geometry.value.pts[i].x,
    text: dateFmt.format(new Date(now - (n - 1 - i) * DAY)),
  }))
})

function measure() {
  const el = plotEl.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  // never clobber a good box with a zero read (display:none / hidden tab layouts)
  if (width > 0 && height > 0) box.value = { w: Math.round(width), h: Math.round(height) }
}

const onVisibility = () => { if (!document.hidden) measure() }

onMounted(() => {
  // the observer only reports changes on a rendered frame, so it can miss the
  // first measure entirely when the page loads in a background tab
  measure()
  document.addEventListener('visibilitychange', onVisibility)
  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', measure)
    return
  }
  ro = new ResizeObserver(measure)
  if (plotEl.value) ro.observe(plotEl.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', measure)
  document.removeEventListener('visibilitychange', onVisibility)
})

// ---- side card ----
const q = ref('')
function runSearch() {
  const s = q.value.trim()
  router.push({ path: '/tasks', query: s ? { q: s } : {} })
}

/** Bare host of a tool URL, for the product-card footer. Falls back to the raw string. */
function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}

/** Relative "time ago" label for a note's updatedAt, in days/weeks. */
function ago(ms: number): string {
  const d = Math.floor((now - ms) / DAY)
  if (d <= 0) return '今天'
  if (d === 1) return '昨天'
  if (d < 7) return `${d} 天前`
  return `${Math.floor(d / 7)} 周前`
}

/** Short month/day label for a due key. */
function dueDate(due: string): string {
  return dateFmt.format(new Date(`${due}T00:00:00`))
}

/** Days from today to the due date; negative when past due. */
function dueDelta(due: string): number {
  return Math.round(
    (new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / DAY,
  )
}

function dueText(due: string): string {
  const d = dueDelta(due)
  if (d < 0) return `逾期 ${-d} 天`
  if (d === 0) return '今天'
  if (d === 1) return '明天'
  return `${d} 天后`
}
</script>

<template>
  <!-- ===== main column (left) ===== -->
  <div class="dash-main">
    <!-- hero row: brand focus card + two live KPIs -->
    <section class="hero-row reveal">
      <RouterLink class="card hero-img" to="/tasks">
        <svg class="leaf" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <path d="M85 15C50 20 25 45 20 85c40-5 62-30 65-70z" class="leaf-fill" />
          <path d="M20 85C45 60 65 45 85 15" class="leaf-vein" />
        </svg>
        <span class="go" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H8M17 7v9" /></svg>
        </span>
        <div class="tag">本周到期</div>
        <div class="name">{{ weekTasks.length }} 项待办</div>
        <div v-if="lateTasks.length" class="tag late">已逾期 {{ lateTasks.length }} 项</div>
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

    <!-- trend chart, with a time range control that actually drives it -->
    <section class="card chart-card reveal" style="animation-delay: .06s">
      <div class="chart-head">
        <div>
          <div class="big">{{ rangeTotal }}</div>
          <div class="sub">
            {{ rangeLabel }}新建任务 · 完成率
            <b :class="{ good: rate >= 50 }">{{ rate }}%</b>
          </div>
        </div>
        <div class="seg" role="group" aria-label="趋势时间范围">
          <button
            v-for="r in RANGES"
            :key="r.key"
            class="seg-btn"
            :class="{ on: range === r.key }"
            @click="range = r.key"
          >{{ r.label }}</button>
        </div>
      </div>

      <div ref="plotEl" class="chart-plot">
        <svg
          class="chart-svg"
          :viewBox="`0 0 ${box.w} ${box.h}`"
          role="img"
          :aria-label="`${rangeLabel}新建任务 ${rangeTotal} 项，日均 ${dailyAvg}`"
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop class="area-0" offset="0%" />
              <stop class="area-1" offset="100%" />
            </linearGradient>
          </defs>
          <line
            v-for="(tk, i) in ticks"
            :key="`grid-${i}`"
            class="chart-grid"
            :x1="PAD.l"
            :x2="box.w - PAD.r"
            :y1="tk.y"
            :y2="tk.y"
          />
          <text
            v-for="(tk, i) in ticks"
            :key="`tick-${i}`"
            class="axis"
            :x="PAD.l - 8"
            :y="tk.y + 4"
            text-anchor="end"
          >{{ tk.v }}</text>
          <path :d="geometry.area" fill="url(#areaFill)" />
          <path class="trend" :d="geometry.line" />
          <circle
            v-for="(p, i) in geometry.pts"
            :key="`pt-${i}`"
            class="dot"
            :class="{ last: i === geometry.pts.length - 1 }"
            :cx="p.x"
            :cy="p.y"
            :r="i === geometry.pts.length - 1 ? 4.5 : 3"
          />
          <text
            v-for="l in xLabels"
            :key="`xl-${l.i}`"
            class="axis"
            :x="l.x"
            :y="box.h - 8"
            text-anchor="middle"
          >{{ l.text }}</text>
        </svg>
        <p v-if="rangeTotal === 0" class="chart-empty">{{ rangeLabel }}还没有新建任务</p>
      </div>

      <div class="chart-foot">
        <div class="legend">
          <span><i />新建任务</span>
          <span class="axis-note">纵轴：单日新建数</span>
        </div>
        <div class="avg">日均 {{ dailyAvg }}</div>
      </div>
    </section>

    <!-- what needs attention next -->
    <section class="card due-card reveal" style="animation-delay: .1s">
      <div class="side-head">
        <div><div class="k">Next up</div><h2>本周到期</h2></div>
        <RouterLink class="more" to="/tasks">全部任务 →</RouterLink>
      </div>
      <ul v-if="upcoming.length" class="due-list">
        <li v-for="t in upcoming" :key="t.id" class="due-item">
          <span class="due-dot" :class="`p-${t.priority}`" aria-hidden="true" />
          <span class="due-name">{{ t.title }}</span>
          <span class="due-date">{{ dueDate(t.due) }}</span>
          <span class="due-when" :class="{ late: dueDelta(t.due) < 0 }">{{ dueText(t.due) }}</span>
        </li>
      </ul>
      <p v-else class="empty">本周没有到期任务，可以先专注手上的事。</p>
    </section>
  </div>

  <!-- ===== side panel ===== -->
  <aside class="side reveal" style="animation-delay: .08s">
    <form class="side-search" @submit.prevent="runSearch">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input
        v-model="q"
        type="search"
        placeholder="搜索任务、笔记、工具"
        aria-label="搜索工作台"
        @keyup.enter="runSearch"
      />
    </form>

    <div class="side-block">
      <div class="side-head">
        <div><div class="k">Quick Access</div><h2>常用工具</h2></div>
        <RouterLink class="more" to="/tools">共 {{ tools.length }} 个 →</RouterLink>
      </div>
      <div v-if="topTools.length" class="prod-list">
        <a
          v-for="t in topTools"
          :key="t.id"
          class="prod"
          :href="t.url"
          target="_blank"
          rel="noopener"
        >
          <span class="p-main">
            <span class="cat">{{ t.category || '链接' }}</span>
            <span class="nm">{{ t.name }}</span>
          </span>
          <span class="p-side">
            <span class="host">{{ hostOf(t.url) }}</span>
            <span class="open" aria-hidden="true">↗</span>
          </span>
        </a>
      </div>
      <p v-else class="empty">还没有工具，去「工具导航」添加常用链接。</p>
    </div>

    <div class="side-block notes-block">
      <div class="side-head">
        <div><div class="k">Recently</div><h2>最近笔记</h2></div>
        <RouterLink class="more" to="/notes">全部笔记 →</RouterLink>
      </div>
      <div v-if="recentNotes.length" class="notes">
        <RouterLink v-for="n in recentNotes" :key="n.id" class="note" to="/notes">
          <div class="txt">
            <div class="t">{{ n.title || '无标题' }}</div>
            <div class="s">{{ n.tags?.length ? n.tags.join(' · ') : '未分类' }}</div>
          </div>
          <span class="when">{{ ago(n.updatedAt) }}</span>
        </RouterLink>
      </div>
      <p v-else class="empty">还没有笔记。</p>
    </div>

    <p class="trust">数据只存在这台设备，任务 / 笔记 / 工具页可导出完整备份。</p>
  </aside>
</template>
