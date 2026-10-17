import type { Serialize } from 'nitropack/types'
import { BaseApiClient } from '~~/layers/core/app/services/base.api'
import type { adminService } from '~~/layers/admin/server/services/admin.service'

export type Overview = Serialize<Awaited<ReturnType<typeof adminService.overview>>>
export type Decision = 'APPROVED' | 'REJECTED'

export class AdminApiClient extends BaseApiClient {
  overview() {
    return this.request<Overview>('/api/admin/overview')
  }
  reviewCourier(id: string, decision: Decision) {
    return this.request<{ id: string; status: string; assigned: number }>(`/api/couriers/${id}/review`, { method: 'POST', body: { decision } })
  }
  reviewCentre(id: string, decision: Decision) {
    return this.request<{ id: string; status: string }>(`/api/hubs/${id}/review`, { method: 'POST', body: { decision } })
  }
  assignCouriers() {
    return this.request<{ assigned: number }>('/api/admin/assign-couriers', { method: 'POST' })
  }
}
