
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://pgcdokfiaarnhzryfzwf.supabase.co';

// Using environment variable if available, otherwise use the configured anon key
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY2Rva2ZpYWFybmh6cnlmendmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTk1OTEsImV4cCI6MjA3OTY3NTU5MX0.wn4-y6x8Q-EbPGci_B27scrRXNOEvg7I4xsqeCEYqag';

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
