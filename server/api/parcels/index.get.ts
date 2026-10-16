export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const view = getQuery(event).view as ParcelView | undefined
  const statuses = view && view in PARCEL_VIEWS ? [...PARCEL_VIEWS[view]] : undefined
  const mine = ownedBy(user)

  const [parcels, byStatus] = await Promise.all([
    prisma.parcel.findMany({
      where: { ...mine, ...(statuses ? { status: { in: statuses } } : {}) },
      select: {
        id: true,
        number: true,
        status: true,
        fromCity: true,
        toCity: true,
        recipientName: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // ponytail: no paging until someone has more than 200 parcels
    }),
    prisma.parcel.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
  ])

  const counts = { all: 0, waiting: 0, moving: 0, delivered: 0 }
  for (const b of byStatus) {
    counts.all += b._count._all
    for (const [v, list] of Object.entries(PARCEL_VIEWS)) {
      if ((list as readonly string[]).includes(b.status)) counts[v as ParcelView] += b._count._all
    }
  }
  return { parcels, counts }
})
