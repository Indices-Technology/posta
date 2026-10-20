/**
 * Scans: the only way stakeholders talk to each other. One stakeholder shows a QR (or its 6-digit
 * code), the other scans it from their own dashboard and confirms. Each side sees only what its
 * part needs: the parcel number, what it is, and who is handing it to whom.
 *
 * Who may confirm (see utils/chain.ts `confirmer`): the party taking the parcel, signed in as
 * themselves; or a carrier holding their job link. Staff cannot confirm handovers for anyone.
 *
 * Explicit imports only (scripts run it too).
 */
import { prisma } from '~~/server/utils/db'
import { AppError } from '~~/layers/core/server/types/errors'
import type { PostaUser } from '~~/layers/core/server/types/user'
import { siteUrl } from '~~/layers/core/server/utils/siteUrl'
import { firstName, formatRef } from '~~/shared/utils/posta'
import { notificationService, to, type Outgoing } from '~~/layers/notifications/server/services/notification.service'
import { handoverRepository, type HandoverFull } from '../repositories/handover.repository'
import { eventRepository } from '../repositories/event.repository'
import { confirmer, statusAfter, MAX_FAILED_ATTEMPTS, type Party } from '../utils/chain'
import { refreshReadiness } from './chainState.service'
import { dispatchService } from './dispatch.service'

/** Who is looking: a signed-in person and/or a carrier's job link. */
export interface Viewer {
  user?: PostaUser | null
  job?: string | null
}

type Side = 'from' | 'to'

export function sideOf(h: HandoverFull, side: Side) {
  const party = (side === 'from' ? h.fromParty : h.toParty) as Party
  const hub = side === 'from' ? h.fromHub : h.toHub
  const leg = side === 'from' ? h.fromLeg : h.toLeg
  const name =
    party === 'SENDER'
      ? h.parcel.senderName
      : party === 'RECIPIENT'
        ? h.parcel.recipientName
        : party === 'CENTRE'
          ? (hub?.name ?? 'A Posta centre')
          : (leg?.carrierName ?? (party === 'TRAVELLER' ? 'A traveller' : 'A courier'))
  return { party, name, hub, leg }
}

/** Is this viewer the party on `side` of the handover? */
export function isParty(h: HandoverFull, side: Side, v: Viewer) {
  const { party, hub, leg } = sideOf(h, side)
  const uid = v.user?.id
  switch (party) {
    case 'SENDER':
      return !!uid && uid === h.parcel.createdBy
    case 'CENTRE':
      return !!uid && uid === hub?.ownerUserId
    case 'COURIER':
      return (!!v.job && v.job === leg?.linkToken) || (!!uid && uid === leg?.courier?.userId)
    case 'TRAVELLER':
      return (!!v.job && v.job === leg?.linkToken) || (!!uid && uid === leg?.trip?.driverUserId)
    default:
      return false // the recipient never confirms: they show their code
  }
}

export const canConfirm = (h: HandoverFull, v: Viewer) => isParty(h, confirmer(h.fromParty as Party, h.toParty as Party), v)

/** How it's done, by link or by account, for the record. */
const confirmedBy = (h: HandoverFull, v: Viewer) => {
  const side = confirmer(h.fromParty as Party, h.toParty as Party)
  const leg = side === 'from' ? h.fromLeg : h.toLeg
  return v.job && v.job === leg?.linkToken ? `link:${leg.id}` : (v.user?.id ?? 'unknown')
}

export const handoverService = {
  /** What someone sees after scanning a QR: enough to recognise the parcel and the people, no more. */
  async view(token: string, v: Viewer) {
    const h = await handoverRepository.findByToken(token)
    if (!h) throw new AppError('HANDOVER_NOT_FOUND', 'This code is not a Posta handover.', 404)
    const from = sideOf(h, 'from')
    const toSide = sideOf(h, 'to')
    return {
      ref: formatRef(h.parcel.number),
      contents: h.parcel.description,
      weightKg: h.parcel.weightKg,
      from: { party: from.party, name: from.party === 'RECIPIENT' ? firstName(from.name) : from.name },
      to: { party: toSide.party, name: toSide.party === 'RECIPIENT' ? firstName(toSide.name) : toSide.name },
      status: h.status,
      doneAt: h.doneAt,
      youConfirm: canConfirm(h, v),
      needsSignIn: !v.user && !v.job,
    }
  },

  /** Confirm by scanning (the QR carries the token). */
  async confirmToken(token: string, v: Viewer) {
    const h = await handoverRepository.findByToken(token)
    if (!h) throw new AppError('HANDOVER_NOT_FOUND', 'This code is not a Posta handover.', 404)
    return this.confirm(h, v)
  },

  /**
   * Confirm by typing the 6-digit code shown on the other person's screen. Codes are short, so only
   * handovers this viewer may confirm count, and wrong codes lock a handover after 5 tries.
   */
  async confirmCode(code: string, v: Viewer) {
    const mine = (await handoverRepository.listReadyByCode(code)).filter((h) => canConfirm(h, v))
    if (mine.length === 1) {
      if (mine[0]!.failedAttempts >= MAX_FAILED_ATTEMPTS) throw locked()
      return this.confirm(mine[0]!, v)
    }
    if (mine.length > 1) throw new AppError('SCAN_INSTEAD', 'That code matches more than one parcel. Scan the QR instead.', 409)

    // Wrong code: if the viewer has exactly one handover waiting on them, it counts towards its lock.
    if (v.job) {
      const leg = await prisma.leg.findUnique({ where: { linkToken: v.job }, select: { id: true } })
      const pending = leg
        ? await prisma.handover.findMany({ where: { status: 'READY', OR: [{ fromLegId: leg.id }, { toLegId: leg.id }] } })
        : []
      if (pending.length === 1) {
        const left = MAX_FAILED_ATTEMPTS - pending[0]!.failedAttempts - 1
        await handoverRepository.recordWrongCode(pending[0]!.id)
        if (left <= 0) {
          await notificationService.queue([to.staff('staff.job_locked', { ref: '', carrier: 'A carrier' }, pending[0]!.parcelId)])
          throw locked()
        }
        throw new AppError('WRONG_CODE', `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`, 422, 'code')
      }
    }
    throw new AppError('WRONG_CODE', 'That code is not right. Check it, or scan the QR.', 422, 'code')
  },

  async confirm(h: HandoverFull, v: Viewer) {
    if (h.status === 'DONE') throw new AppError('ALREADY_DONE', 'This handover is already done.', 409)
    if (!canConfirm(h, v)) {
      const side = sideOf(h, confirmer(h.fromParty as Party, h.toParty as Party))
      throw new AppError('NOT_YOURS', `Only ${side.name} can confirm this.`, 403)
    }
    if (h.status !== 'READY') throw new AppError('NOT_YET', 'Not yet: an earlier step is still open.', 409)

    const p = h.parcel
    const ref = formatRef(p.number)
    // The last centre is the destination centre (the same shop as the origin when both are near).
    const toFinalCentre = h.toParty === 'CENTRE' && (!p.destHubId || h.toHubId === p.destHubId)
    const status = statusAfter({ toParty: h.toParty as Party, toFinalCentre, toLegKind: h.toLeg?.kind ?? null }, p.lastMile)
    const now = new Date()

    const messages: Outgoing[] = []
    const carrier = h.toLeg?.carrierName ? firstName(h.toLeg.carrierName) : ''
    if (status === 'WITH_COURIER') messages.push(to.user(p.createdBy, 'parcel.picked_up', { ref, carrier }, p.id))
    if (status === 'AT_ORIGIN') messages.push(to.user(p.createdBy, 'parcel.at_origin', { ref, hub: h.toHub?.name ?? '' }, p.id))
    if (status === 'IN_TRANSIT') messages.push(to.user(p.createdBy, 'parcel.collected', { ref }, p.id))
    if (status === 'AT_HUB' || status === 'READY_FOR_COLLECTION') messages.push(to.user(p.createdBy, 'parcel.at_hub', { ref, hub: h.toHub?.name ?? '' }, p.id))
    if (status === 'READY_FOR_COLLECTION') {
      messages.push(to.whatsapp(p.recipientPhone, 'collection.ready', { recipient: firstName(p.recipientName), hub: h.toHub?.name ?? '', link: `${siteUrl()}/t/${p.trackToken}` }, p.id))
    }
    if (status === 'DELIVERED') {
      messages.push(to.user(p.createdBy, 'parcel.delivered', { ref, recipient: p.recipientName }, p.id))
      messages.push(to.whatsapp(p.senderPhone, 'parcel.delivered', { ref, recipient: p.recipientName }, p.id))
    }

    const ids = await prisma.$transaction(async (tx) => {
      if (!(await handoverRepository.complete(h.id, confirmedBy(h, v), tx))) {
        throw new AppError('ALREADY_DONE', 'This handover is already done.', 409)
      }
      if (h.toLegId) await tx.leg.update({ where: { id: h.toLegId }, data: { status: 'COLLECTED', collectedAt: now } })
      if (h.fromLegId) await tx.leg.update({ where: { id: h.fromLegId }, data: { status: 'HANDED_OVER', handedOverAt: now } })
      await tx.parcel.update({ where: { id: p.id }, data: { status: status as never } })
      await eventRepository.record(
        p.id,
        'handover.done',
        { seq: h.seq, from: h.fromParty, to: h.toParty, fromName: sideOf(h, 'from').name, toName: sideOf(h, 'to').name, place: h.toHub?.name ?? h.fromHub?.name ?? null },
        tx,
      )
      await refreshReadiness(p.id, tx)
      return notificationService.queue(messages, tx)
    })
    void notificationService.send(ids)

    // The next stretch may need a courier now (e.g. it just reached the last centre).
    await dispatchService.forParcel(p.id)
    return { ref, status }
  },
}

const locked = () => new AppError('LOCKED', 'Too many wrong codes. Scan the QR instead, or call Posta.', 423)
