/** All database access for couriers. */
import type { CourierKind, PartnerStatus, Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

const openJobs = { status: { not: 'HANDED_OVER' } } satisfies Prisma.LegWhereInput

export const courierRepository = {
  create(data: Prisma.CourierUncheckedCreateInput) {
    return prisma.courier.create({ data })
  },

  update(id: string, data: Prisma.CourierUpdateInput) {
    return prisma.courier.update({ where: { id }, data })
  },

  findById(id: string) {
    return prisma.courier.findUnique({ where: { id } })
  },

  findByUserAndKind(userId: string, kind: CourierKind) {
    return prisma.courier.findUnique({ where: { userId_kind: { userId, kind } } })
  },

  /** The person's courier profiles (as a person and/or a company) with their open jobs. */
  listForUserWithJobs(userId: string) {
    return prisma.courier.findMany({
      where: { userId },
      include: {
        legs: {
          where: openJobs,
          orderBy: { windowStart: 'asc' },
          include: { parcel: { select: { number: true, description: true, weightKg: true, toCity: true } } },
        },
      },
    })
  },

  listPending() {
    return prisma.courier.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } })
  },

  /** Decide an application. False if it was already decided (someone else got there first). */
  async review(id: string, status: PartnerStatus, reviewedBy: string) {
    const { count } = await prisma.courier.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, reviewedBy, reviewedAt: new Date() },
    })
    return count === 1
  },

  /** The approved courier in a city with the fewest unfinished jobs, or null. */
  async findLeastBusy(city: string) {
    const couriers = await prisma.courier.findMany({
      where: { status: 'APPROVED', city: { equals: city.trim(), mode: 'insensitive' } },
      include: { _count: { select: { legs: { where: openJobs } } } },
      orderBy: { createdAt: 'asc' },
    })
    return couriers.sort((a, b) => a._count.legs - b._count.legs)[0] ?? null
  },
}
