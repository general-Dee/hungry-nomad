# Platform Contract

This is the canonical reference for facts about the hungry-nomad Supabase project
and business rules that **any second app reading/writing the same data must respect**
(e.g. an internal staff/backend dashboard). It reflects the code in this repo
(`hungry-nomad`) as of the date below — verified against source, not assumed.

If this doc and the code ever disagree, the code wins; update this doc rather than
trusting it blindly.

Last verified: 2026-07-23, against `hungry-nomad` on branch `main`.

---

## 1. Supabase Schema (as used by this app)

The app only ever accesses these tables. Columns listed are the ones actually
read or written in code — there may be additional columns in the real database
that this app simply never touches (e.g. `products.subcategory` is read but
optional; anything not listed here is unverified from this repo alone).

### `products`
Read in `src/app/menu/page.tsx`, `src/app/track/page.tsx` (reorder), and
`src/app/api/orders/route.ts`.

| column | type (TS) | notes |
|---|---|---|
| `id` | `number` | PK, referenced by `order_items.product_id` |
| `name` | `string` | |
| `description` | `string` | |
| `price` | `number` | source of truth for pricing — see §2 |
| `category` | `'fast_food' \| 'regular' \| 'chinese' \| 'icecream' \| 'beverages'` | drives takeaway-fee logic, see §2 |
| `subcategory` | `string` (optional) | |
| `image_url` | `string` | |
| `created_at` | `string` | |

TS shape: `src/types/index.ts` (`Product` interface).

### `delivery_zones`
Read in `src/app/checkout/page.tsx` and `src/app/api/orders/route.ts`.

| column | type | notes |
|---|---|---|
| `id` | `number` | |
| `lga_name` | `string` | unique zone name (Local Government Area); looked up by exact match in the orders API |
| `fee` | `number` | flat delivery fee for that zone, in Naira |

No dedicated TS interface exists for this table; shape is inferred from a local
`DeliveryZone` interface in `checkout/page.tsx` and the `select('lga_name, fee')`
in the orders API.

### `orders`
Written by `src/app/api/orders/route.ts` (insert, `status: 'pending'`) and
`src/app/api/verify-payment/route.ts` (update, `status: 'paid'` +
`payment_reference`). Read by `src/app/api/orders/[id]/route.ts` (requires a
matching `reference` query param, see §4) and
`src/app/api/orders/track/route.ts`.

Columns confirmed in use by code (insert/select), combining the `Order` TS
interface (`src/types/index.ts`) with what the orders API actually inserts:

| column | type | notes |
|---|---|---|
| `id` | `number` | PK |
| `customer_name` | `string` | |
| `customer_email` | `string` | |
| `customer_phone` | `string` | used for order lookup in `/api/orders/track` (last-10-digits match, see below) |
| `customer_address` | `string` | |
| `delivery_lga` | `string` | **written by the orders API, but missing from the `Order` TS interface** — see "Known drift" below |
| `delivery_fee` | `number` | **written by the orders API, but missing from the `Order` TS interface** — see "Known drift" below |
| `total_amount` | `number` | server-derived, see §2 — never trust a client-supplied value for this |
| `payment_reference` | `string \| null` | set on successful Paystack verification |
| `status` | `'pending' \| 'paid' \| 'failed' \| 'delivered'` (declared type) | in practice only `'pending'` and `'paid'` are ever set by this app's code — see §4 |
| `created_at` | `string` | |

**Known drift:** `src/types/index.ts`'s `Order` interface does not declare
`delivery_lga` or `delivery_fee`, even though `src/app/api/orders/route.ts`
inserts both. Don't assume the TS interface is a complete/accurate schema
description — the API route's actual `.insert()` call is the more reliable
source for what's on this table.

### `order_items`
Written by `src/app/api/orders/route.ts` (insert) and read by
`src/app/api/orders/[id]/route.ts`, `src/app/api/orders/track/route.ts`,
and `src/app/api/verify-payment/route.ts` (all via a join to `products` for
`name`).

| column | type | notes |
|---|---|---|
| `id` | `number` | PK (per `OrderItem` TS interface; not selected anywhere in code) |
| `order_id` | `number` | FK to `orders.id` |
| `product_id` | `number` | FK to `products.id` |
| `quantity` | `number` | |
| `price_at_time` | `number` | snapshot of `products.price` at order time — item pricing is never re-read from `products` after order creation, so `products.price` can change later without affecting past orders |

Note: `category` is computed in-memory in the orders API (joined from
`products.category`, used only to decide the takeaway fee) but is **not**
persisted on `order_items`. If a second app needs an item's category, it must
join through `product_id` → `products.category`.

**Relationship summary:** `orders` 1—* `order_items` *—1 `products`;
`orders.delivery_lga` matches `delivery_zones.lga_name` by string equality
(no FK enforced in code — the orders API does a `.eq('lga_name', ...)` lookup,
not a join).

---

## 2. Pricing Rules — HARD RULE

**Order totals must always be server-derived and Paystack-verified. Never trust
a client-supplied amount for anything money-related.** This was already the
subject of a price-tampering fix (`7a0bd64`) — any second app that creates or
modifies orders must follow the same pattern, not shortcut it.

Source: `src/lib/pricing.ts`, `src/app/api/orders/route.ts`,
`src/app/api/verify-payment/route.ts`.

- `TAKEAWAY_FEE = 300` (Naira), flat.
- `requiresTakeawayFee(items)` returns `true` if any item's `category` is
  `'regular'` or `'chinese'` (`TAKEAWAY_CATEGORIES`). Fast food, ice cream,
  and beverages do not trigger it.
- **Order creation** (`POST /api/orders`): the client sends only
  `product_id` + `quantity` per line item, plus a `delivery_lga` string —
  never a price. The server then:
  1. Looks up each `product_id`'s `price` and `category` fresh from `products`.
  2. Looks up the delivery `fee` fresh from `delivery_zones` by `lga_name`.
  3. Computes `subtotal` from server-fetched prices, adds `deliveryFee`, adds
     `takeawayFee` (0 or `TAKEAWAY_FEE`, per `requiresTakeawayFee`).
  4. Inserts the order with that server-computed `total_amount`.
- **Payment verification** (`POST /api/verify-payment`): given a Paystack
  `reference` and `order_id`, the server calls Paystack's
  `/transaction/verify/:reference` endpoint (using `PAYSTACK_SECRET_KEY`) and
  treats **Paystack's returned amount as ground truth**. It compares
  `data.data.amount` (kobo) against `Math.round(order.total_amount * 100)`
  (the order's own server-computed total, converted to kobo). If they don't
  match, the order is **not** marked paid — a `400` is returned and nothing
  is updated. Only on a match does it set `orders.status = 'paid'` and
  `orders.payment_reference = reference`.

Any second app that needs to create orders, adjust prices, or mark orders paid
must replicate this "derive server-side, verify against Paystack" pattern —
it must not accept a total from a client/caller and write it directly.

---

## 3. Business Hours Gating

Source: `src/lib/businessHours.ts`.

- `BUSINESS_HOURS_LABEL = '11:00am – 9:30pm'`.
- `isWithinBusinessHours(date?)`: open window is `11:00`–`21:30` (exclusive
  upper bound), computed in the `Africa/Lagos` timezone (WAT, UTC+1, no DST)
  via `Intl.DateTimeFormat`, independent of the server's local timezone.

**Enforced in two places, both server- and client-side:**
- Client: `src/app/checkout/page.tsx` checks `isWithinBusinessHours()` on
  mount and every 60s, disables the "Proceed to payment" button and shows a
  closed-notice banner when outside hours.
- Server: `src/app/api/orders/route.ts` (`POST /api/orders`) calls
  `isWithinBusinessHours()` as the **first** check in the handler and returns
  `403` with a message referencing `BUSINESS_HOURS_LABEL` if outside the
  window — the client-side check is not the only gate, so this can't be
  bypassed by calling the API directly.

`POST /api/verify-payment` does **not** re-check business hours — it only
confirms a payment for an order that was already created within hours. This
means a payment initiated near closing time could complete verification
slightly after hours; that is accepted current behavior, not a bug this doc
is flagging.

A second app should treat `isWithinBusinessHours`/`BUSINESS_HOURS_LABEL` as
the single source of truth for "are we open" and, if it needs the same gate
(e.g. to block staff from manually creating an order outside hours), should
reuse the same window rather than defining its own — currently there's no
shared package for this logic, so it would need to be duplicated verbatim or
factored out later.

---

## 4. Order Lifecycle / Status Values

Source: `src/types/index.ts` (`Order.status` type), `src/app/track/page.tsx`
(`OrderStatus` type + `STEPS` UI), `src/app/api/orders/route.ts`,
`src/app/api/verify-payment/route.ts`, `src/lib/orderStatus.ts`,
`src/app/api/orders/[id]/route.ts` (`PATCH` handler).

The declared TypeScript type is:

```ts
status: 'pending' | 'paid' | 'failed' | 'delivered'
```

**What's actually verified from code:**
- `'pending'` — set on order creation (`POST /api/orders`), the only value
  ever inserted.
- `'paid'` — set on successful, amount-verified Paystack payment
  (`POST /api/verify-payment`).
- `'failed'` and `'delivered'` — not written by any *automatic* flow, but as
  of this update can be set via the status-transition endpoint below.

### `GET /api/orders/[id]` — fetch an order's details

`orders.id` is a small sequential integer, so a bare lookup-by-id would let
anyone enumerate every order (and every customer's name, phone, email, and
address) by walking `/api/orders/1`, `/2`, `/3`, ... This endpoint requires
the caller to already know the order's Paystack payment reference, proving
they were part of the checkout: pass it as a `reference` query param (e.g.
`GET /api/orders/123?reference=<payment_reference>`). The `reference` is
compared against the order's stored `payment_reference` column; if it's
missing or doesn't match, the endpoint returns `404` — the same status code
used when the order id itself doesn't exist, so a caller can't distinguish
"wrong id" from "wrong reference" via status code. This mirrors the
ownership-proof pattern `POST /api/orders/track` uses (phone-number match
instead of payment reference). Also rate-limited via
`src/lib/ratelimit.ts` (`orderGetRatelimit`), same graceful no-op-if-Upstash-
isn't-configured behavior as the other order routes.

The only in-app caller is `src/app/success/page.tsx`, right after payment
verification succeeds, where both `order_id` and `reference` are already
available from the success-page URL's search params.

### Status transition state machine

`src/lib/orderStatus.ts` defines the only valid transitions, enforced
server-side (not just documented here):

| from | can transition to |
|---|---|
| `pending` | `paid`, `failed` |
| `paid` | `delivered`, `failed` |
| `delivered` | *(none — terminal)* |
| `failed` | *(none — terminal)* |

Same-status "transitions" (e.g. `paid -> paid`) and anything not listed
(e.g. `delivered -> pending`) are rejected.

### `PATCH /api/orders/[id]` — transition an order's status

Body: `{ "status": "paid" | "failed" | "delivered" | "pending" }`. Validates
the transition via `src/lib/orderStatus.ts` against the order's current
status; returns `409` with an explanatory message if the transition isn't
allowed, `404` if the order doesn't exist, `200` with the updated order on
success.

**Auth: real per-user Supabase Auth, gated on a staff role.** The caller
must present a valid Supabase Auth access token as
`Authorization: Bearer <token>`. `src/lib/staffAuth.ts` validates the token
via `supabaseAdmin.auth.getUser(token)` and requires the resulting user's
`app_metadata.role` to equal `'staff'` — `app_metadata` (unlike
`user_metadata`) is only writable by a service-role/admin client, so a user
can never self-elevate to staff from the browser. Unauthenticated or
invalid/expired tokens get `401`; an authenticated user without the staff
role gets `403`. This replaces the old `x-staff-secret` /
`STAFF_API_SECRET` shared-secret stopgap — auth is now per-user (each caller
authenticates as themselves, not as one shared credential) and every
successful transition is logged with the acting staff user's id/email
(`console.log`, not persisted on the `orders` row — no schema change was
made for this).

This app now ships a minimal staff-facing UI to obtain and use that session:
`/staff/login` (`src/app/staff/login/page.tsx`) is an email/password sign-in
form against Supabase Auth (`supabase.auth.signInWithPassword`), and
`/staff` (`src/app/staff/page.tsx`) is a bare-bones authenticated page — not
a full order-management dashboard — with a form that calls this PATCH
endpoint directly using the signed-in user's access token. Staff accounts
are regular Supabase Auth users; there is no self-serve signup, and being
signed in does **not** imply staff access — the app owner must separately
grant `app_metadata.role = 'staff'` to a user's account after they exist
(see `docs/sql/set-staff-role.sql` for the SQL, or the equivalent
`supabaseAdmin.auth.admin.updateUserById` call), which is what actually
gates the PATCH endpoint.

Aside from `/staff` and `/staff/login`, this app's own code does not call
`PATCH /api/orders/[id]` anywhere else — it otherwise exists purely as the
capability a fuller future staff app is expected to call. `'delivered'`/
`'failed'` still have no *automatic* trigger in this codebase (e.g. no
refund flow sets `'failed'` on a `paid` order); a staff app or person is
expected to call this endpoint deliberately.

---

## 5. Environment / Secrets Boundary

Source: variable names referenced via `process.env.*` across `src/`, cross-checked
against local `.env.local` (values not reproduced here).

### Safe to duplicate in a second app's own config
These identify the *same* public-facing Supabase project/anon access and
public tracking IDs — safe to reuse as-is since they carry no elevated
privilege:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (subject to whatever Row Level Security
  policies exist on the Supabase project — the intended policy set is
  defined in `docs/sql/enable-rls.sql` and summarized in §7 below. As of this
  update, the anon key has **zero** access to `orders`/`order_items` — those
  tables are default-deny for `anon`. A second app's own writes/reads to
  those two tables must go through its own service-role key or equivalent,
  not the anon key.)
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID` (only relevant
  if the staff app also wants shared analytics — otherwise skip)

### Must stay exclusive to this app — do not copy
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used exclusively by
  `src/lib/supabaseAdmin.ts`. This client is imported only from API routes
  (`src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts`,
  `src/app/api/verify-payment/route.ts`, `src/app/api/orders/track/route.ts`)
  for every `orders`/`order_items` read and write; it bypasses Row Level
  Security entirely, so it must never be prefixed `NEXT_PUBLIC_` and must
  never be imported from a `'use client'` component or any module that ends
  up in the browser bundle. A staff app needing elevated/bypass-RLS access
  must provision and manage its own service-role key — do not reuse this
  app's.
- `PAYSTACK_SECRET_KEY` — used server-side only, in
  `src/app/api/verify-payment/route.ts`, to call Paystack's verify endpoint.
  A staff app should not need this unless it independently verifies payments
  (which would be duplicating this app's job — prefer having the staff app
  read `orders.status`/`payment_reference` instead).
- `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `STAFF_EMAIL` — this app's own email
  sending config (`src/lib/email.ts`). A staff app sending its own
  notifications should provision its own Resend key/from-address, not reuse
  this app's.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — rate limiting is
  optional and silently skipped if unset (`src/lib/ratelimit.ts`); a staff
  app needing its own rate limiting should provision its own Redis instance,
  not share this app's rate-limit keyspace/prefixes (`ratelimit:orders:create`,
  `ratelimit:orders:track`).
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
  — this app's own error tracking project. A staff app should have its own
  Sentry project/DSN so errors from the two apps aren't mixed together.
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` — technically public (used client-side to
  open the Paystack widget), but there's no reason a staff/admin dashboard
  would need to initiate customer payments, so treat it as not-applicable
  rather than something to copy.

### Two Supabase clients, split by privilege
This app now has two Supabase clients, deliberately split by where each is
allowed to run:
- `src/lib/supabaseClient.ts` — the public anon-key client. Used both
  browser-side (client components, RSCs) and, in
  `src/app/api/orders/route.ts`, for the `products`/`delivery_zones` lookups
  during order creation (read-only, no PII, safe under the anon key's
  SELECT-only policies on those two tables).
- `src/lib/supabaseAdmin.ts` — the service-role client
  (`SUPABASE_SERVICE_ROLE_KEY`, server-only). Used exclusively by the four
  API routes that touch `orders`/`order_items` (order creation, payment
  verification, `/track` lookups, and the staff status-transition endpoint)
  — see §7 for the full table. It bypasses RLS by design, which is why
  `orders`/`order_items` are now default-deny for `anon`: the app's own
  ownership-proof checks (reference match, phone match, staff-role Supabase
  Auth check — see §4) are what actually gate access to those tables now,
  not RLS.

Those RLS policies are explicitly defined in `docs/sql/enable-rls.sql` (see
§7 below for a summary); running that script against a live Supabase project
is a manual, one-time operation the developer performs from the Supabase
Dashboard, not something automated by this repo.

A staff app that needs elevated/bypass-RLS access to `orders`/`order_items`
(e.g. to update `orders.status` to `'delivered'` as an authenticated staff
action) will need to provision and manage **its own** service-role key or
proper staff auth — do not reuse this app's `SUPABASE_SERVICE_ROLE_KEY`.

---

## 6. Naming Convention

This app's manager agent is named **Nomad** (`CLAUDE.md`, `## NAME`), purely
as this repo's own convention. A second app's manager agent can reuse the
name or pick its own — there's no requirement either way.

---

## 7. Row Level Security Policies

Source: `docs/sql/enable-rls.sql`. This documents the policy set as defined
in that script.

RLS was originally found DISABLED on `orders` in the live project — with RLS
disabled, anyone holding the public anon key (already shipped in the browser
bundle) could issue arbitrary SELECT/INSERT/UPDATE/DELETE directly against
Supabase's REST API on any table, bypassing every app-layer protection this
codebase relies on. The first fix for that (RLS enabled, anon granted
`USING (true)`/`WITH CHECK (true)` policies on `orders`/`order_items`) closed
the "RLS disabled entirely" hole but still left the anon key able to insert,
read, and update every row in `orders`/`order_items` directly — enough to
tamper with `total_amount`/`status` or read every customer's PII via a
direct REST call, entirely bypassing the app's API routes.

**Current model:** `orders` and `order_items` are now **default-deny for
`anon`** — zero policies granted, of any kind. All access to those two
tables goes through the server-only service-role client
(`src/lib/supabaseAdmin.ts`, see §5), which bypasses RLS entirely and is
never shipped to the browser. `products` and `delivery_zones` still need
browser-side reads (menu display, checkout zone lookup) and keep their
anon SELECT-only policies, unchanged.

| table | `anon` operations granted | notes |
|---|---|---|
| `products` | `SELECT` | No write policy — writes must stay closed, or anyone could set `price` directly and bypass all server-side pricing logic. |
| `delivery_zones` | `SELECT` | No write policy — same reasoning, for delivery fees. |
| `orders` | *(none)* | Default-deny. All reads/writes go through `supabaseAdmin` (service-role key, server-only) from the four API routes listed in §5 — the anon key cannot touch this table via direct REST calls at all. |
| `order_items` | *(none)* | Default-deny. Same as `orders` — all access goes through `supabaseAdmin`. |

Because the anon key now has zero access to `orders`/`order_items`, RLS is a
real, enforced boundary against direct-REST-call tampering/PII reads on
those two tables — not just a backstop behind app-layer logic. The app's own
ownership-proof checks (the `reference` query param on
`GET /api/orders/[id]`, the phone-number match on `POST /api/orders/track`,
the staff-role Supabase Auth check on `PATCH /api/orders/[id]` — see §4)
still matter: they're what gates *which* rows a legitimate API-route call can
read/write, since the service-role client itself has no row-level
restriction once a request reaches it. Server-derived pricing (§2) and
Paystack amount verification (§2) remain the source of truth for what
`total_amount`/`status` are allowed to be, independent of RLS.
