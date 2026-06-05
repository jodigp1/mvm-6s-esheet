// app/api/sessions/route.ts
// POST  — buat session baru (draft)
// GET   — cek draft session aktif per lokasi

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST: buat session baru
export async function POST(req: NextRequest) {
  const { lokasi_id, tanggal, auditor1, auditor2 } = await req.json()
  const sb = supabaseAdmin()

  const { data, error } = await sb
    .from('audit_sessions')
    .insert({ lokasi_id, tanggal, auditor1, auditor2: auditor2 || null, status: 'draft' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

// GET: ambil draft session yang belum selesai (untuk banner resume)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lokasi_id = searchParams.get('lokasi_id')
  const sb = supabaseAdmin()

  let query = sb
    .from('audit_sessions')
    .select(`*, lokasi(nama, kode), audit_results(id, auditee_name, skipped)`)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })

  if (lokasi_id) query = query.eq('lokasi_id', lokasi_id)

  const { data, error } = await query.limit(5)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
