/**
 * What a carrier sees on their job link. Never includes a code: the carrier must get each
 * code from the person in front of them, that's the proof.
 */
export async function loadLegView(linkToken: string) {
  const leg = await prisma.leg.findUnique({ where: { linkToken }, include: { parcel: true } })
  if (!leg) throw createError({ statusCode: 404, statusMessage: 'This job link is not valid' })

  const hubs = await prisma.handoverPoint.findMany({ where: { postcode: { in: [leg.fromPostcode, leg.toPostcode] } } })
  const hub = (pc: string) => hubs.find((h) => h.postcode === pc)
  const p = leg.parcel

  const sender = { kind: 'person' as const, name: p.senderName, phone: p.senderPhone, postcode: p.pickupPostcode, city: p.fromCity }
  const recipient = { kind: 'person' as const, name: p.recipientName, phone: p.recipientPhone, postcode: p.dropPostcode, city: p.toCity }
  const place = (pc: string, city: string) => {
    const h = hub(pc)
    return { kind: 'hub' as const, name: h?.name ?? 'Handover point', phone: h?.contactPhone ?? null, postcode: pc, city: h?.city ?? city }
  }

  const linehaul = leg.kind === 'LINEHAUL'
  return {
    carrierName: leg.carrierName,
    kind: leg.kind,
    status: leg.status,
    windowStart: leg.windowStart,
    windowEnd: leg.windowEnd,
    collectedAt: leg.collectedAt,
    handedOverAt: leg.handedOverAt,
    attemptsLeft: Math.max(0, 5 - leg.failedAttempts),
    parcel: { number: p.number, description: p.description, weightKg: p.weightKg },
    from: linehaul ? sender : place(leg.fromPostcode, p.toCity),
    to: linehaul ? place(leg.toPostcode, p.toCity) : recipient,
  }
}
