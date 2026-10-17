# Moving MarketX shipping into Posta

Status: proposal, nothing moved. Written 2026-10-17.

## The idea

Posta becomes the one place that moves parcels for Indices: GIG Logistics, seller self-delivery,
pickup, and Posta travellers. MarketX becomes a Posta customer, the same way any shop could be.

## What moves today, measured

`marketX/layers/shipping`: about 4,500 lines (GIG provider, self-delivery, pricing, zones,
stations, booking, tracking state machine, quote tokens, 11 API routes). 16 files outside the
layer depend on it. The ones that matter:

| Outside marketX file | Uses | Why it matters |
|---|---|---|
| `commerce/services/order.service.ts` | flat rate, `resolveGroupShipping` | sets the shipping charge on an order |
| `commerce/services/wallet.service.ts` | `verifyShippingQuote` | checks the price the buyer was quoted |
| `server/tasks/pollCarrierTracking.ts` | GIG provider, terminal statuses | watches GIG for scans |
| `server/services/carrierProgress.ts` | tracking state machine | **a carrier scan releases the seller's money** |
| `pod/providers/gig.pod.ts` | GIG booking | pay-on-delivery orders |
| product, seller services, checkout UI | delivery options, rates | what buyers see |

The shipping code also writes straight into MarketX's `orders` table (waybill, tracking number,
carrier status, temp code). That has to stop: two apps writing one table is how money bugs happen.

## Four rules for the boundary

1. **Posta never touches money.** It reports facts: quoted, booked, picked up, delivered, failed.
   MarketX alone decides to release or hold escrow (its `carrierProgress.ts` stays in MarketX).
2. **No shared database.** MarketX keeps `orders`; Posta keeps `shipments`. They talk only through
   a versioned API (`/v1`) and signed events.
3. **Checkout survives Posta being slow or down.** Quotes have a short timeout and fall back to the
   existing flat-rate zones, so a buyer can always pay.
4. **Every money-relevant message is signed, retried and safe to receive twice.**

## The contract

**MarketX → Posta** (server to server, MarketX holds a Posta API key):

- `POST /v1/quotes`: addresses, parcels, seller delivery settings. Returns rates, each with a quote
  token **signed by Posta's private key**. MarketX checks it with Posta's public key. This replaces
  the shared `SHIPPING_QUOTE_SECRET`, which today falls back to `JWT_SECRET`, the key that signs
  every MarketX login. Posta must never hold that key.
- `POST /v1/shipments` (with an idempotency key = MarketX order id): books GIG / self / Posta.
- `GET /v1/shipments/:id`, `GET /v1/dropoff-centres`.

**Posta → MarketX** (webhooks):

- `shipment.booked`, `shipment.picked_up`, `shipment.delivered`, `shipment.failed`.
- Signed (HMAC with a timestamp), sent from an outbox table, retried until MarketX says 200.
  MarketX ignores an event id it has already processed.
- `shipment.delivered` reaches `carrierProgress.ts`, which releases escrow exactly as it does now.

## Steps (each one can be switched off again)

All behind one MarketX setting, `SHIPPING_VIA_POSTA`.

1. **Make Posta production-grade** (list below). Nothing in MarketX changes.
2. **Copy, don't move.** Bring the shipping code and its 3 test files into Posta behind `/v1`.
   MarketX keeps its own copy running.
3. **Shadow.** MarketX asks Posta for quotes alongside its own, logs any difference, and still
   charges its own price. Run a week of real checkouts.
4. **Switch quotes.** Buyers are charged Posta's price; local flat rate is the fallback.
5. **Switch booking and tracking.** Posta books GIG and watches scans; MarketX gets webhooks.
   Prove it on staging first: book, simulate a scan, see escrow release, end to end.
6. **Move orders already on the road.** Every order with a waybill and not yet delivered gets a
   Posta shipment; MarketX's poller turns off.
7. **Delete `layers/shipping` from MarketX.** GIG credentials leave MarketX.

## "Up to standard" checklist for Posta (before step 4)

- [ ] Staging and production on Railway, deployed from git, never by hand.
- [ ] **Database near the app.** Posta's Supabase is in Tokyo (`ap-northeast-1`). Every quote at
      checkout would cross the world twice. Move it to the region MarketX runs in.
- [ ] Typecheck and tests on every push; a red build cannot deploy.
- [ ] Error alerts and an uptime check on `/health`; request ids in every log line.
- [ ] Rate limits on public endpoints (job codes, tracking) per IP, on top of the 5-try lock.
- [ ] Security headers and a content security policy (MarketX already has the pattern).
- [ ] Daily backups with a tested restore.
- [ ] API keys for clients stored hashed; one key per client; can be revoked.
- [ ] OpenAPI description of `/v1`.
- [ ] Quote speed: 95% of quotes under 1.5 seconds including GIG.

## Things to decide

1. **The boundary:** Posta reports, MarketX pays. Agree?
2. **Timing:** recommend the pitch first (27 October), then this. The move touches live payments
   and deserves its own two to three weeks.
3. **Sendbox and Shippo** (legacy, unused): delete rather than move?
4. **Login loop:** Posta signs people in through MarketX, and MarketX will depend on Posta for
   shipping. Not a problem (different paths, and driver/tracking pages need no login), but if
   MarketX is down, Posta's signed-in screens are too.
