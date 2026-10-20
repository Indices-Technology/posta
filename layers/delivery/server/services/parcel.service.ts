import type { PostaUser } from '~~/layers/core/server/types/user'
import { notFound } from '~~/layers/core/server/types/errors'
import { parcelRepository } from '../repositories/parcel.repository'
import { handoverRepository, type HandoverFull } from '../repositories/handover.repository'
import { bookingService } from './booking.service'
import { sideOf } from './handover.service'
import { buildJourney } from '../utils/journey'
import type { CreateParcelInput } from '../schemas/parcel.schema'

/** One line of the chain for the sender: who hands to whom, and whether it has happened. */
const chainRow = (h: HandoverFull) => ({
  seq: h.seq,
  from: { party: h.fromParty, name: sideOf(h, 'from').name },
  to: { party: h.toParty, name: sideOf(h, 'to').name },
  status: h.status,
  doneAt: h.doneAt,
})

const hubPoint = (h?: { name: string; lat: number; lng: number } | null) => (h ? { name: h.name, lat: h.lat, lng: h.lng } : null)

export const parcelService = {
  create: (user: PostaUser, input: CreateParcelInput) => bookingService.create(user, input),

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
      statusText: PARCEL_STATUS[p.status as ParcelStatusName]?.label ?? p.status,
      from: p.fromCity,
      to: p.toCity,
      recipient: p.recipientName,
      contents: p.description,
    }))
  },

  /** The sender's parcel page: the whole chain, and their QR when it's their turn to hand it over. */
  async getForUser(user: PostaUser, id: string) {
    const parcel = await parcelRepository.findWithJourney(id, ownerScope(user))
    if (!parcel) throw notFound('Parcel')
    const handovers = await handoverRepository.listForParcel(parcel.id)

    // The sender shows their QR to whoever collects it (a courier or the centre they drop at).
    const mine = handovers.find((h) => h.fromParty === 'SENDER' && h.status === 'READY')
    const yourTurn = mine ? { token: mine.token, code: mine.code, to: { party: mine.toParty, name: sideOf(mine, 'to').name }, place: mine.toHub ? { name: mine.toHub.name, address: mine.toHub.address, hours: mine.toHub.openingHours, postcode: mine.toHub.postcode } : null } : null
    const waitingForCourier = handovers.some((h) => h.fromParty === 'SENDER' && h.toParty === 'COURIER' && h.status === 'WAITING')

    const { legs, events, ...rest } = parcel
    return {
      parcel: rest,
      journey: buildJourney({ ...rest, origin: hubPoint(parcel.originHub), hub: hubPoint(parcel.destHub) }, 'owner'),
      yourTurn,
      waitingForCourier,
      chain: handovers.map(chainRow),
      // Staff see each carrier's job link; senders don't (a link plus a QR could fake a step).
      legs: isOps(user)
        ? legs.map((l) => ({ id: l.id, kind: l.kind, carrierName: l.carrierName, carrierPhone: l.carrierPhone, status: l.status, linkToken: l.linkToken }))
        : [],
      events: events.map((e) => ({ id: e.id, type: e.type, data: e.data as Record<string, unknown>, at: e.at })),
    }
  },

  /**
   * The recipient's public tracking page. Their QR appears only when it's their turn: the courier is
   * at the door, or the parcel is ready at the centre they collect from.
   */
  async getTracking(trackToken: string) {
    const parcel = await parcelRepository.findByTrackToken(trackToken)
    if (!parcel) throw notFound('Tracking link')
    const handovers = await handoverRepository.listForParcel(parcel.id)
    const last = handovers.find((h) => h.toParty === 'RECIPIENT')
    const yourTurn = last && last.status === 'READY'
    const giver = last ? sideOf(last, 'from') : null

    return {
      number: parcel.number,
      status: parcel.status,
      fromCity: parcel.fromCity,
      toCity: parcel.toCity,
      lastMile: parcel.lastMile,
      journey: buildJourney({ ...parcel, origin: hubPoint(parcel.originHub), hub: hubPoint(parcel.destHub) }, 'public'),
      recipientFirstName: parcel.recipientName.split(' ')[0],
      yourQr: yourTurn ? { token: last.token, code: last.code } : null,
      // Collecting: where and when. Door delivery: who is bringing it.
      collectAt: parcel.lastMile === 'COLLECT' && parcel.destHub ? { name: parcel.destHub.name, address: parcel.destHub.address, hours: parcel.destHub.openingHours, postcode: parcel.destHub.postcode } : null,
      courier: parcel.lastMile === 'DOOR' && giver?.party === 'COURIER' && giver.leg?.carrierName ? { name: giver.leg.carrierName, phone: giver.leg.carrierPhone } : null,
      // Public wording hides who carried it.
      events: parcel.events
        .map((e) => ({ id: e.id, at: e.at, text: eventText(e.type, e.data as Record<string, any>, true) }))
        .filter((e): e is typeof e & { text: string } => !!e.text),
    }
  },
}
