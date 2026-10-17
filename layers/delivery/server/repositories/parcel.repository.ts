/** All database access for parcels. Write methods take an optional transaction. */
import type { ParcelStatus, Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

type Db = Prisma.TransactionClient

const fullInclude = {
  legs: { orderBy: { seq: 'asc' }, include: { trip: { select: { id: true, departAt: true, arriveBy: true } } } },
  events: { orderBy: { at: 'asc' } },
} satisfies Prisma.ParcelInclude

export const parcelRepository = {
  create(data: Prisma.ParcelUncheckedCreateInput, db: Db = prisma) {
    return db.parcel.create({ data })
  },

  /** One parcel with its legs and history, if `scope` allows it (see ownerScope). */
  findWithJourney(id: string, scope: Prisma.ParcelWhereInput) {
    return prisma.parcel.findFirst({ where: { id, ...scope }, include: fullInclude })
  },

  findByTrackToken(trackToken: string) {
    return prisma.parcel.findUnique({ where: { trackToken }, include: fullInclude })
  },

  listCreatedBy(userId: string, take = 30, number?: number) {
    return prisma.parcel.findMany({
      where: { createdBy: userId, ...(number ? { number } : {}) },
      select: { id: true, number: true, status: true, fromCity: true, toCity: true, recipientName: true, description: true },
      orderBy: { createdAt: 'desc' },
      take,
    })
  },

  listWaiting() {
    return prisma.parcel.findMany({ where: { status: 'NEW' } })
  },

  /** At a centre with no courier yet: waiting for one to be approved or freed up. */
  listAtHubWithoutCourier(city?: string) {
    return prisma.parcel.findMany({
      where: {
        status: 'AT_HUB',
        legs: { none: { seq: 2 } },
        ...(city ? { toCity: { equals: city.trim(), mode: 'insensitive' as const } } : {}),
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  },

  /** NEW → MATCHED only if still NEW. False means another run got there first. */
  async claimForMatching(id: string, db: Db = prisma) {
    const { count } = await db.parcel.updateMany({ where: { id, status: 'NEW' }, data: { status: 'MATCHED' } })
    return count === 1
  },

  setStatus(id: string, status: ParcelStatus, db: Db = prisma) {
    return db.parcel.update({ where: { id }, data: { status } })
  },
}
