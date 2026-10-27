<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTasks } from '@/composables/useTasks'
import { sortByPriority } from '@/lib/tasks'
import type { Priority } from '@/types'

const { tasks, add, toggle, remove } = useTasks()
const draft = ref('')
const prio = ref<Priority>('med')
const filter = ref<'all' | 'active' | 'done'>('all')

function submit() {
  add(draft.value, prio.value)
  draft.value = ''
}

const shown = computed(() => {
  const base =
    filter.value === 'active' ? tasks.value.filter((t) => !t.done)
    : filter.value === 'done' ? tasks.value.filter((t) => t.done)
    : tasks.value
  return sortByPriority(base)
})
</script>

<template>
  <section class="card reveal">
    <form class="row" @submit.prevent="submit">
      <input v-model="draft" class="field" placeholder="添加一项待办…" style="flex: 1; min-width: 200px" />
      <select v-model="prio" class="field" style="width: auto">
        <option value="high">高优先级</option>
        <option value="med">中</option>
        <option value="low">低</option>
      </select>
      <button class="btn btn-plum" type="submit">添加</button>
    </form>

    <div class="row" style="margin: 16px 0 6px">
      <button class="chip" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部 {{ tasks.length }}</button>
      <button class="chip" :class="{ on: filter === 'active' }" @click="filter = 'active'">进行中</button>
      <button class="chip" :class="{ on: filter === 'done' }" @click="filter = 'done'">已完成</button>
    </div>

    <p v-if="!shown.length" class="empty">这里还空着——先添加一项待办。</p>
    <ul style="list-style: none">
      <li v-for="t in shown" :key="t.id" class="list-item">
        <input type="checkbox" :checked="t.done" @change="toggle(t.id)" />
        <span :style="{ textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }">{{ t.title }}</span>
        <span class="chip" style="margin-left: auto">{{ t.priority }}</span>
        <button class="chip" @click="remove(t.id)">删除</button>
      </li>
    </ul>
  </section>
</template>
