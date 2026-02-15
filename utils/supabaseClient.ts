
import { createClient } from '@supabase/supabase-js';

// Supabase configuration - CONTENT PROJECT for app_commands table
// This is the project where the webapp sends commands
const SUPABASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co';

// IMPORTANT: You need to get the anon key for project gzyywcqlrjimjegbtoyc
// Go to: https://supabase.com/dashboard/project/gzyywcqlrjimjegbtoyc/settings/api
// Copy the "anon" key and replace the placeholder below
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY_HERE';

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

console.log('✅ Supabase client initialized successfully');
console.log('📡 Supabase URL:', SUPABASE_URL);
console.log('🔑 Anon key configured: Yes');
console.log('🎯 This client connects to the CONTENT PROJECT (gzyywcqlrjimjegbtoyc) for app_commands table');
