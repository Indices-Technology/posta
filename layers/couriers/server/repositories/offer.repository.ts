/** All database access for job offers (a job offered to one courier at a time). */
import type { OfferStatus, Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

type Db = Prisma.TransactionClient

export const offerRepository = {
  create(data: Prisma.JobOfferUncheckedCreateInput) {
    return prisma.jobOffer.create({ data })
  },

  findById(id: string) {
    return prisma.jobOffer.findUnique({ where: { id }, include: { courier: true, leg: { include: { parcel: true } } } })
  },

  /**
   * Couriers already asked for this leg, so they are not asked twice. With `onlyDeclined`, just those
   * who said no: couriers who let an offer run out get another chance once everyone has been asked.
   */
  async courierIdsAsked(legId: string, onlyDeclined = false) {
    const rows = await prisma.jobOffer.findMany({
      where: { legId, ...(onlyDeclined ? { status: 'DECLINED' as const } : {}) },
      select: { courierId: true },
    })
    return rows.map((r) => r.courierId)
  },

  hasOpen(legId: string, now = new Date()) {
    return prisma.jobOffer.count({ where: { legId, status: 'OFFERED', expiresAt: { gt: now } } }).then((n) => n > 0)
  },

  /** Answer an offer only if it is still open. False means it expired or was answered already. */
  async answer(id: string, status: OfferStatus, now = new Date(), db: Db = prisma) {
    const { count } = await db.jobOffer.updateMany({
      where: { id, status: 'OFFERED', expiresAt: { gt: now } },
      data: { status, respondedAt: now },
    })
    return count === 1
  },

  cancelOthers(legId: string, keepId: string, db: Db = prisma) {
    return db.jobOffer.updateMany({ where: { legId, status: 'OFFERED', id: { not: keepId } }, data: { status: 'CANCELLED' } })
  },

  /** Offers past their deadline: mark them expired and return them so the job moves on. */
  async expireDue(now = new Date()) {
    const due = await prisma.jobOffer.findMany({ where: { status: 'OFFERED', expiresAt: { lte: now } }, select: { id: true, legId: true } })
    if (due.length) await prisma.jobOffer.updateMany({ where: { id: { in: due.map((d) => d.id) } }, data: { status: 'EXPIRED' } })
    return due
  },

  listOpenForCourier(courierIds: string[], now = new Date()) {
    return prisma.jobOffer.findMany({
      where: { courierId: { in: courierIds }, status: 'OFFERED', expiresAt: { gt: now } },
      include: { leg: { include: { parcel: { select: { number: true, description: true, weightKg: true, pickupPostcode: true, fromCity: true } } } } },
      orderBy: { createdAt: 'asc' },
    })
  },
}
