import type { PostaUser } from '~~/layers/core/server/types/user'
import { AppError } from '~~/layers/core/server/types/errors'
import type { ReviewInput } from '~~/layers/core/server/schemas/common.schema'
import { notificationService, to } from '~~/layers/notifications/server/services/notification.service'
import { newWebhookSecret } from '~~/layers/notifications/server/utils/channels/webhook'
import { dispatchService } from '~~/layers/delivery/server/services/dispatch.service'
import { centresNear } from '~~/layers/delivery/server/services/booking.service'
import { offerRepository } from '../repositories/offer.repository'
import { rankCouriers, roughKm } from '../utils/ranking'
import { km } from '~~/layers/delivery/server/utils/matching'
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
    // Jobs in this city may be waiting for exactly this courier (companies take them straight away;
    // people get offers once they switch on "I'm available").
    if (decision === 'APPROVED') await dispatchService.retryWaiting(courier.city)
    return { id, status: decision, assigned: 0 }
  },

  /** The courier dashboard: am I available, offers to answer, and jobs in progress. */
  async dashboard(user: PostaUser) {
    // Hosts without a background job (Vercel) still move unanswered offers on: do it on every look.
    await dispatchService.expireDue()
    const couriers = await courierRepository.listForUserWithJobs(user.id)
    const approved = couriers.filter((c) => c.status === 'APPROVED')
    const offers = await offerRepository.listOpenForCourier(approved.map((c) => c.id))
    const now = Date.now()
    return {
      profiles: couriers.map((c) => ({
        id: c.id,
        kind: c.kind,
        name: c.name,
        city: c.city,
        vehicle: c.vehicle,
        status: c.status,
        available: !!c.availableUntil && c.availableUntil.getTime() > now,
        availableUntil: c.availableUntil,
      })),
      offers: offers.map((o) => ({
        id: o.id,
        ref: formatRef(o.leg.parcel.number),
        contents: o.leg.parcel.description,
        weightKg: o.leg.parcel.weightKg,
        kind: o.leg.kind,
        from: o.leg.fromPostcode,
        to: o.leg.toPostcode,
        expiresAt: o.expiresAt,
      })),
      jobs: approved.flatMap((c) =>
        c.legs.map((l) => ({
          legId: l.id,
          linkToken: l.linkToken,
          kind: l.kind,
          status: l.status,
          ref: formatRef(l.parcel.number),
          contents: l.parcel.description,
          by: l.windowEnd,
        })),
      ),
    }
  },

  /**
   * The "I'm available" switch. On: taking jobs for the next 8 hours, from where the phone is now.
   * Switching on also offers any job in the city that was waiting for a free courier.
   */
  async setAvailability(user: PostaUser, input: { on: boolean; lat?: number | null; lng?: number | null }) {
    const couriers = (await courierRepository.listForUserWithJobs(user.id)).filter((c) => c.status === 'APPROVED' && c.kind === 'INDIVIDUAL')
    if (!couriers.length) throw new AppError('NOT_A_COURIER', 'Only approved couriers can take jobs.', 403)
    const until = input.on ? new Date(Date.now() + 8 * 3_600_000) : null
    for (const c of couriers) {
      await courierRepository.setAvailability(c.id, { availableUntil: until, lastLat: input.lat ?? c.lastLat, lastLng: input.lng ?? c.lastLng })
      if (input.on) await dispatchService.retryWaiting(c.city)
    }
    return { available: input.on, until }
  },

  /**
   * Couriers a sender can pick for a pickup: available now, nearest first. Senders see a first name,
   * the vehicle and a rounded distance, never where a courier actually is.
   */
  async near(lat: number, lng: number) {
    const [centre] = await centresNear(lat, lng, { limit: 1 })
    if (!centre) return []
    const ranked = rankCouriers((await courierRepository.listAvailable(centre.city)).filter((c) => c.kind === 'INDIVIDUAL'), { lat, lng })
    return ranked.slice(0, 8).map((c) => ({
      id: c.id,
      firstName: c.name.split(' ')[0],
      vehicle: c.vehicle,
      distanceKm: c.lastLat != null && c.lastLng != null ? roughKm(km(lat, lng, c.lastLat, c.lastLng)) : null,
    }))
  },
}
