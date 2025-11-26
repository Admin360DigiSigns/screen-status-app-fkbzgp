
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://gzyywcqlrjimjegbtoyc.supabase.co';

// Using environment variable if available, otherwise use the configured anon key
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eXl3Y3FscmppbWplZ2J0b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzM2MDUsImV4cCI6MjA3OTM0OTYwNX0.gEyAIsTiaY_Hhtofyhda_YAXu3-8fE_Dp6lZ9P3ax50';

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
console.log('Supabase URL:', SUPABASE_URL);
console.log('Anon key configured: Yes');
