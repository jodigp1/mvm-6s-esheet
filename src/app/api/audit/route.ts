// app/api/audit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hitungKategori } from '@/types/database'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const sb = supabaseAdmin()

  const {
    session_id, lokasi_id, tanggal, auditee_name,
    scores, remarks, non_bobot_answers = null, total_score, max_score,
    skipped = false, skip_reason = null,
  } = body

  const persen = max_score > 0 ? Math.round((total_score / max_score) * 100) : 0
  const kategori = skipped ? null : hitungKategori(persen)

  const { data, error } = await sb
    .from('audit_results')
    .upsert(
      {
        session_id, lokasi_id, tanggal, auditee_name,
        scores, remarks, non_bobot_answers, total_score, max_score,
        persen, kategori, skipped, skip_reason,
      } as any,
      { onConflict: 'session_id,auditee_name' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function PATCH(req: NextRequest) {
  const { session_id, waktu_proses, checklist_snapshot = null } = await req.json()
  const sb = supabaseAdmin()

  const { data: results } = await sb
    .from('audit_results')
    .select('persen, skipped')
    .eq('session_id', session_id)

  const rows = (results ?? []) as { persen: number | null; skipped: boolean }[]
  const valid = rows.filter(r => !r.skipped && r.persen !== null)
  const avg = valid.length > 0
    ? Math.round(valid.reduce((s, r) => s + (r.persen ?? 0), 0) / valid.length)
    : 0

  const { error } = await sb
    .from('audit_sessions')
    .update({ status: 'completed', waktu_proses, avg_score_pct: avg, checklist_snapshot } as unknown as never)
    .eq('id', session_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, avg_score_pct: avg })
}