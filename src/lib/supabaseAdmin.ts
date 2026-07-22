import { createClient } from '@supabase/supabase-js';

// Server-only: uses the service-role key, which bypasses Row Level Security.
// This must only ever be imported from server-side code (API routes) — never
// from a 'use client' component or any module that ends up in the browser
// bundle. See docs/PLATFORM-CONTRACT.md §5 and §7, and docs/sql/enable-rls.sql.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
