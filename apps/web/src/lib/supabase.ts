import { createClient } from '@supabase/supabase-js';
import { parseWebConfig } from '../config.js';

const config = parseWebConfig();

export const supabase = createClient(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
