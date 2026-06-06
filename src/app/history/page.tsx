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

  async function exportSessionPDF(s: SessionWithLokasi) {
    if (!detailResults.length || !detailChecklist.length) return
    const { default: jsPDF }     = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W = 297, M = 14

    const lokasiNama = s.lokasi.nama
    const tanggalFmt = new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const bulan      = new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    const nonSkipped = detailResults.filter(r => !r.skipped)
    const skipped    = detailResults.filter(r => r.skipped)
    const avgPct     = nonSkipped.length > 0
      ? Math.round(nonSkipped.reduce((sum, r) => sum + (r.persen ?? 0), 0) / nonSkipped.length) : 0
    const exCount    = nonSkipped.filter(r => r.kategori === 'EX').length

    // Green header
    doc.setFillColor(16, 201, 143)
    doc.roundedRect(M, 8, W - M * 2, 62, 4, 4, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16); doc.setFont('helvetica', 'bold')
    doc.text(`Hasil Audit 6S MVM (${bulan})`, M + 8, 21)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`${lokasiNama} — ${tanggalFmt}`, M + 8, 29)
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3)
    doc.line(M + 8, 33, W - M - 8, 33)
    doc.setFontSize(9)
    doc.text(
      `PIC Auditor: ${s.auditor1}${s.auditor2 ? ' & ' + s.auditor2 : ''}   |   ${detailChecklist.length} Item Checklist   |   Waktu: ${s.waktu_proses ?? '—'}`,
      M + 8, 40
    )

    const kpis = [
      { label: 'Jumlah Auditee', value: String(nonSkipped.length) },
      { label: 'Rata-rata',       value: `${avgPct}%` },
      { label: 'Jumlah Excellent', value: String(exCount) },
    ]
    const boxW = (W - M * 2 - 16 - 8) / 3
    kpis.forEach((kpi, i) => {
      const x = M + 8 + i * (boxW + 4)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(x, 44, boxW, 20, 3, 3, 'F')
      doc.setTextColor(16, 100, 70)
      doc.setFontSize(14); doc.setFont('helvetica', 'bold')
      doc.text(kpi.value, x + 5, 54)
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 120, 90)
      doc.text(kpi.label, x + 5, 60)
    })

    // Table
    doc.setTextColor(0, 0, 0)
    const head = [['#', 'NAMA', ...detailChecklist.map(c => c.item.length > 10 ? c.item.substring(0, 10) + '.' : c.item), 'TOTAL', '%', 'KATEGORI']]
    const body = detailResults.map((r, i) => {
      const isSkipped = r.skipped
      const scores = (r.scores as Record<string, number>) ?? {}
      if (isSkipped) return [i + 1, r.auditee_name, ...detailChecklist.map(() => '—'), '—', '—', 'Dilewati']
      return [
        i + 1, r.auditee_name,
        ...detailChecklist.map(c => scores[c.id] !== undefined ? scores[c.id] : '—'),
        r.total_score ?? '—',
        r.persen !== null ? `${r.persen}%` : '—',
        r.kategori ? KATEGORI_LABEL[r.kategori] : '—',
      ]
    })

    autoTable(doc, {
      head, body, startY: 76,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [240, 238, 255], textColor: [50, 40, 100], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [252, 251, 255] },
      columnStyles: { 1: { minCellWidth: 28, fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const raw = data.row.raw as (string | number)[]
          if (raw[raw.length - 1] === 'Dilewati') {
            data.cell.styles.textColor = [160, 160, 160]; data.cell.styles.fontStyle = 'italic'
          } else {
            const val = data.cell.raw
            if (val === 'Excellent')        { data.cell.styles.textColor = [16, 160, 110]; data.cell.styles.fontStyle = 'bold' }
            if (val === 'Standard')         { data.cell.styles.textColor = [180, 130, 0];  data.cell.styles.fontStyle = 'bold' }
            if (val === 'Need Improvement') { data.cell.styles.textColor = [200, 50, 80];  data.cell.styles.fontStyle = 'bold' }
            const col = data.column.index
            if (col >= 2 && col < 2 + detailChecklist.length) {
              const num = Number(val)
              if (!isNaN(num)) {
                if (num === 4)      data.cell.styles.textColor = [100, 85, 220]
                else if (num === 3) data.cell.styles.textColor = [16, 160, 110]
                else if (num <= 2)  data.cell.styles.textColor = [200, 80, 80]
              }
            }
          }
        }
      },
    })

    const tableBottom = (doc as any).lastAutoTable.finalY
    const signY = tableBottom + 10
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
    doc.text('PIC AUDITOR 6S', M + 8, signY)
    if (s.auditor2) doc.text('MENGETAHUI:', W - M - 8 - 60, signY)
    doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.4)
    doc.line(M + 8, signY + 16, M + 70, signY + 16)
    if (s.auditor2) doc.line(W - M - 8 - 60, signY + 16, W - M - 8, signY + 16)
    doc.setTextColor(100, 85, 220); doc.setFontSize(10); doc.setFont('helvetica', 'bold')
    doc.text(s.auditor1, M + 8, signY + 21)
    doc.setTextColor(80, 80, 80); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    doc.text(`PIC 6S ${lokasiNama}`, M + 8, signY + 26)
    if (s.auditor2) {
      doc.setTextColor(100, 85, 220); doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text(s.auditor2, W - M - 8 - 60, signY + 21)
      doc.setTextColor(80, 80, 80); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text('Safety Coordinator', W - M - 8 - 60, signY + 26)
    }

    if (skipped.length > 0) {
      const warnY = signY + 34
      doc.setFillColor(255, 242, 235)
      doc.roundedRect(M, warnY, W - M * 2, 16, 3, 3, 'F')
      doc.setDrawColor(255, 143, 92); doc.setLineWidth(0.3)
      doc.roundedRect(M, warnY, W - M * 2, 16, 3, 3, 'S')
      doc.setTextColor(180, 70, 10); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      doc.text(`${skipped.length} Auditee Dilewati`, M + 8, warnY + 6)
      doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text(skipped.map(r => r.auditee_name).join(', '), M + 8, warnY + 12)
    }

    doc.save(`6S-Audit_${lokasiNama}_${s.tanggal}.pdf`)
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
