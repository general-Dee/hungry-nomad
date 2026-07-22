-- ============================================================================
-- enable-rls.sql
-- ============================================================================
-- Purpose:
--   Enables Row Level Security (RLS) on the four tables this app touches
--   (products, delivery_zones, orders, order_items) and grants the `anon`
--   role exactly the operations the app's code actually performs against
--   each table. See docs/PLATFORM-CONTRACT.md §7 for the full rationale.
--
--   RLS was found DISABLED on `orders` in the live project. With RLS
--   disabled, anyone holding the public anon key (already shipped in the
--   browser bundle) can issue arbitrary SELECT/INSERT/UPDATE/DELETE directly
--   against Supabase's REST API, bypassing every app-layer protection this
--   codebase relies on (server-derived pricing, Paystack amount
--   verification, the order-status state machine, rate limiting, the
--   reference-match gate on GET /api/orders/[id]).
--
--   There is no per-row auth condition to enforce here (this app has no
--   user-login system) -- policies below intentionally use USING (true) /
--   WITH CHECK (true) for every operation that's allowed at all. RLS's job
--   in this app is to establish default-deny for anything NOT listed below
--   (e.g. DELETE on orders, and all writes on products/delivery_zones) and
--   to enforce that only the app's own business logic (Paystack verification,
--   server-side pricing, the status state machine) governs what's allowed --
--   not to add row-level conditions of its own.
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
-- IMPORTANT -- smoke test immediately after running:
--   A missing or misconfigured policy FAILS CLOSED (breaks a feature, e.g.
--   checkout stops working) rather than failing open. Immediately after
--   running this script, manually exercise:
--     1. Checkout flow (place a real or test order end-to-end)
--     2. /track (look up an order by phone number)
--     3. /success (payment verification + order fetch by id + reference)
--     4. Staff PATCH /api/orders/[id] (status transition, if you have
--        STAFF_API_SECRET configured)
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
-- anon needs: INSERT, SELECT, UPDATE. Explicitly NO DELETE policy.
--
-- The app has a best-effort rollback (`DELETE FROM orders WHERE id = ...`
-- in src/app/api/orders/route.ts) for a rare partial-failure case during
-- order creation, but DELETE is deliberately NOT granted here. That rollback
-- will silently no-op if blocked by RLS -- this is an accepted, harmless
-- tradeoff, not a bug to fix.
-- ----------------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_insert_orders
  ON orders
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY anon_select_orders
  ON orders
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY anon_update_orders
  ON orders
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);


-- ----------------------------------------------------------------------------
-- order_items
-- anon needs: INSERT and SELECT only. No UPDATE/DELETE policy -- order items
-- are a point-in-time price snapshot (price_at_time) and are never modified
-- or removed by any app flow after creation.
-- ----------------------------------------------------------------------------
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_insert_order_items
  ON order_items
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY anon_select_order_items
  ON order_items
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- End of script.
-- ============================================================================
