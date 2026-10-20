/**
 * Booking a parcel: choose the centres, lay out the handover chain, then start finding carriers
 * (a courier for pickup / door delivery, a traveller for city to city).
 *
 * Cities come from the centres, never typed: the origin centre is the one the sender drops at
 * (or the nearest to their pickup pin); the destination centre is the one the recipient collects
 * from (or the nearest to the delivery pin).
 *
 * Explicit imports only (scripts and the seed run it too).
 */
import { randomBytes } from 'node:crypto'
import { prisma } from '~~/server/utils/db'
import { logger } from '~~/server/utils/logger'
import { AppError } from '~~/layers/core/server/types/errors'
import type { PostaUser } from '~~/layers/core/server/types/user'
import { hubRepository } from '~~/layers/hubs/server/repositories/hub.repository'
import { eventRepository } from '../repositories/event.repository'
import { buildChain, initialStatus, type Ref } from '../utils/chain'
import { km } from '../utils/matching'
import { newCode, newLinkToken } from '../utils/codes'
import { refreshReadiness } from './chainState.service'
import { dispatchService } from './dispatch.service'
import { matchService } from './match.service'
import type { CreateParcelInput } from '../schemas/parcel.schema'

/** Farther than this from any centre, Posta doesn't serve the spot yet. */
const MAX_CENTRE_KM = 60

type Hub = Awaited<ReturnType<typeof hubRepository.listApproved>>[number]

/** Approved centres by distance from a point (optionally only in one city). */
export async function centresNear(lat: number, lng: number, opts: { limit?: number; city?: string } = {}) {
  const hubs = await hubRepository.listApproved()
  return hubs
    .filter((h) => !opts.city || h.city.toLowerCase() === opts.city.trim().toLowerCase())
    .map((h) => ({ ...h, distanceKm: km(lat, lng, h.lat, h.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, opts.limit ?? 5)
}

async function approvedHub(id: string, field: string): Promise<Hub> {
  const hub = await hubRepository.findById(id)
  if (!hub || hub.status !== 'APPROVED') throw new AppError('NO_CENTRE', 'That centre is not taking parcels. Choose another.', 400, field)
  return hub
}

async function nearestHub(lat: number | null | undefined, lng: number | null | undefined, city: string | undefined, field: string) {
  if (lat != null && lng != null) {
    const [near] = await centresNear(lat, lng, { limit: 1 })
    if (near && near.distanceKm <= MAX_CENTRE_KM) return near
  } else if (city) {
    const [first] = (await hubRepository.listApproved()).filter((h) => h.city.toLowerCase() === city.toLowerCase())
    if (first) return first
  }
  throw new AppError('NO_CENTRE', 'Posta has no centre near there yet.', 400, field)
}

export const bookingService = {
  async create(user: PostaUser, input: CreateParcelInput) {
    const { valueNaira, firstMile, lastMile, originHubId, destHubId, toCity, preferredCourierId, ...rest } = input

    const origin = originHubId ? await approvedHub(originHubId, 'originHubId') : await nearestHub(input.pickupLat, input.pickupLng, undefined, 'pickupLat')
    const dest = destHubId ? await approvedHub(destHubId, 'destHubId') : await nearestHub(input.dropLat, input.dropLng, toCity, 'dropLat')
    const intercity = origin.city.toLowerCase() !== dest.city.toLowerCase()
    const chain = buildChain({ firstMile, lastMile, intercity, sameCentre: origin.id === dest.id })

    const parcel = await prisma.$transaction(async (tx) => {
      const parcel = await tx.parcel.create({
        data: {
          ...rest,
          valueKobo: valueNaira * 100,
          fromCity: origin.city,
          toCity: dest.city,
          firstMile,
          lastMile,
          originHubId: origin.id,
          destHubId: dest.id,
          preferredCourierId: firstMile === 'PICKUP' ? (preferredCourierId ?? null) : null,
          status: initialStatus(firstMile),
          createdBy: user.id,
        },
      })

      // One leg per carrier stretch; carriers are added later (dispatch / matching).
      const now = new Date()
      const legIds: Partial<Record<Ref, string>> = {}
      for (const [i, l] of chain.legs.entries()) {
        const leg = await tx.leg.create({
          data: {
            parcelId: parcel.id,
            seq: i + 1,
            kind: l.kind,
            fromPostcode: l.key === 'first' ? parcel.pickupPostcode : l.key === 'last' ? dest.postcode : origin.postcode,
            toPostcode: l.key === 'first' ? origin.postcode : l.key === 'last' ? parcel.dropPostcode : dest.postcode,
            windowStart: now,
            windowEnd: new Date(now.getTime() + 3 * 24 * 3_600_000), // replaced once a carrier is assigned
            linkToken: newLinkToken(),
          },
        })
        legIds[l.key] = leg.id
      }

      const hubOf = (ref: Ref) => (ref === 'origin' ? origin.id : ref === 'dest' ? dest.id : null)
      const legOf = (ref: Ref) => (ref === 'first' || ref === 'middle' || ref === 'last' ? (legIds[ref] ?? null) : null)
      await tx.handover.createMany({
        data: chain.steps.map((s) => ({
          parcelId: parcel.id,
          seq: s.seq,
          fromParty: s.from.party,
          toParty: s.to.party,
          fromHubId: hubOf(s.from.ref),
          toHubId: hubOf(s.to.ref),
          fromLegId: legOf(s.from.ref),
          toLegId: legOf(s.to.ref),
          token: randomBytes(16).toString('hex'),
          code: newCode(),
        })),
      })
      await refreshReadiness(parcel.id, tx)
      await eventRepository.record(parcel.id, 'parcel.created', { firstMile, lastMile, origin: origin.name, dest: dest.name }, tx)
      return parcel
    })

    // Finding carriers must not fail the booking: anything missed is retried by the sweep task.
    await dispatchService.forParcel(parcel.id).catch((e) => logger.logError('[booking] dispatch', e, { parcelId: parcel.id }))
    if (intercity) await matchService.run().catch((e) => logger.logError('[booking] match', e, { parcelId: parcel.id }))
    return { id: parcel.id }
  },
}
