'use client'

import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
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

// ── Custom simple dropdown ──────────────────────────────────────
function SimpleDropdown({ value, onChange, options, placeholder, icon }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; color?: string }[]
  placeholder: string
  icon: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div className="relative flex-1" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs font-semibold text-ink-2 cursor-pointer hover:border-brand hover:bg-brand-pale hover:text-brand transition-all">
        <span className="material-icons-round text-sm flex-shrink-0" style={{ color: selected?.color }}>{icon}</span>
        <span className="flex-1 text-left truncate" style={{ color: selected?.color }}>
          {selected?.label ?? placeholder}
        </span>
        <span className="material-icons-round text-ink-3 text-sm flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-card-hover border border-surface-border z-50 overflow-hidden py-1">
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 transition-colors ${
                value === opt.value
                  ? 'bg-brand-pale font-bold'
                  : 'hover:bg-surface'
              }`}>
              {value === opt.value && (
                <span className="material-icons-round text-brand text-sm">check</span>
              )}
              {value !== opt.value && <span className="w-5" />}
              <span style={{ color: value === opt.value ? '#7C6EF5' : opt.color ?? '#4B5169' }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const router = useRouter()

  const [sessions, setSessions]         = useState<SessionWithLokasi[]>([])
  const [lokasiList, setLokasiList]     = useState<Lokasi[]>([])
  const [loading, setLoading]           = useState(true)

  // Filters
  const [filterLokasi,   setFilterLokasi]   = useState('ALL')
  const [filterTahun,    setFilterTahun]    = useState('ALL')
  const [filterBulan,    setFilterBulan]    = useState('ALL')
  const [filterKategori, setFilterKategori] = useState('ALL')
  const [sortOrder,      setSortOrder]      = useState<'newest' | 'oldest'>('newest')

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('lokasi').select('*').eq('aktif', true).order('nama'),
    ]).then(([{ data: s }, { data: l }]) => {
      if (s) setSessions(s as SessionWithLokasi[])
      if (l) setLokasiList(l)
      setLoading(false)
    })
  }, [])

  const tahunOptions = useMemo(() => {
    const years = new Set(sessions.map(s => new Date(s.tanggal + 'T00:00:00').getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [sessions])

  const filtered = useMemo(() => {
    const arr = sessions.filter(s => {
      if (filterLokasi !== 'ALL' && s.lokasi_id !== filterLokasi) return false
      const d = new Date(s.tanggal + 'T00:00:00')
      if (filterTahun  !== 'ALL' && d.getFullYear() !== parseInt(filterTahun)) return false
      if (filterBulan  !== 'ALL' && d.getMonth()    !== parseInt(filterBulan))  return false
      if (filterKategori !== 'ALL') {
        if (!s.audit_results.some(r => r.kategori === filterKategori)) return false
      }
      return true
    })
    if (sortOrder === 'oldest') arr.reverse()
    return arr
  }, [sessions, filterLokasi, filterTahun, filterBulan, filterKategori, sortOrder])

  const groupedByMonth = useMemo(() => {
    const groups: { label: string; sessions: SessionWithLokasi[] }[] = []
    const seen = new Map<string, number>()
    filtered.forEach(s => {
      const d = new Date(s.tanggal + 'T00:00:00')
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      if (!seen.has(key)) { seen.set(key, groups.length); groups.push({ label, sessions: [] }) }
      groups[seen.get(key)!].sessions.push(s)
    })
    return groups
  }, [filtered])

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

  async function confirmDelete() {
    if (!deleteTarget) return
    await fetch(`/api/sessions/${deleteTarget}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== deleteTarget))
    if (detail?.id === deleteTarget) setDetail(null)
    setDeleteTarget(null)
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
      const scores  = (r.scores  as Record<string, number>) ?? {}
      const remarks = (r.remarks as Record<string, string>)  ?? {}
      const cells = detailChecklist.map(item => {
        if (isSkipped) return `<td style="text-align:center;color:#9CA3AF">&mdash;</td>`
        const v = scores[item.id]
        if (v === undefined) return `<td style="text-align:center;color:#9CA3AF">—</td>`
        const c = scoreColor(v)
        return `<td style="text-align:center"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${c}22;color:${c};font-weight:800;font-size:11px">${v}</span></td>`
      }).join('')

      const commentItems = detailChecklist.filter(item => remarks[item.id]?.trim())
      const commentRow = commentItems.length > 0
        ? `<tr style="background:#FFFBEB"><td></td><td colspan="${detailChecklist.length + 4}" style="padding:5px 8px 7px">
            <span style="font-size:10px;color:#92400E">💬 </span>
            ${commentItems.map(item =>
              `<span style="font-size:10px;color:#374151;margin-right:12px"><strong style="color:#B45309">${item.item}:</strong> <em>${remarks[item.id]}</em></span>`
            ).join('')}
          </td></tr>`
        : ''

      if (isSkipped) {
        return `<tr style="opacity:0.5"><td style="color:#9CA3AF">${i+1}</td><td style="font-style:italic;color:#9CA3AF">${r.auditee_name}</td>${detailChecklist.map(() => '<td style="text-align:center;color:#9CA3AF">&mdash;</td>').join('')}<td style="text-align:center;color:#9CA3AF">—</td><td style="text-align:center;color:#9CA3AF">—</td><td style="text-align:center;color:#9CA3AF;font-style:italic">Dilewati</td></tr>`
      }
      const kc = katColor(r.kategori ?? null)
      return `<tr><td style="color:#9CA3AF">${i+1}</td><td style="font-weight:700">${r.auditee_name}</td>${cells}<td style="text-align:center;font-weight:700">${r.total_score ?? '—'}</td><td style="text-align:center;font-weight:700;color:#10C98F">${r.persen ?? 0}%</td><td style="text-align:center;font-weight:700;color:${kc}">${katLabel(r.kategori ?? null)}</td></tr>${commentRow}`
    }).join('')

    const headCols = detailChecklist.map(c => {
      const n = c.item.length
      const fs = n <= 8 ? 10 : n <= 13 ? 9 : n <= 19 ? 8 : 7
      const text = c.item.split(' ').join('<br>')
      return `<th style="text-align:center;padding:6px 3px;vertical-align:bottom"><div style="font-size:${fs}px;font-weight:700;text-transform:uppercase;line-height:1.45;max-width:62px;margin:0 auto">${text}</div></th>`
    }).join('')

    const signHtml = `
      <div style="display:flex;gap:48px;padding:20px 0 12px;border-top:1px solid #E5E2FF;margin-top:8px">
        <div>
          <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">PIC AUDITOR 6S</div>
          <div style="font-family:'Dancing Script',cursive;font-size:32px;color:#6455DC;line-height:1.1;margin-bottom:4px">${s.auditor1}</div>
          <div style="border-bottom:1px solid #D1D5DB;width:160px;margin-bottom:6px"></div>
          <div style="font-weight:700;font-size:13px;color:#1a1a2e;margin-bottom:2px">${s.auditor1}</div>
          <div style="font-size:11px;color:#9CA3AF">PIC 6S ${lokasiNama}</div>
        </div>
        ${s.auditor2 ? `<div>
          <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">PIC AUDITOR 6S</div>
          <div style="font-family:'Dancing Script',cursive;font-size:32px;color:#6455DC;line-height:1.1;margin-bottom:4px">${s.auditor2}</div>
          <div style="border-bottom:1px solid #D1D5DB;width:160px;margin-bottom:6px"></div>
          <div style="font-weight:700;font-size:13px;color:#1a1a2e;margin-bottom:2px">${s.auditor2}</div>
          <div style="font-size:11px;color:#9CA3AF">PIC 6S ${lokasiNama}</div>
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

    const lokasiKey = lokasiNama.toLowerCase()
    const headerGradient = lokasiKey.includes('cabin')
      ? 'linear-gradient(135deg,#10B981 0%,#059669 100%)'
      : lokasiKey.includes('otc')
        ? 'linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%)'
        : 'linear-gradient(135deg,#7C6EF5 0%,#5A4ED4 100%)'

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Audit 6S — ${lokasiNama} ${tanggalFmt}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{font-family:'Plus Jakarta Sans',Arial,sans-serif;margin:0;padding:20px;background:#fff;font-size:13px;color:#1a1a2e;width:277mm;min-width:277mm}
  @page{size:landscape;margin:12mm}
  .header{background:${headerGradient};border-radius:14px;padding:22px 28px;color:#fff;margin-bottom:24px}
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

    const w = window.open('', '_blank', 'width=1400,height=750')
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

        {/* ── FILTER SECTION ─────────────────────────────────── */}
        <div className="card fade-up" style={{ position: 'relative', zIndex: 30 }}>
          {/* Connected segmented lokasi */}
          <div className="p-3 border-b border-surface-border overflow-x-auto">
            <div className="inline-flex w-full border border-surface-border rounded-2xl overflow-hidden min-w-max">
              {[{ id: 'ALL', nama: 'Semua' }, ...lokasiList].map((l, idx, arr) => (
                <button key={l.id} onClick={() => setFilterLokasi(l.id)}
                  className={`flex-1 px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                    idx < arr.length - 1 ? 'border-r border-surface-border' : ''
                  } ${
                    filterLokasi === l.id
                      ? 'bg-brand text-white'
                      : 'bg-white text-ink-2 hover:bg-brand-pale hover:text-brand'
                  }`}>
                  {l.nama}
                </button>
              ))}
            </div>
          </div>

          {/* Dropdowns + sort */}
          <div className="p-3 flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <SimpleDropdown
                value={filterTahun}
                onChange={setFilterTahun}
                icon="event"
                placeholder="Semua Tahun"
                options={[
                  { value: 'ALL', label: 'Semua Tahun' },
                  ...tahunOptions.map(y => ({ value: String(y), label: String(y) })),
                ]}
              />
              <SimpleDropdown
                value={filterBulan}
                onChange={setFilterBulan}
                icon="calendar_month"
                placeholder="Semua Bulan"
                options={[
                  { value: 'ALL', label: 'Semua Bulan' },
                  ...BULAN_ID.map((b, i) => ({ value: String(i), label: b })),
                ]}
              />
            </div>
            <div className="flex gap-2 items-center">
              <SimpleDropdown
                value={filterKategori}
                onChange={setFilterKategori}
                icon="star"
                placeholder="Kategori"
                options={[
                  { value: 'ALL',  label: 'Semua Kategori' },
                  { value: 'EX',   label: 'Excellent',        color: '#10C98F' },
                  { value: 'SD',   label: 'Standard',          color: '#FACC15' },
                  { value: 'NI',   label: 'Need Improvement',  color: '#FF5C7A' },
                ]}
              />
              {/* Sort segmented */}
              <div className="flex border border-surface-border rounded-xl overflow-hidden flex-shrink-0">
                <button onClick={() => setSortOrder('newest')}
                  className={`px-2.5 py-2 text-[11px] font-bold transition-all ${sortOrder === 'newest' ? 'bg-brand text-white' : 'bg-white text-ink-3 hover:text-brand'}`}>
                  <span className="material-icons-round text-sm">arrow_downward</span>
                </button>
                <button onClick={() => setSortOrder('oldest')}
                  className={`px-2.5 py-2 text-[11px] font-bold transition-all border-l border-surface-border ${sortOrder === 'oldest' ? 'bg-brand text-white' : 'bg-white text-ink-3 hover:text-brand'}`}>
                  <span className="material-icons-round text-sm">arrow_upward</span>
                </button>
              </div>
            </div>
          </div>

          {(filterLokasi !== 'ALL' || filterTahun !== 'ALL' || filterBulan !== 'ALL' || filterKategori !== 'ALL') && (
            <div className="px-3 pb-3">
              <button onClick={() => { setFilterLokasi('ALL'); setFilterTahun('ALL'); setFilterBulan('ALL'); setFilterKategori('ALL') }}
                className="text-[11px] text-ink-3 hover:text-danger transition-colors flex items-center gap-1">
                <span className="material-icons-round text-sm">close</span> Reset filter
              </button>
            </div>
          )}
        </div>

        {/* List grouped by month */}
        <div className="flex flex-col gap-5">
          {loading && <div className="text-center py-12 text-ink-3 text-sm">Memuat riwayat...</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-ink-3 text-sm">Tidak ada riwayat yang cocok.</div>
          )}
          {groupedByMonth.map(({ label, sessions: groupSessions }) => (
            <div key={label} className="flex flex-col gap-2">
              {/* Month label */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-extrabold text-ink-2 uppercase tracking-wider">{label}</span>
                <div className="flex-1 h-px bg-surface-border" />
                <span className="text-[11px] text-ink-3">{groupSessions.length} sesi</span>
              </div>
              {/* Sessions */}
              {groupSessions.map((s, i) => {
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
                          <span className="text-[11px] text-ink-3">·</span>
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
          ))}
        </div>
      </main>

      {/* ── DETAIL MODAL ─────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-6"
          style={{ background: 'rgba(22,22,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-card-hover flex flex-col max-h-[92vh] animate-slide-up">

            {/* Modal header */}
            <div className="p-4 border-b border-surface-border flex-shrink-0">
              <div className="flex items-start gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-ink leading-tight">{detail.lokasi.nama} — {formatTanggal(detail.tanggal)}</div>
                  <div className="text-[11px] text-ink-3 mt-0.5">PIC: {detail.auditor1}{detail.auditor2 ? ' & ' + detail.auditor2 : ''}</div>
                </div>
                <button onClick={() => setDetail(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-surface transition-all flex-shrink-0">
                  <span className="material-icons-round text-lg">close</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportSessionExcel(detail)} disabled={detailLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-success-light text-success hover:bg-success hover:text-white transition-all disabled:opacity-40">
                  <span className="material-icons-round text-sm">table_chart</span> Excel
                </button>
                <button onClick={() => exportSessionPDF(detail)} disabled={detailLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-danger-light text-danger hover:bg-danger hover:text-white transition-all disabled:opacity-40">
                  <span className="material-icons-round text-sm">picture_as_pdf</span> PDF
                </button>
                <div className="flex-1" />
                <button onClick={() => setDeleteTarget(detail.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-danger hover:bg-danger-light transition-all">
                  <span className="material-icons-round text-sm">delete</span> Hapus
                </button>
              </div>
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
                        {/* Dynamic hero */}
                        <div className="rounded-2xl overflow-hidden"
                          style={{ background: (() => {
                            const k = detail.lokasi.nama.toLowerCase()
                            return k.includes('cabin')
                              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                              : k.includes('otc')
                                ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)'
                                : 'linear-gradient(135deg, #10C98F 0%, #0db87e 50%, #0ea572 100%)'
                          })() }}>
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
                            <table className="text-xs" style={{ width: 'max-content', minWidth: '100%' }}>
                              <thead>
                                <tr className="bg-surface">
                                  <th className="px-2 py-2 text-left font-bold text-ink-2 whitespace-nowrap">#</th>
                                  <th className="px-2 py-2 text-left font-bold text-ink-2 whitespace-nowrap">NAMA</th>
                                  {detailChecklist.map(item => {
                                    const words = item.item.split(' ')
                                    const n = item.item.length
                                    const fs = n <= 8 ? 9 : n <= 13 ? 8 : n <= 19 ? 7 : 6.5
                                    return (
                                      <th key={item.id} style={{ padding: '4px 2px', textAlign: 'center', verticalAlign: 'bottom' }}>
                                        <div style={{
                                          maxWidth: '54px', margin: '0 auto',
                                          fontSize: `${fs}px`, fontWeight: 700, textTransform: 'uppercase',
                                          lineHeight: 1.4, color: '#475569',
                                          wordBreak: 'break-word',
                                        }}>
                                          {words.map((word, i) => (
                                            <Fragment key={i}>{word}{i < words.length - 1 && <br />}</Fragment>
                                          ))}
                                        </div>
                                      </th>
                                    )
                                  })}
                                  <th className="px-2 py-2 text-center font-bold text-ink-2 whitespace-nowrap text-[10px]">TOTAL</th>
                                  <th className="px-2 py-2 text-center font-bold text-ink-2 whitespace-nowrap text-[10px]">%</th>
                                  <th className="px-2 py-2 text-center font-bold text-ink-2 whitespace-nowrap text-[10px]">KAT</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailResults.map((r, i) => {
                                  const isSkipped = r.skipped
                                  const scores  = (r.scores  as Record<string, number>) ?? {}
                                  const remarks = (r.remarks as Record<string, string>)  ?? {}
                                  const commentItems = detailChecklist.filter(item => remarks[item.id]?.trim())
                                  return (
                                    <Fragment key={r.id}>
                                      <tr className={`border-t border-surface-border ${isSkipped ? 'opacity-50' : ''}`}>
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
                                      {commentItems.length > 0 && (
                                        <tr key={`${r.id}-remarks`} className="bg-warning/5 border-t border-warning/20">
                                          <td />
                                          <td colSpan={detailChecklist.length + 4} className="px-2 py-1.5">
                                            <div className="flex items-start gap-1.5 flex-wrap">
                                              <span className="material-icons-round text-warning text-sm mt-0.5 flex-shrink-0">chat_bubble_outline</span>
                                              <div className="flex flex-wrap gap-2">
                                                {commentItems.map(item => (
                                                  <span key={item.id} className="text-[10px] text-ink-2">
                                                    <span className="font-bold text-warning">{item.item}:</span>{' '}
                                                    <span className="italic">{remarks[item.id]}</span>
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                        </div>

                        {/* Sign approval — separate card */}
                        <div className="card">
                          <div className={`p-5 grid gap-3 ${detail.auditor2 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
                            <div>
                              <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-3">PIC Auditor 6S</div>
                              <div className="text-3xl text-brand mb-1" style={{ fontFamily: "'Dancing Script', cursive" }}>
                                {detail.auditor1}
                              </div>
                              <div className="border-b border-ink-3/30 mb-2 w-40" />
                              <div className="font-bold text-sm text-ink mb-0.5">{detail.auditor1}</div>
                              <div className="text-[11px] text-ink-3">PIC 6S {detail.lokasi.nama}</div>
                            </div>
                            {detail.auditor2 && (
                              <div>
                                <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-3">PIC Auditor 6S</div>
                                <div className="text-3xl text-brand mb-1" style={{ fontFamily: "'Dancing Script', cursive" }}>
                                  {detail.auditor2}
                                </div>
                                <div className="border-b border-ink-3/30 mb-2 w-40" />
                                <div className="font-bold text-sm text-ink mb-0.5">{detail.auditor2}</div>
                                <div className="text-[11px] text-ink-3">PIC 6S {detail.lokasi.nama}</div>
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

      {/* ── DELETE CONFIRM MODAL ─────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(22,22,42,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-hover p-5 flex flex-col gap-4 animate-[fadeUp_0.2s_ease]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-danger-light flex items-center justify-center flex-shrink-0">
                <span className="material-icons-round text-danger text-xl">delete_forever</span>
              </div>
              <div>
                <div className="text-sm font-extrabold text-ink">Hapus riwayat ini?</div>
                <div className="text-[11px] text-ink-3 mt-0.5">Data audit akan dihapus permanen dan tidak bisa dikembalikan.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="btn-secondary flex-1 text-sm py-3">Batal</button>
              <button onClick={confirmDelete}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white border-none cursor-pointer bg-danger flex items-center justify-center gap-1.5 hover:-translate-y-0.5 transition-all">
                <span className="material-icons-round text-base">delete</span> Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
