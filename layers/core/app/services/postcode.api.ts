import type { Serialize } from 'nitropack/types'
import { BaseApiClient } from './base.api'
import type { postcodeService } from '~~/layers/core/server/services/postcode.service'

export type PostcodeAtPoint = Serialize<Awaited<ReturnType<typeof postcodeService.fromPoint>>>

export class PostcodeApiClient extends BaseApiClient {
  atPoint(lat: number, lng: number) {
    return this.request<PostcodeAtPoint>('/api/postcodes/reverse', { query: { lat, lng } })
  }
}
