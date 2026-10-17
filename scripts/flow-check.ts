/**
 * End-to-end check of the whole delivery flow against the real database, through the real services.
 *   npm run check:flow
 *
 * Path 1: a courier company with its own system is approved in the destination city.
 *         Match → driver collects → hands over at the centre → the company's system receives a
 *         signed job (checked here) → their rider collects → delivers. Every message is checked.
 * Path 2: no courier in the city. The parcel waits at the centre and staff are told; approving a
 *         courier assigns it.
 *
 * Writes test rows to the dev database (city "Testville", phone numbers 0700…). Run it against
 * dev only. Test couriers are suspended at the end so real parcels never go to them.
 */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { prisma } from '../server/utils/db'
import { matchService } from '../layers/delivery/server/services/match.service'
import { jobService } from '../layers/delivery/server/services/job.service'
import { lastMileService } from '../layers/delivery/server/services/lastMile.service'
import { notificationService } from '../layers/notifications/server/services/notification.service'
import { verifyWebhook } from '../layers/notifications/server/utils/channels/webhook'
import { courierRepository } from '../layers/couriers/server/repositories/courier.repository'

if (process.env.NODE_ENV === 'production') throw new Error('flow-check writes test data: never run it in production')
delete process.env.WHATSAPP_ACCESS_TOKEN // WhatsApp messages must be SKIPPED here, never really sent

const CITY = 'Testville'
const run = Date.now().toString(36)
const hours = (h: number) => new Date(Date.now() + h * 3_600_000)
const step = (s: string) => console.log(`  ✔ ${s}`)

// A stand-in for a courier company's system: records what Posta sends.
const received: { body: string; signature: string }[] = []
const companySystem = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c)).on('end', () => {
    received.push({ body, signature: String(req.headers['x-posta-signature']) })
    res.end('ok')
  })
}).listen(0)
const webhookUrl = `http://localhost:${(companySystem.address() as AddressInfo).port}/posta`

async function newParcel(sender: string) {
  const p = await prisma.parcel.create({
    data: {
      senderName: 'Flow Sender', senderPhone: '07000000001', pickupPostcode: 'PL-01-A01-TM-01', fromCity: 'Jos',
      recipientName: 'Flow Recipient', recipientPhone: '07000000002', dropPostcode: 'TV-01-A01-AA-01', toCity: CITY,
      description: `flow-check ${run}`, weightKg: 1, valueKobo: 100_00, createdBy: sender,
    },
  })
  await prisma.event.create({ data: { parcelId: p.id, type: 'parcel.created' } })
  return p
}
const notes = (parcelId: string) => prisma.notification.findMany({ where: { parcelId }, orderBy: { createdAt: 'asc' } })
const legOf = (parcelId: string, seq: number) => prisma.leg.findUniqueOrThrow({ where: { parcelId_seq: { parcelId, seq } } })

try {
  // ── Setup: a centre in Testville, a driver's trip, a courier company with a system ────────
  await prisma.handoverPoint.upsert({
    where: { id: 'hp-flow-check' },
    update: { status: 'APPROVED' },
    create: { id: 'hp-flow-check', postcode: 'TV-01-A01-HB-01', name: 'Testville Centre', city: CITY, lat: 9, lng: 7, contactPhone: '07000000003', status: 'APPROVED' },
  })
  await prisma.trip.create({
    data: { driverName: 'Flow Driver', driverPhone: '07000000004', driverUserId: `driver-${run}`, fromCity: 'Jos', toCity: CITY, departAt: hours(1), arriveBy: hours(9), capacity: 5, createdBy: `driver-${run}` },
  })
  const company = await prisma.courier.create({
    data: { kind: 'COMPANY', userId: `company-${run}`, name: 'Flow Riders Ltd', phone: '07000000005', city: CITY, webhookUrl, webhookSecret: 'whsec_flowcheck', status: 'APPROVED' },
  })

  console.log('Path 1: company courier with its own system')
  const p1 = await newParcel(`sender-${run}`)
  await matchService.run()
  const l1 = await legOf(p1.id, 1)
  step('parcel matched to the trip')

  await jobService.act(l1.linkToken, { action: 'collect', code: l1.collectCode })
  await jobService.act(l1.linkToken, { action: 'handover', code: l1.handoverCode })
  const l2 = await legOf(p1.id, 2)
  assert.equal(l2.courierId, company.id)
  step('handed over at the centre; last mile given to Flow Riders Ltd')

  await notificationService.flushDue(200)
  const hook = received.find((r) => JSON.parse(r.body).data?.job?.link?.endsWith(l2.linkToken))
  assert.ok(hook, 'the company system received the job')
  assert.ok(verifyWebhook('whsec_flowcheck', hook.body, hook.signature), 'signature checks out with their secret')
  assert.ok(!hook.body.includes(l2.handoverCode) && !hook.body.includes(l2.collectCode), 'no codes in the webhook')
  step('company system received a signed job, with no codes in it')

  await jobService.act(l2.linkToken, { action: 'collect', code: l2.collectCode })
  await jobService.act(l2.linkToken, { action: 'handover', code: l2.handoverCode })
  assert.equal((await prisma.parcel.findUniqueOrThrow({ where: { id: p1.id } })).status, 'DELIVERED')
  step('rider collected and delivered')

  await notificationService.flushDue(200)
  const n1 = await notes(p1.id)
  const has = (template: string, channel: string, status?: string) =>
    n1.some((n) => n.template === template && n.channel === channel && (!status || n.status === status))
  assert.ok(has('job.assigned', 'WHATSAPP', 'SKIPPED'), 'driver WhatsApp (skipped: not set up)')
  assert.ok(has('trip.parcel_added', 'IN_APP'), 'driver in-app')
  assert.ok(has('parcel.matched', 'IN_APP') && has('parcel.collected', 'IN_APP') && has('parcel.at_hub', 'IN_APP'), 'sender kept informed')
  assert.ok(has('job.assigned', 'WEBHOOK', 'SENT'), 'company webhook sent')
  assert.ok(has('job.assigned', 'IN_APP'), 'company account in-app')
  assert.ok(has('tracking.sent', 'WHATSAPP'), 'recipient gets tracking + code')
  assert.ok(has('parcel.delivered', 'IN_APP') && has('parcel.delivered', 'WHATSAPP'), 'sender told it was delivered')
  assert.ok(!n1.some((n) => n.status === 'PENDING'), 'nothing left unsent')
  step(`${n1.length} messages, each to the right person and channel`)

  console.log('Path 2: no courier free in the city')
  await prisma.courier.update({ where: { id: company.id }, data: { status: 'SUSPENDED' } })
  const p2 = await newParcel(`sender2-${run}`)
  await matchService.run()
  const m1 = await legOf(p2.id, 1)
  await jobService.act(m1.linkToken, { action: 'collect', code: m1.collectCode })
  await jobService.act(m1.linkToken, { action: 'handover', code: m1.handoverCode })
  assert.equal(await prisma.leg.count({ where: { parcelId: p2.id, seq: 2 } }), 0)
  assert.ok((await notes(p2.id)).some((n) => n.template === 'staff.no_courier' && n.forStaff))
  step('parcel waits at the centre; staff alerted')

  const rider = await prisma.courier.create({
    data: { kind: 'INDIVIDUAL', userId: `rider-${run}`, name: 'Flow Rider', phone: '07000000006', city: CITY, vehicle: 'BIKE', status: 'PENDING' },
  })
  assert.ok(await courierRepository.review(rider.id, 'APPROVED', 'flow-check'))
  assert.equal(await lastMileService.assignWaiting(CITY), 1)
  assert.equal((await legOf(p2.id, 2)).courierId, rider.id)
  step('approving a rider in the city assigned the waiting parcel')

  await prisma.courier.updateMany({ where: { userId: { in: [`company-${run}`, `rider-${run}`] } }, data: { status: 'SUSPENDED' } })
  await prisma.trip.updateMany({ where: { createdBy: `driver-${run}` }, data: { status: 'DONE' } })
  await prisma.handoverPoint.update({ where: { id: 'hp-flow-check' }, data: { status: 'SUSPENDED' } }) // keep Testville out of city choices
  console.log('\nAll checks passed.')
} finally {
  companySystem.close()
  await prisma.$disconnect()
}
