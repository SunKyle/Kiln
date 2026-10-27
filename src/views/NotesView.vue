<script setup lang="ts">
import { ref } from 'vue'
import { useNotes } from '@/composables/useNotes'

const { notes, loading, save, remove } = useNotes()
const title = ref('')
const body = ref('')

async function submit() {
  await save({ title: title.value, body: body.value })
  title.value = ''
  body.value = ''
}
</script>

<template>
  <section class="card reveal">
    <form style="display: flex; flex-direction: column; gap: 10px" @submit.prevent="submit">
      <input v-model="title" class="field" placeholder="笔记标题…" />
      <textarea v-model="body" class="field" rows="4" placeholder="正文（存本地 IndexedDB）…"></textarea>
      <div><button class="btn btn-plum" type="submit">保存笔记</button></div>
    </form>

    <div style="margin-top: 16px">
      <p v-if="loading" class="empty">载入本地笔记…</p>
      <p v-else-if="!notes.length" class="empty">还没有笔记。</p>
      <ul style="list-style: none">
        <li v-for="n in notes" :key="n.id" class="list-item">
          <div style="min-width: 0; flex: 1">
            <div style="font-weight: 600">{{ n.title }}</div>
            <div class="muted" style="font-size: 12.5px">{{ new Date(n.updatedAt).toLocaleString('zh-CN') }}</div>
            <div v-if="n.body" class="muted" style="font-size: 13px; margin-top: 4px">{{ n.body }}</div>
          </div>
          <button class="chip" @click="remove(n.id)">删除</button>
        </li>
      </ul>
    </div>
  </section>
</template>
