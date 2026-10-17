import type { PostaUser } from '~~/layers/core/server/types/user'
import { hubRepository } from '~~/layers/hubs/server/repositories/hub.repository'
import { courierRepository } from '~~/layers/couriers/server/repositories/courier.repository'
import { parcelRepository } from '../repositories/parcel.repository'
import { tripRepository } from '../repositories/trip.repository'

export const homeService = {
  /** Everything the home screen shows: my parcels, my trips, my courier work, and form prefill. */
  async get(user: PostaUser) {
    const [parcels, trips, cities, couriers] = await Promise.all([
      parcelRepository.listCreatedBy(user.id),
      tripRepository.listActiveFor(user.id),
      hubRepository.listCities(),
      courierRepository.listForUserWithJobs(user.id),
    ])
    const approved = couriers.filter((c) => c.status === 'APPROVED')
    return {
      me: { name: user.username ?? '', phone: user.phone ?? '', isOps: isOps(user) },
      cities,
      parcels,
      trips: trips.map(({ legs, ...t }) => ({
        ...t,
        carrying: legs.length,
        toCollect: legs.filter((l) => l.status === 'ASSIGNED').length,
      })),
      /** Shown as "My deliveries" once approved; "Work with Posta" otherwise. */
      courier: couriers.length
        ? { approved: approved.length > 0, openJobs: approved.reduce((n, c) => n + c.legs.length, 0) }
        : null,
    }
  },
}
