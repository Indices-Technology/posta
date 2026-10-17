import { DeliveryApiClient } from '../services/delivery.api'
import { useDeliveryStore } from '../stores/delivery.store'
import type { NewParcel, NewTrip } from '../types/delivery.types'

/** Parcels and trips for the signed-in person. Pages call this, never the API client directly. */
export function useDelivery() {
  const store = useDeliveryStore()
  const api = new DeliveryApiClient()

  async function loadHome() {
    store.setHome(await api.getHome())
    return store.home!
  }

  async function createParcel(body: NewParcel) {
    const res = await api.createParcel(body)
    store.invalidate()
    return res
  }

  async function createTrip(body: NewTrip) {
    const res = await api.createTrip(body)
    store.invalidate()
    return res
  }

  return {
    home: computed(() => store.home),
    cities: computed(() => store.cities),
    me: computed(() => store.me),
    loadHome,
    createParcel,
    createTrip,
    getParcel: (id: string) => api.getParcel(id),
    getTrip: (id: string) => api.getTrip(id),
    getTracking: (token: string) => api.getTracking(token),
  }
}
