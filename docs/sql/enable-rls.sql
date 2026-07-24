-- ============================================================================
-- enable-rls.sql
-- ============================================================================
-- Purpose:
--   Enables Row Level Security (RLS) on the four tables this app touches
--   (products, delivery_zones, orders, order_items). See
--   docs/PLATFORM-CONTRACT.md §7 for the full rationale.
--
--   RLS was found DISABLED on `orders` in the live project. With RLS
--   disabled, anyone holding the public anon key (already shipped in the
--   browser bundle) can issue arbitrary SELECT/INSERT/UPDATE/DELETE directly
--   against Supabase's REST API, bypassing every app-layer protection this
--   codebase relies on (server-derived pricing, Paystack amount
--   verification, the order-status state machine, rate limiting, the
--   reference-match gate on GET /api/orders/[id]).
--
--   Current model: `orders` and `order_items` are default-deny for `anon` --
--   no policies at all are granted to `anon` on those two tables. All app
--   access to those tables (checkout order creation, payment-status updates,
--   /track lookups) now goes through a server-only Supabase client backed
--   by the `service_role` key
--   (`src/lib/supabaseAdmin.ts`), which is never shipped to the browser and
--   bypasses RLS entirely by design. `products` and `delivery_zones` still
--   need browser-side reads (menu display, checkout zone lookup), so `anon`
--   keeps SELECT-only policies on those two tables, same as before.
--
-- How to run:
--   Paste this entire file into the Supabase Dashboard -> SQL Editor and
--   run it. This is NOT a migration file and is not wired into any
--   migration tool -- it's meant to be run manually, once, against the
--   live project. The ALTER TABLE ... ENABLE ROW LEVEL SECURITY statements
--   are safe to re-run; the CREATE POLICY statements are NOT (Postgres has
--   no CREATE POLICY IF NOT EXISTS) -- see the re-run note below before
--   running this script a second time.
--
--   If `orders`/`order_items` already have the old anon_insert_orders /
--   anon_select_orders / anon_update_orders / anon_insert_order_items /
--   anon_select_order_items policies from a prior run of this script, drop
--   them explicitly (DROP POLICY IF EXISTS <name> ON <table>;) -- RLS stays
--   enabled with zero policies for a role, which is what makes it
--   default-deny for `anon` on those two tables now that the app no longer
--   needs anon access to them.
--
-- IMPORTANT -- smoke test immediately after running:
--   A missing or misconfigured policy FAILS CLOSED (breaks a feature, e.g.
--   checkout stops working) rather than failing open. Immediately after
--   running this script, manually exercise:
--     1. Checkout flow (place a real or test order end-to-end)
--     2. /track (look up an order by phone number)
--     3. /success (payment verification + order fetch by id + reference)
--   If any of these break after running this script, re-check the policy
--   list below against the operation that failed.
--
-- Note on CREATE POLICY re-runs:
--   Postgres does not support `CREATE POLICY IF NOT EXISTS`. If you need to
--   re-run this script after policies already exist, either drop the
--   existing policies first (DROP POLICY IF EXISTS <name> ON <table>;) or
--   only run the ALTER TABLE ... ENABLE ROW LEVEL SECURITY lines again (those
--   are safe to repeat) and skip the CREATE POLICY statements that already
--   succeeded.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- products
-- anon needs: SELECT only. No INSERT/UPDATE/DELETE policy -- writes must
-- stay closed, since open write access would let anyone set `price` directly,
-- bypassing all server-side pricing logic (see docs/PLATFORM-CONTRACT.md §2).
-- ----------------------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_select_products
  ON products
  FOR SELECT
  TO anon
  USING (true);


-- ----------------------------------------------------------------------------
-- delivery_zones
-- anon needs: SELECT only. No INSERT/UPDATE/DELETE policy -- same reasoning
-- as products; open write access would let anyone tamper with delivery fees.
-- ----------------------------------------------------------------------------
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_select_delivery_zones
  ON delivery_zones
  FOR SELECT
  TO anon
  USING (true);


-- ----------------------------------------------------------------------------
-- orders
-- anon needs: NOTHING. Default-deny -- no policies granted to `anon` at all.
--
-- All order creation (INSERT), reads (SELECT, e.g. /success, /track), and
-- status updates (UPDATE, e.g. payment verification) now go through the
-- server-only service-role client (src/lib/supabaseAdmin.ts), which
-- bypasses RLS entirely. The anon key
-- (shipped in the browser bundle) has zero access to this table -- direct
-- REST calls to Supabase using the anon key can no longer read or write
-- orders at all, closing the tampering/PII-read hole this script originally
-- existed to fix.
-- ----------------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- order_items
-- anon needs: NOTHING. Default-deny -- no policies granted to `anon` at all.
--
-- Same reasoning as orders above: all order_items reads and writes now go
-- through the service-role client. The anon key has zero access to this
-- table.
-- ----------------------------------------------------------------------------
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- End of script.
-- ============================================================================
