import { BaseApiClient } from '~~/layers/core/app/services/base.api'
import type { Home, Job, JobAction, NewParcel, NewTrip, ParcelPage, Tracking, TripPage } from '../types/delivery.types'

export class DeliveryApiClient extends BaseApiClient {
  getHome() {
    return this.request<Home>('/api/delivery/home')
  }

  createParcel(body: NewParcel) {
    return this.request<{ id: string }>('/api/delivery/parcels', { method: 'POST', body })
  }
  getParcel(id: string) {
    return this.request<ParcelPage>(`/api/delivery/parcels/${id}`)
  }

  createTrip(body: NewTrip) {
    return this.request<{ id: string; matched: number }>('/api/delivery/trips', { method: 'POST', body })
  }
  getTrip(id: string) {
    return this.request<TripPage>(`/api/delivery/trips/${id}`)
  }

  // Public: carrier job links and recipient tracking links.
  getJob(token: string) {
    return this.request<Job>(`/api/delivery/jobs/${token}`)
  }
  actOnJob(token: string, body: JobAction) {
    return this.request<Job>(`/api/delivery/jobs/${token}`, { method: 'POST', body })
  }
  getTracking(token: string) {
    return this.request<Tracking>(`/api/delivery/track/${token}`)
  }
}
