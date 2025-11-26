
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
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
console.log('Supabase URL:', SUPABASE_CONFIG.url);
console.log('Project ID:', SUPABASE_CONFIG.projectId);
console.log('Anon key configured: Yes');
