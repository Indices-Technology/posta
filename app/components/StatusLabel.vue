<script setup lang="ts">
const props = defineProps<{ status: string; kind?: 'parcel' | 'trip' }>()
const meta = computed(
  () => (props.kind === 'trip' ? TRIP_STATUS : PARCEL_STATUS)[props.status as ParcelStatusName] ?? { label: props.status, tone: 'neutral' },
)
</script>

<template>
  <span class="status" :class="`tone-${meta.tone}`"><i class="dot" />{{ meta.label }}</span>
</template>
