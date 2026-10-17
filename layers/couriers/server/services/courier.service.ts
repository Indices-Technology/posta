import type { PostaUser } from '~~/layers/core/server/types/user'
import { AppError } from '~~/layers/core/server/types/errors'
import type { ReviewInput } from '~~/layers/core/server/schemas/common.schema'
import { notificationService, to } from '~~/layers/notifications/server/services/notification.service'
import { newWebhookSecret } from '~~/layers/notifications/server/utils/channels/webhook'
import { lastMileService } from '~~/layers/delivery/server/services/lastMile.service'
import { courierRepository } from '../repositories/courier.repository'
import type { ApplyCourierInput } from '../schemas/courier.schema'

const what = (kind: string) => (kind === 'COMPANY' ? 'courier company' : 'courier')

export const courierService = {
  /**
   * Apply as a courier (a person) or register a courier company. One of each per MarketX account.
   * A rejected applicant may apply again; a pending or approved one may not.
   */
  async apply(user: PostaUser, input: ApplyCourierInput) {
    const existing = await courierRepository.findByUserAndKind(user.id, input.kind)
    if (existing && existing.status !== 'REJECTED') {
      throw new AppError(
        'ALREADY_APPLIED',
        existing.status === 'APPROVED' ? 'You are already approved.' : 'You already applied. We will let you know.',
        409,
      )
    }

    const data = {
      name: input.name,
      phone: input.phone,
      city: input.city,
      vehicle: input.kind === 'INDIVIDUAL' ? input.vehicle : null,
      webhookUrl: input.kind === 'COMPANY' ? (input.webhookUrl ?? null) : null,
      // The company verifies our webhooks with this. Kept if they re-apply, so their system keeps working.
      webhookSecret: input.kind === 'COMPANY' && input.webhookUrl ? (existing?.webhookSecret ?? newWebhookSecret()) : null,
      status: 'PENDING' as const,
      reviewedBy: null,
      reviewedAt: null,
    }
    // ponytail: webhookSecret is stored as-is (we must sign with it); encrypt at rest if companies become self-serve.
    const courier = existing
      ? await courierRepository.update(existing.id, data)
      : await courierRepository.create({ ...data, kind: input.kind, userId: user.id })

    await notificationService.queue([to.staff('staff.application', { what: what(courier.kind), name: courier.name, city: courier.city })])
    return { id: courier.id, status: courier.status }
  },

  /** My courier profiles with their open jobs. The webhook secret is shown only to its owner. */
  async mine(user: PostaUser) {
    const couriers = await courierRepository.listForUserWithJobs(user.id)
    return couriers.map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      city: c.city,
      vehicle: c.vehicle,
      status: c.status,
      webhookUrl: c.webhookUrl,
      webhookSecret: c.webhookSecret,
      jobs: c.legs.map((l) => ({
        legId: l.id,
        status: l.status,
        linkToken: l.linkToken,
        ref: formatRef(l.parcel.number),
        contents: l.parcel.description,
        weightKg: l.parcel.weightKg,
        toPostcode: l.toPostcode,
        by: l.windowEnd,
      })),
    }))
  },

  listPending() {
    return courierRepository.listPending()
  },

  async review(user: PostaUser, id: string, { decision }: ReviewInput) {
    requireOps(user)
    const courier = await courierRepository.findById(id)
    if (!courier) throw new AppError('NOT_FOUND', 'Courier not found', 404)
    if (!(await courierRepository.review(id, decision, user.id))) {
      throw new AppError('ALREADY_REVIEWED', 'This application was already decided', 409)
    }
    await notificationService.queue([
      to.user(courier.userId, 'partner.reviewed', { what: what(courier.kind), decision: decision === 'APPROVED' ? 'approved' : 'not approved' }),
    ])
    // Parcels may be waiting at a centre in this city for exactly this courier.
    const assigned = decision === 'APPROVED' ? await lastMileService.assignWaiting(courier.city) : 0
    return { id, status: decision, assigned }
  },
}
