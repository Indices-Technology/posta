export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const parcel = await prisma.parcel.findFirst({
    where: { id: getRouterParam(event, 'id'), ...ownedBy(user) },
    include: {
      legs: { orderBy: { seq: 'asc' }, include: { trip: { select: { id: true, departAt: true, arriveBy: true } } } },
      events: { orderBy: { at: 'asc' } },
    },
  })
  if (!parcel) throw createError({ statusCode: 404, statusMessage: 'Parcel not found' })

  const postcodes = parcel.legs.flatMap((l) => [l.fromPostcode, l.toPostcode])
  const hubs = await prisma.handoverPoint.findMany({ where: { postcode: { in: postcodes } } })
  const placeName = (pc: string) => hubs.find((h) => h.postcode === pc)?.name ?? null

  // Who holds which code. Senders see their own; hub codes are staff-only so a sender and a
  // driver can't fake a handover between them.
  const ops = isOps(user)
  const [l1, l2] = parcel.legs
  const codes = [
    l1 && { holder: 'Sender', use: 'Gives it to the driver at pickup', code: l1.collectCode },
    l1 && ops && { holder: 'Handover point', use: 'Gives it to the driver on arrival', code: l1.handoverCode },
    l2 && ops && { holder: 'Handover point', use: 'Gives it to the courier', code: l2.collectCode },
    l2 && { holder: 'Recipient', use: 'Gives it to the courier on delivery. Also on their tracking page', code: l2.handoverCode },
  ].filter((c): c is { holder: string; use: string; code: string } => !!c)

  const { legs, events, ...p } = parcel
  return {
    parcel: p,
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
      linkToken: l.linkToken,
      locked: l.failedAttempts >= 5,
      trip: l.trip,
    })),
    codes,
    events: events.map((e) => ({ id: e.id, type: e.type, data: e.data, at: e.at })),
  }
})
