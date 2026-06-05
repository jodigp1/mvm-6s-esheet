// lib/supabase.ts
// Dua client: satu untuk browser (anon key), satu untuk server/API routes (service_role key)

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Untuk browser — read only (RLS aktif, hanya SELECT yang diizinkan)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Untuk API routes — bypass RLS, bisa write
// JANGAN dipakai di client-side / komponen browser
export const supabaseAdmin = () =>
  createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
