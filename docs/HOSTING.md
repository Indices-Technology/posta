# Hosting Posta at posta.indicestech.com

Status: plan. Nothing deployed yet.

## Shape

| Piece | Where | Why |
|---|---|---|
| App | One Railway service, `posta-web`, same account as MarketX's `mx-web` / `mx-worker` | Same host the team already runs; long-running Node (the every-minute notification task needs a process that stays up, so not serverless) |
| Database | Postgres **in the same region as the Railway service** | Today's Supabase project is in Tokyo (`ap-northeast-1`); every request would cross the world. Move it first |
| Domain | `posta.indicestech.com` → CNAME to the Railway domain | Railway issues the certificate |
| Website | indicestech.com/logistics links to it once live (`postaLive` in `webpage/pages/logistics/index.vue`) | |

Run **one instance** for now: the MarketX profile cache and the refresh-token single-flight live in
memory (marked `ponytail:` in `layers/core/server/utils/marketx.ts`). The notification outbox is
already safe with several instances (each send is claimed in the database).

## Railway service

- **Build:** `npm ci && npm run build` (the `postinstall` step runs `nuxt prepare` and `prisma generate`).
- **Pre-deploy:** `npx prisma migrate deploy`, using a direct or session-mode connection, never a
  transaction pooler (port 6543 breaks migrations, see MarketX's Neon note for the same trap).
- **Start:** `node .output/server/index.mjs`
- **Health check:** `GET /api/health` (200 when the database answers, 503 when it doesn't).

## Environment

| Variable | Value |
|---|---|
| `DATABASE_URL` | the new, same-region database |
| `NUXT_MARKETX_API_URL` | `https://marketx.africa` |
| `NUXT_PUBLIC_SITE_URL` | `https://posta.indicestech.com` (used in every WhatsApp and webhook link, the canonical tag and link previews) |
| `NUXT_POSTCODE_API_KEY` | a **live** postcode.gov.ng key (test keys know only 5 FCT sandbox buildings) |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | MarketX's WABA values, once the 3 Posta templates are approved (`INTEGRATIONS.md`) |
| `NODE_ENV` | `production` (makes cookies `secure`) |
| `DATABASE_POOL_MAX` | database connections per running copy. Default 3. On Vercel keep it at 1–3 and use Supabase's **transaction pooler** (port 6543): every serverless copy opens its own pool, and the session pooler allows only 15 clients in total |

Do not copy `VERCEL*` or a development `NODE_ENV` across hosts (MarketX learned this in its cutover).

## DNS

`indicestech.com` DNS is served by **Namecheap** (nameservers `dns1/dns2.registrar-servers.com`,
checked 2026-10-20). The apex `A` record points at Vercel (`216.198.79.1`), where the website runs.
Posta gets its own subdomain record; the website is untouched.

1. Railway → `posta-web` → Settings → Networking → **Custom domain** `posta.indicestech.com`.
   Railway shows a CNAME target (and, if it asks, a TXT verification record).
2. Namecheap → Domain List → `indicestech.com` → **Advanced DNS** → Add record:
   `CNAME` · Host `posta` · Value `<railway target>` · TTL Automatic. Add Railway's TXT record too if shown.
3. Wait for Railway to show the domain as verified and the certificate issued (minutes, sometimes an hour).
4. Check: `curl -I https://posta.indicestech.com/api/health` → 200 and the security headers.

### Why Posta is not on Vercel with the website

- The notification outbox needs a task every minute; Vercel cron on the Hobby plan runs at most once a day.
- Serverless instances don't share memory, so the MarketX token-refresh guard (one refresh per token)
  stops working and people get signed out when two requests arrive together.
- Each serverless instance opens its own database connections; a long-running server keeps one pool.
The website is static-ish content and suits Vercel; Posta is an always-on service and suits Railway.

## Elsewhere once it's live

- **Axioms:** `POSTA_API_URL=https://posta.indicestech.com`.
- **Website:** set `postaLive = true` in `webpage/pages/logistics/index.vue`.
- **postcode.gov.ng:** if the postcode widget is added, put `https://posta.indicestech.com` on the key's origin allowlist.
- **MarketX:** nothing. Posta signs people in by calling MarketX's API from its own server.

## Before the first real parcel

- [ ] Database moved next to the app; daily backups on and one restore tried.
- [ ] Replace the 3 demo centres (made-up postcodes) with real partner shops, or remove them.
- [ ] `npm run check:flow` against **staging**, never production (it refuses `NODE_ENV=production`).
- [ ] Uptime monitor on `/api/health`; error alerts from the logs.
- [ ] Content-Security-Policy (MarketX's `nuxt.config.ts` has the pattern; allow Google Fonts).
- [ ] NIPOST courier licensing, and a data-processing agreement with MarketX (buyer details flow to Posta).
