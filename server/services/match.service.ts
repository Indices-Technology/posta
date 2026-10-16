import { prisma } from '../utils/db'
import { newCode, newLinkToken } from '../utils/codes'
import { matchParcels, nearestPoint } from '../domain/match'

/**
 * Match every waiting parcel to a trip and create leg 1 for each.
 * Returns the created legs so the caller can message the drivers.
 */
export async function runMatching(now = new Date()) {
  const [parcels, trips, points] = await Promise.all([
    prisma.parcel.findMany({ where: { status: 'NEW' } }),
    prisma.trip.findMany({ where: { status: 'OPEN' }, include: { _count: { select: { legs: true } } } }),
    prisma.handoverPoint.findMany(),
  ])

  // A parcel with no handover point in its destination city can't ride yet; don't let it take a seat.
  const routable = parcels.filter((p) => nearestPoint(points, p.toCity))
  const matches = matchParcels(
    routable,
    trips.map((t) => ({ ...t, carrying: t._count.legs })),
    now,
  )

  const created = []
  for (const m of matches) {
    const parcel = routable.find((p) => p.id === m.parcelId)!
    const trip = trips.find((t) => t.id === m.tripId)!
    const hub = nearestPoint(points, parcel.toCity, parcel.dropLat, parcel.dropLng)!

    const leg = await prisma.$transaction(async (tx) => {
      // Claim the parcel. If another run already matched it, skip it.
      const claimed = await tx.parcel.updateMany({ where: { id: parcel.id, status: 'NEW' }, data: { status: 'MATCHED' } })
      if (claimed.count === 0) return null

      const leg = await tx.leg.create({
        data: {
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
      })
      await tx.event.create({
        data: {
          parcelId: parcel.id,
          type: 'parcel.matched',
          data: { tripId: trip.id, driver: trip.driverName, hubId: hub.id, hub: hub.name, postcode: hub.postcode },
        },
      })
      // ponytail: capacity re-check isn't locked; two matching runs at the same instant could overfill a trip by one.
      const carrying = await tx.leg.count({ where: { tripId: trip.id } })
      if (carrying >= trip.capacity) await tx.trip.update({ where: { id: trip.id }, data: { status: 'FULL' } })
      return leg
    })
    if (leg) created.push(leg)
  }
  return created
}
