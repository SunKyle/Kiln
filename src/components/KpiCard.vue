<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  label: string
  value: string | number
  unit?: string
  foot?: string
  variant?: 'white' | 'plum' | 'orange'
}>()
const cls = computed(() =>
  props.variant === 'plum' ? 'plum-card' : props.variant === 'orange' ? 'orange-card' : '',
)
</script>

<template>
  <div class="card" :class="cls">
    <div class="lab">{{ label }}</div>
    <div class="num">
      {{ value }}<span v-if="unit" class="unit"> {{ unit }}</span>
    </div>
    <div v-if="foot" class="lab" style="margin-top: 12px">{{ foot }}</div>
  </div>
</template>
