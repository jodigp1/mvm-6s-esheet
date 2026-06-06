'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { AuditSession, AuditResult, Lokasi, ChecklistItem, ScoreConfig } from '@/types/database'
import { KATEGORI_LABEL } from '@/types/database'

type SessionWithLokasi = AuditSession & {
  lokasi: { nama: string; kode: string }
  audit_results: Pick<AuditResult, 'id' | 'skipped' | 'kategori'>[]
}

const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export default function HistoryPage() {
  const router = useRouter()

  const [sessions, setSessions]         = useState<SessionWithLokasi[]>([])
  const [lokasiList, setLokasiList]     = useState<Lokasi[]>([])
  const [loading, setLoading]           = useState(true)

  // Filters
  const [filterLokasi,   setFilterLokasi]   = useState('ALL')
  const [filterBulan,    setFilterBulan]    = useState('ALL')
  const [filterKategori, setFilterKategori] = useState('ALL')
  const [search,         setSearch]         = useState('')

  // Detail modal
  const [detail, setDetail]                 = useState<SessionWithLokasi | null>(null)
  const [detailResults, setDetailResults]   = useState<AuditResult[]>([])
  const [detailChecklist, setDetailChecklist] = useState<ChecklistItem[]>([])
  const [detailScoreConfig, setDetailScoreConfig] = useState<ScoreConfig[]>([])
  const [detailLoading, setDetailLoading]   = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('audit_sessions')
        .select('*, lokasi(nama, kode), audit_results(id, skipped, kategori)')
        .eq('status', 'completed')
        .order('tanggal', { ascending: false }),
      supabase.from('lokasi').select('*').eq('aktif', true).order('nama'),
    ]).then(([{ data: s }, { data: l }]) => {
      if (s) setSessions(s as SessionWithLokasi[])
      if (l) setLokasiList(l)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (filterLokasi !== 'ALL' && s.lokasi_id !== filterLokasi) return false
      if (filterBulan  !== 'ALL') {
        const bln = new Date(s.tanggal + 'T00:00:00').getMonth()
        if (bln !== parseInt(filterBulan)) return false
      }
      if (filterKategori !== 'ALL') {
        const hasKat = s.audit_results.some(r => r.kategori === filterKategori)
        if (!hasKat) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchAuditor = (s.auditor1 + ' ' + (s.auditor2 ?? '')).toLowerCase().includes(q)
        const matchLokasi  = s.lokasi.nama.toLowerCase().includes(q)
        const matchTanggal = s.tanggal.includes(q)
        const matchBulan   = BULAN_ID[new Date(s.tanggal + 'T00:00:00').getMonth()].toLowerCase().includes(q)
        if (!matchAuditor && !matchLokasi && !matchTanggal && !matchBulan) return false
      }
      return true
    })
  }, [sessions, filterLokasi, filterBulan, filterKategori, search])

  async function openDetail(s: SessionWithLokasi) {
    setDetail(s)
    setDetailLoading(true)
    setDetailResults([])
    setDetailChecklist([])
    const [{ data: r }, { data: cl }, { data: sc }] = await Promise.all([
      supabase.from('audit_results').select('*').eq('session_id', s.id).order('created_at'),
      supabase.from('checklist_items').select('*').eq('lokasi_id', s.lokasi_id).eq('aktif', true).order('nomor'),
      supabase.from('score_config').select('*').order('nilai'),
    ])
    if (r)  setDetailResults(r)
    if (cl) setDetailChecklist(cl)
    if (sc) setDetailScoreConfig(sc)
    setDetailLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus riwayat audit ini?')) return
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (detail?.id === id) setDetail(null)
  }

  // ── Export per session ──────────────────────────────────────
  async function exportSessionExcel(s: SessionWithLokasi) {
    if (!detailResults.length || !detailChecklist.length) return
    const XLSX = await import('xlsx')
    const lokasiNama = s.lokasi.nama
    const rows = detailResults.map((r, i) => {
      const isSkipped = r.skipped
      const scores = (r.scores as Record<string, number>) ?? {}
      const row: Record<string, string | number> = {
        '#': i + 1, 'Nama Auditee': r.auditee_name, 'Lokasi': lokasiNama, 'Tanggal': s.tanggal,
      }
      detailChecklist.forEach(item => {
        row[`${item.nomor}. ${item.item}`] = isSkipped ? '—' : (scores[item.id] ?? '—')
      })
      row['Total Score'] = isSkipped ? '—' : (r.total_score ?? 0)
      row['Persen (%)']  = isSkipped ? '—' : (r.persen ?? 0)
      row['Kategori']    = isSkipped ? 'Dilewati' : (r.kategori ? KATEGORI_LABEL[r.kategori] : '—')
      return row
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Hasil Audit')
    XLSX.writeFile(wb, `6S-Audit_${lokasiNama}_${s.tanggal}.xlsx`)
  }

  function exportSessionPDF(s: SessionWithLokasi) {
    if (!detailResults.length || !detailChecklist.length) return

    const lokasiNama = s.lokasi.nama
    const tanggalFmt = new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const bulan      = new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    const nonSkipped = detailResults.filter(r => !r.skipped)
    const skippedList = detailResults.filter(r => r.skipped)
    const avgPct     = nonSkipped.length > 0
      ? Math.round(nonSkipped.reduce((sum, r) => sum + (r.persen ?? 0), 0) / nonSkipped.length) : 0
    const exCount    = nonSkipped.filter(r => r.kategori === 'EX').length

    const scoreColor = (val: number) => {
      if (val === 4) return '#6455DC'
      if (val === 3) return '#10A070'
      return '#DC4444'
    }
    const katLabel = (k: string | null) => k === 'EX' ? 'Excellent' : k === 'SD' ? 'Standard' : k === 'NI' ? 'Need Improvement' : '—'
    const katColor = (k: string | null) => k === 'EX' ? '#10A070' : k === 'SD' ? '#B08000' : '#DC4444'

    const tableRows = detailResults.map((r, i) => {
      const isSkipped = r.skipped
      const scores = (r.scores as Record<string, number>) ?? {}
      const cells = detailChecklist.map(item => {
        if (isSkipped) return `<td style="text-align:center;color:#9CA3AF">—</td>`
        const v = scores[item.id]
        if (v === undefined) return `<td style="text-align:center;color:#9CA3AF">—</td>`
        const c = scoreColor(v)
        return `<td style="text-align:center"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${c}22;color:${c};font-weight:800;font-size:11px">${v}</span></td>`
      }).join('')
      if (isSkipped) {
        return `<tr style="opacity:0.5"><td style="color:#9CA3AF">${i+1}</td><td style="font-style:italic;color:#9CA3AF">${r.auditee_name}</td>${detailChecklist.map(() => '<td style="text-align:center;color:#9CA3AF">—</td>').join('')}<td style="text-align:center;color:#9CA3AF">—</td><td style="text-align:center;color:#9CA3AF">—</td><td style="text-align:center;color:#9CA3AF;font-style:italic">Dilewati</td></tr>`
      }
      const kc = katColor(r.kategori ?? null)
      return `<tr><td style="color:#9CA3AF">${i+1}</td><td style="font-weight:700">${r.auditee_name}</td>${cells}<td style="text-align:center;font-weight:700">${r.total_score ?? '—'}</td><td style="text-align:center;font-weight:700;color:#10C98F">${r.persen ?? 0}%</td><td style="text-align:center;font-weight:700;color:${kc}">${katLabel(r.kategori ?? null)}</td></tr>`
    }).join('')

    const headCols = detailChecklist.map(c => `<th style="text-align:center;min-width:55px">${c.item.length > 9 ? c.item.substring(0,9)+'.' : c.item}</th>`).join('')

    const signHtml = `
      <div style="display:flex;justify-content:space-between;padding:24px 0 16px;border-top:1px solid #E5E2FF;margin-top:8px">
        <div>
          <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:36px">PIC AUDITOR 6S</div>
          <div style="border-bottom:2px solid #6B7280;width:120px;margin-bottom:6px"></div>
          <div style="font-weight:700;font-size:13px;color:#6455DC">${s.auditor1}</div>
          <div style="font-size:11px;color:#9CA3AF">PIC 6S ${lokasiNama}</div>
        </div>
        ${s.auditor2 ? `<div style="text-align:right">
          <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:36px">MENGETAHUI:</div>
          <div style="border-bottom:2px solid #6B7280;width:120px;margin-bottom:6px;margin-left:auto"></div>
          <div style="font-weight:700;font-size:13px;color:#6455DC">${s.auditor2}</div>
          <div style="font-size:11px;color:#9CA3AF">Safety Coordinator</div>
        </div>` : ''}
      </div>`

    const warnHtml = skippedList.length > 0 ? `
      <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:10px;padding:12px 16px;margin-top:16px;display:flex;align-items:flex-start;gap:10px">
        <span style="font-size:20px;margin-top:1px">⚠️</span>
        <div>
          <div style="color:#B45309;font-weight:700;font-size:13px">${skippedList.length} Auditee Dilewati</div>
          <div style="color:#6B7280;font-size:11px;margin-top:2px">${skippedList.map(r => r.auditee_name).join(', ')}</div>
        </div>
      </div>` : ''

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Audit 6S — ${lokasiNama} ${tanggalFmt}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{font-family:'Plus Jakarta Sans',Arial,sans-serif;margin:0;padding:20px;background:#fff;font-size:13px;color:#1a1a2e}
  @page{margin:12mm;size:A4 landscape}
  .header{background:linear-gradient(135deg,#10C98F 0%,#0ea572 100%);border-radius:14px;padding:22px 28px;color:#fff;margin-bottom:24px}
  .header h1{font-size:20px;font-weight:800;margin:0 0 4px}
  .header p{font-size:12px;opacity:.85;margin:0 0 6px}
  .header hr{border:none;border-top:1px solid rgba(255,255,255,.35);margin:10px 0}
  .header .meta{font-size:11px;opacity:.9;margin-bottom:16px}
  .kpi-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .kpi-box{background:rgba(255,255,255,.18);border-radius:10px;padding:10px 14px}
  .kpi-val{font-size:22px;font-weight:800}
  .kpi-lbl{font-size:10px;opacity:.75;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px}
  th{background:#F5F3FF;color:#3B2F8A;font-weight:700;padding:8px 8px;border-bottom:2px solid #E5E2FF;font-size:10px;text-transform:uppercase;text-align:left}
  td{padding:7px 8px;border-bottom:1px solid #F0EEF8}
  tr:nth-child(even){background:#FAFAFF}
  .tbl-wrap{background:#fff;border:1px solid #E5E2FF;border-radius:12px;overflow:hidden;padding:0 0 4px}
  .tbl-head{padding:14px 16px 10px;border-bottom:1px solid #E5E2FF}
  .tbl-head h2{font-size:13px;font-weight:700;margin:0 0 2px}
  .tbl-head p{font-size:11px;color:#9CA3AF;margin:0}
</style>
</head>
<body>
<div class="header">
  <h1>Hasil Audit 6S MVM (${bulan})</h1>
  <p>${lokasiNama} — ${tanggalFmt}</p>
  <hr>
  <div class="meta">PIC Auditor: ${s.auditor1}${s.auditor2 ? ' &amp; ' + s.auditor2 : ''} &nbsp;|&nbsp; ${detailChecklist.length} Item Checklist &nbsp;|&nbsp; Waktu: ${s.waktu_proses ?? '—'}</div>
  <div class="kpi-grid">
    <div class="kpi-box"><div class="kpi-val">${nonSkipped.length}</div><div class="kpi-lbl">Jumlah Auditee</div></div>
    <div class="kpi-box"><div class="kpi-val">${avgPct}%</div><div class="kpi-lbl">Rata-rata</div></div>
    <div class="kpi-box"><div class="kpi-val">${exCount}</div><div class="kpi-lbl">Jumlah Excellent</div></div>
  </div>
</div>
<div class="tbl-wrap">
  <div class="tbl-head">
    <h2>Rekap audit penilaian 6S di ${lokasiNama} (${bulan}) | Auditor: ${s.auditor1}</h2>
    <p>${nonSkipped.length} dari ${detailResults.length} auditee dinilai</p>
  </div>
  <table>
    <thead><tr><th>#</th><th>NAMA</th>${headCols}<th style="text-align:center">TOTAL</th><th style="text-align:center">%</th><th style="text-align:center">KATEGORI</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div style="padding:0 16px">${signHtml}</div>
</div>
${warnHtml}
<script>window.onload=function(){window.print()}<\/script>
</body>
</html>`

    const w = window.open('', '_blank', 'width=1100,height=800')
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  function formatTanggal(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function ScoreBubble({ val, config }: { val: number | undefined; config: ScoreConfig[] }) {
    if (val === undefined) return <span className="text-ink-3 text-[11px]">—</span>
    const sc = config.find(s => s.nilai === val)
    const color = sc?.warna ?? '#9CA3AF'
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold"
        style={{ background: color + '22', color }}>{val}</span>
    )
  }

  function KategoriBadge({ k }: { k: string | null }) {
    if (!k) return null
    const cls = k === 'EX' ? 'badge-ex' : k === 'SD' ? 'badge-sd' : 'badge-ni'
    return <span className={cls}>{k}</span>
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-surface-border sticky top-0 z-50 shadow-card">
        <div className="max-w-lg mx-auto px-5 h-[60px] flex items-center gap-3">
          <Link href="/"
            className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
            <span className="material-icons-round text-lg">arrow_back</span>
          </Link>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-ink">Riwayat Audit</div>
            <div className="text-[11px] text-ink-3">{filtered.length} sesi ditemukan</div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">

        {/* Filter */}
        <div className="card fade-up">
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">filter_list</span></div>
            <div className="text-sm font-bold text-ink">Filter & Cari</div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-xl">search</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari auditor, lokasi, atau bulan..."
                className="inp pl-10" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select value={filterLokasi} onChange={e => setFilterLokasi(e.target.value)} className="inp text-xs py-2">
                <option value="ALL">Semua Lokasi</option>
                {lokasiList.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}
              </select>
              <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)} className="inp text-xs py-2">
                <option value="ALL">Semua Bulan</option>
                {BULAN_ID.map((b, i) => <option key={i} value={i}>{b}</option>)}
              </select>
              <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className="inp text-xs py-2">
                <option value="ALL">Semua Kategori</option>
                <option value="EX">Excellent</option>
                <option value="SD">Standard</option>
                <option value="NI">Need Improvement</option>
              </select>
            </div>
            {(filterLokasi !== 'ALL' || filterBulan !== 'ALL' || filterKategori !== 'ALL' || search) && (
              <button onClick={() => { setFilterLokasi('ALL'); setFilterBulan('ALL'); setFilterKategori('ALL'); setSearch('') }}
                className="text-xs text-ink-3 hover:text-danger transition-colors flex items-center gap-1 self-start">
                <span className="material-icons-round text-sm">close</span> Reset filter
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex flex-col gap-3">
          {loading && <div className="text-center py-12 text-ink-3 text-sm">Memuat riwayat...</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-ink-3 text-sm">Tidak ada riwayat yang cocok.</div>
          )}
          {filtered.map((s, i) => {
            const exC = s.audit_results.filter(r => r.kategori === 'EX').length
            const sdC = s.audit_results.filter(r => r.kategori === 'SD').length
            const niC = s.audit_results.filter(r => r.kategori === 'NI').length
            const skC = s.audit_results.filter(r => r.skipped).length
            return (
              <div key={s.id} className="card fade-up hover:shadow-card-hover transition-all cursor-pointer"
                style={{ animationDelay: `${i * 0.03}s` }}
                onClick={() => openDetail(s)}>
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-pale flex items-center justify-center flex-shrink-0">
                    <span className="material-icons-round text-brand">assignment_turned_in</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-extrabold text-ink">{s.lokasi.nama}</span>
                      <span className="text-[11px] text-ink-3">—</span>
                      <span className="text-[11px] text-ink-3">{formatTanggal(s.tanggal)}</span>
                    </div>
                    <div className="text-[11px] text-ink-3 truncate">
                      PIC: {s.auditor1}{s.auditor2 ? ' & ' + s.auditor2 : ''} · {s.waktu_proses ?? '—'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {exC > 0 && <span className="badge-ex">{exC} EX</span>}
                      {sdC > 0 && <span className="badge-sd">{sdC} SD</span>}
                      {niC > 0 && <span className="badge-ni">{niC} NI</span>}
                      {skC > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-ink-3">{skC} skip</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-extrabold text-brand">{s.avg_score_pct ?? '—'}<span className="text-xs">%</span></div>
                    <div className="text-[10px] text-ink-3">avg</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* ── DETAIL MODAL ─────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-6"
          style={{ background: 'rgba(22,22,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-card-hover flex flex-col max-h-[92vh]">

            {/* Modal header */}
            <div className="p-4 border-b border-surface-border flex items-center gap-3 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-ink">{detail.lokasi.nama} — {formatTanggal(detail.tanggal)}</div>
                <div className="text-[11px] text-ink-3">PIC: {detail.auditor1}{detail.auditor2 ? ' & ' + detail.auditor2 : ''}</div>
              </div>
              {/* Export buttons */}
              <button onClick={() => exportSessionExcel(detail)}
                disabled={detailLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-success-light text-success hover:bg-success hover:text-white transition-all disabled:opacity-40">
                <span className="material-icons-round text-sm">table_chart</span> Excel
              </button>
              <button onClick={() => exportSessionPDF(detail)}
                disabled={detailLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-danger-light text-danger hover:bg-danger hover:text-white transition-all disabled:opacity-40">
                <span className="material-icons-round text-sm">picture_as_pdf</span> PDF
              </button>
              <button onClick={() => handleDelete(detail.id)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-danger hover:bg-danger-light transition-all">
                <span className="material-icons-round text-base">delete</span>
              </button>
              <button onClick={() => setDetail(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-surface transition-all">
                <span className="material-icons-round text-lg">close</span>
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex flex-col gap-4 p-4">

              {detailLoading ? (
                <div className="text-center py-12 text-ink-3 text-sm">Memuat data...</div>
              ) : (
                <>
                  {/* Hero header */}
                  {(() => {
                    const nonSkipped = detailResults.filter(r => !r.skipped)
                    const skippedList = detailResults.filter(r => r.skipped)
                    const avgPct = nonSkipped.length > 0
                      ? Math.round(nonSkipped.reduce((s, r) => s + (r.persen ?? 0), 0) / nonSkipped.length) : 0
                    const exCount = nonSkipped.filter(r => r.kategori === 'EX').length
                    const bulan = new Date(detail.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

                    return (
                      <>
                        {/* Green hero */}
                        <div className="rounded-2xl overflow-hidden"
                          style={{ background: 'linear-gradient(135deg, #10C98F 0%, #0db87e 50%, #0ea572 100%)' }}>
                          <div className="p-5 text-white relative overflow-hidden">
                            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 bg-white" />
                            <div className="relative">
                              <h2 className="text-base font-extrabold mb-0.5">Hasil Audit 6S MVM ({bulan})</h2>
                              <p className="text-xs opacity-80 mb-3">{detail.lokasi.nama} — {formatTanggal(detail.tanggal)}</p>
                              <div className="flex flex-wrap gap-3 text-xs mb-4 opacity-90">
                                <span className="flex items-center gap-1"><span className="material-icons-round text-sm">person</span>PIC: {detail.auditor1}{detail.auditor2 ? ` & ${detail.auditor2}` : ''}</span>
                                <span className="flex items-center gap-1"><span className="material-icons-round text-sm">checklist</span>{detailChecklist.length} Item</span>
                                <span className="flex items-center gap-1"><span className="material-icons-round text-sm">timer</span>{detail.waktu_proses ?? '—'}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: 'Jumlah Auditee', value: nonSkipped.length },
                                  { label: 'Rata-rata',       value: `${avgPct}%` },
                                  { label: 'Jml Excellent',   value: exCount },
                                ].map(({ label, value }) => (
                                  <div key={label} className="rounded-xl p-2.5 text-center"
                                    style={{ background: 'rgba(255,255,255,0.18)' }}>
                                    <div className="text-lg font-extrabold">{value}</div>
                                    <div className="text-[10px] opacity-75">{label}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Score table */}
                        <div className="card">
                          <div className="card-head">
                            <div className="text-xs font-bold text-ink">Rekap audit penilaian 6S di {detail.lokasi.nama} ({bulan}) | Auditor: {detail.auditor1}</div>
                            <div className="text-[11px] text-ink-3">{nonSkipped.length} dari {detailResults.length} auditee dinilai</div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-surface">
                                  <th className="px-2 py-2 text-left font-bold text-ink-2">#</th>
                                  <th className="px-2 py-2 text-left font-bold text-ink-2 min-w-[90px]">NAMA</th>
                                  {detailChecklist.map(item => (
                                    <th key={item.id} className="px-1.5 py-2 text-center font-bold text-ink-2 text-[10px] min-w-[55px] uppercase">
                                      {item.item.length > 7 ? item.item.substring(0, 7) + '…' : item.item}
                                    </th>
                                  ))}
                                  <th className="px-2 py-2 text-center font-bold text-ink-2">TOTAL</th>
                                  <th className="px-2 py-2 text-center font-bold text-ink-2">%</th>
                                  <th className="px-2 py-2 text-center font-bold text-ink-2">KAT</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailResults.map((r, i) => {
                                  const isSkipped = r.skipped
                                  const scores = (r.scores as Record<string, number>) ?? {}
                                  return (
                                    <tr key={r.id} className={`border-t border-surface-border ${isSkipped ? 'opacity-50' : ''}`}>
                                      <td className="px-2 py-2 text-ink-3">{i + 1}</td>
                                      <td className={`px-2 py-2 whitespace-nowrap ${isSkipped ? 'text-ink-3' : 'font-bold text-ink'}`}>{r.auditee_name}</td>
                                      {detailChecklist.map(item => (
                                        <td key={item.id} className="px-1.5 py-2 text-center">
                                          {isSkipped
                                            ? <span className="text-ink-3">—</span>
                                            : <ScoreBubble val={scores[item.id]} config={detailScoreConfig} />
                                          }
                                        </td>
                                      ))}
                                      <td className="px-2 py-2 text-center font-bold text-ink">
                                        {isSkipped ? <span className="text-ink-3">—</span> : (r.total_score ?? '—')}
                                      </td>
                                      <td className="px-2 py-2 text-center font-bold text-brand">
                                        {isSkipped ? <span className="text-ink-3">—</span> : `${r.persen ?? 0}%`}
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        {isSkipped
                                          ? <span className="text-[10px] italic text-ink-3">Dilewati</span>
                                          : <KategoriBadge k={r.kategori ?? null} />
                                        }
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Sign approval */}
                          <div className="p-5 border-t border-surface-border grid grid-cols-2 gap-6">
                            <div>
                              <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-8">PIC Auditor 6S</div>
                              <div className="border-b-2 border-ink-2 mb-1.5 w-28" />
                              <div className="font-bold text-sm text-brand">{detail.auditor1}</div>
                              <div className="text-[11px] text-ink-3">PIC 6S {detail.lokasi.nama}</div>
                            </div>
                            {detail.auditor2 && (
                              <div className="text-right">
                                <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-8">Mengetahui:</div>
                                <div className="border-b-2 border-ink-2 mb-1.5 w-28 ml-auto" />
                                <div className="font-bold text-sm text-brand">{detail.auditor2}</div>
                                <div className="text-[11px] text-ink-3">Safety Coordinator</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Skipped warning */}
                        {skippedList.length > 0 && (
                          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-3.5 flex items-start gap-3">
                            <span className="material-icons-round text-warning text-lg mt-0.5">warning_amber</span>
                            <div>
                              <div className="text-xs font-bold text-warning">{skippedList.length} Auditee Dilewati</div>
                              <div className="text-[11px] text-ink-3 mt-0.5">{skippedList.map(r => r.auditee_name).join(', ')}</div>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
