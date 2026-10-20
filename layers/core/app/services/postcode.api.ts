import type { Serialize } from 'nitropack/types'
import { BaseApiClient } from './base.api'
import type { postcodeService } from '~~/layers/core/server/services/postcode.service'
import type { PlaceResult } from '~~/layers/core/server/services/place.service'

export type PostcodeAtPoint = Serialize<Awaited<ReturnType<typeof postcodeService.fromPoint>>>
export type { PlaceResult }

export class PostcodeApiClient extends BaseApiClient {
  atPoint(lat: number, lng: number) {
    return this.request<PostcodeAtPoint>('/api/postcodes/reverse', { query: { lat, lng } })
  }
  search(q: string, near?: { lat: number; lng: number } | null) {
    return this.request<PlaceResult[]>('/api/places/search', { query: { q, ...(near ?? {}) } })
  }
}
