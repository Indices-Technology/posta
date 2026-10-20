import type { PostaUser } from '~~/layers/core/server/types/user'
import { courierRepository } from '~~/layers/couriers/server/repositories/courier.repository'
import { hubRepository } from '~~/layers/hubs/server/repositories/hub.repository'
import { dispatchService } from '~~/layers/delivery/server/services/dispatch.service'
import { prisma } from '~~/server/utils/db'
import { adminRepository } from '../repositories/admin.repository'

export const adminService = {
  async overview(user: PostaUser) {
    requireOps(user)
    const [byStatus, late, locked, parcels, pendingCouriers, pendingCentres, noCourier] = await Promise.all([
      adminRepository.countByStatus(),
      adminRepository.listLateLegs(new Date()),
      adminRepository.listLockedHandovers(),
      adminRepository.listParcels(),
      courierRepository.listPending(),
      hubRepository.listPending(),
      adminRepository.countWaitingForCourier(),
    ])
    const count = (...statuses: string[]) =>
      byStatus.filter((b) => statuses.includes(b.status)).reduce((n, b) => n + b._count._all, 0)

    return {
      figures: {
        waiting: count('NEW'),
        moving: count('MATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'),
        atHub: count('AT_HUB'),
        delivered: count('DELIVERED'),
      },
      attention: [
        ...locked.map((h) => ({ kind: 'locked' as const, legId: h.id, parcel: h.parcel, carrier: `${h.fromParty.toLowerCase()} to ${h.toParty.toLowerCase()}`, since: null })),
        ...late.map((l) => ({ kind: 'late' as const, legId: l.id, parcel: l.parcel, carrier: l.carrierName, since: l.windowEnd })),
      ],
      /** Parcels at a centre with no courier yet. */
      waitingForCourier: noCourier,
      applications: [
        ...pendingCouriers.map((c) => ({
          type: 'courier' as const,
          id: c.id,
          kind: c.kind,
          name: c.name,
          city: c.city,
          phone: c.phone,
          detail: c.kind === 'COMPANY' ? (c.webhookUrl ? 'Company, with system integration' : 'Company') : (c.vehicle ?? ''),
          at: c.createdAt,
        })),
        ...pendingCentres.map((h) => ({
          type: 'centre' as const,
          id: h.id,
          kind: 'CENTRE' as const,
          name: h.name,
          city: h.city,
          phone: h.contactPhone,
          detail: `${h.address} · ${h.postcode}${h.openingHours ? ` · ${h.openingHours}` : ''}`,
          at: h.createdAt,
        })),
      ].sort((a, b) => a.at.getTime() - b.at.getTime()),
      parcels,
    }
  },

  /** Try again to find couriers for every job still waiting for one. */
  async assignCouriers(user: PostaUser) {
    requireOps(user)
    const cities = await prisma.handoverPoint.findMany({ where: { status: 'APPROVED' }, distinct: ['city'], select: { city: true } })
    for (const c of cities) await dispatchService.retryWaiting(c.city)
    return { assigned: 0 }
  },
}
