import type { z } from 'zod'
import type { Serialize } from 'nitropack/types'
import { BaseApiClient } from '~~/layers/core/app/services/base.api'
import type { hubService } from '~~/layers/hubs/server/services/hub.service'
import type { centreService } from '~~/layers/hubs/server/services/centre.service'
import type { registerCentreSchema } from '~~/layers/hubs/server/schemas/hub.schema'

export type HubList = Serialize<Awaited<ReturnType<typeof hubService.list>>>
export type MyCentres = Serialize<Awaited<ReturnType<typeof hubService.mine>>>
export type CentreDashboard = Serialize<Awaited<ReturnType<typeof centreService.dashboard>>>
export type NewCentre = z.input<typeof registerCentreSchema>

export class HubApiClient extends BaseApiClient {
  list() {
    return this.request<HubList>('/api/hubs')
  }
  mine() {
    return this.request<MyCentres>('/api/hubs/mine')
  }
  register(body: NewCentre) {
    return this.request<{ id: string; status: string }>('/api/hubs/register', { method: 'POST', body })
  }
  dashboard() {
    return this.request<CentreDashboard>('/api/centres/dashboard')
  }
}
