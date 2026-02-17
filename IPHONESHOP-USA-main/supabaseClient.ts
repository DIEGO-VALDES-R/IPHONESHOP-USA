import { createClient } from '@supabase/supabase-js';

// 🔐 Variables de entorno correctas para Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables are missing. Check your .env.local or Vercel settings.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
