
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// Get your anon key from: Supabase Dashboard > Project Settings > API > anon public key
const SUPABASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co';

// Using environment variable if available, otherwise use a placeholder
// You MUST replace this with your actual Supabase anon key for screen share to work
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXl3Y3FscmppbWplZ2J0b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI1NTI4MDAsImV4cCI6MjA0ODEyODgwMH0.PLACEHOLDER_REPLACE_WITH_YOUR_ACTUAL_KEY';

// Check if the key is still a placeholder
if (SUPABASE_ANON_KEY.includes('PLACEHOLDER') || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
  console.warn('⚠️ WARNING: Supabase anon key is not configured!');
  console.warn('Screen share feature will not work until you add your Supabase anon key.');
  console.warn('Get your key from: Supabase Dashboard > Project Settings > API > anon public key');
  console.warn('Then update utils/supabaseClient.ts or set EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

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
console.log('Supabase URL:', SUPABASE_URL);
console.log('Anon key configured:', !SUPABASE_ANON_KEY.includes('PLACEHOLDER'));
