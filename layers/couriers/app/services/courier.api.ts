import type { z } from 'zod'
import type { Serialize } from 'nitropack/types'
import { BaseApiClient } from '~~/layers/core/app/services/base.api'
import type { courierService } from '~~/layers/couriers/server/services/courier.service'
import type { applyCourierSchema } from '~~/layers/couriers/server/schemas/courier.schema'

export type MyCouriers = Serialize<Awaited<ReturnType<typeof courierService.mine>>>
export type CourierApplication = z.input<typeof applyCourierSchema>

export class CourierApiClient extends BaseApiClient {
  apply(body: CourierApplication) {
    return this.request<{ id: string; status: string }>('/api/couriers/apply', { method: 'POST', body })
  }
  mine() {
    return this.request<MyCouriers>('/api/couriers/mine')
  }
}
