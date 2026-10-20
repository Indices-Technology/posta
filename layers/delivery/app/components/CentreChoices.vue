<script setup lang="ts">
// Pick one of the nearest fulfilment centres: name, distance, hours. Nearest first.
import type { NearCentre } from '../types/delivery.types'

const model = defineModel<string>({ required: true })
const props = defineProps<{ centres: NearCentre[]; loading?: boolean }>()

// Nothing chosen yet: preselect the nearest, the usual answer.
watch(
  () => props.centres,
  (list) => {
    if (!model.value && list[0]) model.value = list[0].id
  },
  { immediate: true },
)
</script>

<template>
  <p v-if="loading" class="soft small">Finding centres…</p>
  <p v-else-if="!centres.length" class="soft">No Posta centre near there yet.</p>
  <ul v-else class="list">
    <li v-for="c in centres" :key="c.id">
      <button type="button" class="item pick" :class="{ on: model === c.id }" @click="model = c.id">
        <span class="item-icon"><AppIcon name="hubs" /></span>
        <span>
          <b>{{ c.name }}</b>
          <span class="sub">{{ c.distanceKm }} km · {{ c.hours || c.city }}</span>
        </span>
        <AppIcon :name="model === c.id ? 'done' : 'chevron'" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.pick { width: 100%; border: 0; background: none; text-align: left; cursor: pointer; border-radius: 12px; padding-inline: 8px; }
.pick.on { background: var(--sunken); }
</style>
