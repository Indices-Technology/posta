/**
 * Seed a full, walkable Posta network, and prove the flow on the way.
 *
 *   npm run seed:flow -- <yourMarketxUserId>        (your id: open /api/auth/me while signed in)
 *
 * Creates (all public places, never homes):
 *   - fulfilment centres at markets and malls in Jos, Lagos and Abuja, with REAL national postcodes
 *     looked up from NIPOST at each spot when NUXT_POSTCODE_API_KEY is a live key; otherwise
 *     placeholders marked "ZZ" in the area segment (e.g. LA-01-A01-ZZ-01)
 *   - available couriers in each city, a courier company, travellers on the main routes
 *   - one parcel at every stage, each moved along by real scans through the real services, and
 *     checked: if any parcel doesn't reach its stage, the seed fails loudly
 *
 * You get every role: sender of all parcels, owner of the Jos and Lagos (Tejuosho) centres,
 * an available courier in Lagos, and a traveller with a trip. Every dashboard has something on it.
 *
 * Safe to run twice: centres/couriers are upserted by fixed ids; parcels and trips are added again.
 * Writes to whatever DATABASE_URL points at. WhatsApp is never sent (phones are 0700 numbers).
 */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { prisma } from '../server/utils/db'
import { normalizePostcode } from '../shared/utils/postcode'
import { bookingService } from '../layers/delivery/server/services/booking.service'
import { dispatchService } from '../layers/delivery/server/services/dispatch.service'
import { matchService } from '../layers/delivery/server/services/match.service'
import { handoverService, type Viewer } from '../layers/delivery/server/services/handover.service'
import { handoverRepository } from '../layers/delivery/server/repositories/handover.repository'
import { confirmer, type Party } from '../layers/delivery/server/utils/chain'

if (process.env.NODE_ENV === 'production') throw new Error('Run the seed from a development machine.')
delete process.env.WHATSAPP_ACCESS_TOKEN // seed phones are fake: never message them

const me = process.argv[2]
if (!me) throw new Error('Pass your MarketX user id: npm run seed:flow -- <id>  (see /api/auth/me)')
const user = { id: me, email: 'seed@posta', role: 'user' }
const hours = (h: number) => new Date(Date.now() + h * 3_600_000)

// ── Centres at public places ─────────────────────────────────────────────────────────────────
const CENTRES = [
  { id: 'seed-hub-jos-terminus', name: 'Terminus Market Centre', city: 'Jos', state: 'PL', lat: 9.9197, lng: 8.8919, address: 'Terminus Market, Ahmadu Bello Way', owner: me },
  { id: 'seed-hub-jos-rayfield', name: 'Rayfield Centre', city: 'Jos', state: 'PL', lat: 9.8619, lng: 8.8949, address: 'Rayfield Road, by the resort junction', owner: 'seed-owner' },
  { id: 'seed-hub-lag-tejuosho', name: 'Tejuosho Market Centre', city: 'Lagos', state: 'LA', lat: 6.5098, lng: 3.3619, address: 'Tejuosho Market, Ojuelegba Road, Yaba', owner: me },
  { id: 'seed-hub-lag-ikeja', name: 'Ikeja City Mall Centre', city: 'Lagos', state: 'LA', lat: 6.6137, lng: 3.3576, address: 'Ikeja City Mall, Obafemi Awolowo Way', owner: 'seed-owner' },
  { id: 'seed-hub-lag-lekki', name: 'Lekki Centre', city: 'Lagos', state: 'LA', lat: 6.4474, lng: 3.4722, address: 'Admiralty Way, Lekki Phase 1', owner: 'seed-owner' },
  { id: 'seed-hub-abj-wuse', name: 'Wuse Market Centre', city: 'Abuja', state: 'FC', lat: 9.0664, lng: 7.4689, address: 'Wuse Market, Zone 5', owner: 'seed-owner' },
  { id: 'seed-hub-abj-jabi', name: 'Jabi Lake Centre', city: 'Abuja', state: 'FC', lat: 9.0747, lng: 7.4225, address: 'Jabi Lake Mall, Bala Sokoto Way', owner: 'seed-owner' },
]

/** The real postcode at a public place, from NIPOST; null without a key or when nothing is in range. */
async function realPostcode(lat: number, lng: number): Promise<string | null> {
  const key = process.env.NUXT_POSTCODE_API_KEY
  if (!key) return null
  const url = `https://api.postcode.gov.ng/v1/search/reverse?lat=${lat}&lng=${lng}&max_distance_m=250`
  const res = await fetch(url, { headers: { 'X-API-Key': key }, signal: AbortSignal.timeout(8000) }).catch(() => null)
  if (!res?.ok) return null
  const body = (await res.json()) as { data?: { found?: boolean; unit?: { postcode?: string } } }
  return body.data?.found && body.data.unit?.postcode ? normalizePostcode(body.data.unit.postcode) : null
}

console.log('\nCentres')
let placeholders = 0
for (const [n, c] of CENTRES.entries()) {
  const real = await realPostcode(c.lat, c.lng)
  const postcode = real ?? `${c.state}-01-A01-ZZ-${String(n + 1).padStart(2, '0')}`
  if (!real) placeholders++
  const data = {
    name: c.name, city: c.city, lat: c.lat, lng: c.lng, address: c.address, postcode, ownerUserId: c.owner,
    contactPhone: `0700000${String(100 + n)}`, openingHours: 'Mon–Sat, 8am–7pm', status: 'APPROVED' as const,
  }
  await prisma.handoverPoint.upsert({ where: { id: c.id }, update: data, create: { id: c.id, ...data } })
  console.log(`  ${real ? '✔' : '·'} ${c.name.padEnd(26)} ${postcode}${real ? '' : '  (placeholder)'}`)
}
// The first demo shops had made-up postcodes: stop new parcels going to them.
await prisma.handoverPoint.updateMany({ where: { id: { startsWith: 'hp-' } }, data: { status: 'SUSPENDED' } })

// ── Couriers and travellers ──────────────────────────────────────────────────────────────────
const COURIERS = [
  { id: 'seed-courier-me', userId: me, name: 'You (courier)', city: 'Lagos', lat: 6.512, lng: 3.366, vehicle: 'BIKE' },
  { id: 'seed-courier-tunde', userId: 'seed-tunde', name: 'Tunde Bakare', city: 'Lagos', lat: 6.6, lng: 3.35, vehicle: 'BIKE' },
  { id: 'seed-courier-ngozi', userId: 'seed-ngozi', name: 'Ngozi Eze', city: 'Lagos', lat: 6.45, lng: 3.47, vehicle: 'CAR' },
  { id: 'seed-courier-dauda', userId: 'seed-dauda', name: 'Dauda Musa', city: 'Jos', lat: 9.92, lng: 8.89, vehicle: 'BIKE' },
  { id: 'seed-courier-amaka', userId: 'seed-amaka', name: 'Amaka Obi', city: 'Abuja', lat: 9.07, lng: 7.47, vehicle: 'VAN' },
]
for (const [n, c] of COURIERS.entries()) {
  const data = {
    kind: 'INDIVIDUAL' as const, userId: c.userId, name: c.name, phone: `0700000${200 + n}`, city: c.city, vehicle: c.vehicle,
    status: 'APPROVED' as const, availableUntil: hours(12), lastLat: c.lat, lastLng: c.lng, lastSeenAt: new Date(),
  }
  await prisma.courier.upsert({ where: { id: c.id }, update: data, create: { id: c.id, ...data } })
}
await prisma.courier.upsert({
  where: { id: 'seed-company-swift' },
  update: { status: 'APPROVED' },
  create: { id: 'seed-company-swift', kind: 'COMPANY', userId: 'seed-swift', name: 'Swift Riders Ltd', phone: '07000000299', city: 'Lagos', status: 'APPROVED' },
})

// Matching gives each parcel the earliest trip with room: your trip leaves first with 2 seats, so you
// carry the first two Jos parcels and John takes the next.
const trip = (driverName: string, driverUserId: string, fromCity: string, toCity: string, inHours: number, phone: string, capacity = 4) =>
  prisma.trip.create({ data: { driverName, driverUserId, driverPhone: phone, fromCity, toCity, departAt: hours(inHours), arriveBy: hours(inHours + 9), capacity, createdBy: driverUserId } })
await trip('You (traveller)', me, 'Jos', 'Lagos', 5, '07000000304', 2)
await trip('John Okoro', 'seed-john', 'Jos', 'Lagos', 8, '07000000301')
await trip('Hauwa Bello', 'seed-hauwa', 'Abuja', 'Lagos', 2, '07000000302')
await trip('Emeka Nwosu', 'seed-emeka', 'Lagos', 'Abuja', 4, '07000000303')
console.log('\nCouriers: 5 available + Swift Riders Ltd · Trips: Jos→Lagos ×2, Abuja→Lagos, Lagos→Abuja')

// ── Moving parcels along with real scans ─────────────────────────────────────────────────────
const centre = (id: string) => CENTRES.find((c) => c.id === id)!
const near = (c: { lat: number; lng: number }, d = 0.004) => ({ lat: c.lat + d, lng: c.lng + d })

/** Confirm the parcel's next handover as whoever must confirm it (centre owner, or the carrier's link). */
async function scanNext(parcelId: string) {
  const h = (await handoverRepository.listForParcel(parcelId)).find((x) => x.status === 'READY')
  assert.ok(h, 'a handover is ready')
  const side = confirmer(h.fromParty as Party, h.toParty as Party)
  const party = side === 'from' ? h.fromParty : h.toParty
  const hub = side === 'from' ? h.fromHub : h.toHub
  const leg = side === 'from' ? h.fromLeg : h.toLeg
  const viewer: Viewer = party === 'CENTRE' ? { user: { id: hub!.ownerUserId!, email: '', role: 'user' } } : { job: leg!.linkToken }
  await handoverService.confirm(h, viewer)
}

/** Put a specific courier on a parcel's open courier leg (as if they accepted the offer). */
async function courierTakes(parcelId: string, courierId: string) {
  await prisma.jobOffer.updateMany({ where: { leg: { parcelId }, status: 'OFFERED' }, data: { status: 'CANCELLED' } })
  const leg = await prisma.leg.findFirst({ where: { parcelId, carrierName: null, handoversIn: { some: { toParty: 'COURIER' } } }, orderBy: { seq: 'asc' } })
  assert.ok(leg, 'a courier leg is waiting')
  await dispatchService.assign(leg.id, courierId)
}

let n = 0
async function book(o: {
  what: string; from: { lat: number; lng: number }; to: { lat: number; lng: number }; firstMile: 'DROP_OFF' | 'PICKUP'; lastMile: 'DOOR' | 'COLLECT'
  originHubId?: string; destHubId?: string; recipient: string
}) {
  n++
  const { id } = await bookingService.create(user, {
    senderName: 'Amina Dung', senderPhone: '07000000401',
    recipientName: o.recipient, recipientPhone: `0700000${410 + n}`,
    description: o.what, weightKg: 2, valueNaira: 25_000,
    pickupPostcode: 'PL-01-A01-ZZ-99', pickupLat: o.from.lat, pickupLng: o.from.lng, firstMile: o.firstMile, originHubId: o.originHubId ?? null,
    dropPostcode: 'LA-01-A01-ZZ-99', dropLat: o.to.lat, dropLng: o.to.lng, lastMile: o.lastMile, destHubId: o.destHubId ?? null,
  })
  // Pickup and drop are the centres' own postcodes (public places), never someone's home.
  const p = await prisma.parcel.findUniqueOrThrow({ where: { id }, include: { originHub: true, destHub: true } })
  await prisma.parcel.update({ where: { id }, data: { pickupPostcode: p.originHub!.postcode, dropPostcode: p.destHub!.postcode } })
  return id
}

const expectStatus = async (id: string, status: string, label: string) => {
  const p = await prisma.parcel.findUniqueOrThrow({ where: { id } })
  assert.equal(p.status, status, `${label}: expected ${status}, got ${p.status}`)
  console.log(`  ✔ #${p.number} ${label.padEnd(44)} ${status}`)
  return p
}

console.log('\nParcels (moved along by real scans)')
const parcels: { label: string; id: string }[] = []

// 1. Waiting for drop-off at Terminus (Jos), going to a Lagos door.
const p1 = await book({ what: 'Ankara fabric, 6 yards', from: near(centre('seed-hub-jos-terminus')), to: near(centre('seed-hub-lag-tejuosho'), 0.006), firstMile: 'DROP_OFF', lastMile: 'DOOR', originHubId: 'seed-hub-jos-terminus', recipient: 'Chidi Okafor' })
parcels.push({ label: 'Jos → Lagos door, waiting for drop-off', id: (await expectStatus(p1, 'AWAITING_DROPOFF', 'Jos → Lagos door, waiting for drop-off')).id })

// 2. Courier pickup in Lagos, offered to you (an available courier near the sender).
const p2 = await book({ what: 'Laptop charger', from: near(centre('seed-hub-lag-tejuosho'), 0.002), to: near(centre('seed-hub-lag-lekki')), firstMile: 'PICKUP', lastMile: 'DOOR', recipient: 'Tolu Adeyemi' })
parcels.push({ label: 'Lagos pickup, offer waiting for a courier', id: (await expectStatus(p2, 'AWAITING_PICKUP', 'Lagos pickup, offer waiting for a courier')).id })

// 3. Dropped at Terminus, waiting for its traveller (you).
const p3 = await book({ what: 'Shea butter, 2 tubs', from: near(centre('seed-hub-jos-terminus')), to: near(centre('seed-hub-lag-tejuosho')), firstMile: 'DROP_OFF', lastMile: 'COLLECT', originHubId: 'seed-hub-jos-terminus', destHubId: 'seed-hub-lag-tejuosho', recipient: 'Kemi Bankole' })
await scanNext(p3) // Terminus scans the sender's QR
parcels.push({ label: 'At Terminus, waiting for its traveller', id: (await expectStatus(p3, 'AT_ORIGIN', 'At Terminus, waiting for its traveller')).id })

// 4. On the road with Hauwa, Abuja → Lagos.
const p4 = await book({ what: 'Phone and case', from: near(centre('seed-hub-abj-wuse')), to: near(centre('seed-hub-lag-ikeja')), firstMile: 'DROP_OFF', lastMile: 'DOOR', originHubId: 'seed-hub-abj-wuse', recipient: 'Bisi Lawal' })
await scanNext(p4) // Wuse receives it
await matchService.run()
await scanNext(p4) // Hauwa scans Wuse's QR
parcels.push({ label: 'On the road with Hauwa, Abuja → Lagos', id: (await expectStatus(p4, 'IN_TRANSIT', 'On the road with Hauwa, Abuja → Lagos')).id })

// 5. Ready for collection at Tejuosho, after Jos → Lagos.
const p5 = await book({ what: 'Handmade leather sandals', from: near(centre('seed-hub-jos-rayfield')), to: near(centre('seed-hub-lag-tejuosho')), firstMile: 'DROP_OFF', lastMile: 'COLLECT', originHubId: 'seed-hub-jos-rayfield', destHubId: 'seed-hub-lag-tejuosho', recipient: 'Ifeoma Nnaji' })
await scanNext(p5) // Rayfield receives it
await matchService.run()
await scanNext(p5) // traveller collects at Rayfield
await scanNext(p5) // Tejuosho scans the traveller
parcels.push({ label: 'Ready for collection at Tejuosho', id: (await expectStatus(p5, 'READY_FOR_COLLECTION', 'Ready for collection at Tejuosho')).id })

// 6. Out for delivery in Lagos with Ngozi.
const p6 = await book({ what: 'Books, a small box', from: near(centre('seed-hub-abj-jabi')), to: near(centre('seed-hub-lag-lekki')), firstMile: 'DROP_OFF', lastMile: 'DOOR', originHubId: 'seed-hub-abj-jabi', recipient: 'Segun Ade' })
await scanNext(p6)
await matchService.run()
await scanNext(p6)
await scanNext(p6) // arrives at the Lagos centre nearest the door
await courierTakes(p6, 'seed-courier-ngozi')
await scanNext(p6) // Ngozi scans the centre
parcels.push({ label: 'Out for delivery with Ngozi, Lagos', id: (await expectStatus(p6, 'OUT_FOR_DELIVERY', 'Out for delivery with Ngozi, Lagos')).id })

// 7. Delivered: Lagos → Abuja, collected at Wuse.
const p7 = await book({ what: 'Birthday cake topper', from: near(centre('seed-hub-lag-ikeja')), to: near(centre('seed-hub-abj-wuse')), firstMile: 'PICKUP', lastMile: 'COLLECT', destHubId: 'seed-hub-abj-wuse', recipient: 'Zainab Yusuf' })
await courierTakes(p7, 'seed-courier-tunde')
await scanNext(p7) // Tunde scans the sender
await scanNext(p7) // Ikeja centre scans Tunde
await matchService.run()
await scanNext(p7) // Emeka collects at Ikeja
await scanNext(p7) // Wuse scans Emeka
await scanNext(p7) // Wuse scans the recipient's QR
parcels.push({ label: 'Delivered: collected at Wuse, Abuja', id: (await expectStatus(p7, 'DELIVERED', 'Delivered: collected at Wuse, Abuja')).id })

// ── What to open ─────────────────────────────────────────────────────────────────────────────
const base = (process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3100').replace(/\/$/, '')
console.log('\nOpen as each role')
console.log(`  Sender (you)       ${base}/            your 7 parcels`)
console.log(`  Courier (you)      ${base}/courier     switch, offers, jobs`)
console.log(`  Centre (you)       ${base}/centre      Terminus (Jos) and Tejuosho (Lagos)`)
const myTrip = await prisma.trip.findFirst({ where: { driverUserId: me }, orderBy: { createdAt: 'desc' } })
if (myTrip) console.log(`  Traveller (you)    ${base}/trips/${myTrip.id}`)
console.log('\n  Recipients (no account):')
for (const p of parcels) {
  const row = await prisma.parcel.findUniqueOrThrow({ where: { id: p.id } })
  console.log(`    #${row.number} ${p.label.padEnd(44)} ${base}/t/${row.trackToken}`)
}
if (placeholders) {
  console.log(`\n  ${placeholders} centre postcodes are placeholders ("ZZ"). Put a live NIPOST key in NUXT_POSTCODE_API_KEY and run again for real ones.`)
}
console.log('\nAll 7 parcels reached their stage through real scans.\n')
await prisma.$disconnect()
