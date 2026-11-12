# Posta integrations

## 1. Courier companies (receiving jobs in your own system)

Register at **Work with Posta → Courier company**, choose **Our system**, and give a public
`https://` address. Once staff approve you, your secret is on **My work** (only your account sees it).

When a parcel in your city reaches a Posta fulfilment centre and you are the least busy approved
courier there, Posta POSTs to your address:

```http
POST https://your-system/posta
content-type: application/json
x-posta-signature: t=1760700000,v1=5f2c…
user-agent: Posta-Webhooks/1

{
  "id": "6b1f…",                 // same on every retry: ignore ids you've already handled
  "event": "job.assigned",
  "createdAt": "2026-10-17T14:02:11.000Z",
  "data": {
    "ref": "#1001",
    "job": {
      "ref": "#1001",
      "contents": "2 pairs of sandals",
      "weightKg": 1.5,
      "collectFrom": { "name": "Yaba Partner Shop", "postcode": "LA-02-A01-YB-01", "phone": "+234…" },
      "deliverTo":   { "name": "Chidi Okafor",      "postcode": "LA-02-A01-YB-07", "phone": "+234…" },
      "by": "2026-10-17T20:02:11.000Z",
      "link": "https://posta…/l/…"   // give this to your rider
    }
  }
}
```

**Check the signature** before trusting the body:
`v1 = hex(HMAC-SHA256(secret, "<t>.<raw body>"))`, compare in constant time, and reject a `t` more
than 5 minutes old. (Posta's own check: `layers/notifications/server/utils/channels/webhook.ts`.)

Answer any **2xx** once you have stored it. Anything else, or no answer in 8 seconds, is retried
after 1, 5, 15 and 60 minutes, then marked failed for Posta staff.

**No codes are ever sent to you.** Your rider opens the link, collects at the centre with the code
the centre gives them, and delivers with the code the recipient gives them. That is the proof.

## 2. Carriers Posta books (GIG, DHL …)

These go the other way: Posta calls *their* API to book and track. They arrive with the shipping
layer moving from MarketX (`SHIPPING_MOVE.md`), behind MarketX's existing provider contract
(`IShippingProvider`). GIG is already written there. DHL needs a DHL Express business account and
MyDHL API credentials first.

## 3. Axioms (and so Dasah)

Posta accepts the person's **MarketX access token** as `Authorization: Bearer …`, the same identity
Dasah already holds. Capabilities in `axioms/src/capabilities/posta/`:

| Capability | Risk | Calls |
|---|---|---|
| `posta.list_parcels@1` | read | `GET /api/delivery/parcels` |
| `posta.get_parcel_status@1` | read | `GET /api/delivery/parcels?number=1001` |

They return plain words (status, route, recipient), never codes or carrier phone numbers. Axioms
needs `POSTA_API_URL`. Write capabilities (book a parcel, post a trip) wait for Axioms' confirmation flow.

## 4. WhatsApp

Same Cloud API and env names as MarketX: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
(optional `WHATSAPP_TEMPLATE_LANG`, default `en_US`). Without them, WhatsApp messages are kept as
`SKIPPED` and their text is logged.

Messages Posta starts must use **Meta-approved templates**. Create these (Utility category) in
WhatsApp Manager before turning WhatsApp on:

| Template | Body ({{n}} in this order) |
|---|---|
| `posta_job_assigned` | carrier, ref, from, to, link |
| `posta_parcel_on_its_way` | recipient, fromCity, code, link |
| `posta_parcel_delivered` | ref, recipient |
| `posta_job_offer` | carrier, ref, from, link |
| `posta_ready_for_collection` | recipient, hub, link |

Suggested wording is the `text` of each entry in `layers/notifications/server/utils/templates.ts`.

## 5. Delivery quotes for platforms (MarketX first)

`POST /api/v1/quotes`, server to server. Send your key in `x-posta-key` (Posta stores only its
hash, in `NUXT_API_KEYS`; one key per client, removed to revoke). 600 requests a minute per client.

```jsonc
{
  "origin":      { "city": "Aba", "state": "Abia", "country": "NG", "lat": 5.1, "lng": 7.36 },
  "destination": { "city": "Ikeja", "state": "Lagos" },
  "parcel": { "weightKg": 1.5 },
  "declaredValueMinor": 2500000,   // kobo; 0 = uninsured
  "subtotalMinor": 2500000,        // for the seller's free-delivery threshold
  "mode": "door",                  // optional: door | collect. Omit for both
  "carriers": ["self", "gig"],     // optional: which carriers you can use. Omit for all
  "sellerShipping": { "selfEnabled": true, "flatRateMinor": 300000, "pickupEnabled": true },
  "strategy": "best-value"         // best-value | cheapest | fastest | safest
}
```

Carriers: `self` (the seller's own delivery and pickup, priced from `sellerShipping`), `gig` (live
GIG price plus Posta's markup), `posta` (Posta's network; only when `NUXT_NETWORK_QUOTES=true`).
Each carrier gets 7.5 s; one that is slower drops out rather than holding up the rest.

Response, best first:

```jsonc
{ "success": true, "data": { "strategy": "best-value", "quotes": [{
  "id": "gig-standard", "carrier": { "id": "gig", "name": "GIG Logistics" },
  "service": "standard", "delivery": "door", "rateRef": null,
  "priceMinor": 1147241,           // charged online, insurance included
  "insuranceMinor": 25000,         // part of priceMinor, passed on at cost
  "payOnDelivery": false, "payOnDeliveryMinor": 0,   // cash to the rider, never charged online
  "currency": "NGN",
  "eta": { "text": "3–4 working days", "minHours": 72, "maxHours": 96 },
  "insurance": { "covered": true, "coverMinor": 2500000, "claimsWindowHours": 24 },
  "score": 0.6, "badges": ["fastest", "insured"]
}]}}
```

Ranking (`layers/shipping/server/utils/rank.ts`): best-value scores price 60 %, time 30 %,
insurance 10 %, using the full cost to the buyer (cash on arrival included). Badges `cheapest`,
`fastest` only appear when there is more than one option.

Quotes only for now. Booking, tracking and delivery events follow (SHIPPING_MOVE.md steps 5 to 7).

## 6. Address to national postcode (MarketX first)

`POST /api/v1/addresses/resolve`, same `x-posta-key` as §5. Posta stores nothing from it.

NIPOST cannot read a typed address, only a map point, so everything becomes a point first:
postcode (checked with NIPOST) · GPS `lat`/`lng` · `mapLink` (Google/Apple links; `maps.app.goo.gl`
short links are expanded once, no other host is fetched) · typed `address` + `city` + `state`
(OpenStreetMap search). Then NIPOST gives the building nearest the point (within 250 m).

```json
{ "address": "12 Herbert Macaulay Way", "city": "Yaba", "state": "Lagos", "lat": 6.5095, "lng": 3.3711 }
→ { "status": "found", "source": "gps", "postcode": "LA-02-A01-YB-07", "lat": 6.5095, "lng": 3.3711,
    "distanceM": 12, "place": "Yaba, Lagos" }
```

`status`: **found** (precise point, NIPOST sure: save it) · **check** (a typed street or an unsure
match: ask "is this your building?") · **none** (keep the typed address; `lat`/`lng` may still be set).
A typed street is never `found`: its nearest building is a neighbour's.

Needs a **live** NIPOST key (`nipost_live_`); test keys only know 5 sandbox buildings in the FCT.

## 7. Shipments for platforms (MarketX first)

Same `x-posta-key` as §5. The shipment is the one thing Posta keeps from a client.

- `POST /api/v1/shipments`: book a paid order. `clientRef` = the client's order id; booking twice with
  it returns the same shipment (`alreadyBooked: true`), never a second parcel. `mode: pickup` returns a
  waybill; `mode: dropoff` returns a GIG `tempCode` and `dropoffCentre`, and the waybill comes later.
- `GET /api/v1/shipments/:code`: current status. Another client's code answers 404.
- `POST /api/v1/shipments/:code/waybill {waybill}`: a drop-off was handed in; tracking starts.
- `POST /api/v1/shipments/:code/simulate {status}`: staging only (`POSTA_ALLOW_SIMULATE=true`).

```json
POST /api/v1/shipments
{ "clientRef": "233", "carrierId": "gig", "mode": "pickup",
  "origin":      { "name": "Star Collections", "street1": "…", "city": "Umuahia", "state": "Abia", "phone": "+234…" },
  "destination": { "name": "Ada Obi", "street1": "…", "city": "Yaba", "state": "Lagos", "phone": "+234…", "zip": "LA-02-A01-YB-07" },
  "parcel": { "weightKg": 0.5 }, "declaredValueMinor": 2500000, "settlementMode": "ESCROW_POD" }
→ { "code": "PST-7K3Q9X", "clientRef": "233", "carrierId": "gig", "mode": "pickup", "waybill": "1234567",
    "tempCode": null, "dropoffCentre": null, "labelUrl": null, "status": "PRE_TRANSIT", "alreadyBooked": false }
```

**Status webhooks.** Posta reads GIG every 15 minutes. Each forward move (PRE_TRANSIT → IN_TRANSIT →
OUT_FOR_DELIVERY → DELIVERED, or RETURNED / FAILURE) is posted to the client's URL in
`NUXT_CLIENT_WEBHOOKS`, signed like §1 (`x-posta-signature`), body
`{ id, event: "shipment.updated", createdAt, data: <the shipment as above> }`. Retried after 1, 5, 15
and 60 minutes. A status never goes backwards, so a receiver can apply repeats safely. Posta reports;
the client decides about money (MarketX releases escrow on DELIVERED).
