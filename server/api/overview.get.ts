export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const mine = ownedBy(user)
  const now = new Date()

  const [byStatus, late, locked, waiting, recent, hubCount, tripCount] = await Promise.all([
    prisma.parcel.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
    prisma.leg.findMany({
      where: { status: { not: 'HANDED_OVER' }, windowEnd: { lt: now }, parcel: mine },
      select: { id: true, seq: true, carrierName: true, windowEnd: true, parcel: { select: { id: true, number: true } } },
      orderBy: { windowEnd: 'asc' },
      take: 10,
    }),
    prisma.leg.findMany({
      where: { failedAttempts: { gte: 5 }, status: { not: 'HANDED_OVER' }, parcel: mine },
      select: { id: true, carrierName: true, parcel: { select: { id: true, number: true } } },
      take: 10,
    }),
    prisma.parcel.findMany({
      where: { ...mine, status: 'NEW' },
      select: { id: true, number: true, fromCity: true, toCity: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }),
    prisma.event.findMany({
      where: { parcel: mine },
      select: { id: true, type: true, data: true, at: true, parcel: { select: { id: true, number: true } } },
      orderBy: { at: 'desc' },
      take: 8,
    }),
    prisma.handoverPoint.count(),
    prisma.trip.count({ where: ownedBy(user) }),
  ])

  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0
  return {
    figures: {
      waiting: count('NEW'),
      moving: count('MATCHED') + count('IN_TRANSIT') + count('OUT_FOR_DELIVERY'),
      atHub: count('AT_HUB'),
      delivered: count('DELIVERED'),
    },
    attention: [
      ...locked.map((l) => ({ kind: 'locked' as const, legId: l.id, parcel: l.parcel, carrier: l.carrierName })),
      ...late.map((l) => ({ kind: 'late' as const, legId: l.id, parcel: l.parcel, carrier: l.carrierName, since: l.windowEnd })),
    ],
    waiting,
    recent,
    setup: { hubs: hubCount, trips: tripCount, parcels: byStatus.reduce((n, b) => n + b._count._all, 0) },
    isOps: isOps(user),
  }
})
