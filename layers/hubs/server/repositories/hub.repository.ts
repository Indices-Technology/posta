/** All database access for fulfilment centres (HandoverPoint). Only APPROVED ones receive parcels. */
import type { PartnerStatus, Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'

const byPlace = [{ city: 'asc' as const }, { name: 'asc' as const }]

export const hubRepository = {
  /** Every centre, any status (staff). */
  listAll() {
    return prisma.handoverPoint.findMany({ orderBy: byPlace })
  },

  /** Centres that can receive parcels. Matching uses only these. */
  listApproved() {
    return prisma.handoverPoint.findMany({ where: { status: 'APPROVED' }, orderBy: byPlace })
  },

  /** Cities with at least one approved centre: the only places parcels can be sent to. */
  async listCities() {
    const rows = await prisma.handoverPoint.findMany({
      where: { status: 'APPROVED' },
      distinct: ['city'],
      select: { city: true },
      orderBy: { city: 'asc' },
    })
    return rows.map((r) => r.city)
  },

  listPending() {
    return prisma.handoverPoint.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } })
  },

  listOwnedBy(userId: string) {
    return prisma.handoverPoint.findMany({ where: { ownerUserId: userId }, orderBy: { createdAt: 'desc' } })
  },

  findById(id: string) {
    return prisma.handoverPoint.findUnique({ where: { id } })
  },

  findByPostcode(postcode: string) {
    return prisma.handoverPoint.findFirst({ where: { postcode } })
  },

  findByPostcodes(postcodes: string[]) {
    return prisma.handoverPoint.findMany({ where: { postcode: { in: postcodes } } })
  },

  create(data: Prisma.HandoverPointUncheckedCreateInput) {
    return prisma.handoverPoint.create({ data })
  },

  /** Decide an application. False if it was already decided. */
  async review(id: string, status: PartnerStatus, reviewedBy: string) {
    const { count } = await prisma.handoverPoint.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, reviewedBy, reviewedAt: new Date() },
    })
    return count === 1
  },
}
