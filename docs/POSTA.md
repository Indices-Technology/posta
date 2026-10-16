# Posta: parcels ride on trips people are already making

Status: plan, nothing built. Target: working demo for the pitch on 2026-10-27.

## 1. The idea in one paragraph

John drives Jos to Lagos in his own car. A parcel needs to go Jos to Lagos. Posta matches the
parcel to John's trip, tells him where to collect it and where to hand it over in Lagos, and
records proof at each handover. A local courier does the last mile. John only ever sees his own
leg: what to collect, where, by when, and how to prove it.

## 2. What we carry over from MarketX (and why)

| MarketX pattern | Where it lives | What Posta does with it |
|---|---|---|
| Shipping layer talks only in plain value objects, never commerce models | `marketX/layers/shipping/server/utils/types.ts` | Posta is its own app. It never reads MarketX tables. A parcel arrives as plain data (addresses, weight, value). |
| Carrier plug-in registry | `marketX/layers/shipping/server/providers/registry.ts` | Later, Posta becomes one more carrier there (`postaProvider`). MarketX orders are Posta's first parcels. Not needed for the demo. |
| A shipment only moves forward, as a pure, tested function | `marketX/layers/shipping/server/utils/trackingTransition.ts` | Same for each Posta leg: `ASSIGNED → COLLECTED → HANDED_OVER`. No going backwards, unit tested. |
| A real handover scan releases escrow | escrow release rules | A confirmed Posta handover is that same signal. This is the trust-rail story. |
| Money in kobo (whole numbers) | shipping `types.ts` | Same. |
| WhatsApp Business is live (OTP and notifications) | marketX WABA | John and the courier get their instructions on WhatsApp plus a link. No driver app. |
| Axioms capability shape: `domain.action@version`, zod input, risk level | `axioms/src/capability.ts` | Posta exposes capabilities (section 6). Axioms can only call `read` ones today, which is enough for "has John handed over yet?". |
| Stack: Nuxt 4, Prisma, Neon Postgres, Railway | marketX | Same stack, so nothing new to learn. Skip BullMQ/Redis (the Upstash free quota already ran out once). |

## 3. The demo flow (the 5-minute story)

1. **Sender** (ops screen) creates parcel #4821: pickup postcode in Jos, recipient in Lagos.
2. **John** posts a trip: Jos → Lagos, leaving Fri 7am, arriving by 5pm, room for 3 parcels.
3. Posta **matches** #4821 to John's trip. Two legs are created:
   - Leg 1 (John): Jos pickup point → Lagos handover point (a partner shop).
   - Leg 2 (courier): Lagos handover point → customer's door.
4. John gets a WhatsApp message with a link:
   "Collect parcel #4821 at [postcode] before 9am. Hand over at [Lagos postcode] between 4 and 6pm."
5. **Collect:** the sender reads John a 6-digit code; John types it in. Leg 1 = COLLECTED.
6. **Handover:** the shop reads John its code; John types it in (and can add a photo).
   Recorded: "Handed over at [postcode] at 17:12". Leg 1 = HANDED_OVER.
7. That handover **automatically opens leg 2** and messages the courier.
8. Courier delivers; the customer gives the courier their code. Parcel = DELIVERED.
9. Dasah, through Axioms: "Has John handed over parcel 4821?" → "Yes, at 17:12 at [postcode]."

**Why the code goes this way:** the person *receiving* the parcel holds the code and the person
*handing it over* types it in. John can only have the code if he was standing in front of them.
A QR on John's own phone proves nothing about who he gave it to.

## 4. Data model (5 tables)

```
HandoverPoint  id, postcode, name, city, lat, lng, contactPhone      -- partner shops / pickup spots
Trip           id, driverName, driverPhone, fromCity, toCity,
               departAt, arriveBy, capacity, status(OPEN|FULL|DONE)
Parcel         id, ref("4821"), senderName, senderPhone, recipientName, recipientPhone,
               pickupPostcode, dropPostcode, fromCity, toCity, weightKg, valueKobo,
               status(NEW|MATCHED|IN_TRANSIT|AT_HUB|OUT_FOR_DELIVERY|DELIVERED)
Leg            id, parcelId, seq(1,2), kind(LINEHAUL|LASTMILE), tripId?, carrierName, carrierPhone,
               fromPostcode, toPostcode, windowStart, windowEnd,
               collectCode, handoverCode, linkToken,
               status(ASSIGNED|COLLECTED|HANDED_OVER), collectedAt, handedOverAt,
               handoverPostcode, photoUrl
Event          id, parcelId, type, data(json), at   -- parcel.matched, leg.collected,
                                                    -- handover.completed, lastmile.created, parcel.delivered
```

Postcode is a plain text field plus lat/lng. City comes from the postcode (a small lookup table
for the demo cities). We do not depend on an outside postcode service for the demo.

## 5. Matching rule (demo version)

A parcel matches a trip when: same `fromCity → toCity`, the trip leaves after the parcel was
created, and the trip still has room. Oldest parcel first. The Lagos handover point is the
nearest `HandoverPoint` in `toCity` to the parcel's drop postcode (straight-line distance).

Real road routing, partial-route matching (Jos → Abuja → Lagos) and price bidding come later.

## 6. Axioms capabilities

| Capability | Risk | Purpose |
|---|---|---|
| `posta.get_parcel_status@1` | read | Where is parcel X, who has it, last handover. Demo-ready in Axioms today. |
| `posta.list_trip_jobs@1` | read | What John has to collect and deliver on a trip. |
| `posta.match_parcel@1` | write | Run matching for a parcel. Waits for Axioms confirmation flow. |
| `posta.confirm_handover@1` | write | Record a handover with code. Waits for Axioms confirmation flow. |

## 7. Screens (all web, phone-first, no login for drivers)

1. **Ops: new parcel** form.
2. **Ops: new trip** form (later: John sends "Jos to Lagos Friday 7am" on WhatsApp).
3. **Ops: board**: unmatched parcels, open trips, a "Match" button, live leg statuses.
4. **Leg page** `/l/[token]`: one page for John *and* the courier. Shows what, where, when, and
   a code box. Same page, different leg.
5. **Tracking page** `/t/[ref]`: the customer's view, a timeline built from `Event`.

Drivers get a signed link, not an account. Everyone else signs in with their **MarketX account**.

### Sign-in (built 2026-10-17)

Posta has no accounts or passwords of its own (`server/utils/marketx.ts`):
- Login is forwarded to MarketX `POST /api/auth/login`; the tokens go into Posta's own httpOnly
  cookies (`posta_at`, `posta_rt`). The person's IP is passed on, because MarketX limits logins per IP.
- To check a token, Posta asks MarketX `GET /api/profile` (cached 60s). Posta never holds `JWT_SECRET`,
  so it cannot mint MarketX tokens, and MarketX logouts and suspensions still apply.
- Expired tokens are refreshed through MarketX, one refresh per token at a time (MarketX rotates them).
- Uses `/api/*`, not `/api/v1/*`: the v1 alias returns 404 on marketx.africa (bug on the MarketX side).
- When Axioms moves MarketX to ES256 + JWKS, the profile call becomes a local signature check.

## 8. Build order (11 days)

1. Day 1: Nuxt 4 + Prisma + Neon project, 5 tables, seed (2 cities, 3 handover points, John, 1 courier).
2. Day 2: leg state machine as a pure function with its test (copy the trackingTransition approach).
3. Day 3: matching function with its test.
4. Days 4–5: ops forms + board.
5. Days 5–6: leg page with code check; handover auto-creates leg 2.
6. Day 7: tracking page from events.
7. Day 8: WhatsApp messages (reuse the marketX WABA templates/sending code).
8. Day 9: `posta.get_parcel_status@1` in Axioms; Dasah question works.
9. Days 10–11: rehearse the demo end to end on real phones; fix what breaks.

## 9. Left out on purpose

Payments and pricing (show a fixed fee), insurance, live GPS, driver app, multiple cities beyond
the demo pair, partial-route matching.

**Before real parcels move (not for the demo):** driver identity check (NIN), a banned-items list,
a declared-value limit per parcel, and what happens when a handover never happens (timeout →
ops alert).

## 10. National postcode (from docs.postcode.gov.ng, read 2026-10-17)

- Format: 12 characters, 5 segments, e.g. `FC-01-A01-KP-27` = state (2 letters) · LGA (2 digits) ·
  district (3) · area (2 letters) · building unit (2 digits). Posta stores the dashed form
  (`shared/utils/postcode.ts`) and accepts it typed with spaces, dashes or neither.
- API: `https://api.postcode.gov.ng`, header `X-API-Key`. Keys from the dashboard (Settings → API Keys).
  - `GET /v1/lookup?code=…&level=1` says whether a postcode exists. Free. Posta calls it on every
    parcel and handover point when `NUXT_POSTCODE_API_KEY` is a **live** key (`server/utils/postcodeApi.ts`).
  - Test keys only know 5 FCT sandbox buildings (e.g. `FC-01-A01-KP-27`), so Posta skips the check with them.
  - Coordinates come only at lookup level 5 (needs KYB). Reverse geocode (point → postcode) exists.
  - An embeddable postcode picker widget exists (`@nipost/postcode-widget`, 0.1.0, not on npm yet).
- Seeded handover point postcodes have the right shape but are **not real buildings**. Replace them
  with the partner shops' real postcodes before the pitch.

## 11. Screens (built 2026-10-17)

Signed in (MarketX account): Overview `/`, Parcels `/parcels` (+ `/new`, `/[id]`), Trips `/trips`
(+ `/new`, `/[id]`), Handover points `/hubs`. Staff (MarketX `admin` / `support_agent`) see every
parcel and every code; others see what they created and only the codes they hold.

Public, behind unguessable links: carrier job `/l/[token]` (no codes in it), recipient tracking
`/t/[trackToken]` (shows the delivery code while the courier has the parcel).

Matching runs automatically when a parcel or trip is created. `npm run demo -- <yourMarketxId>`
creates John's trip and a parcel and prints all links and codes for rehearsal.
