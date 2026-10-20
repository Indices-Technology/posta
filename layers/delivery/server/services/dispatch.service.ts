/**
 * Courier dispatch, ride-hailing style: a job is offered to one courier at a time; they accept
 * or decline within OFFER_TTL, then it moves to the next. Courier companies take jobs straight
 * away (their own system dispatches their riders). Travellers are not dispatched: they are
 * matched to parcels by match.service.
 *
 * Explicit imports only (scripts and the sweep task run it too).
 */
import { prisma } from '~~/server/utils/db'
import { AppError } from '~~/layers/core/server/types/errors'
import type { PostaUser } from '~~/layers/core/server/types/user'
import { siteUrl } from '~~/layers/core/server/utils/siteUrl'
import { firstName, formatCode, formatRef } from '~~/shared/utils/posta'
import { cityCentre } from '~~/shared/utils/postcode'
import { courierRepository } from '~~/layers/couriers/server/repositories/courier.repository'
import { offerRepository } from '~~/layers/couriers/server/repositories/offer.repository'
import { rankCouriers } from '~~/layers/couriers/server/utils/ranking'
import { notificationService, to, type Outgoing } from '~~/layers/notifications/server/services/notification.service'
import { eventRepository } from '../repositories/event.repository'
import { refreshReadiness } from './chainState.service'

export const OFFER_TTL_MS = 2 * 60 * 1000

/** A courier leg, with where it starts (for "nearest courier") and its handovers. */
async function loadLeg(legId: string) {
  return prisma.leg.findUnique({
    where: { id: legId },
    include: {
      parcel: true,
      handoversIn: { include: { fromHub: true } },
      handoversOut: { include: { toHub: true } },
    },
  })
}
type LegFull = NonNullable<Awaited<ReturnType<typeof loadLeg>>>

/** Where the job starts: the sender's pin for pickups, otherwise the centre it leaves from. */
function startOf(leg: LegFull) {
  const fromHub = leg.handoversIn[0]?.fromHub
  if (fromHub) return { lat: fromHub.lat, lng: fromHub.lng, city: fromHub.city, name: fromHub.name }
  const p = leg.parcel
  const centre = cityCentre(p.fromCity)
  const lat = p.pickupLat ?? centre?.[1]
  const lng = p.pickupLng ?? centre?.[0]
  return { lat: lat ?? null, lng: lng ?? null, city: p.fromCity, name: p.pickupPostcode }
}

/** Is this a courier leg (not a traveller's) with nobody on it yet? */
const needsCourier = (leg: LegFull) => !leg.carrierName && leg.handoversIn.some((h) => h.toParty === 'COURIER')

export const dispatchService = {
  /** Offer every courier leg of a parcel that is due a courier now. Safe to call any time. */
  async forParcel(parcelId: string) {
    const legs = await prisma.leg.findMany({ where: { parcelId }, select: { id: true } })
    for (const l of legs) await this.offerNext(l.id)
  },

  /**
   * Offer one leg to the next courier in line, unless it already has one or an offer is open.
   * Pickups are offered straight away; later legs only once the parcel is about to need them
   * (their incoming handover is the next one in the chain).
   */
  async offerNext(legId: string) {
    const leg = await loadLeg(legId)
    if (!leg || !needsCourier(leg) || (await offerRepository.hasOpen(leg.id))) return null

    const incoming = leg.handoversIn[0]
    const prior = await prisma.handover.count({ where: { parcelId: leg.parcelId, seq: { lt: incoming?.seq ?? 0 }, status: { not: 'DONE' } } })
    if (leg.kind !== 'FIRST_MILE' && prior > 0) return null // not due yet

    const start = startOf(leg)
    const available = await courierRepository.listAvailable(start.city)
    const point = start.lat != null && start.lng != null ? { lat: start.lat, lng: start.lng } : null
    const preferredId = leg.kind === 'FIRST_MILE' ? leg.parcel.preferredCourierId : null
    const asked = await offerRepository.courierIdsAsked(leg.id)
    // Everyone asked once: go round again, skipping only those who said no.
    const [next] =
      rankCouriers(available, point, { preferredId, exclude: asked }).concat(
        rankCouriers(available, point, { preferredId, exclude: await offerRepository.courierIdsAsked(leg.id, true) }),
      )

    if (!next) {
      // Nobody free: staff are told once; the job is offered again when a courier switches on.
      if (!asked.length) {
        await eventRepository.record(leg.parcelId, 'courier.waiting', { legId: leg.id, city: start.city })
        await notificationService.queue([
          to.staff('staff.no_courier', { ref: formatRef(leg.parcel.number), hub: start.name, city: start.city }, leg.parcelId),
        ])
      }
      return null
    }

    if (next.kind === 'COMPANY') return this.assign(leg.id, next.id)

    const offer = await offerRepository.create({ legId: leg.id, courierId: next.id, expiresAt: new Date(Date.now() + OFFER_TTL_MS) })
    const ids = await notificationService.queue([
      to.user(next.userId, 'offer.new', { ref: formatRef(leg.parcel.number), from: start.name, link: `${siteUrl()}/courier` }, leg.parcelId),
      to.whatsapp(next.phone, 'offer.new', { carrier: firstName(next.name), ref: formatRef(leg.parcel.number), from: start.name, link: `${siteUrl()}/courier` }, leg.parcelId),
    ])
    void notificationService.send(ids)
    return offer
  },

  /** Put a courier on a leg, and tell everyone who needs to know. */
  async assign(legId: string, courierId: string) {
    const courier = await courierRepository.findById(courierId)
    const leg = await loadLeg(legId)
    if (!courier || !leg) return null
    const p = leg.parcel
    const ref = formatRef(p.number)
    const link = `${siteUrl()}/l/${leg.linkToken}`
    const start = startOf(leg)
    const job = { carrier: firstName(courier.name), ref, from: start.name, to: leg.kind === 'LASTMILE' ? p.toCity : (leg.handoversOut[0]?.toHub?.name ?? p.toCity), link }

    const ids = await prisma.$transaction(async (tx) => {
      const { count } = await tx.leg.updateMany({
        where: { id: leg.id, carrierName: null },
        data: { courierId: courier.id, carrierName: courier.name, carrierPhone: courier.phone, windowStart: new Date(), windowEnd: new Date(Date.now() + 6 * 3_600_000) },
      })
      if (count === 0) return null // someone else got it first
      await refreshReadiness(p.id, tx)
      await eventRepository.record(p.id, 'courier.assigned', { legId: leg.id, kind: leg.kind, courier: courier.name }, tx)

      const messages: Outgoing[] = [to.user(courier.userId, 'job.assigned', job, p.id)]
      if (courier.kind === 'COMPANY' && courier.webhookUrl) {
        messages.push(to.company(courier.id, 'job.assigned', { ...job, job: { ref, contents: p.description, weightKg: p.weightKg, collectFrom: start.name, link } }, p.id))
      } else {
        messages.push(to.whatsapp(courier.phone, 'job.assigned', job, p.id))
      }
      if (leg.kind === 'FIRST_MILE') messages.push(to.user(p.createdBy, 'offer.taken', { carrier: firstName(courier.name), ref }, p.id))
      if (leg.kind === 'LASTMILE') {
        const doorStep = await tx.handover.findFirst({ where: { fromLegId: leg.id, toParty: 'RECIPIENT' } })
        messages.push(
          to.whatsapp(p.recipientPhone, 'tracking.sent', {
            recipient: firstName(p.recipientName),
            fromCity: p.fromCity,
            code: doorStep ? formatCode(doorStep.code) : '',
            link: `${siteUrl()}/t/${p.trackToken}`,
          }, p.id),
        )
      }
      return notificationService.queue(messages, tx)
    })
    if (ids) void notificationService.send(ids)
    return ids ? leg : null
  },

  async accept(offerId: string, user: PostaUser) {
    const offer = await offerRepository.findById(offerId)
    if (!offer || offer.courier.userId !== user.id) throw new AppError('NOT_FOUND', 'Offer not found', 404)
    if (!(await offerRepository.answer(offer.id, 'ACCEPTED'))) throw new AppError('OFFER_GONE', 'This offer has expired or was taken.', 409)
    await offerRepository.cancelOthers(offer.legId, offer.id)
    const leg = await this.assign(offer.legId, offer.courierId)
    if (!leg) throw new AppError('OFFER_GONE', 'Another courier already took this job.', 409)
    return { legId: offer.legId, linkToken: leg.linkToken }
  },

  async decline(offerId: string, user: PostaUser) {
    const offer = await offerRepository.findById(offerId)
    if (!offer || offer.courier.userId !== user.id) throw new AppError('NOT_FOUND', 'Offer not found', 404)
    await offerRepository.answer(offer.id, 'DECLINED')
    await this.offerNext(offer.legId)
    return null
  },

  /** For the sweep task: expire unanswered offers and move each job to the next courier. */
  async expireDue() {
    const due = await offerRepository.expireDue()
    for (const o of due) await this.offerNext(o.legId)
    return due.length
  },

  /** A courier just became available: offer them any job in their city still waiting for someone. */
  async retryWaiting(city: string) {
    const legs = await prisma.leg.findMany({
      where: {
        carrierName: null,
        parcel: { status: { not: 'DELIVERED' } },
        handoversIn: { some: { toParty: 'COURIER' } },
        OR: [{ parcel: { fromCity: { equals: city, mode: 'insensitive' } } }, { parcel: { toCity: { equals: city, mode: 'insensitive' } } }],
      },
      select: { id: true },
    })
    for (const l of legs) await this.offerNext(l.id)
  },
}
