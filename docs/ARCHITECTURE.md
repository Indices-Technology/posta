# Posta architecture

Posta follows MarketX's structure so anyone who knows one knows the other.

## Layers

Each domain is a Nuxt layer under `layers/`, listed in the root `nuxt.config.ts`.

| Layer | Owns |
|---|---|
| `core` | sign-in through MarketX, API client, errors, logging, layout, design system (`app/assets/css/main.css`), shared components |
| `delivery` | parcels, trips, legs, matching, carrier jobs (`/l/…`), tracking (`/t/…`) |
| `couriers` | people and courier companies: apply, staff review, jobs, company webhooks |
| `hubs` | fulfilment centres: registration, staff review |
| `notifications` | in-app inbox, WhatsApp, signed webhooks; outbox with retries (every-minute task) |
| `admin` | staff screens: figures, applications to review, stuck parcels |
| `shipping` (next) | carriers moved from MarketX (GIG, self-delivery). See `SHIPPING_MOVE.md` |

Root keeps only what every layer shares: `app/app.vue`, `app/error.vue`, `server/utils/db.ts`,
`server/utils/logger.ts`, `shared/utils/` (wording and postcode helpers used by server and pages),
`prisma/`.

## Inside a layer

```
layers/<domain>/
  nuxt.config.ts
  app/
    pages/           routes
    components/      UI pieces
    composables/     use<Thing>(): what pages call. Calls the API client, updates the store
    services/        <domain>.api.ts: one API client class, extends core BaseApiClient
    stores/          <domain>.store.ts: Pinia, state only, never calls the API
    types/           types for pages, derived from server services (see below)
    utils/           pure helpers for pages
  server/
    api/<domain>/    routes: check who is asking, parse with a schema, call ONE service
    schemas/         zod request shapes, one per action (createParcelSchema …)
    services/        business rules; no Prisma here
    repositories/    ALL Prisma access; write methods take an optional transaction
    utils/           pure rules (legTransition, matching) and external clients
    utils/__tests__/ Vitest specs next to the code they test
```

## The rules

1. **A page never calls `$fetch`.** Page → composable → API client → route.
2. **A route never touches Prisma.** Route → service → repository.
3. **Every route is `defineApiHandler(...)`** (core). It answers `{ success: true, data }` and
   turns errors into one shape: `statusMessage` written for people, `data.code` for code,
   `data.field` for the form field at fault. Unknown errors are logged with the request id and
   shown as a generic 500.
4. **Expected failures throw `AppError`** (`layers/core/server/types/errors.ts`), never `createError`.
5. **Page types come from the server.** `delivery.types.ts` uses
   `Serialize<ReturnType<service>>` and `z.input<schema>`, so a change on the server is
   type-checked on every page that uses it.
6. **API clients are built per call** (inside composables), never shared: on the server they
   carry the visitor's cookies.
7. **Who may see what is decided in services**, not pages (codes, job links, staff data).
8. **Messages go through the outbox.** Call `notificationService.queue(items, tx)` inside the
   transaction that makes the change, then `send(ids)` after it commits. Never send directly.
9. **Pure rules have tests.** Anything with a branch that moves a parcel or money gets a spec.
10. **Imports:** server utils, composables and app utils are auto-imported. Services,
   repositories, schemas, stores and API clients are imported explicitly, as in MarketX.
   Services on the delivery path (match, job, lastMile, notification) use only explicit imports so
   scripts (`prisma/demo.ts`, `scripts/flow-check.ts`) and scheduled tasks can run them outside a request.

## Where MarketX differs, on purpose

- One `defineApiHandler` wrapper instead of a try/catch in every route. Same error order as
  MarketX (HTTP errors pass through, domain errors mapped, the rest logged).
- `BaseApiClient` is smaller: Posta keeps tokens in httpOnly cookies on its own origin, so
  there is no bearer header, client-side refresh or CSRF token to attach.
- API clients return `data` already unwrapped from the envelope.

## Commands

| | |
|---|---|
| `npm run dev` | app on http://localhost:3100 |
| `npm test` | Vitest |
| `npx nuxi typecheck` | types across server and pages |
| `npm run db:migrate` / `db:seed` | Prisma |
| `npm run demo -- <marketxUserId>` | John's trip + a parcel, prints every link and code |
| `npm run check:flow` | end-to-end check of the whole flow on the dev database (both courier paths, every message) |
