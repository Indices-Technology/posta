/** A parcel's history: append-only. */
import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

type Db = Prisma.TransactionClient

export const eventRepository = {
  record(parcelId: string, type: string, data: Prisma.InputJsonValue = {}, db: Db = prisma) {
    return db.event.create({ data: { parcelId, type, data } })
  },
}
