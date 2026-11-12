/**
 * Shipments booked by platform clients (MarketX first). See docs/INTEGRATIONS.md §7.
 *
 *   book      client sends a paid order → Posta books the carrier → returns a PST- code
 *   track     every 15 min Posta reads GIG scans for shipments on the road
 *   status    a new status → saved and a signed `shipment.updated` webhook to the client,
 *             written in the same transaction (outbox), retried by notifications:flush
 *
 * Posta reports facts; the client decides about money (MarketX releases escrow on DELIVERED).
 * Explicit imports only, so the scheduled task can use it outside a request.
 */
import { randomBytes } from 'node:crypto'
import type { Prisma, Shipment } from '@prisma/client'
import { prisma } from '~~/server/utils/db'
import { logger } from '~~/server/utils/logger'
import { AppError } from '~~/layers/core/server/types/errors'
import { notificationService, to } from '~~/layers/notifications/server/services/notification.service'
import { gigProvider, bookGigDropoff, type GigDropoffCentre } from '../carriers/gig'
import { listServiceCentresForState } from '../carriers/gig/stations'
import type { BookRequest, TrackingStatus } from '../carriers/types'
import type { BookInput } from '../schemas/shipment.schema'
import { BOOKING, moves, TERMINAL } from '../utils/shipmentStatus'

// No 0/O, 1/I/L or U: readable over the phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const newCode = () => `PST-${Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('')}`

/** What a client sees, in API answers and webhooks. No names, phones or addresses. */
export const viewOf = (s: Shipment) => ({
  code: s.code,
  clientRef: s.clientRef,
  carrierId: s.carrierId,
  mode: s.mode.toLowerCase(),
  waybill: s.waybill,
  tempCode: s.tempCode,
  dropoffCentre: s.dropoffCentre as GigDropoffCentre | null,
  labelUrl: s.labelUrl,
  status: s.status,
  statusAt: s.statusAt,
})

async function mine(client: string, code: string) {
  const s = await prisma.shipment.findUnique({ where: { code } })
  // Another client's shipment answers exactly like a missing one.
  if (!s || s.client !== client) throw new AppError('SHIPMENT_NOT_FOUND', 'No such shipment', 404)
  return s
}

async function chosenCentre(input: BookInput): Promise<GigDropoffCentre | null> {
  if (!input.dropoffCentreId) return null
  const centres = await listServiceCentresForState(input.origin.state, input.origin.lat, input.origin.lng)
  const c = centres.find((x) => x.ServiceCentreId === input.dropoffCentreId)
  return c ? { id: c.ServiceCentreId, name: c.ServiceCentreName, code: c.ServiceCentreCode, address: c.Address } : null
}

export const shipmentService = {
  /**
   * Book once per (client, clientRef). The row is written BEFORE calling the carrier, so the
   * unique key stops a double-submit from booking (and paying for) two real parcels.
   */
  async book(client: string, input: BookInput) {
    const existing = await prisma.shipment.findUnique({ where: { client_clientRef: { client, clientRef: input.clientRef } } })
    if (existing) return answerExisting(existing)

    let row: Shipment
    try {
      row = await prisma.shipment.create({
        data: {
          code: newCode(),
          client,
          clientRef: input.clientRef,
          carrierId: input.carrierId,
          mode: input.mode.toUpperCase(),
          status: BOOKING,
          origin: input.origin as Prisma.InputJsonValue,
          destination: input.destination as Prisma.InputJsonValue,
          weightKg: input.parcel.weightKg,
          declaredValueMinor: input.declaredValueMinor,
          settlementMode: input.settlementMode,
        },
      })
    } catch (error) {
      // Lost a race with an identical request: answer with the winner's shipment.
      if ((error as { code?: string }).code !== 'P2002') throw error
      return answerExisting(await prisma.shipment.findUniqueOrThrow({ where: { client_clientRef: { client, clientRef: input.clientRef } } }))
    }

    const req: BookRequest = {
      request: {
        origin: input.origin,
        destination: input.destination,
        items: [{ qty: 1, unitWeightKg: input.parcel.weightKg }],
        parcel: input.parcel,
        declaredValueMinor: input.declaredValueMinor,
        currency: 'NGN',
      },
      carrierId: input.carrierId,
      serviceLevel: 'standard',
      orderRef: `${client}:${input.clientRef}`,
      settlementMode: input.settlementMode,
    }

    try {
      const booked =
        input.mode === 'dropoff'
          ? await bookGigDropoff(req, await chosenCentre(input)).then((r) => ({
              tempCode: r.tempCode,
              dropoffCentre: (r.dropoffCentre ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
            }))
          : await gigProvider.book!(req).then((r) => ({ waybill: r.trackingNumber, labelUrl: r.labelUrl ?? null }))
      row = await prisma.shipment.update({ where: { id: row.id }, data: { ...booked, status: 'PRE_TRANSIT', statusAt: new Date() } })
    } catch (error) {
      // Nothing was booked: free the clientRef so the client can try again.
      await prisma.shipment.delete({ where: { id: row.id } }).catch(() => {})
      logger.warn('[shipments] carrier booking failed', { client, clientRef: input.clientRef, error: (error as Error).message })
      throw new AppError('CARRIER_BOOKING_FAILED', 'The carrier did not accept the booking. Try again shortly.', 502)
    }

    logger.info('[shipments] booked', { client, code: row.code, carrierId: row.carrierId, mode: row.mode })
    return { ...viewOf(row), alreadyBooked: false }
  },

  async get(client: string, code: string) {
    return viewOf(await mine(client, code))
  },

  /** Drop-off: the sender handed the parcel in and got a waybill. Tracking starts from here. */
  async setWaybill(client: string, code: string, waybill: string) {
    const s = await mine(client, code)
    if (s.waybill === waybill) return viewOf(s)
    if (s.waybill) throw new AppError('WAYBILL_SET', `This shipment already has waybill ${s.waybill}`, 409)
    if (s.mode !== 'DROPOFF') throw new AppError('NOT_DROPOFF', 'Only drop-off shipments take a waybill later', 409)
    return viewOf(await prisma.shipment.update({ where: { id: s.id }, data: { waybill } }))
  },

  /**
   * Record a carrier status and tell the client. Only forward moves count, so a late or repeated
   * scan changes nothing. The webhook row is written in the same transaction as the status.
   */
  async applyStatus(s: Shipment, next: TrackingStatus) {
    if (!moves(s.status, next)) return false
    const ids = await prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({ where: { id: s.id }, data: { status: next, statusAt: new Date() } })
      return notificationService.queue([to.client(s.client, 'shipment.updated', viewOf(updated))], tx)
    })
    await notificationService.send(ids)
    logger.info('[shipments] status', { code: s.code, from: s.status, to: next })
    return true
  },

  /** For the scheduled task: read the carrier for every shipment still on the road. */
  async trackDue(limit = 200) {
    const due = await prisma.shipment.findMany({
      where: { waybill: { not: null }, carrierId: 'gig', status: { notIn: [...TERMINAL, BOOKING] } },
      orderBy: { statusAt: 'asc' },
      take: limit,
    })
    let changed = 0
    for (const s of due) {
      try {
        const t = await gigProvider.track!(s.waybill!)
        if (await this.applyStatus(s, t.currentStatus)) changed++
      } catch (error) {
        logger.warn('[shipments] tracking failed', { code: s.code, error: (error as Error).message })
      }
    }
    return { checked: due.length, changed }
  },

  /** Staging only (POSTA_ALLOW_SIMULATE=true): pretend the carrier scanned, to test the client end to end. */
  async simulate(client: string, code: string, status: TrackingStatus) {
    if (process.env.POSTA_ALLOW_SIMULATE !== 'true') throw new AppError('NOT_ALLOWED', 'Simulated scans are off here', 403)
    const s = await mine(client, code)
    await this.applyStatus(s, status)
    return viewOf(await mine(client, code))
  },
}

function answerExisting(s: Shipment) {
  // ponytail: a row stuck in BOOKING means a crash between reserving and booking; staff must
  // check GIG by hand. Add a sweeper if it ever happens.
  if (s.status === BOOKING) throw new AppError('BOOKING_IN_PROGRESS', 'This order is being booked. Try again in a minute.', 409)
  return { ...viewOf(s), alreadyBooked: true }
}
