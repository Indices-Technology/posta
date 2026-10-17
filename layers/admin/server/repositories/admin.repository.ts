/** Read-only queries across all parcels for staff screens. */
import { prisma } from '~~/server/utils/db'
import { MAX_FAILED_ATTEMPTS } from '~~/layers/delivery/server/utils/legTransition'

export const adminRepository = {
  countByStatus() {
    return prisma.parcel.groupBy({ by: ['status'], _count: { _all: true } })
  },

  /** Legs whose time window has passed without a handover. */
  listLateLegs(now: Date, take = 20) {
    return prisma.leg.findMany({
      where: { status: { not: 'HANDED_OVER' }, windowEnd: { lt: now } },
      select: { id: true, carrierName: true, windowEnd: true, parcel: { select: { id: true, number: true } } },
      orderBy: { windowEnd: 'asc' },
      take,
    })
  },

  /** Legs locked after too many wrong codes: someone must call the carrier. */
  listLockedLegs(take = 20) {
    return prisma.leg.findMany({
      where: { failedAttempts: { gte: MAX_FAILED_ATTEMPTS }, status: { not: 'HANDED_OVER' } },
      select: { id: true, carrierName: true, parcel: { select: { id: true, number: true } } },
      take,
    })
  },

  // ponytail: no paging until there are more than 200 parcels
  listParcels(take = 200) {
    return prisma.parcel.findMany({
      select: { id: true, number: true, status: true, fromCity: true, toCity: true, recipientName: true },
      orderBy: { createdAt: 'desc' },
      take,
    })
  },
}
