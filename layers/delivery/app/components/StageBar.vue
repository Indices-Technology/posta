<script setup lang="ts">
// The parcel's journey as 4 pictures. `status` is a parcel status.
const props = defineProps<{ status: string }>()
const at = computed(() => STAGE_INDEX[props.status] ?? 0)
</script>

<template>
  <div class="stages" :class="{ delivered: status === 'DELIVERED' }" role="img" :aria-label="PARCEL_STATUS[status as ParcelStatusName]?.label">
    <span class="fill" :style="{ width: `${(Math.max(0, at - 1) / 3) * 75}%` }" />
    <div v-for="(s, i) in STAGES" :key="s.label" class="stage" :class="{ done: i < at, now: i === at }">
      <i><AppIcon :name="s.icon" /></i>
      {{ s.label }}
    </div>
  </div>
</template>
