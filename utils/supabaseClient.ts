
import { createClient } from '@supabase/supabase-js';

// Supabase configuration - CONTENT PROJECT for app_commands table
// This is the project where the webapp sends commands
const SUPABASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co';

// Anon key for project gzyywcqlrjimjegbtoyc
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXl3Y3FscmppbWplZ2J0b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NjMxMjEsImV4cCI6MjA1MjQzOTEyMX0.gEyAIsTiaY_HhtofyhdaYAXu3-8fE_Dp61Z9P3ax50';

console.log('✅ Supabase client initialized successfully');
console.log('📡 Supabase URL:', SUPABASE_URL);
console.log('🔑 Anon key (first 50 chars):', SUPABASE_ANON_KEY.substring(0, 50));
console.log('🔑 Anon key (last 20 chars):', SUPABASE_ANON_KEY.substring(SUPABASE_ANON_KEY.length - 20));
console.log('🔑 Anon key length:', SUPABASE_ANON_KEY.length);
console.log('🎯 This client connects to the CONTENT PROJECT (gzyywcqlrjimjegbtoyc) for app_commands table');

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
