import { BaseApiClient } from '~~/layers/core/app/services/base.api'
import type {
  Confirmed,
  HandoverView,
  Home,
  Job,
  NearCentre,
  NearCourier,
  NewParcel,
  NewTrip,
  ParcelPage,
  Tracking,
  TripPage,
} from '../types/delivery.types'

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

  // Choices while booking.
  centresNear(lat: number, lng: number) {
    return this.request<NearCentre[]>('/api/hubs/near', { query: { lat, lng } })
  }
  couriersNear(lat: number, lng: number) {
    return this.request<NearCourier[]>('/api/couriers/near', { query: { lat, lng } })
  }

  // Public: carrier job links, recipient tracking links, and scans.
  getJob(token: string) {
    return this.request<Job>(`/api/delivery/jobs/${token}`)
  }
  getTracking(token: string) {
    return this.request<Tracking>(`/api/delivery/track/${token}`)
  }
  getHandover(token: string, job?: string | null) {
    return this.request<HandoverView>(`/api/handovers/${token}`, { query: job ? { job } : undefined })
  }
  confirmHandover(token: string, job?: string | null) {
    return this.request<Confirmed>(`/api/handovers/${token}/confirm`, { method: 'POST', body: { job: job ?? null } })
  }
  confirmCode(code: string, job?: string | null) {
    return this.request<Confirmed>('/api/handovers/code', { method: 'POST', body: { code, job: job ?? null } })
  }
}
