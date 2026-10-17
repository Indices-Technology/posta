import type { PostaUser } from '~~/layers/core/server/types/user'
import { notFound } from '~~/layers/core/server/types/errors'
import { tripRepository } from '../repositories/trip.repository'
import { matchService } from './match.service'
import type { CreateTripInput } from '../schemas/trip.schema'

export const tripService = {
  /** Whoever posts the trip is the driver, so their jobs show up in their own account. */
  async create(user: PostaUser, input: CreateTripInput) {
    const trip = await tripRepository.create({ ...input, createdBy: user.id, driverUserId: user.id })
    const legs = await matchService.run().catch((error) => {
      logger.logError('[match] after trip create', error, { tripId: trip.id })
      return []
    })
    return { id: trip.id, matched: legs.filter((l) => l.tripId === trip.id).length }
  },

  /** The driver's view of their trip: which parcels to collect, with each job link. */
  async getForUser(user: PostaUser, id: string) {
    const trip = await tripRepository.findWithLoads(id, ownerScope(user))
    if (!trip) throw notFound('Trip')

    const { legs, ...rest } = trip
    return {
      trip: rest,
      loads: legs.map((l) => ({
        legId: l.id,
        status: l.status,
        fromPostcode: l.fromPostcode,
        toPostcode: l.toPostcode,
        linkToken: l.linkToken,
        parcel: l.parcel,
      })),
    }
  },
}
