import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseInstance: any = null;
let signUpClientInstance: any = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase environment variables are missing!");
} else {
  try {
    // 1. Browser client stores session in cookies so middleware.ts can read it
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
    
    // 2. Sign up client needs to be completely isolated (no session persistence)
    signUpClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  } catch (err) {
    console.error("Error creating Supabase client:", err);
  }
}

export const supabase = supabaseInstance;
export const supabaseSignUpClient = signUpClientInstance;
