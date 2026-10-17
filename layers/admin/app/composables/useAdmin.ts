import { AdminApiClient, type Decision } from '../services/admin.api'

/** Staff screens. The server refuses non-staff; the menu also hides the link from them. */
export function useAdmin() {
  const api = new AdminApiClient()
  return {
    overview: () => api.overview(),
    review: (type: 'courier' | 'centre', id: string, decision: Decision) =>
      type === 'courier' ? api.reviewCourier(id, decision) : api.reviewCentre(id, decision),
    assignCouriers: () => api.assignCouriers(),
  }
}
