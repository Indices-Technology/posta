import { DeliveryApiClient } from '../services/delivery.api'

/** A carrier's job link (public, no account): their two handovers. Actions happen through scans (useHandovers). */
export function useJob(token: string) {
  const api = new DeliveryApiClient()
  return { load: () => api.getJob(token) }
}
