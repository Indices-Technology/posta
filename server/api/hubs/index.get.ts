export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const hubs = await prisma.handoverPoint.findMany({ orderBy: [{ city: 'asc' }, { name: 'asc' }] })
  return { hubs, canEdit: isOps(user) }
})
