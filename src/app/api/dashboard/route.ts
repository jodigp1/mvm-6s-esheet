// app/api/dashboard/route.ts
// GET — ambil semua data untuk dashboard analytics

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tahun     = searchParams.get('tahun') || new Date().getFullYear().toString()
  const lokasiId  = searchParams.get('lokasi_id') || null
  const semester  = searchParams.get('semester') || null // '1' atau '2'

  const sb = supabaseAdmin()

  // Rentang tanggal
  let dateFrom = `${tahun}-01-01`
  let dateTo   = `${tahun}-12-31`
  if (semester === '1') { dateFrom = `${tahun}-01-01`; dateTo = `${tahun}-06-30` }
  if (semester === '2') { dateFrom = `${tahun}-07-01`; dateTo = `${tahun}-12-31` }

  // Query audit_results dengan join session & lokasi
  let query = sb
    .from('audit_results')
    .select(`
      id, auditee_name, persen, kategori, skipped, tanggal, lokasi_id,
      audit_sessions!inner(id, auditor1, auditor2, avg_score_pct, waktu_proses),
      lokasi!inner(nama, kode)
    `)
    .gte('tanggal', dateFrom)
    .lte('tanggal', dateTo)
    .eq('audit_sessions.status', 'completed')

  if (lokasiId) query = query.eq('lokasi_id', lokasiId)

  const { data: results, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (results ?? []) as any[]

  // ── 1. KPI ────────────────────────────────────────────────────
  const nonSkipped    = rows.filter(r => !r.skipped)
  const totalAuditee  = nonSkipped.length
  const totalSkipped  = rows.filter(r => r.skipped).length
  const avgScore      = totalAuditee > 0
    ? Math.round(nonSkipped.reduce((s, r) => s + (r.persen ?? 0), 0) / totalAuditee)
    : 0
  const exCount = nonSkipped.filter(r => r.kategori === 'EX').length
  const sdCount = nonSkipped.filter(r => r.kategori === 'SD').length
  const niCount = nonSkipped.filter(r => r.kategori === 'NI').length

  // Hitung unique sessions
  const sessionIds = new Set(rows.map((r: any) => r.audit_sessions?.id).filter(Boolean))
  const totalSesi  = sessionIds.size

  // ── 2. Distribusi kategori (untuk donut) ──────────────────────
  const distribusi = [
    { name: 'Excellent',        value: exCount, color: '#10C98F', key: 'EX' },
    { name: 'Standard',         value: sdCount, color: '#FACC15', key: 'SD' },
    { name: 'Need Improvement', value: niCount, color: '#FF5C7A', key: 'NI' },
  ]

  // ── 3. Tren per bulan (untuk stacked bar) ─────────────────────
  const bulanNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const trenBulan = bulanNames.map((nama, idx) => {
    const bulanRows = nonSkipped.filter(r => {
      const m = new Date(r.tanggal + 'T00:00:00').getMonth()
      return m === idx
    })
    return {
      bulan: nama,
      EX:    bulanRows.filter(r => r.kategori === 'EX').length,
      SD:    bulanRows.filter(r => r.kategori === 'SD').length,
      NI:    bulanRows.filter(r => r.kategori === 'NI').length,
      total: bulanRows.length,
      avg:   bulanRows.length > 0
        ? Math.round(bulanRows.reduce((s, r) => s + (r.persen ?? 0), 0) / bulanRows.length)
        : 0,
    }
  })

  // ── 4. Tren per semester ──────────────────────────────────────
  const trenSemester = [
    { label: 'Sem 1 (Jan–Jun)', bulanStart: 0, bulanEnd: 5 },
    { label: 'Sem 2 (Jul–Des)', bulanStart: 6, bulanEnd: 11 },
  ].map(s => {
    const semRows = nonSkipped.filter(r => {
      const m = new Date(r.tanggal + 'T00:00:00').getMonth()
      return m >= s.bulanStart && m <= s.bulanEnd
    })
    return {
      bulan: s.label,
      EX:    semRows.filter(r => r.kategori === 'EX').length,
      SD:    semRows.filter(r => r.kategori === 'SD').length,
      NI:    semRows.filter(r => r.kategori === 'NI').length,
      total: semRows.length,
      avg:   semRows.length > 0
        ? Math.round(semRows.reduce((s, r) => s + (r.persen ?? 0), 0) / semRows.length)
        : 0,
    }
  })

  // ── 5. Comparison per lokasi ──────────────────────────────────
  const lokasiMap: Record<string, { nama: string; rows: typeof nonSkipped }> = {}
  nonSkipped.forEach((r: any) => {
    const lid = r.lokasi_id
    if (!lokasiMap[lid]) lokasiMap[lid] = { nama: r.lokasi?.nama ?? lid, rows: [] }
    lokasiMap[lid].rows.push(r)
  })

  const perLokasi = Object.values(lokasiMap).map(({ nama, rows: lr }) => ({
    lokasi: nama,
    avg:    lr.length > 0 ? Math.round(lr.reduce((s, r) => s + (r.persen ?? 0), 0) / lr.length) : 0,
    EX:     lr.filter(r => r.kategori === 'EX').length,
    SD:     lr.filter(r => r.kategori === 'SD').length,
    NI:     lr.filter(r => r.kategori === 'NI').length,
    total:  lr.length,
  })).sort((a, b) => b.avg - a.avg)

  // ── 6. Ranking auditee ────────────────────────────────────────
  const auditeeMap: Record<string, {
    nama: string; lokasi: string; scores: number[]; kategori: string[]
  }> = {}

  nonSkipped.forEach((r: any) => {
    const key = r.auditee_name + '|' + r.lokasi_id
    if (!auditeeMap[key]) auditeeMap[key] = {
      nama: r.auditee_name,
      lokasi: r.lokasi?.nama ?? '',
      scores: [],
      kategori: [],
    }
    if (r.persen !== null) auditeeMap[key].scores.push(r.persen)
    if (r.kategori)        auditeeMap[key].kategori.push(r.kategori)
  })

  const ranking = Object.values(auditeeMap).map(a => {
    const avg = a.scores.length > 0
      ? Math.round(a.scores.reduce((s, v) => s + v, 0) / a.scores.length)
      : 0
    const katCount = { EX: 0, SD: 0, NI: 0 }
    a.kategori.forEach(k => { if (k in katCount) katCount[k as keyof typeof katCount]++ })
    const dominan = Object.entries(katCount).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
    return {
      nama:         a.nama,
      lokasi:       a.lokasi,
      totalAudit:   a.scores.length,
      avgPct:       avg,
      dominanKat:   dominan,
      exCount:      katCount.EX,
      sdCount:      katCount.SD,
      niCount:      katCount.NI,
    }
  }).sort((a, b) => b.avgPct - a.avgPct)

  // ── 7. Skipped list ───────────────────────────────────────────
  const skippedList = rows
    .filter(r => r.skipped)
    .map((r: any) => ({
      nama:      r.auditee_name,
      lokasi:    r.lokasi?.nama ?? '',
      tanggal:   r.tanggal,
    }))

  return NextResponse.json({
    ok: true,
    data: {
      kpi: { totalSesi, totalAuditee, totalSkipped, avgScore, exCount, sdCount, niCount },
      distribusi,
      trenBulan,
      trenSemester,
      perLokasi,
      ranking,
      skippedList,
    }
  })
}
