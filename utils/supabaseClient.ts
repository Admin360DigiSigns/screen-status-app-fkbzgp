
import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase anon key
// You can find this in your Supabase project settings under API
const SUPABASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Note: If you haven't set up the Supabase anon key yet, 
// you'll need to get it from your Supabase project dashboard
// Go to: Project Settings > API > anon public key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

console.log('Supabase client initialized for screen share');
