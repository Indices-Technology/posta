/**
 * Keeps each handover's WAITING/READY state in line with the chain rules: only the first
 * unfinished handover is READY, and only once both sides have someone assigned.
 * Called after anything that changes the chain (a scan, a carrier assigned or released).
 * Explicit imports only (scripts and tasks run it too).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'
import { readiness } from '../utils/chain'

type Db = Prisma.TransactionClient

export async function refreshReadiness(parcelId: string, db: Db = prisma) {
  const handovers = await db.handover.findMany({
    where: { parcelId },
    select: {
      id: true,
      seq: true,
      status: true,
      fromParty: true,
      toParty: true,
      fromLeg: { select: { carrierName: true } },
      toLeg: { select: { carrierName: true } },
    },
  })
  // A carrier side counts as assigned once the leg has a named carrier (matched trip or accepted courier).
  const assigned = (party: string, leg: { carrierName: string | null } | null) =>
    party === 'COURIER' || party === 'TRAVELLER' ? !!leg?.carrierName : true

  const target = readiness(
    handovers.map((h) => ({
      seq: h.seq,
      status: h.status,
      fromAssigned: assigned(h.fromParty, h.fromLeg),
      toAssigned: assigned(h.toParty, h.toLeg),
    })),
  )
  for (const h of handovers) {
    const want = target.get(h.seq)
    if (want && want !== h.status) await db.handover.update({ where: { id: h.id }, data: { status: want } })
  }
}
