import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

// Demo handover points. The postcodes have the national shape but are NOT real buildings:
// replace them with the partner shops' real postcodes (List states / reverse geocode in the
// postcode.gov.ng API) before the pitch.
const points = [
  { id: 'hp-jos-terminus', postcode: 'PL-01-A01-TM-01', name: 'Terminus Market Pickup', city: 'Jos', lat: 9.9285, lng: 8.8921, contactPhone: '+2348000000001' },
  { id: 'hp-lag-ikeja', postcode: 'LA-01-A01-IK-01', name: 'Ikeja Along Partner Shop', city: 'Lagos', lat: 6.6018, lng: 3.3515, contactPhone: '+2348000000002' },
  { id: 'hp-lag-yaba', postcode: 'LA-02-A01-YB-01', name: 'Yaba Partner Shop', city: 'Lagos', lat: 6.5095, lng: 3.3711, contactPhone: '+2348000000003' },
]

for (const p of points) {
  await prisma.handoverPoint.upsert({ where: { id: p.id }, update: p, create: p })
}
console.log(`Seeded ${points.length} handover points`)
await prisma.$disconnect()
