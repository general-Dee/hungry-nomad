-- ============================================================================
-- add-attribution-columns.sql
-- ============================================================================
-- Purpose:
--   Adds ad-attribution columns to `orders` so orders placed via Meta (and
--   other UTM-tagged) ad traffic can be tied back to the campaign/ad that
--   drove them. Captured client-side from the landing URL's query string
--   (see src/lib/attribution.ts) and threaded through order creation
--   (src/app/api/orders/route.ts). `fbclid` additionally feeds the `fbc`
--   parameter on the server-side Meta Conversions API Purchase event (see
--   src/lib/paystackPayment.ts's confirmOrderPaid, src/lib/metaCapi.ts).
--
--   All six columns are nullable TEXT — most orders (direct traffic, organic,
--   repeat customers) will have none of these set, and that's expected.
--
-- How to run:
--   Paste this entire file into the Supabase Dashboard -> SQL Editor and
--   run it. This is NOT a migration file and is not wired into any
--   migration tool -- it's meant to be run manually against the live
--   project, same as docs/sql/enable-rls.sql. Every statement uses
--   `ADD COLUMN IF NOT EXISTS`, so this script is idempotent -- it can be
--   pasted and re-run any number of times without erroring.
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fbclid TEXT;

-- ============================================================================
-- End of script.
-- ============================================================================
