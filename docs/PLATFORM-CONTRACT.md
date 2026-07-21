# Platform Contract

This is the canonical reference for facts about the hungry-nomad Supabase project
and business rules that **any second app reading/writing the same data must respect**
(e.g. an internal staff/backend dashboard). It reflects the code in this repo
(`hungry-nomad`) as of the date below — verified against source, not assumed.

If this doc and the code ever disagree, the code wins; update this doc rather than
trusting it blindly.

Last verified: 2026-07-21, against `hungry-nomad` on branch `main`.

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

**Auth is a provisional stopgap, not real auth.** There is no staff-auth
system in this app (by design — that's the future staff app's job). This
endpoint currently requires a single shared secret sent as the
`x-staff-secret` header, checked against the `STAFF_API_SECRET` env var
(server-only; not currently present in `.env.local` — must be added before
this endpoint will work, and the endpoint fails closed with `503` if unset).
This is one static, unrotatable, all-or-nothing credential — not per-user
auth, no audit trail of *who* transitioned an order. **Before a real staff
app relies on this, it needs proper staff authentication/authorization**
(e.g. Supabase Auth with a staff role + RLS policy, or session-based login)
in place of `STAFF_API_SECRET`, and ideally the underlying Supabase write
should move off the anon key (see §5's note on the absent service-role key).

This app's own code does not call `PATCH /api/orders/[id]` anywhere yet —
it exists purely as the capability a future staff app is expected to call.
`'delivered'`/`'failed'` still have no *automatic* trigger in this codebase
(e.g. no refund flow sets `'failed'` on a `paid` order); a staff app or
person is expected to call this endpoint deliberately.

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
  policies exist on the Supabase project — this repo's code doesn't define
  or verify RLS policies, so don't assume the anon key alone is sufficient
  for a staff app's write needs)
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID` (only relevant
  if the staff app also wants shared analytics — otherwise skip)

### Must stay exclusive to this app — do not copy
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

### Notably absent from this app
There is **no Supabase service-role key** (`SUPABASE_SERVICE_ROLE_KEY` or
similar) anywhere in this codebase — `src/lib/supabaseClient.ts` only ever
constructs a client with the public anon key. This app does all of its
writes (order creation, payment status updates) through the anon key,
meaning either RLS is permissive enough to allow it or RLS is not enforced
on these tables — not verifiable from this repo alone. A staff app that
needs elevated/bypass-RLS access (e.g. to update `orders.status` to
`'delivered'` as an authenticated staff action) will need to provision and
manage **its own** service-role key — there is nothing to reuse from this
app for that purpose.

---

## 6. Naming Convention

This app's manager agent is named **Nomad** (`CLAUDE.md`, `## NAME`), purely
as this repo's own convention. A second app's manager agent can reuse the
name or pick its own — there's no requirement either way.
