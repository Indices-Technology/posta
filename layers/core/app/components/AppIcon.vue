<script setup lang="ts">
// One file decides Posta's iconography (same approach as MarketX's AppIcon map). Solar set.
const ICONS = {
  send: 'solar:box-bold',
  travel: 'solar:routing-bold',
  parcel: 'solar:box-minimalistic-linear',
  trips: 'solar:routing-2-linear',
  road: 'solar:bus-linear',
  home: 'solar:home-2-linear',
  hubs: 'solar:shop-linear',
  waiting: 'solar:clock-circle-linear',
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
  calendar: 'solar:calendar-linear',
  alert: 'solar:danger-triangle-linear',
  pin: 'solar:map-point-linear',
  user: 'solar:user-linear',
  money: 'solar:wallet-money-linear',
  staff: 'solar:shield-user-linear',
  share: 'solar:share-linear',
  chat: 'solar:chat-round-line-linear',
  signout: 'solar:logout-2-linear',
  close: 'solar:close-circle-linear',
  bell: 'solar:bell-linear',
  bike: 'solar:scooter-linear',
  car: 'solar:car-linear',
  van: 'solar:delivery-linear',
  company: 'solar:buildings-2-linear',
  gps: 'solar:gps-linear',
  system: 'solar:server-path-linear',
  refresh: 'solar:refresh-linear',
  work: 'solar:hand-shake-linear',
  link: 'solar:link-linear',
} as const

export type IconName = keyof typeof ICONS
const props = defineProps<{ name: IconName; label?: string }>()
</script>

<template>
  <Icon :name="ICONS[props.name]" :aria-label="label" :aria-hidden="label ? undefined : 'true'" />
</template>
