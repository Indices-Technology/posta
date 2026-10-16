// Public: the recipient's tracking link. Shows their delivery code, which is why the
// token is a UUID and not the parcel number.
export default defineEventHandler(async (event) => {
  const parcel = await prisma.parcel.findUnique({
    where: { trackToken: getRouterParam(event, 'token') },
    include: { legs: { orderBy: { seq: 'asc' } }, events: { orderBy: { at: 'asc' } } },
  })
  if (!parcel) throw createError({ statusCode: 404, statusMessage: 'Tracking link not found' })

  const lastMile = parcel.legs.find((l) => l.kind === 'LASTMILE')
  return {
    number: parcel.number,
    status: parcel.status,
    fromCity: parcel.fromCity,
    toCity: parcel.toCity,
    recipientFirstName: parcel.recipientName.split(' ')[0],
    deliveryCode: lastMile && lastMile.status !== 'HANDED_OVER' ? lastMile.handoverCode : null,
    courier: lastMile && lastMile.status !== 'HANDED_OVER' ? { name: lastMile.carrierName, phone: lastMile.carrierPhone } : null,
    events: parcel.events
      .map((e) => ({ id: e.id, at: e.at, text: eventText(e.type, e.data as Record<string, any>, true) }))
      .filter((e) => e.text),
  }
})
