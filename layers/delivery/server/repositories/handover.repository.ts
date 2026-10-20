/** All database access for handovers (each change of hands in a parcel's chain). */
import type { HandoverStatus, Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

type Db = Prisma.TransactionClient

const legSide = {
  select: {
    id: true,
    kind: true,
    carrierName: true,
    carrierPhone: true,
    linkToken: true,
    courierId: true,
    tripId: true,
    courier: { select: { userId: true } },
    trip: { select: { driverUserId: true, departAt: true } },
  },
} satisfies Prisma.LegDefaultArgs

const hubSide = {
  select: { id: true, name: true, postcode: true, ownerUserId: true, city: true, lat: true, lng: true, address: true, contactPhone: true, openingHours: true },
} satisfies Prisma.HandoverPointDefaultArgs

/** A handover with exactly what's needed to decide who may confirm it and what to show. */
export const handoverInclude = {
  fromHub: hubSide,
  toHub: hubSide,
  fromLeg: legSide,
  toLeg: legSide,
  parcel: {
    select: {
      id: true,
      number: true,
      description: true,
      weightKg: true,
      status: true,
      lastMile: true,
      destHubId: true,
      originHubId: true,
      createdBy: true,
      senderName: true,
      senderPhone: true,
      recipientName: true,
      recipientPhone: true,
      fromCity: true,
      toCity: true,
      trackToken: true,
      pickupPostcode: true,
      dropPostcode: true,
      firstMile: true,
    },
  },
} satisfies Prisma.HandoverInclude

export type HandoverFull = Prisma.HandoverGetPayload<{ include: typeof handoverInclude }>

export const handoverRepository = {
  createMany(data: Prisma.HandoverCreateManyInput[], db: Db = prisma) {
    return db.handover.createMany({ data })
  },

  findByToken(token: string) {
    return prisma.handover.findUnique({ where: { token }, include: handoverInclude })
  },

  findById(id: string, db: Db = prisma) {
    return db.handover.findUnique({ where: { id }, include: handoverInclude })
  },

  listForParcel(parcelId: string, db: Db = prisma) {
    return db.handover.findMany({ where: { parcelId }, include: handoverInclude, orderBy: { seq: 'asc' } })
  },

  /** READY handovers with this typed code (codes are short, so several parcels can share one). */
  listReadyByCode(code: string) {
    return prisma.handover.findMany({ where: { code, status: 'READY' }, include: handoverInclude })
  },

  /** Mark done only if still READY: a double scan must not act twice. */
  async complete(id: string, doneBy: string, db: Db = prisma) {
    const { count } = await db.handover.updateMany({
      where: { id, status: 'READY' },
      data: { status: 'DONE', doneAt: new Date(), doneBy },
    })
    return count === 1
  },

  setStatus(id: string, status: HandoverStatus, db: Db = prisma) {
    return db.handover.update({ where: { id }, data: { status } })
  },

  recordWrongCode(id: string) {
    return prisma.handover.update({ where: { id }, data: { failedAttempts: { increment: 1 } } })
  },

  /** Handovers touching a centre (in either direction), for its dashboard. */
  listForHub(hubId: string, statuses: HandoverStatus[]) {
    return prisma.handover.findMany({
      where: { status: { in: statuses }, OR: [{ fromHubId: hubId }, { toHubId: hubId }] },
      include: handoverInclude,
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
  },

  /** Handovers touching a carrier's legs, for their job screens. */
  listForLegs(legIds: string[], statuses: HandoverStatus[]) {
    return prisma.handover.findMany({
      where: { status: { in: statuses }, OR: [{ fromLegId: { in: legIds } }, { toLegId: { in: legIds } }] },
      include: handoverInclude,
      orderBy: { seq: 'asc' },
    })
  },

  /** Handovers locked by wrong codes, for staff. */
  listLocked(max: number, take = 20) {
    return prisma.handover.findMany({
      where: { failedAttempts: { gte: max }, status: { in: ['READY', 'WAITING'] } },
      include: handoverInclude,
      take,
    })
  },
}
