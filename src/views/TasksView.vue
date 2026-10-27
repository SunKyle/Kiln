<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTasks } from '@/composables/useTasks'
import { searchTasks, sortByPriority } from '@/lib/tasks'
import { dayKey } from '@/lib/stats'
import {
  addDays,
  byDue,
  dayGap,
  isOverdue,
  mondayOf,
  monthAnchor,
  monthGrid,
  shiftMonths,
  tasksOn,
  unscheduled,
  weekGrid,
} from '@/lib/calendar'
import type { Priority, Task } from '@/types'

const { tasks, add, toggle, remove } = useTasks()
const route = useRoute()
const router = useRouter()

const now = new Date()
const today = dayKey(now.getTime())

const PRIO: Record<Priority, string> = { high: '高', med: '中', low: '低' }
const WD = ['一', '二', '三', '四', '五', '六', '日']
const ORDER: Priority[] = ['high', 'med', 'low']
/** A day never prints more than this many marks — the rest collapse into +N or a tail bar. */
const CAP = 3

type Mode = 'week' | 'month'
type Scope = 'day' | 'overdue' | 'unscheduled' | 'all'

/**
 * A /tasks?date=… link (from the dashboard, say) opens the calendar on that day.
 * Anything malformed falls back to today rather than poisoning the join key.
 */
const linked = typeof route.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.date)
  ? (route.query.date as string)
  : today

const mode = ref<Mode>('month')
/** The day being read: it drives the rail, and it is what a click on a cell changes. */
const sel = ref(linked)
/** The window the grid is showing. Kept separate from `sel` so you can page away and still read the day. */
const view = ref(linked)
const draft = ref('')
const prio = ref<Priority>('med')
const dueInput = ref(linked)
const scope = ref<Scope>('day')
const onlyDone = ref(false)

const ym = computed(() => monthAnchor(view.value))
const cells = computed(() =>
  mode.value === 'week'
    ? weekGrid(mondayOf(view.value))
    : monthGrid(ym.value.year, ym.value.month),
)
/** Every dated task bucketed by day, open work first inside each bucket. */
const marks = computed(() => byDue(tasks.value))
const overdue = computed(() => tasks.value.filter((t) => isOverdue(t, today)))
const lateKeys = computed(() => new Set(overdue.value.map((t) => t.due as string)))
const loose = computed(() => unscheduled(tasks.value))
const scheduledCount = computed(() => tasks.value.filter((t) => !t.done && t.due).length)

/** Open work carrying a date inside the month block on screen. */
const monthDated = computed(() => {
  const prefix = `${ym.value.year}-${String(ym.value.month + 1).padStart(2, '0')}`
  let n = 0
  for (const [key, rows] of marks.value) {
    if (key.startsWith(prefix)) n += rows.filter((t) => !t.done).length
  }
  return n
})
const weekDated = computed(() =>
  cells.value.reduce((n, c) => n + (marks.value.get(c.key) ?? []).filter((t) => !t.done).length, 0),
)

/** The dashboard search lands here as /tasks?q=… ; a stray array never breaks the page. */
const q = computed(() => {
  const raw = route.query.q
  return Array.isArray(raw) ? (raw[0] ?? '').toString() : (raw ?? '').toString()
})

function clearQuery() {
  router.replace({ path: '/tasks', query: {} })
}

function pickDay(key: string) {
  sel.value = key
  dueInput.value = key
  scope.value = 'day'
  view.value = key // a bleed day from the next month pulls the grid along with it
}

/** ±7 days in week density, ±1 month in month density — one anchor, two strides. */
function shift(delta: number) {
  view.value = mode.value === 'week' ? addDays(view.value, delta * 7) : shiftMonths(view.value, delta)
}

function setMode(next: Mode) {
  if (mode.value === next) return
  mode.value = next
  view.value = sel.value // re-centre on the day you were reading, never jump to a blank window
}

function backToToday() {
  pickDay(today)
}

function submit() {
  add(draft.value, prio.value, dueInput.value || undefined)
  draft.value = ''
}

function openOn(key: string): Task[] {
  return (marks.value.get(key) ?? []).filter((t) => !t.done)
}
/** Month density marks open work only — a finished task must not make a day look busy. */
function dotsFor(key: string): Task[] {
  return openOn(key).slice(0, CAP)
}
function tailFor(key: string): boolean {
  return openOn(key).length > CAP
}
/** Week density has room for titles, so completed work rides along (struck through). */
function pillsFor(key: string): Task[] {
  return (marks.value.get(key) ?? []).slice(0, CAP)
}
function moreFor(key: string): number {
  return (marks.value.get(key) ?? []).length - CAP
}

function pillCls(t: Task) {
  const late = isOverdue(t, today)
  return {
    // the plum fill is the high-priority accent; overdue work gives it up so red can read
    'pri-h': t.priority === 'high' && !late && !t.done,
    late,
    done: t.done,
  }
}

function cellCls(c: { key: string; inMonth: boolean; weekday: number }) {
  return {
    out: !c.inMonth,
    we: c.weekday >= 5,
    today: c.key === today,
    late: lateKeys.value.has(c.key),
    sel: c.key === sel.value,
  }
}

/** Up to three marks per cell, so a 52px row never overflows. */
function cellLabel(c: { key: string }): string {
  const n = openOn(c.key).length
  return `${dayLabel(c.key)}，${n} 项待办`
}

/** Open work floats to the top; inside each group the priority order from lib/tasks holds. */
function order(rows: Task[]): Task[] {
  return sortByPriority(rows).sort((a, b) => Number(a.done) - Number(b.done))
}

const list = computed<Task[]>(() => {
  if (q.value) return order(searchTasks(tasks.value, q.value))
  if (scope.value === 'day') return order(tasksOn(tasks.value, sel.value))
  if (scope.value === 'overdue') return order(overdue.value)
  if (scope.value === 'unscheduled') return order(loose.value)
  return order(onlyDone.value ? tasks.value.filter((t) => t.done) : tasks.value.filter((t) => !t.done))
})

function dayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  const wd = '日一二三四五六'[d.getDay()]
  const base = `${d.getMonth() + 1}月${d.getDate()}日 · 周${wd}`
  const gap = dayGap(key, today)
  if (gap === 0) return `${base} · 今天`
  if (gap === 1) return `${base} · 昨天`
  if (gap === -1) return `${base} · 明天`
  return base
}

/** The grid's own headline: a week names its span, a month names the month. */
const rangeLabel = computed(() => {
  if (mode.value === 'month') return `${ym.value.month + 1}月`
  const first = new Date(`${cells.value[0].key}T00:00:00`)
  const last = new Date(`${cells.value[6].key}T00:00:00`)
  return `${first.getMonth() + 1}月${first.getDate()}日 – ${last.getMonth() + 1}月${last.getDate()}日`
})
const rangeYear = computed(() => {
  const first = new Date(`${cells.value[0].key}T00:00:00`).getFullYear()
  const last = new Date(`${cells.value[cells.value.length - 1].key}T00:00:00`).getFullYear()
  return first === last ? `${first}` : `${first}–${last}`
})

const paneTitle = computed(() => {
  if (q.value) return `搜索「${q.value}」`
  if (scope.value === 'overdue') return '逾期'
  if (scope.value === 'unscheduled') return '未排期'
  if (scope.value === 'all') return '全部任务'
  return dayLabel(sel.value)
})

/** "3 项 · 高 1 中 1 低 1 · 另有 2 项逾期" — the tally of what is still open, plus what is finished. */
const paneSub = computed(() => {
  const rows = list.value
  if (!rows.length) return '0 项'
  const open = rows.filter((t) => !t.done)
  const bits = [`${rows.length} 项`]
  if (open.length) {
    bits.push(
      ORDER.map((p) => `${PRIO[p]} ${open.filter((t) => t.priority === p).length}`)
        .filter((s) => !s.endsWith(' 0'))
        .join(' '),
    )
  }
  const done = rows.length - open.length
  if (done) bits.push(`已完成 ${done}`)
  if (scope.value === 'day' && overdue.value.length) bits.push(`另有 ${overdue.value.length} 项逾期`)
  return bits.join(' · ')
})

const emptyText = computed(() => {
  if (scope.value === 'overdue') return '没有逾期任务——日历上的红点会跟着这里一起清掉。'
  if (scope.value === 'unscheduled') return '进行中的任务都排上了日期。'
  if (scope.value === 'all') return onlyDone.value ? '还没有完成过任务。' : '这里还空着，先添加一项待办。'
  return `${dayLabel(sel.value)} 没有安排。在上面写一项，回车就落到这一天。`
})

/** Right-hand stamp on each row: how late, how soon, or never scheduled. */
function whenLabel(t: Task): string {
  if (!t.due) return '未排期'
  if (t.due === today) return '今天'
  const gap = dayGap(t.due, today)
  if (gap > 0) return `逾期 ${gap} 天`
  const d = new Date(`${t.due}T00:00:00`)
  return Number.isNaN(d.getTime()) ? t.due : `${d.getMonth() + 1}/${d.getDate()}`
}
function isLate(t: Task): boolean {
  return isOverdue(t, today)
}
function tagCls(t: Task) {
  return { rd: isLate(t), now: t.due === today }
}
</script>

<template>
  <div class="tasks-split reveal">
    <!-- ===== the month (or the week) at a glance — the primary view ===== -->
    <section class="card cal" :class="{ monthly: mode === 'month' }">
      <div class="cal-head">
        <div class="cal-nav">
          <button class="arrow" :aria-label="mode === 'week' ? '上一周' : '上一月'" @click="shift(-1)">‹</button>
          <h2 class="cal-title">{{ rangeLabel }}<span class="yr">{{ rangeYear }}</span></h2>
          <button class="arrow" :aria-label="mode === 'week' ? '下一周' : '下一月'" @click="shift(1)">›</button>
        </div>

        <div class="cal-tools">
          <span v-if="mode === 'month'" class="chip count">
            本月 <span class="cnt">{{ monthDated }}</span> 项有日期
          </span>
          <span v-else-if="!weekDated" class="chip rd">本周 0 项有日期</span>
          <div class="seg" role="group" aria-label="日历密度">
            <button class="seg-btn" :class="{ on: mode === 'week' }" @click="setMode('week')">周</button>
            <button class="seg-btn" :class="{ on: mode === 'month' }" @click="setMode('month')">月</button>
          </div>
          <button class="chip z" @click="backToToday">回到今天</button>
          <button
            v-if="overdue.length"
            class="chip rd"
            :class="{ on: scope === 'overdue' && !q }"
            @click="scope = 'overdue'"
          >
            逾期 <span class="cnt">{{ overdue.length }}</span>
          </button>
        </div>
      </div>

      <div class="dow">
        <span v-for="(w, i) in WD" :key="w" :class="{ we: i >= 5 }">{{ w }}</span>
      </div>

      <div class="cells" :class="mode === 'week' ? 'w' : 'm'">
        <button
          v-for="c in cells"
          :key="c.key"
          class="cell"
          :class="cellCls(c)"
          :aria-label="cellLabel(c)"
          @click="pickDay(c.key)"
        >
          <span class="num">{{ c.day }}</span>

          <span v-if="mode === 'week'" class="pills">
            <span v-for="t in pillsFor(c.key)" :key="t.id" class="pill" :class="pillCls(t)">
              <span v-if="!(t.priority === 'high' && !t.done && !isLate(t))" class="d" :class="'d-' + t.priority" />
              <span class="pt">{{ t.title }}</span>
            </span>
            <span v-if="moreFor(c.key) > 0" class="more-p">+{{ moreFor(c.key) }}</span>
          </span>

          <span v-else class="dots">
            <i v-for="t in dotsFor(c.key)" :key="t.id" class="d" :class="'d-' + t.priority" />
            <i v-if="tailFor(c.key)" class="d tail" />
          </span>

          <i class="seline" />
        </button>
      </div>

      <div class="legend">
        <span class="lg"><i class="d d-high" />高</span>
        <span class="lg"><i class="d d-med" />中</span>
        <span class="lg"><i class="d d-low" />低</span>
        <span v-if="mode === 'month'" class="lg">只标记未完成 · 4 项以上收成短横</span>
        <span v-else class="lg">格内最多 3 条 · 其余收成 +N</span>
        <span class="lg lg-late">红＝逾期</span>
      </div>

      <p v-if="!scheduledCount && loose.length" class="nudge">
        {{ loose.length }} 项任务还没写到期日，所以日历上看不见它们。选中一天，把它们排进来。
      </p>
    </section>

    <!-- ===== the day, opened ===== -->
    <aside class="card focus">
      <div class="f-head">
        <div>
          <h2>{{ paneTitle }}</h2>
          <p class="f-sub">{{ paneSub }}</p>
        </div>
        <button v-if="!q" class="f-more" @click="scope = scope === 'unscheduled' ? 'day' : 'unscheduled'">
          {{ scope === 'unscheduled' ? '回到当日 ←' : `未排期 ${loose.length} 项 →` }}
        </button>
      </div>

      <div v-if="!q" class="scopes">
        <button class="chip" :class="{ on: scope === 'day' }" @click="pickDay(sel)">当日</button>
        <button v-if="overdue.length" class="chip" :class="{ on: scope === 'overdue' }" @click="scope = 'overdue'">
          逾期 {{ overdue.length }}
        </button>
        <button class="chip" :class="{ on: scope === 'all' }" @click="scope = 'all'">全部 {{ tasks.length }}</button>
        <button v-if="scope === 'all'" class="chip quiet" @click="onlyDone = !onlyDone">
          {{ onlyDone ? '看进行中' : '看已完成' }}
        </button>
      </div>
      <button v-else class="chip on clear-q" @click="clearQuery">清除搜索「{{ q }}」×</button>

      <form class="add-form" @submit.prevent="submit">
        <div class="add">
          <button class="plus" type="submit" aria-label="添加待办">＋</button>
          <input v-model="draft" :placeholder="dueInput ? '添加待办，回车落到所选日' : '添加待办（不排期）'" />
        </div>
        <div class="opts">
          <select v-model="prio" class="field prio" aria-label="优先级" title="优先级">
            <option value="high">高优先级</option>
            <option value="med">中优先级</option>
            <option value="low">低优先级</option>
          </select>
          <input v-model="dueInput" type="date" class="field due" title="到期日；清空＝不排期" aria-label="到期日" />
        </div>
      </form>

      <ul v-if="list.length" class="f-list">
        <li v-for="t in list" :key="t.id" class="ti" :class="{ done: t.done, late: isLate(t) }">
          <input type="checkbox" class="box" :checked="t.done" :aria-label="`完成 ${t.title}`" @change="toggle(t.id)" />
          <span class="tt">{{ t.title }}</span>
          <span class="tail">
            <span v-if="scope !== 'day' || t.due !== sel" class="tag" :class="tagCls(t)">{{ whenLabel(t) }}</span>
            <span class="pri">{{ PRIO[t.priority] }}</span>
            <button class="del" :aria-label="`删除 ${t.title}`" @click="remove(t.id)">删除</button>
          </span>
        </li>
      </ul>
      <p v-else-if="q" class="emptyhint">没有匹配「<b>{{ q }}</b>」的任务。</p>
      <p v-else class="emptyhint">{{ emptyText }}</p>

      <div class="f-foot">
        <span>点日历上的日期换一天</span>
        <span>清空日期＝不排期</span>
      </div>
    </aside>
  </div>
</template>
