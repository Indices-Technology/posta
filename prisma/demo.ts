/**
 * Pitch rehearsal: John's Jos → Lagos trip plus one parcel, matched by the real matching code.
 * Prints every link and code needed to walk the story on phones.
 *
 *   npm run demo                      # owned by "demo" (visible to Posta staff)
 *   npm run demo -- <marketxUserId>   # owned by you; your id is at /api/auth/me
 */
import 'dotenv/config'
import { prisma } from '../server/utils/db'
import { matchService } from '../layers/delivery/server/services/match.service'

const owner = process.argv[2] || 'demo'
const base = process.env.POSTA_URL || 'http://localhost:3100'
const hours = (h: number) => new Date(Date.now() + h * 3_600_000)

const trip = await prisma.trip.create({
  data: {
    driverName: 'John Okoro',
    driverPhone: '+2348031234567',
    fromCity: 'Jos',
    toCity: 'Lagos',
    departAt: hours(2),
    arriveBy: hours(12),
    capacity: 3,
    createdBy: owner,
  },
})

const parcel = await prisma.parcel.create({
  data: {
    senderName: 'Amina Dung',
    senderPhone: '+2348051112222',
    pickupPostcode: 'PL-01-A01-TM-01',
    fromCity: 'Jos',
    recipientName: 'Chidi Okafor',
    recipientPhone: '+2348093334444',
    dropPostcode: 'LA-02-A01-YB-07',
    toCity: 'Lagos',
    dropLat: 6.5, // Surulere side, so the Yaba point is nearest
    dropLng: 3.36,
    description: '2 pairs of handmade leather sandals',
    weightKg: 1.5,
    valueKobo: 45_000_00,
    createdBy: owner,
  },
})
await prisma.event.create({ data: { parcelId: parcel.id, type: 'parcel.created' } })
await matchService.run()

const legs = await prisma.leg.findMany({ where: { parcelId: parcel.id } })
const leg1 = legs.find((l) => l.seq === 1)
console.log(`\nParcel #${parcel.number}  ${legs.length ? 'matched to John' : 'NOT matched (check handover points)'}\n`)
console.log(`  Parcel page     ${base}/parcels/${parcel.id}`)
console.log(`  Trip page       ${base}/trips/${trip.id}`)
console.log(`  Tracking link   ${base}/t/${parcel.trackToken}`)
if (leg1) {
  console.log(`  John's job link ${base}/l/${leg1.linkToken}`)
  console.log(`\n  Sender code (Amina gives John)        ${leg1.collectCode}`)
  console.log(`  Hub code (shop gives John on arrival) ${leg1.handoverCode}`)
  console.log(`  Courier link + codes appear on the parcel page after John's handover.\n`)
}
await prisma.$disconnect()
