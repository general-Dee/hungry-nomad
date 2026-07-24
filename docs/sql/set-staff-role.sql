-- ============================================================================
-- set-staff-role.sql
-- ============================================================================
-- Purpose:
--   Grants (or revokes) the "staff" role used by PATCH /api/orders/[id]
--   (src/app/api/orders/[id]/route.ts, gated via src/lib/staffAuth.ts) to a
--   Supabase Auth user, by setting `app_metadata.role = 'staff'` on their
--   `auth.users` row. See docs/PLATFORM-CONTRACT.md §4 for the full auth
--   model this supports.
--
--   `app_metadata` (as opposed to `user_metadata`) is only writable by a
--   service-role/admin client, never by the signed-in user themselves via
--   the public client SDK — that's exactly why it's the right place for an
--   authorization flag like this. A user cannot self-promote to staff no
--   matter what they send from the browser.
--
-- Prerequisite:
--   The user must already exist in auth.users -- i.e. they must have signed
--   up once via the staff login page's underlying Supabase project (there is
--   no self-serve signup UI in this app; create the account either via the
--   Supabase Dashboard -> Authentication -> Users -> "Add user", or by
--   calling supabaseAdmin.auth.admin.createUser({ email, password }) once
--   from a trusted context).
--
-- How to run:
--   Paste into the Supabase Dashboard -> SQL Editor and run it, same as
--   docs/sql/enable-rls.sql. This is a manual, one-time (or occasional)
--   operation per staff member -- not wired into any migration tool or app
--   code, since staff-role assignment is deliberately an app-owner action,
--   not something the app itself exposes an endpoint for.
--
-- Alternative (no SQL access / prefer the Admin API):
--   The same change can be made from trusted server-side code using the
--   service-role client already used elsewhere in this app
--   (src/lib/supabaseAdmin.ts):
--
--     await supabaseAdmin.auth.admin.updateUserById(userId, {
--       app_metadata: { role: 'staff' },
--     });
--
--   Note this REPLACES app_metadata's `role` key but merges with other
--   existing app_metadata keys (the Admin API merges app_metadata, it does
--   not overwrite the whole object) -- same effect as the SQL below, which
--   also merges via the `||` jsonb operator rather than overwriting.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Grant staff role to a user, by email.
-- Merges { "role": "staff" } into their existing app_metadata rather than
-- replacing it outright, so any other app_metadata keys Supabase Auth itself
-- manages (e.g. "provider", "providers") are preserved.
-- ----------------------------------------------------------------------------
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "staff"}'::jsonb
where email = 'staff@example.com'; -- <-- replace with the real staff member's email


-- ----------------------------------------------------------------------------
-- Verify it took effect.
-- ----------------------------------------------------------------------------
select id, email, raw_app_meta_data
from auth.users
where email = 'staff@example.com'; -- <-- replace with the real staff member's email


-- ----------------------------------------------------------------------------
-- Revoke staff role from a user, by email (e.g. offboarding).
-- Removes just the "role" key from app_metadata, leaving other keys intact.
-- ----------------------------------------------------------------------------
-- update auth.users
-- set raw_app_meta_data = raw_app_meta_data - 'role'
-- where email = 'staff@example.com'; -- <-- replace with the real staff member's email

-- ============================================================================
-- End of script.
-- ============================================================================
