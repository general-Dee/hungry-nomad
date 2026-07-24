import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Real per-user staff auth, replacing the old shared-secret stopgap (see
// docs/PLATFORM-CONTRACT.md §4). Callers must present a valid Supabase Auth
// access token as `Authorization: Bearer <token>`, and the authenticated
// user must have `app_metadata.role === 'staff'`.
//
// `app_metadata` (as opposed to `user_metadata`) is only writable by a
// service-role/admin client — never by the user themselves via the public
// client — which is exactly why it's used here as the staff flag: a
// compromised or malicious user session can't self-elevate to staff by
// editing their own metadata. See docs/sql/set-staff-role.sql for how the
// app owner grants this role to a user.
export type StaffAuthResult =
  | { ok: true; user: { id: string; email: string | null } }
  | { ok: false; status: 401 | 403; error: string };

export async function requireStaff(request: Request): Promise<StaffAuthResult> {
  const authHeader = request.headers.get('authorization') ?? '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  // supabaseAdmin.auth.getUser(token) validates the JWT against Supabase
  // Auth and returns the user it belongs to (or an error if it's missing,
  // expired, or malformed). Using the service-role client here is just for
  // consistency with the rest of this app's server-side Supabase access —
  // getUser(token) validates whatever token is passed regardless of which
  // client key made the call.
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const role = (data.user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (role !== 'staff') {
    return { ok: false, status: 403, error: 'Forbidden: staff role required' };
  }

  return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
}
