/**
 * Puts waiting parcels on trips. The decision is the pure matchParcels(); this applies it.
 * Explicit imports only (no Nuxt auto-imports) so prisma/demo.ts can run it outside the app.
 */
import { prisma } from '~~/server/utils/db'
import { hubRepository } from '~~/layers/hubs/server/repositories/hub.repository'
import { parcelRepository } from '../repositories/parcel.repository'
import { tripRepository } from '../repositories/trip.repository'
import { legRepository } from '../repositories/leg.repository'
import { eventRepository } from '../repositories/event.repository'
import { matchParcels, nearestPoint } from '../utils/matching'
import { newCode, newLinkToken } from '../utils/codes'
import { siteUrl } from '~~/layers/core/server/utils/siteUrl'
import { firstName, formatRef } from '~~/shared/utils/posta'
import { notificationService, to } from '~~/layers/notifications/server/services/notification.service'

export const matchService = {
  /** Match every waiting parcel it can and create leg 1 for each. Returns the new legs. */
  async run(now = new Date()) {
    const [parcels, trips, hubs] = await Promise.all([
      parcelRepository.listWaiting(),
      tripRepository.listOpenWithLoad(),
      hubRepository.listApproved(),
    ])

    // A parcel with no handover point in its destination city can't ride yet; don't let it take a seat.
    const routable = parcels.filter((p) => nearestPoint(hubs, p.toCity))
    const matches = matchParcels(routable, trips, now)

    const created = []
    for (const m of matches) {
      const parcel = routable.find((p) => p.id === m.parcelId)!
      const trip = trips.find((t) => t.id === m.tripId)!
      const hub = nearestPoint(hubs, parcel.toCity, parcel.dropLat, parcel.dropLng)!

      const result = await prisma.$transaction(async (tx) => {
        if (!(await parcelRepository.claimForMatching(parcel.id, tx))) return null // another run got it

        const leg = await legRepository.create(
          {
            parcelId: parcel.id,
            seq: 1,
            kind: 'LINEHAUL',
            tripId: trip.id,
            carrierName: trip.driverName,
            carrierPhone: trip.driverPhone,
            fromPostcode: parcel.pickupPostcode,
            toPostcode: hub.postcode,
            windowStart: trip.departAt,
            windowEnd: trip.arriveBy,
            collectCode: newCode(),
            handoverCode: newCode(),
            linkToken: newLinkToken(),
          },
          tx,
        )
        await eventRepository.record(
          parcel.id,
          'parcel.matched',
          { tripId: trip.id, driver: trip.driverName, hubId: hub.id, hub: hub.name, postcode: hub.postcode },
          tx,
        )
        // ponytail: capacity re-check isn't locked; two matching runs at the same instant could overfill a trip by one.
        if ((await tripRepository.countLoad(trip.id, tx)) >= trip.capacity) await tripRepository.markFull(trip.id, tx)

        const ref = formatRef(parcel.number)
        const ids = await notificationService.queue(
          [
            to.whatsapp(trip.driverPhone, 'job.assigned', {
              carrier: firstName(trip.driverName),
              ref,
              from: parcel.fromCity,
              to: parcel.toCity,
              link: `${siteUrl()}/l/${leg.linkToken}`,
            }, parcel.id),
            ...(trip.driverUserId ? [to.user(trip.driverUserId, 'trip.parcel_added', { to: trip.toCity, contents: parcel.description }, parcel.id)] : []),
            to.user(parcel.createdBy, 'parcel.matched', { ref, driver: trip.driverName }, parcel.id),
          ],
          tx,
        )
        return { leg, ids }
      })
      if (result) {
        created.push(result.leg)
        void notificationService.send(result.ids)
      }
    }
    return created
  },
}
