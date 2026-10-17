/** All database access for legs (one carrier's stretch of a parcel's journey). */
import type { LegStatus, Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

type Db = Prisma.TransactionClient

export const legRepository = {
  create(data: Prisma.LegUncheckedCreateInput, db: Db = prisma) {
    return db.leg.create({ data })
  },

  findByLinkToken(linkToken: string) {
    return prisma.leg.findUnique({ where: { linkToken }, include: { parcel: true } })
  },

  findByParcel(parcelId: string) {
    return prisma.leg.findMany({ where: { parcelId }, orderBy: { seq: 'asc' } })
  },

  /** Move a leg only if it is still in `from`. False means a double tap or a race: do nothing. */
  async moveIfStill(id: string, from: LegStatus, data: Prisma.LegUpdateInput, db: Db = prisma) {
    const { count } = await db.leg.updateMany({ where: { id, status: from }, data })
    return count === 1
  },

  recordWrongCode(id: string) {
    return prisma.leg.update({ where: { id }, data: { failedAttempts: { increment: 1 } } })
  },
}
