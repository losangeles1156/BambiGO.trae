import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // Warn instead of throw to allow build in environments without secrets (e.g. CI build vs runtime)
  console.warn('Missing Supabase Service Role Key - Admin operations will fail');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || 'placeholder', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
