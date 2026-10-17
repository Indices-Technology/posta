/**
 * Delivery store: the home screen's data, shared by Home, Send and Travel (cities, prefill).
 * State only, no API calls (useDelivery does those), as in MarketX.
 * Page-specific data (one parcel, one job) stays with its page, not here.
 */
import type { Home } from '../types/delivery.types'

export const useDeliveryStore = defineStore('delivery', () => {
  const home = ref<Home | null>(null)

  const cities = computed(() => home.value?.cities ?? [])
  const me = computed(() => home.value?.me ?? { name: '', phone: '', isOps: false })

  const setHome = (h: Home) => {
    home.value = h
  }
  /** After booking a parcel or posting a trip, Home must refetch. */
  const invalidate = () => {
    home.value = null
  }

  return { home, cities, me, setHome, invalidate }
})
