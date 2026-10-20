/**
 * Puts parcels on travellers' trips: the city-to-city stretch, origin centre to destination centre.
 * Travellers only ever deal with two centres, never with senders or recipients.
 * The decision is the pure matchParcels(); this applies it.
 *
 * Explicit imports only (scripts and the sweep task run it too).
 */
import { prisma } from '~~/server/utils/db'
import { siteUrl } from '~~/layers/core/server/utils/siteUrl'
import { firstName, formatRef } from '~~/shared/utils/posta'
import { notificationService, to } from '~~/layers/notifications/server/services/notification.service'
import { tripRepository } from '../repositories/trip.repository'
import { eventRepository } from '../repositories/event.repository'
import { matchParcels } from '../utils/matching'
import { refreshReadiness } from './chainState.service'

// A trip that left this long ago without collecting its parcel has missed it.
const MISSED_AFTER_MS = 60 * 60 * 1000

/** Traveller legs with no trip yet, on parcels still moving. */
function openTravellerLegs() {
  return prisma.leg.findMany({
    where: { kind: 'LINEHAUL', carrierName: null, handoversIn: { some: { toParty: 'TRAVELLER' } }, parcel: { status: { not: 'DELIVERED' } } },
    include: { parcel: true, handoversIn: { include: { fromHub: true } }, handoversOut: { include: { toHub: true } } },
  })
}

export const matchService = {
  /** Match every open traveller leg it can. Returns the legs it assigned. */
  async run(now = new Date()) {
    const [legs, trips] = await Promise.all([openTravellerLegs(), tripRepository.listOpenWithLoad()])
    const items = legs.map((l) => ({
      id: l.id,
      fromCity: l.handoversIn[0]?.fromHub?.city ?? l.parcel.fromCity,
      toCity: l.handoversOut[0]?.toHub?.city ?? l.parcel.toCity,
      createdAt: l.parcel.createdAt,
    }))

    const assigned = []
    for (const m of matchParcels(items, trips, now)) {
      const leg = legs.find((l) => l.id === m.parcelId)!
      const trip = trips.find((t) => t.id === m.tripId)!
      const p = leg.parcel
      const origin = leg.handoversIn[0]?.fromHub
      const dest = leg.handoversOut[0]?.toHub
      const ref = formatRef(p.number)

      const ids = await prisma.$transaction(async (tx) => {
        const { count } = await tx.leg.updateMany({
          where: { id: leg.id, carrierName: null },
          data: { tripId: trip.id, carrierName: trip.driverName, carrierPhone: trip.driverPhone, windowStart: trip.departAt, windowEnd: trip.arriveBy },
        })
        if (count === 0) return null // another run got it
        await refreshReadiness(p.id, tx)
        await eventRepository.record(p.id, 'parcel.matched', { tripId: trip.id, driver: trip.driverName, from: origin?.name, hub: dest?.name ?? null }, tx)
        // ponytail: capacity re-check isn't locked; two matching runs at the same instant could overfill a trip by one.
        if ((await tripRepository.countLoad(trip.id, tx)) >= trip.capacity) await tripRepository.markFull(trip.id, tx)

        return notificationService.queue(
          [
            to.whatsapp(trip.driverPhone, 'job.assigned', {
              carrier: firstName(trip.driverName),
              ref,
              from: origin?.name ?? p.fromCity,
              to: dest?.name ?? p.toCity,
              link: `${siteUrl()}/l/${leg.linkToken}`,
            }, p.id),
            ...(trip.driverUserId ? [to.user(trip.driverUserId, 'trip.parcel_added', { to: trip.toCity, contents: p.description }, p.id)] : []),
            to.user(p.createdBy, 'parcel.matched', { ref, driver: trip.driverName }, p.id),
          ],
          tx,
        )
      })
      if (ids) {
        assigned.push(leg)
        void notificationService.send(ids)
      }
    }
    return assigned
  },

  /** For the sweep task: a trip left without its parcel, so free the seat and match it again. */
  async releaseMissed(now = new Date()) {
    const missed = await prisma.leg.findMany({
      where: {
        kind: 'LINEHAUL',
        tripId: { not: null },
        trip: { departAt: { lt: new Date(now.getTime() - MISSED_AFTER_MS) } },
        handoversIn: { some: { toParty: 'TRAVELLER', status: { in: ['READY', 'WAITING'] } } },
      },
      select: { id: true, parcelId: true, carrierName: true },
    })
    for (const l of missed) {
      await prisma.$transaction(async (tx) => {
        await tx.leg.update({ where: { id: l.id }, data: { tripId: null, carrierName: null, carrierPhone: null } })
        await refreshReadiness(l.parcelId, tx)
        await eventRepository.record(l.parcelId, 'trip.missed', { driver: l.carrierName }, tx)
      })
    }
    if (missed.length) await this.run(now)
    return missed.length
  },
}
