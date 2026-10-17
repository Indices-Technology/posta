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

Suggested wording is the `text` of each entry in `layers/notifications/server/utils/templates.ts`.
