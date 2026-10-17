import { CourierApiClient, type CourierApplication } from '../services/courier.api'
import { useDeliveryStore } from '~~/layers/delivery/app/stores/delivery.store'

/** Apply as a courier or courier company, and see my courier work. */
export function useCourier() {
  const api = new CourierApiClient()
  const delivery = useDeliveryStore()

  return {
    async apply(body: CourierApplication) {
      const res = await api.apply(body)
      delivery.invalidate() // Home shows courier status
      return res
    },
    mine: () => api.mine(),
  }
}
