/**
 * Carrier jobs: what a driver or courier sees on their link, and the codes they type.
 *
 * Proof rule: whoever RECEIVES the parcel holds the code; the carrier types it in.
 * So a job view never contains a code: the carrier must get it from the person in front of them.
 */
import { prisma } from '~~/server/utils/db'
import { AppError } from '~~/layers/core/server/types/errors'
import { formatRef } from '~~/shared/utils/posta'
import { hubRepository } from '~~/layers/hubs/server/repositories/hub.repository'
import { notificationService, to, type Outgoing } from '~~/layers/notifications/server/services/notification.service'
import { legRepository } from '../repositories/leg.repository'
import { parcelRepository } from '../repositories/parcel.repository'
import { eventRepository } from '../repositories/event.repository'
import { planLegAction, MAX_FAILED_ATTEMPTS } from '../utils/legTransition'
import { lastMileService } from './lastMile.service'
import type { JobActionInput } from '../schemas/job.schema'

// ponytail: support line is a constant until Posta has a real number
const SUPPORT = '0800 000 0000'

const jobNotFound = () => new AppError('JOB_NOT_FOUND', 'This job link is not valid', 404)

export const jobService = {
  async view(linkToken: string) {
    const leg = await legRepository.findByLinkToken(linkToken)
    if (!leg) throw jobNotFound()

    const hubs = await hubRepository.findByPostcodes([leg.fromPostcode, leg.toPostcode])
    const p = leg.parcel
    const place = (postcode: string) => {
      const h = hubs.find((x) => x.postcode === postcode)
      return { kind: 'hub' as const, name: h?.name ?? 'Fulfilment centre', phone: h?.contactPhone ?? null, postcode, city: h?.city ?? p.toCity }
    }
    const sender = { kind: 'person' as const, name: p.senderName, phone: p.senderPhone, postcode: p.pickupPostcode, city: p.fromCity }
    const recipient = { kind: 'person' as const, name: p.recipientName, phone: p.recipientPhone, postcode: p.dropPostcode, city: p.toCity }
    const linehaul = leg.kind === 'LINEHAUL'

    return {
      carrierName: leg.carrierName,
      kind: leg.kind,
      status: leg.status,
      windowStart: leg.windowStart,
      windowEnd: leg.windowEnd,
      collectedAt: leg.collectedAt,
      handedOverAt: leg.handedOverAt,
      attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - leg.failedAttempts),
      parcel: { number: p.number, description: p.description, weightKg: p.weightKg },
      from: linehaul ? sender : place(leg.fromPostcode),
      to: linehaul ? place(leg.toPostcode) : recipient,
    }
  },

  /** The carrier typed a code. Moves the leg and parcel forward, or explains why not. */
  async act(linkToken: string, { action, code }: JobActionInput) {
    const leg = await legRepository.findByLinkToken(linkToken)
    if (!leg) throw jobNotFound()
    const p = leg.parcel
    const ref = formatRef(p.number)

    const plan = planLegAction(leg, action, code)
    if (!plan.ok) {
      if (plan.reason === 'wrong_code') {
        await legRepository.recordWrongCode(leg.id)
        if (plan.attemptsLeft === 0) {
          await notificationService.queue([to.staff('staff.job_locked', { ref, carrier: leg.carrierName }, p.id)])
        }
      }
      const message = {
        locked: `This job is locked after too many wrong codes. Call Posta on ${SUPPORT}.`,
        already_done: 'This step is already done.',
        not_yet: 'Collect the parcel first.',
        wrong_code:
          plan.attemptsLeft === 0
            ? `That code is not right. This job is now locked. Call Posta on ${SUPPORT}.`
            : `That code is not right. ${plan.attemptsLeft} ${plan.attemptsLeft === 1 ? 'try' : 'tries'} left.`,
      }[plan.reason]
      throw new AppError(plan.reason.toUpperCase(), message, 422, 'code')
    }

    const now = new Date()
    const place = await hubRepository.findByPostcode(leg.toPostcode)

    // Who hears about this step.
    const messages: Outgoing[] = []
    if (leg.kind === 'LINEHAUL' && action === 'collect') messages.push(to.user(p.createdBy, 'parcel.collected', { ref }, p.id))
    if (leg.kind === 'LINEHAUL' && action === 'handover') messages.push(to.user(p.createdBy, 'parcel.at_hub', { ref, hub: place?.name ?? leg.toPostcode }, p.id))
    if (leg.kind === 'LASTMILE' && action === 'handover') {
      messages.push(to.user(p.createdBy, 'parcel.delivered', { ref, recipient: p.recipientName }, p.id))
      messages.push(to.whatsapp(p.senderPhone, 'parcel.delivered', { ref, recipient: p.recipientName }, p.id))
    }

    const ids = await prisma.$transaction(async (tx) => {
      // Only move the leg if it is still where we read it. A double tap must not act twice.
      const moved = await legRepository.moveIfStill(
        leg.id,
        leg.status,
        action === 'collect'
          ? { status: plan.legStatus, collectedAt: now }
          : { status: plan.legStatus, handedOverAt: now, handoverPostcode: leg.toPostcode },
        tx,
      )
      if (!moved) throw new AppError('ALREADY_DONE', 'This step is already done.', 409)

      await parcelRepository.setStatus(leg.parcelId, plan.parcelStatus, tx)
      for (const type of plan.events.filter((t) => t !== 'lastmile.created')) {
        const data =
          type === 'handover.completed'
            ? { legSeq: leg.seq, postcode: leg.toPostcode, place: place?.name ?? null, by: leg.carrierName }
            : { legSeq: leg.seq, by: leg.carrierName }
        await eventRepository.record(leg.parcelId, type, data, tx)
      }
      return notificationService.queue(messages, tx)
    })
    void notificationService.send(ids)

    // The driver's part is recorded. Finding a courier is separate: if none is free the parcel
    // simply waits at the centre (staff are told) and is assigned when one is approved.
    if (plan.openLastMile) await lastMileService.assign(leg.parcelId)

    return this.view(linkToken)
  },
}
