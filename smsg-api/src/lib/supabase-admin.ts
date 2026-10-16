import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// The only module allowed to read SUPABASE_SECRET_KEY.
// Never set a password through the admin API: super admin passwords are self-service only.
export function supabaseAdmin() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY)
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
