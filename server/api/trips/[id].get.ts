export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const trip = await prisma.trip.findFirst({
    where: { id: getRouterParam(event, 'id'), ...ownedBy(user) },
    include: {
      legs: {
        orderBy: { windowStart: 'asc' },
        include: { parcel: { select: { id: true, number: true, status: true, description: true, weightKg: true, toCity: true } } },
      },
    },
  })
  if (!trip) throw createError({ statusCode: 404, statusMessage: 'Trip not found' })

  const { legs, ...t } = trip
  return {
    trip: t,
    loads: legs.map((l) => ({
      legId: l.id,
      status: l.status,
      fromPostcode: l.fromPostcode,
      toPostcode: l.toPostcode,
      linkToken: l.linkToken,
      parcel: l.parcel,
    })),
  }
})
