import { describe, it, expect, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import TasksView from './TasksView.vue'
import { dayKey } from '@/lib/stats'
import type { Task, Priority } from '@/types'

const DAY = 86_400_000
const shift = (n: number) => dayKey(Date.now() + n * DAY)
const num = (key: string) => String(Number(key.slice(8, 10)))
const md = (key: string) => `${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日`

let seq = 0
function task(title: string, opts: Partial<Task> = {}): Task {
  return {
    id: `t${++seq}`,
    title,
    done: false,
    priority: 'med' as Priority,
    createdAt: Date.now(),
    ...opts,
  }
}

/** A throwaway router: TasksView only reads `route.query` and calls `router.replace`. */
function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
}

async function open(tasks: Task[], query: Record<string, string> = {}): Promise<VueWrapper> {
  localStorage.clear()
  localStorage.setItem('kiln.tasks', JSON.stringify(tasks))
  const router = makeRouter()
  await router.push({ path: '/tasks', query })
  await router.isReady()
  const w = mount(TasksView, { global: { plugins: [router] } })
  await nextTick()
  return w
}

/** The cell for a YYYY-MM-DD key. Day numbers repeat across the bleed months, so match the label. */
function cell(w: VueWrapper, key: string) {
  return w.findAll('.cell').find((c) => (c.attributes('aria-label') ?? '').startsWith(md(key)))!
}
function stored(): Task[] {
  return JSON.parse(localStorage.getItem('kiln.tasks') ?? '[]') as Task[]
}
function tabByText(w: VueWrapper, text: string) {
  return w.findAll('.p-tabs .p-tab').find((c) => c.text().startsWith(text))!
}
/** The form only exists in compose mode — open it, and let the focus tick land. */
async function compose(w: VueWrapper) {
  await w.find('.f-new').trigger('click')
  await nextTick()
}
async function toWeek(w: VueWrapper) {
  await w.findAll('.seg-btn')[0].trigger('click')
  await nextTick()
}

beforeEach(() => localStorage.clear())

describe('TasksView calendar', () => {
  it('opens on the month: 42 cells, marks on the days that carry open work', async () => {
    const w = await open([
      task('今天的高优', { due: shift(0), priority: 'high' }),
      task('今天的中等', { due: shift(0), priority: 'med' }),
      task('上周的活', { due: shift(-6) }),
      task('没写日期', {}),
    ])
    expect(w.findAll('.cell')).toHaveLength(42)
    expect(w.find('.cells').classes()).toContain('m')
    expect(cell(w, shift(0)).findAll('.slice')).toHaveLength(2)
    expect(cell(w, shift(-6)).findAll('.slice')).toHaveLength(1)
    expect(cell(w, shift(1)).findAll('.slice')).toHaveLength(0) // nothing dated there
    expect(w.find('.cell.today .num').text()).toBe(num(shift(0)))
    // the cursor is the disc on the number, and it never shares a shape with the bar below it
    expect(w.findAll('.seline')).toHaveLength(0)
    expect(cell(w, shift(0)).classes()).toContain('sel')
  })

  it('a finished task keeps its line in the day but never its mark', async () => {
    const w = await open([task('做完的不算', { due: shift(1), done: true })])
    expect(cell(w, shift(1)).findAll('.slice')).toHaveLength(0)
    await toWeek(w)
    const pill = cell(w, shift(1)).find('.pill')
    expect(pill.classes()).toContain('done')
    expect(pill.find('.pt').text()).toBe('做完的不算')
  })

  it('grows the bar to its ceiling, then folds the fifth task into a dot', async () => {
    const w = await open([
      task('a', { due: shift(0), priority: 'high' }),
      task('b', { due: shift(0), priority: 'med' }),
      task('c', { due: shift(0), priority: 'low' }),
      task('d', { due: shift(0), priority: 'low' }),
      task('e', { due: shift(0), priority: 'low' }),
    ])
    const bar = cell(w, shift(0)).find('.bar')
    expect(bar.findAll('.slice')).toHaveLength(4) // four is the ceiling
    expect(bar.findAll('.more')).toHaveLength(1) // the rest is one dot, not a pile of them
    expect(bar.attributes('style')).toContain('width: 38px') // the width is the plan's, not the CSS's
    expect(bar.findAll('.slice')[0].classes()).toContain('s-high') // and it prints high → low
  })

  it('the week density trades marks for titles, and caps them the same way', async () => {
    const w = await open([
      task('高优先', { due: shift(0), priority: 'high' }),
      task('中优先', { due: shift(0), priority: 'med' }),
      task('低优先', { due: shift(0), priority: 'low' }),
      task('第四条', { due: shift(0) }),
    ])
    await toWeek(w)
    expect(w.findAll('.cell')).toHaveLength(7)
    expect(w.find('.cells').classes()).toContain('w')
    const day = cell(w, shift(0))
    expect(day.findAll('.pill')).toHaveLength(3)
    expect(day.find('.pill.pri-h').text()).toBe('高优先') // the fill is the high-priority accent
    expect(day.find('.more-p').text()).toBe('+1')
  })

  it('overdue work turns red in both densities', async () => {
    const w = await open([task('迟了两天', { due: shift(-2), priority: 'high' })])
    const late = cell(w, shift(-2))
    expect(late.classes()).toContain('late')
    expect(late.findAll('.slice')[0].classes()).toContain('s-high') // the mix survives; the hue goes to red
    await late.trigger('click') // make it the day being read, so the week window still contains it
    await toWeek(w)
    const pill = cell(w, shift(-2)).find('.pill')
    expect(pill.classes()).toContain('late')
    expect(pill.classes()).not.toContain('pri-h') // it gives up the plum fill so red can read
    expect(pill.find('.d').classes()).toContain('d-high') // the dot keeps its name, the sheet turns it red
  })

  it('switching density keeps the day you were reading on screen', async () => {
    const w = await open([task('那天的活', { due: shift(9) })]) // a trailing day from the next month
    await cell(w, shift(9)).trigger('click')
    await toWeek(w)
    expect(w.find('.f-head h2').text()).toContain(md(shift(9)))
    expect(w.findAll('.cell')).toHaveLength(7)
    expect(cell(w, shift(9)).find('.pill .pt').text()).toBe('那天的活')
  })

  it('pages the window without moving the day you are reading', async () => {
    const w = await open([task('今天的活', { due: shift(0) })])
    const headline = w.find('.cal-title').text()
    await w.find('.arrow[aria-label="下一月"]').trigger('click')
    expect(w.find('.cal-title').text()).not.toBe(headline)
    // the pager never drags the rail along with it
    expect(w.find('.f-head h2').text()).toContain(md(shift(0)))
    expect(w.findAll('.f-list .tt')).toHaveLength(1)

    await toWeek(w)
    const span = w.find('.cal-title').text()
    await w.find('.arrow[aria-label="下一周"]').trigger('click')
    expect(w.find('.cal-title').text()).not.toBe(span)
  })

  it('opens the clicked day and moves the form onto it', async () => {
    const w = await open([task('周三的活', { due: shift(3) })])
    await cell(w, shift(3)).trigger('click')
    expect(w.find('.f-head h2').text()).toContain(md(shift(3)))
    expect(w.findAll('.f-list .tt').map((r) => r.text())).toEqual(['周三的活'])
    // the day the form will file under is the day you are reading
    await compose(w)
    expect(w.find<HTMLInputElement>('.opts .due').element.value).toBe(shift(3))
  })

  it('files a new task under the selected day, then hands the card back to the list', async () => {
    const w = await open([task('占位', { due: shift(0) })])
    await cell(w, shift(5)).trigger('click')
    await compose(w)
    await w.find('.cmp-title').setValue('排到五天后')
    await w.find('form.compose').trigger('submit')
    await nextTick()
    const added = stored().find((t) => t.title === '排到五天后')
    expect(added?.due).toBe(shift(5))
    expect(cell(w, shift(5)).findAll('.slice')).toHaveLength(1)
    expect(w.findAll('.f-list .tt').map((r) => r.text())).toContain('排到五天后')
    expect(w.find('.cmp-title').exists()).toBe(false) // compose mode closed itself
  })

  it('a blank due date means today, never nothing', async () => {
    const w = await open([task('占位', { due: shift(0) })])
    await compose(w)
    const due = w.find<HTMLInputElement>('.opts .due')
    await due.setValue('')
    await due.trigger('change') // the field heals itself back to today
    expect(due.element.value).toBe(shift(0))

    await due.setValue('') // and even a submit that slips past the field still lands on a day
    await w.find('.cmp-title').setValue('先记下来')
    await w.find('form.compose').trigger('submit')
    await nextTick()
    const added = stored().find((t) => t.title === '先记下来')
    expect(added?.due).toBe(shift(0))
    expect(w.find('.p-tabs').text()).not.toContain('未排期')
    const rows = w.findAll('.f-list .tt').map((r) => r.text())
    expect(rows).toHaveLength(2)
    expect(rows).toContain('先记下来')
  })

  it('lists overdue work with how late it is', async () => {
    const w = await open([
      task('迟了两天', { due: shift(-2) }),
      task('还没到期', { due: shift(2) }),
    ])
    await tabByText(w, '逾期').trigger('click')
    const rows = w.findAll('.f-list .ti')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.tt').text()).toBe('迟了两天')
    expect(rows[0].find('.tag').classes()).toContain('rd')
    expect(rows[0].find('.tag').text()).toBe('逾期 2 天')
  })

  it('lifts a mark off the calendar once the task is checked off', async () => {
    const w = await open([task('今天要关', { due: shift(0), priority: 'high' })])
    expect(cell(w, shift(0)).findAll('.slice')).toHaveLength(1)
    await w.find('.f-list .box').setValue(true)
    expect(cell(w, shift(0)).findAll('.slice')).toHaveLength(0)
    expect(w.find('.f-list .ti').classes()).toContain('done')
  })

  it('honours a ?date= deep link and keeps ?q= searching across every day', async () => {
    const linked = await open([task('那天的活', { due: shift(9) })], { date: shift(9) })
    expect(linked.findAll('.f-list .tt').map((r) => r.text())).toEqual(['那天的活'])
    await compose(linked)
    expect(linked.find<HTMLInputElement>('.opts .due').element.value).toBe(shift(9))

    const searched = await open([task('搜得到的', { due: shift(20) })], { q: '搜得到' })
    expect(searched.find('.f-head h2').text()).toContain('搜索')
    expect(searched.findAll('.f-list .tt')).toHaveLength(1)
    // in search mode the switcher names the query and offers a way out instead of the scopes
    expect(searched.find('.p-tabs').text()).toContain('清除')
  })

  it('ignores a malformed ?date= instead of poisoning the join key', async () => {
    const w = await open([task('今天的活', { due: shift(0) })], { date: 'yesterday' })
    expect(w.findAll('.f-list .tt')).toHaveLength(1)
    await compose(w)
    expect(w.find<HTMLInputElement>('.opts .due').element.value).toBe(shift(0))
  })

  it('nudges when nothing in the library carries a date at all', async () => {
    const w = await open([task('没头没尾', {}), task('也没日期', {})])
    expect(w.findAll('.cells .slice')).toHaveLength(0)
    expect(w.find('.nudge').text()).toContain('2 项任务还没写到期日')
    expect(w.find('.emptyhint').text()).toContain('这一天还空着')
    // an empty range reads 0% and says so, rather than "已完成 0 / 0"
    expect(w.find('.p-num').text()).toBe('0%')
    expect(w.find('.p-sub').text()).toBe('这个范围里还没有任务')
    expect(w.find('.p-ring .bar').exists()).toBe(false)
  })

  it('ends the rail by pointing at the next day, and takes you there', async () => {
    const w = await open([task('明天的活', { due: shift(1) }), task('明天的另一件', { due: shift(1) })])
    const peek = w.find('.peek')
    expect(peek.find('.pk-main b').text()).toContain(md(shift(1)))
    expect(peek.find('.pk-main span').text()).toBe('2 个任务安排')
    await peek.trigger('click')
    expect(w.find('.f-head h2').text()).toContain(md(shift(1)))
    expect(w.findAll('.f-list .tt')).toHaveLength(2)
  })

  it('draws the ring from the same percentage the figure prints', async () => {
    const w = await open([task('做完的', { due: shift(0), done: true }), task('没做完的', { due: shift(0) })])
    expect(w.find('.p-num').text()).toBe('50%')
    expect(w.find('.p-sub').text()).toBe('已完成 1 / 2')
    // half the circumference wound back is half an arc — the two can never disagree
    const bar = w.find('.p-ring .bar')
    expect(Number(bar.attributes('stroke-dashoffset'))).toBeCloseTo(Math.PI * 25, 1)
  })
})
