import type { z } from 'zod'
import type { Serialize } from 'nitropack/types'
import { BaseApiClient } from '~~/layers/core/app/services/base.api'
import type { courierService } from '~~/layers/couriers/server/services/courier.service'
import type { dispatchService } from '~~/layers/delivery/server/services/dispatch.service'
import type { applyCourierSchema } from '~~/layers/couriers/server/schemas/courier.schema'

export type MyCouriers = Serialize<Awaited<ReturnType<typeof courierService.mine>>>
export type CourierDashboard = Serialize<Awaited<ReturnType<typeof courierService.dashboard>>>
export type Accepted = Serialize<Awaited<ReturnType<typeof dispatchService.accept>>>
export type CourierApplication = z.input<typeof applyCourierSchema>

export class CourierApiClient extends BaseApiClient {
  apply(body: CourierApplication) {
    return this.request<{ id: string; status: string }>('/api/couriers/apply', { method: 'POST', body })
  }
  mine() {
    return this.request<MyCouriers>('/api/couriers/mine')
  }
  dashboard() {
    return this.request<CourierDashboard>('/api/couriers/dashboard')
  }
  setAvailability(on: boolean, at?: { lat: number; lng: number } | null) {
    return this.request<{ available: boolean }>('/api/couriers/availability', { method: 'POST', body: { on, lat: at?.lat ?? null, lng: at?.lng ?? null } })
  }
  accept(offerId: string) {
    return this.request<Accepted>(`/api/couriers/offers/${offerId}/accept`, { method: 'POST' })
  }
  decline(offerId: string) {
    return this.request<null>(`/api/couriers/offers/${offerId}/decline`, { method: 'POST' })
  }
}
