/** Read-only queries across all parcels for staff screens. */
import { prisma } from '~~/server/utils/db'
import { MAX_FAILED_ATTEMPTS } from '~~/layers/delivery/server/utils/chain'

export const adminRepository = {
  countByStatus() {
    return prisma.parcel.groupBy({ by: ['status'], _count: { _all: true } })
  },

  /** Legs whose time window has passed without a handover. */
  listLateLegs(now: Date, take = 20) {
    return prisma.leg.findMany({
      where: { status: { not: 'HANDED_OVER' }, windowEnd: { lt: now }, carrierName: { not: null } },
      select: { id: true, carrierName: true, windowEnd: true, parcel: { select: { id: true, number: true } } },
      orderBy: { windowEnd: 'asc' },
      take,
    })
  },

  /** Handovers locked after too many wrong codes: someone must call the people involved. */
  listLockedHandovers(take = 20) {
    return prisma.handover.findMany({
      where: { failedAttempts: { gte: MAX_FAILED_ATTEMPTS }, status: { in: ['READY', 'WAITING'] } },
      select: { id: true, fromParty: true, toParty: true, parcel: { select: { id: true, number: true } } },
      take,
    })
  },

  /** Courier jobs nobody has taken yet, on parcels waiting for them (at the sender or a centre). */
  countWaitingForCourier() {
    return prisma.leg.count({
      where: {
        carrierName: null,
        handoversIn: { some: { toParty: 'COURIER' } },
        parcel: { status: { in: ['AWAITING_PICKUP', 'AT_ORIGIN', 'AT_HUB'] } },
      },
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
