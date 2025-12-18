import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the Service Role key to bypass RLS in API routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment');
}

export const supabase = createClient(supabaseUrl, serviceKey);
