import type { IconName } from '~~/layers/core/app/components/AppIcon.vue'

/** One picture per parcel status, so a list reads at a glance. */
export const STATUS_ICON: Record<string, IconName> = {
  NEW: 'waiting',
  MATCHED: 'trips',
  IN_TRANSIT: 'road',
  AT_HUB: 'hubs',
  OUT_FOR_DELIVERY: 'road',
  DELIVERED: 'done',
}

/** The 4 stages people see, and how far along a status is (0 = none done yet). */
export const STAGES: { label: string; icon: IconName }[] = [
  { label: 'Matched', icon: 'trips' },
  { label: 'On the road', icon: 'road' },
  { label: 'At hub', icon: 'hubs' },
  { label: 'Delivered', icon: 'home' },
]
export const STAGE_INDEX: Record<string, number> = { NEW: 0, MATCHED: 1, IN_TRANSIT: 2, AT_HUB: 3, OUT_FOR_DELIVERY: 3, DELIVERED: 4 }

