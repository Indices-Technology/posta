import type { IconName } from '~~/layers/core/app/components/AppIcon.vue'

/** One picture per parcel status, so a list reads at a glance. */
export const STATUS_ICON: Record<string, IconName> = {
  NEW: 'waiting',
  MATCHED: 'trips',
  AWAITING_DROPOFF: 'waiting',
  AWAITING_PICKUP: 'waiting',
  WITH_COURIER: 'bike',
  AT_ORIGIN: 'hubs',
  IN_TRANSIT: 'road',
  AT_HUB: 'hubs',
  READY_FOR_COLLECTION: 'hubs',
  OUT_FOR_DELIVERY: 'bike',
  DELIVERED: 'done',
}

/** The 4 stages people see, and how far along a status is (0 = none done yet). */
export const STAGES: { label: string; icon: IconName }[] = [
  { label: 'At a centre', icon: 'hubs' },
  { label: 'On the road', icon: 'road' },
  { label: 'Arrived', icon: 'pin' },
  { label: 'Delivered', icon: 'home' },
]
export const STAGE_INDEX: Record<string, number> = {
  NEW: 0,
  MATCHED: 0,
  AWAITING_DROPOFF: 0,
  AWAITING_PICKUP: 0,
  WITH_COURIER: 0,
  AT_ORIGIN: 1,
  IN_TRANSIT: 2,
  AT_HUB: 3,
  READY_FOR_COLLECTION: 3,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
}
