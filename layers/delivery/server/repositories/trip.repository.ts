/** All database access for trips. */
import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

type Db = Prisma.TransactionClient

export const tripRepository = {
  create(data: Prisma.TripUncheckedCreateInput) {
    return prisma.trip.create({ data })
  },

  /** A trip and the parcels riding on it, if `scope` allows it. */
  findWithLoads(id: string, scope: Prisma.TripWhereInput) {
    return prisma.trip.findFirst({
      where: { id, ...scope },
      include: {
        legs: {
          orderBy: { windowStart: 'asc' },
          include: { parcel: { select: { id: true, number: true, status: true, description: true, weightKg: true, toCity: true } } },
        },
      },
    })
  },

  /** Trips the person drives or posted that aren't finished, with how full they are. */
  listActiveFor(userId: string) {
    return prisma.trip.findMany({
      where: { OR: [{ driverUserId: userId }, { createdBy: userId }], status: { not: 'DONE' } },
      include: { legs: { select: { status: true } } },
      orderBy: { departAt: 'asc' },
      take: 20,
    })
  },

  /** Open trips with how many parcels each already carries. */
  async listOpenWithLoad() {
    const trips = await prisma.trip.findMany({ where: { status: 'OPEN' }, include: { _count: { select: { legs: true } } } })
    return trips.map(({ _count, ...t }) => ({ ...t, carrying: _count.legs }))
  },

  countLoad(tripId: string, db: Db = prisma) {
    return db.leg.count({ where: { tripId } })
  },

  markFull(tripId: string, db: Db = prisma) {
    return db.trip.update({ where: { id: tripId }, data: { status: 'FULL' } })
  },
}
