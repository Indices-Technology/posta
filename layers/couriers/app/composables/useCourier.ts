import { CourierApiClient, type CourierApplication } from '../services/courier.api'
import { useDeliveryStore } from '~~/layers/delivery/app/stores/delivery.store'

/** Apply as a courier or courier company, run the courier dashboard, answer job offers. */
export function useCourier() {
  const api = new CourierApiClient()
  const delivery = useDeliveryStore()

  /** Where the phone is, if the person allows it (so the nearest jobs reach them). */
  const here = () =>
    new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 },
      )
    })

  return {
    async apply(body: CourierApplication) {
      const res = await api.apply(body)
      delivery.invalidate() // Home shows courier status
      return res
    },
    mine: () => api.mine(),
    dashboard: () => api.dashboard(),
    async setAvailability(on: boolean) {
      return api.setAvailability(on, on ? await here() : null)
    },
    accept: (offerId: string) => api.accept(offerId),
    decline: (offerId: string) => api.decline(offerId),
  }
}
