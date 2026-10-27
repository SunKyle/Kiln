<script setup lang="ts">
import { ref } from 'vue'
import { useTools } from '@/composables/useTools'

const { tools, add, remove } = useTools()
const name = ref('')
const url = ref('')
const cat = ref('')

function submit() {
  add(name.value, url.value, cat.value)
  name.value = ''
  url.value = ''
  cat.value = ''
}
</script>

<template>
  <section class="card reveal">
    <form class="row" @submit.prevent="submit">
      <input v-model="name" class="field" placeholder="名称" style="flex: 1" />
      <input v-model="url" class="field" placeholder="https://…" style="flex: 1.4" />
      <input v-model="cat" class="field" placeholder="分类" style="width: 110px" />
      <button class="btn btn-plum" type="submit">添加</button>
    </form>

    <div class="grid cols-2" style="margin-top: 16px">
      <div v-for="t in tools" :key="t.id" class="list-item" style="border: 1px solid var(--line-soft); border-radius: var(--r); padding: 12px">
        <div style="min-width: 0; flex: 1">
          <a :href="t.url" target="_blank" rel="noopener" style="font-weight: 600; text-decoration: none">{{ t.name }}</a>
          <div class="muted" style="font-size: 12px">{{ t.category }}</div>
        </div>
        <button class="chip" @click="remove(t.id)">✕</button>
      </div>
    </div>
  </section>
</template>
