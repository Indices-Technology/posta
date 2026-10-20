/**
 * Delivery types for pages, derived from what the server services return (after JSON), so the
 * two can never drift: change a service's return and every page using it is type-checked.
 */
import type { z } from 'zod'
import type { Serialize } from 'nitropack/types'
import type { homeService } from '~~/layers/delivery/server/services/home.service'
import type { parcelService } from '~~/layers/delivery/server/services/parcel.service'
import type { tripService } from '~~/layers/delivery/server/services/trip.service'
import type { carrierService } from '~~/layers/delivery/server/services/carrier.service'
import type { handoverService } from '~~/layers/delivery/server/services/handover.service'
import type { createParcelSchema } from '~~/layers/delivery/server/schemas/parcel.schema'
import type { createTripSchema } from '~~/layers/delivery/server/schemas/trip.schema'

type Returned<F extends (...args: any[]) => any> = Serialize<Awaited<ReturnType<F>>>

export type Home = Returned<typeof homeService.get>
export type ParcelPage = Returned<typeof parcelService.getForUser>
export type Tracking = Returned<typeof parcelService.getTracking>
export type TripPage = Returned<typeof tripService.getForUser>
export type Job = Returned<typeof carrierService.job>
export type HandoverView = Returned<typeof handoverService.view>
export type Confirmed = Returned<typeof handoverService.confirm>

/** A centre near a point (drop-off / collection choices). */
export interface NearCentre {
  id: string
  name: string
  city: string
  postcode: string
  address: string
  hours: string
  distanceKm: number
}

/** A courier a sender can pick: first name, vehicle, rough distance only. */
export interface NearCourier {
  id: string
  firstName: string
  vehicle: string | null
  distanceKm: number | null
}

// Request bodies: what the forms send (before the server's validation).
export type NewParcel = z.input<typeof createParcelSchema>
export type NewTrip = z.input<typeof createTripSchema>
