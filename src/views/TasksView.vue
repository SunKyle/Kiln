<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTasks } from '@/composables/useTasks'
import { searchTasks, sortByPriority } from '@/lib/tasks'
import { dayKey } from '@/lib/stats'
import {
  addDays,
  barPlan,
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
/** Week density prints at most this many titles in a cell; the rest collapse into +N. The month
 * bar has its own cap, which lives with its geometry in lib/calendar. */
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
/** The rail has two shapes: read the day, or write a new task into it. Only one is on screen. */
const composing = ref(false)

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

const titleEl = ref<HTMLInputElement | null>(null)
function startCompose() {
  composing.value = true
  // the input only exists after the branch swaps in, so focus waits for the next tick
  nextTick(() => titleEl.value?.focus())
}
function cancelCompose() {
  composing.value = false
  draft.value = ''
}

function submit() {
  const title = draft.value.trim()
  if (!title) return // an empty submit must not look like it worked
  add(title, prio.value, dueInput.value || today)
  draft.value = ''
  composing.value = false // back to the list, where the row you just wrote now sits
}

/** The date field never stays empty: clearing it re-arms today, because a task without a day
 * does not exist any more (useTasks enforces the same rule at the write path). */
function firmDue() {
  if (!dueInput.value) dueInput.value = today
}

function openOn(key: string): Task[] {
  return (marks.value.get(key) ?? []).filter((t) => !t.done)
}

/**
 * One pass for the whole grid: every cell arrives with the bar it should print, so the template
 * never plans twice. Month density marks open work only — a finished task must not make a day
 * look busy — and `byDue` already filed each day high → low, which is the print order.
 */
const grid = computed(() =>
  cells.value.map((c) => ({ ...c, bar: barPlan(openOn(c.key).map((t) => t.priority)) })),
)

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

/** A legend key wears the shape the density it explains actually draws: a bar segment in the
 * month, a dot beside the title in the week. Same hue, two letters. */
function keyCls(p: Priority) {
  return mode.value === 'month' ? `kb k-${p}` : `d d-${p}`
}
const lateCls = computed(() => (mode.value === 'month' ? 'kb k-late' : 'd d-late'))

function cellCls(c: { key: string; inMonth: boolean; weekday: number }) {
  return {
    out: !c.inMonth,
    we: c.weekday >= 5,
    today: c.key === today,
    late: lateKeys.value.has(c.key),
    sel: c.key === sel.value,
  }
}

/** The cell's accessible name: which day, and how much is owed on it. */
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
  return order(tasks.value) // every row, done included — order() sinks the finished ones
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

/** One pair of counters drives the whole summary card: the figure, the ring and the label
 * cannot drift apart, because the arc is drawn from the same rounded percentage you read. */
const doneCount = computed(() => list.value.filter((t) => t.done).length)
const pct = computed(() => {
  const total = list.value.length
  return total ? Math.round((doneCount.value / total) * 100) : 0
})
const RING_R = 25
const RING_C = 2 * Math.PI * RING_R
const ringGap = computed(() => Number((RING_C * (1 - pct.value / 100)).toFixed(2)))

/** The day you always walk into next — whatever follows the day being read. */
const nextKey = computed(() => addDays(sel.value, 1))
const nextOpen = computed(() => openOn(nextKey.value).length)

const emptyText = computed(() => {
  if (scope.value === 'overdue') return '没有逾期任务——日历上那几根红条会跟着这里一起清掉。'
  if (scope.value === 'unscheduled') return '没有漏掉日期的任务——每一项都排在某一天上。'
  if (scope.value === 'all') return '任务库还是空的。'
  return '这一天还空着。点「新建任务」，写一项就落到这一天。'
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
        <!-- read: plain ink. act: outlines. They share a row but never a skin. -->
        <div class="cal-read">
          <h2 class="cal-title">{{ rangeLabel }}<span class="yr">{{ rangeYear }}</span></h2>
          <p class="cal-stat">
            {{ mode === 'month' ? '本月' : '本周' }} <b>{{ mode === 'month' ? monthDated : weekDated }}</b> 项有日期
          </p>
        </div>
        <div class="cal-ops">
          <div class="pager" role="group" :aria-label="mode === 'week' ? '按周翻页' : '按月翻页'">
            <button class="arrow" :aria-label="mode === 'week' ? '上一周' : '上一月'" @click="shift(-1)">‹</button>
            <button class="arrow" :aria-label="mode === 'week' ? '下一周' : '下一月'" @click="shift(1)">›</button>
          </div>
          <div class="seg" role="group" aria-label="日历密度">
            <button class="seg-btn" :class="{ on: mode === 'week' }" @click="setMode('week')">周</button>
            <button class="seg-btn" :class="{ on: mode === 'month' }" @click="setMode('month')">月</button>
          </div>
          <button class="chip" @click="backToToday">回到今天</button>
        </div>
      </div>

      <div class="cal-grid">
        <div class="dow">
          <span v-for="(w, i) in WD" :key="w" :class="{ we: i >= 5 }">{{ w }}</span>
        </div>

        <div class="cells" :class="mode === 'week' ? 'w' : 'm'">
          <button
            v-for="c in grid"
            :key="c.key"
            class="cell"
            :class="cellCls(c)"
            :aria-label="cellLabel(c)"
            :aria-current="c.key === sel ? 'date' : undefined"
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

            <span v-else-if="c.bar" class="bar" :style="{ width: c.bar.width + 'px' }">
              <i
                v-for="(p, i) in c.bar.segs"
                :key="i"
                class="seg"
                :class="'s-' + p"
                :style="{ width: c.bar.segWidth + 'px' }"
              />
              <i v-if="c.bar.more" class="more" />
            </span>
          </button>
        </div>
      </div>

      <div class="legend">
        <span class="keys">
          <span class="lg"><i :class="keyCls('high')" />高</span>
          <span class="lg"><i :class="keyCls('med')" />中</span>
          <span class="lg"><i :class="keyCls('low')" />低</span>
          <span class="lg lg-late"><i :class="lateCls" />逾期</span>
        </span>
        <span class="rule">
          {{
            mode === 'month'
              ? '只算未完成 · 条越长＝项越多，第 5 项起收成圆点 · 实心盘＝在看这天，描边圈＝今天'
              : `每格最多 ${CAP} 条，其余收成 +N · 实心盘＝在看这天，描边圈＝今天`
          }}
        </span>
      </div>

      <p v-if="!scheduledCount && loose.length" class="nudge">
        {{ loose.length }} 项任务还没写到期日，所以日历上看不见它们。选中一天，把它们排进来。
      </p>
    </section>

    <!-- ===== the day, opened ===== -->
    <aside class="card focus">
      <div class="f-head">
        <h2>{{ composing ? '新建待办' : paneTitle }}</h2>
        <button v-if="composing" class="chip" @click="cancelCompose">取消</button>
      </div>

      <!-- ===== browse: switch it, read it, then the day after ===== -->
      <template v-if="!composing">
        <button class="btn btn-plum f-new" @click="startCompose">＋ 新建任务</button>

        <section class="prog">
          <div class="p-top">
            <p class="p-num">{{ pct }}<span class="p-unit">%</span></p>
            <svg
              class="p-ring"
              viewBox="0 0 56 56"
              role="img"
              :aria-label="`已完成 ${doneCount} / ${list.length}`"
            >
              <circle class="track" cx="28" cy="28" :r="RING_R" />
              <circle
                v-if="pct"
                class="bar"
                cx="28"
                cy="28"
                :r="RING_R"
                :stroke-dasharray="RING_C"
                :stroke-dashoffset="ringGap"
              />
            </svg>
          </div>
          <p class="p-sub">{{ list.length ? `已完成 ${doneCount} / ${list.length}` : '这个范围里还没有任务' }}</p>

          <!-- the scope switcher lives with the thing it switches, so the counts are said once -->
          <div class="p-tabs" role="group" aria-label="查看范围">
            <template v-if="q">
              <span class="p-tab on">搜索「{{ q }}」</span>
              <button class="p-tab" @click="clearQuery">清除 ×</button>
            </template>
            <template v-else>
              <button class="p-tab" :class="{ on: scope === 'day' }" @click="pickDay(sel)">当日</button>
              <button
                v-if="overdue.length"
                class="p-tab late"
                :class="{ on: scope === 'overdue' }"
                @click="scope = 'overdue'"
              >
                逾期 {{ overdue.length }}
              </button>
              <button
                v-if="loose.length"
                class="p-tab"
                :class="{ on: scope === 'unscheduled' }"
                @click="scope = 'unscheduled'"
              >
                未排期 {{ loose.length }}
              </button>
              <button class="p-tab" :class="{ on: scope === 'all' }" @click="scope = 'all'">
                全部 {{ tasks.length }}
              </button>
            </template>
          </div>
        </section>

        <ul v-if="list.length" class="f-list">
          <li v-for="t in list" :key="t.id" class="ti" :class="{ done: t.done, late: isLate(t) }">
            <input
              type="checkbox"
              class="box"
              :checked="t.done"
              :aria-label="`完成 ${t.title}`"
              @change="toggle(t.id)"
            />
            <span class="tt">{{ t.title }}</span>
            <span class="tail">
              <span v-if="scope !== 'day' || t.due !== sel" class="tag" :class="tagCls(t)">{{ whenLabel(t) }}</span>
              <span class="pri">{{ PRIO[t.priority] }}</span>
              <button class="del" :aria-label="`删除 ${t.title}`" title="删除" @click="remove(t.id)">×</button>
            </span>
          </li>
        </ul>
        <p v-else-if="q" class="emptyhint">没有匹配「<b>{{ q }}</b>」的任务。</p>
        <p v-else class="emptyhint">{{ emptyText }}</p>

        <button v-if="!q" class="peek" @click="pickDay(nextKey)">
          <svg class="pk-ico" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2.5" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
          <span class="pk-main">
            <b>{{ dayLabel(nextKey) }}</b>
            <span>{{ nextOpen ? `${nextOpen} 个任务安排` : '暂无安排' }}</span>
          </span>
          <span class="pk-go">→</span>
        </button>
      </template>

      <!-- ===== compose: the card becomes the form, nothing else is on screen ===== -->
      <form v-else class="compose" @submit.prevent="submit">
        <input
          ref="titleEl"
          v-model="draft"
          class="field cmp-title"
          placeholder="要做什么？"
          aria-label="待办内容"
          @keydown.esc="cancelCompose"
        />
        <div class="opts">
          <select v-model="prio" class="field prio" aria-label="优先级" title="优先级">
            <option value="high">高优先级</option>
            <option value="med">中优先级</option>
            <option value="low">低优先级</option>
          </select>
          <input
            v-model="dueInput"
            type="date"
            class="field due"
            title="到期日；清空＝今天"
            aria-label="到期日"
            @change="firmDue"
          />
        </div>
        <p class="cmp-lands">将落在 {{ dayLabel(dueInput || today) }}</p>
        <button class="btn btn-plum f-new" type="submit">添加</button>
      </form>
    </aside>
  </div>
</template>
