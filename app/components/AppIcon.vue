<script setup lang="ts">
// One file decides Posta's iconography (same approach as MarketX's AppIcon map). Solar set, linear style.
const ICONS = {
  overview: 'solar:widget-2-linear',
  parcels: 'solar:box-linear',
  trips: 'solar:routing-2-linear',
  hubs: 'solar:shop-linear',
  add: 'solar:add-circle-linear',
  back: 'solar:alt-arrow-left-linear',
  chevron: 'solar:alt-arrow-right-linear',
  arrow: 'solar:arrow-right-linear',
  copy: 'solar:copy-linear',
  phone: 'solar:phone-linear',
  done: 'solar:check-circle-bold',
  check: 'solar:check-circle-linear',
  lock: 'solar:lock-keyhole-linear',
  clock: 'solar:clock-circle-linear',
  alert: 'solar:danger-triangle-linear',
  pin: 'solar:map-point-linear',
  signout: 'solar:logout-2-linear',
  link: 'solar:link-linear',
} as const

const props = defineProps<{ name: keyof typeof ICONS; label?: string }>()
</script>

<template>
  <Icon :name="ICONS[props.name]" :aria-label="label" :aria-hidden="label ? undefined : 'true'" />
</template>
