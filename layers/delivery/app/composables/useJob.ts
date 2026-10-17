import { DeliveryApiClient } from '../services/delivery.api'
import type { Job } from '../types/delivery.types'

/** A carrier's job link (public, no account): load it, then confirm collect/handover with a code. */
export function useJob(token: string) {
  const api = new DeliveryApiClient()

  return {
    load: () => api.getJob(token),
    act: (action: 'collect' | 'handover', code: string): Promise<Job> => api.actOnJob(token, { action, code }),
  }
}
