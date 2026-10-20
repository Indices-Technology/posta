/**
 * What a carrier (traveller or courier) sees for one job: just their two handovers, collect and
 * deliver, with what to do at each. Opened from their job link (no account needed) or from their
 * dashboard. A traveller only ever sees two centres; a courier sees the person or centre at each end.
 */
import { prisma } from '~~/server/utils/db'
import { AppError } from '~~/layers/core/server/types/errors'
import { formatRef } from '~~/shared/utils/posta'
import { handoverRepository, type HandoverFull } from '../repositories/handover.repository'
import { confirmer, type Party } from '../utils/chain'
import { sideOf } from './handover.service'

/** The place or person at the other end of a handover, with only what the carrier needs. */
function counterpart(h: HandoverFull, side: 'from' | 'to') {
  const s = sideOf(h, side)
  if (s.party === 'CENTRE') {
    return { kind: 'centre' as const, name: s.name, postcode: s.hub?.postcode ?? '', address: s.hub?.address || null, phone: s.hub?.contactPhone ?? null, hours: s.hub?.openingHours || null }
  }
  if (s.party === 'SENDER') {
    return { kind: 'person' as const, name: s.name, postcode: h.parcel.pickupPostcode, address: null, phone: h.parcel.senderPhone, hours: null }
  }
  if (s.party === 'RECIPIENT') {
    return { kind: 'person' as const, name: s.name, postcode: h.parcel.dropPostcode, address: null, phone: h.parcel.recipientPhone, hours: null }
  }
  return { kind: 'carrier' as const, name: s.name, postcode: '', address: null, phone: s.leg?.carrierPhone ?? null, hours: null }
}

export const carrierService = {
  async job(linkToken: string) {
    const leg = await prisma.leg.findUnique({ where: { linkToken }, include: { parcel: { select: { number: true, description: true, weightKg: true } } } })
    if (!leg) throw new AppError('JOB_NOT_FOUND', 'This job link is not valid', 404)

    const handovers = await handoverRepository.listForLegs([leg.id], ['WAITING', 'READY', 'DONE'])
    const steps = handovers.map((h) => {
      const collect = h.toLegId === leg.id
      const mySide = collect ? 'to' : 'from'
      const iScan = confirmer(h.fromParty as Party, h.toParty as Party) === mySide
      const ready = h.status === 'READY'
      return {
        seq: h.seq,
        kind: collect ? ('collect' as const) : ('deliver' as const),
        status: h.status,
        doneAt: h.doneAt,
        with: counterpart(h, collect ? 'from' : 'to'),
        /** scan: I scan their QR. show: they scan mine (the QR is only handed out when it's time). */
        action: h.status === 'DONE' ? ('done' as const) : iScan ? ('scan' as const) : ('show' as const),
        qr: !iScan && ready ? { token: h.token, code: h.code } : null,
        locked: h.failedAttempts >= 5,
      }
    })

    return {
      carrierName: leg.carrierName,
      kind: leg.kind,
      ref: formatRef(leg.parcel.number),
      contents: leg.parcel.description,
      weightKg: leg.parcel.weightKg,
      windowStart: leg.windowStart,
      windowEnd: leg.windowEnd,
      assigned: !!leg.carrierName,
      steps,
    }
  },
}
