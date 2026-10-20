import { HubApiClient, type NewCentre } from '../services/hub.api'

/** Fulfilment centres: list them, register one, see mine, run one (the centre dashboard). */
export function useHubs() {
  const api = new HubApiClient()
  return {
    list: () => api.list(),
    mine: () => api.mine(),
    register: (body: NewCentre) => api.register(body),
    dashboard: () => api.dashboard(),
  }
}
