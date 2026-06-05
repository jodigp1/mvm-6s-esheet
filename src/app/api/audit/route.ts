// app/api/audit/route.ts
// POST /api/audit — save satu audit result (auto-save per auditee)
// PATCH /api/audit — update session jadi completed

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hitungKategori } from '@/types/database'

// POST: save/upsert satu audit result
export async function POST(req: NextRequest) {
  const body = await req.json()
  const sb = supabaseAdmin()

  const {
    session_id, lokasi_id, tanggal, auditee_name,
    scores, remarks, total_score, max_score,
    skipped = false, skip_reason = null,
  } = body

  const persen = max_score > 0 ? Math.round((total_score / max_score) * 100) : 0
  const kategori = skipped ? null : hitungKategori(persen)

  // Upsert — kalau sudah ada (resume session), update
  const { data, error } = await sb
    .from('audit_results')
    .upsert(
      {
        session_id, lokasi_id, tanggal, auditee_name,
        scores, remarks, total_score, max_score,
        persen, kategori, skipped, skip_reason,
      },
      { onConflict: 'session_id,auditee_name' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

// PATCH: finalize session (completed) + update avg_score_pct & waktu_proses
export async function PATCH(req: NextRequest) {
  const { session_id, waktu_proses } = await req.json()
  const sb = supabaseAdmin()

  // Hitung avg dari semua result yang tidak skipped
  const { data: results } = await sb
    .from('audit_results')
    .select('persen, skipped')
    .eq('session_id', session_id)

  const valid = (results ?? []).filter(r => !r.skipped && r.persen !== null)
  const avg = valid.length > 0
    ? Math.round(valid.reduce((s, r) => s + (r.persen ?? 0), 0) / valid.length)
    : 0

  const { error } = await sb
    .from('audit_sessions')
    .update({ status: 'completed', waktu_proses, avg_score_pct: avg })
    .eq('id', session_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, avg_score_pct: avg })
}
