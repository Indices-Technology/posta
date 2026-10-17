/**
 * The last stretch: when a parcel reaches a fulfilment centre, give it to the least busy approved
 * courier in that city. No courier yet? The parcel waits at the centre, staff are told, and
 * assignWaiting() picks it up the moment a courier in that city is approved.
 *
 * Explicit imports only (scripts and tasks run it too).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'
import { siteUrl } from '~~/layers/core/server/utils/siteUrl'
import { firstName, formatCode, formatRef } from '~~/shared/utils/posta'
import { hubRepository } from '~~/layers/hubs/server/repositories/hub.repository'
import { courierRepository } from '~~/layers/couriers/server/repositories/courier.repository'
import { notificationService, to } from '~~/layers/notifications/server/services/notification.service'
import { parcelRepository } from '../repositories/parcel.repository'
import { legRepository } from '../repositories/leg.repository'
import { eventRepository } from '../repositories/event.repository'
import { newCode, newLinkToken } from '../utils/codes'

const LAST_MILE_WINDOW_MS = 6 * 60 * 60 * 1000

export const lastMileService = {
  /** Assign a courier to one parcel at a centre. Returns the new leg, or null if it must wait. */
  async assign(parcelId: string) {
    const parcel = await parcelRepository.findWithJourney(parcelId, {})
    if (!parcel || parcel.status !== 'AT_HUB' || parcel.legs.some((l) => l.seq === 2)) return null

    const leg1 = parcel.legs.find((l) => l.seq === 1)!
    const hub = await hubRepository.findByPostcode(leg1.toPostcode)
    const ref = formatRef(parcel.number)
    const hubName = hub?.name ?? leg1.toPostcode

    const courier = await courierRepository.findLeastBusy(parcel.toCity)
    if (!courier) {
      await eventRepository.record(parcel.id, 'lastmile.waiting', { city: parcel.toCity })
      await notificationService.queue([to.staff('staff.no_courier', { ref, hub: hubName, city: parcel.toCity }, parcel.id)])
      return null
    }

    const now = new Date()
    try {
      const { leg, ids } = await prisma.$transaction(async (tx) => {
        const leg = await legRepository.create(
          {
            parcelId: parcel.id,
            seq: 2,
            kind: 'LASTMILE',
            courierId: courier.id,
            carrierName: courier.name,
            carrierPhone: courier.phone,
            fromPostcode: leg1.toPostcode,
            toPostcode: parcel.dropPostcode,
            windowStart: now,
            windowEnd: new Date(now.getTime() + LAST_MILE_WINDOW_MS),
            collectCode: newCode(),
            handoverCode: newCode(),
            linkToken: newLinkToken(),
          },
          tx,
        )
        await eventRepository.record(parcel.id, 'lastmile.created', { legId: leg.id, courier: courier.name }, tx)

        const link = `${siteUrl()}/l/${leg.linkToken}`
        const job = { carrier: firstName(courier.name), ref, from: hubName, to: parcel.toCity, link }
        const ids = await notificationService.queue(
          [
            // Companies with a system get a signed webhook (their riders use the same link and codes);
            // everyone else gets WhatsApp.
            courier.kind === 'COMPANY' && courier.webhookUrl
              ? to.company(courier.id, 'job.assigned', {
                  ...job,
                  job: {
                    ref,
                    contents: parcel.description,
                    weightKg: parcel.weightKg,
                    collectFrom: { name: hubName, postcode: leg1.toPostcode, phone: hub?.contactPhone ?? null },
                    deliverTo: { name: parcel.recipientName, postcode: parcel.dropPostcode, phone: parcel.recipientPhone },
                    by: leg.windowEnd,
                    link,
                  },
                }, parcel.id)
              : to.whatsapp(courier.phone, 'job.assigned', job, parcel.id),
            to.user(courier.userId, 'job.assigned', job, parcel.id),
            // The recipient gets their tracking link and the code they will give the courier.
            to.whatsapp(parcel.recipientPhone, 'tracking.sent', {
              recipient: firstName(parcel.recipientName),
              fromCity: parcel.fromCity,
              code: formatCode(leg.handoverCode),
              link: `${siteUrl()}/t/${parcel.trackToken}`,
            }, parcel.id),
          ],
          tx,
        )
        return { leg, ids }
      })
      void notificationService.send(ids)
      return leg
    } catch (error) {
      // Two assignments raced for the same parcel: the (parcelId, seq) unique key let one win.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null
      throw error
    }
  },

  /** Give every parcel waiting at a centre (optionally in one city) to a courier, if one is free. */
  async assignWaiting(city?: string) {
    const waiting = await parcelRepository.listAtHubWithoutCourier(city)
    let assigned = 0
    for (const p of waiting) if (await this.assign(p.id)) assigned++
    return assigned
  },
}
