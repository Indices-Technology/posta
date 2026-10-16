export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const trips = await prisma.trip.findMany({
    where: ownedBy(user),
    include: { _count: { select: { legs: true } } },
    orderBy: { departAt: 'desc' },
    take: 200,
  })
  return {
    trips: trips.map(({ _count, ...t }) => ({ ...t, carrying: _count.legs })),
  }
})
