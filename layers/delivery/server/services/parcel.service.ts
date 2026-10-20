import type { PostaUser } from '~~/layers/core/server/types/user'
import { notFound } from '~~/layers/core/server/types/errors'
import { hubRepository } from '~~/layers/hubs/server/repositories/hub.repository'
import { parcelRepository } from '../repositories/parcel.repository'
import { eventRepository } from '../repositories/event.repository'
import { matchService } from './match.service'
import type { CreateParcelInput } from '../schemas/parcel.schema'
import { buildJourney } from '../utils/journey'

export const parcelService = {
  async create(user: PostaUser, { valueNaira, ...input }: CreateParcelInput) {
    await assertPostcodesExist({ pickupPostcode: input.pickupPostcode, dropPostcode: input.dropPostcode })

    const parcel = await parcelRepository.create({ ...input, valueKobo: valueNaira * 100, createdBy: user.id })
    await eventRepository.record(parcel.id, 'parcel.created')

    // Matching failing must not lose the parcel: it stays waiting and the next trip or parcel retries.
    await matchService.run().catch((error) => logger.logError('[match] after parcel create', error, { parcelId: parcel.id }))
    return { id: parcel.id }
  },

  /**
   * My parcels in plain words, newest first: what Axioms (and so Dasah) reads.
   * No codes, no carrier phone numbers: an assistant answering "where is my parcel" needs neither.
   */
  async listForUser(user: PostaUser, number?: number) {
    const parcels = await parcelRepository.listCreatedBy(user.id, 30, number)
    return parcels.map((p) => ({
      id: p.id,
      number: p.number,
      ref: formatRef(p.number),
      status: p.status,
      statusText: PARCEL_STATUS[p.status].label,
      from: p.fromCity,
      to: p.toCity,
      recipient: p.recipientName,
      contents: p.description,
    }))
  },

  /** The parcel page. Who sees which code is decided here, not on the page. */
  async getForUser(user: PostaUser, id: string) {
    const parcel = await parcelRepository.findWithJourney(id, ownerScope(user))
    if (!parcel) throw notFound('Parcel')

    const hubs = await hubRepository.findByPostcodes(parcel.legs.flatMap((l) => [l.fromPostcode, l.toPostcode]))
    const placeName = (pc: string) => hubs.find((h) => h.postcode === pc)?.name ?? null

    // Senders see their own pickup code and the recipient's. Hub codes are staff-only, so a
    // sender and a driver can't fake a handover between them.
    const ops = isOps(user)
    const [l1, l2] = parcel.legs
    const codes = [
      l1 && { holder: 'Sender', use: 'Gives it to the driver at pickup', code: l1.collectCode },
      l1 && ops && { holder: 'Handover point', use: 'Gives it to the driver on arrival', code: l1.handoverCode },
      l2 && ops && { holder: 'Handover point', use: 'Gives it to the courier', code: l2.collectCode },
      l2 && { holder: 'Recipient', use: 'Gives it to the courier on delivery', code: l2.handoverCode },
    ].filter((c): c is { holder: string; use: string; code: string } => !!c)

    const { legs, events, ...rest } = parcel
    const onRoute = l1 ? hubs.find((h) => h.postcode === l1.toPostcode) : undefined
    return {
      parcel: rest,
      journey: buildJourney({ ...rest, hub: onRoute ?? null }, 'owner'),
      legs: legs.map((l) => ({
        id: l.id,
        seq: l.seq,
        kind: l.kind,
        status: l.status,
        carrierName: l.carrierName,
        carrierPhone: l.carrierPhone,
        fromPostcode: l.fromPostcode,
        fromPlace: placeName(l.fromPostcode),
        toPostcode: l.toPostcode,
        toPlace: placeName(l.toPostcode),
        windowStart: l.windowStart,
        windowEnd: l.windowEnd,
        collectedAt: l.collectedAt,
        handedOverAt: l.handedOverAt,
        // The job link plus the sender's own code would let a sender mark "collected" without
        // the driver. Drivers get their links from their trip; staff see all.
        linkToken: ops ? l.linkToken : null,
        locked: l.failedAttempts >= 5,
        trip: l.trip,
      })),
      codes,
      events: events.map((e) => ({ id: e.id, type: e.type, data: e.data as Record<string, unknown>, at: e.at })),
    }
  },

  /** The recipient's public tracking page. Shows their delivery code only while the courier has the parcel. */
  async getTracking(trackToken: string) {
    const parcel = await parcelRepository.findByTrackToken(trackToken)
    if (!parcel) throw notFound('Tracking link')

    const lastMile = parcel.legs.find((l) => l.kind === 'LASTMILE')
    const leg1 = parcel.legs.find((l) => l.kind === 'LINEHAUL')
    const hub = leg1 ? await hubRepository.findByPostcode(leg1.toPostcode) : null
    const pending = lastMile && lastMile.status !== 'HANDED_OVER'
    return {
      number: parcel.number,
      status: parcel.status,
      fromCity: parcel.fromCity,
      toCity: parcel.toCity,
      journey: buildJourney({ ...parcel, hub }, 'public'),
      recipientFirstName: parcel.recipientName.split(' ')[0],
      deliveryCode: pending ? lastMile.handoverCode : null,
      courier: pending ? { name: lastMile.carrierName, phone: lastMile.carrierPhone } : null,
      // Public wording hides who carried it.
      events: parcel.events
        .map((e) => ({ id: e.id, at: e.at, text: eventText(e.type, e.data as Record<string, any>, true) }))
        .filter((e): e is typeof e & { text: string } => !!e.text),
    }
  },
}
