import { createError } from 'h3'
import { prisma } from '../utils/db'
import { newCode, newLinkToken } from '../utils/codes'
import { planLegAction, type LegAction } from '../domain/leg'

// ponytail: one courier per city for the demo. Becomes a Courier table with a rota when there's more than one.
const COURIERS: Record<string, { name: string; phone: string }> = {
  lagos: { name: 'Tunde Bakare', phone: '+2348000000010' },
}

/**
 * A carrier types a code on their leg page. Applies planLegAction's decision:
 * moves the leg and the parcel forward, records events, and after leg 1's handover
 * opens leg 2 for the courier. Returns the plan, plus the new leg if one was opened.
 */
export async function applyLegAction(linkToken: string, action: LegAction, code: string, photoUrl?: string) {
  const leg = await prisma.leg.findUnique({ where: { linkToken }, include: { parcel: true } })
  if (!leg) throw createError({ statusCode: 404, statusMessage: 'This link is not valid' })

  const plan = planLegAction(leg, action, code)

  if (!plan.ok) {
    if (plan.reason === 'wrong_code') {
      await prisma.leg.update({ where: { id: leg.id }, data: { failedAttempts: { increment: 1 } } })
    }
    return { plan, nextLeg: null }
  }

  const now = new Date()
  const place = await prisma.handoverPoint.findFirst({ where: { postcode: leg.toPostcode } })
  const nextLeg = await prisma.$transaction(async (tx) => {
    // Only move the leg if it is still where we read it. A double tap must not act twice.
    const moved = await tx.leg.updateMany({
      where: { id: leg.id, status: leg.status },
      data:
        action === 'collect'
          ? { status: plan.legStatus, collectedAt: now }
          : { status: plan.legStatus, handedOverAt: now, handoverPostcode: leg.toPostcode, photoUrl },
    })
    if (moved.count === 0) throw createError({ statusCode: 409, statusMessage: 'Already done' })

    await tx.parcel.update({ where: { id: leg.parcelId }, data: { status: plan.parcelStatus } })

    let nextLeg = null
    if (plan.openLastMile) {
      const courier = COURIERS[leg.parcel.toCity.trim().toLowerCase()]
      if (!courier) throw createError({ statusCode: 500, statusMessage: `No courier set up for ${leg.parcel.toCity}` })
      nextLeg = await tx.leg.create({
        data: {
          parcelId: leg.parcelId,
          seq: 2,
          kind: 'LASTMILE',
          carrierName: courier.name,
          carrierPhone: courier.phone,
          fromPostcode: leg.toPostcode,
          toPostcode: leg.parcel.dropPostcode,
          windowStart: now,
          windowEnd: new Date(now.getTime() + 6 * 60 * 60 * 1000),
          collectCode: newCode(),
          handoverCode: newCode(),
          linkToken: newLinkToken(),
        },
      })
    }

    for (const type of plan.events) {
      await tx.event.create({
        data: {
          parcelId: leg.parcelId,
          type,
          data:
            type === 'handover.completed'
              ? { legSeq: leg.seq, postcode: leg.toPostcode, place: place?.name ?? null, by: leg.carrierName }
              : type === 'lastmile.created'
                ? { legId: nextLeg!.id, courier: nextLeg!.carrierName }
                : { legSeq: leg.seq, by: leg.carrierName },
        },
      })
    }
    return nextLeg
  })

  return { plan, nextLeg }
}
