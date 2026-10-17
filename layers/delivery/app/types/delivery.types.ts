/**
 * Delivery types for pages, derived from what the server services return (after JSON), so the
 * two can never drift: change a service's return and every page using it is type-checked.
 */
import type { z } from 'zod'
import type { Serialize } from 'nitropack/types'
import type { homeService } from '~~/layers/delivery/server/services/home.service'
import type { parcelService } from '~~/layers/delivery/server/services/parcel.service'
import type { tripService } from '~~/layers/delivery/server/services/trip.service'
import type { jobService } from '~~/layers/delivery/server/services/job.service'
import type { createParcelSchema } from '~~/layers/delivery/server/schemas/parcel.schema'
import type { createTripSchema } from '~~/layers/delivery/server/schemas/trip.schema'
import type { jobActionSchema } from '~~/layers/delivery/server/schemas/job.schema'

type Returned<F extends (...args: any[]) => any> = Serialize<Awaited<ReturnType<F>>>

export type Home = Returned<typeof homeService.get>
export type ParcelPage = Returned<typeof parcelService.getForUser>
export type Tracking = Returned<typeof parcelService.getTracking>
export type TripPage = Returned<typeof tripService.getForUser>
export type Job = Returned<typeof jobService.view>

// Request bodies: what the forms send (before the server's validation).
export type NewParcel = z.input<typeof createParcelSchema>
export type NewTrip = z.input<typeof createTripSchema>
export type JobAction = z.input<typeof jobActionSchema>
