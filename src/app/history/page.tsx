'use client'
// app/history/page.tsx

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { AuditSession, AuditResult, Lokasi } from '@/types/database'
import { KATEGORI_LABEL } from '@/types/database'

type SessionWithLokasi = AuditSession & {
  lokasi: { nama: string; kode: string }
  audit_results: Pick<AuditResult, 'id' | 'skipped' | 'kategori'>[]
}

const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export default function HistoryPage() {
  const router = useRouter()

  const [sessions, setSessions]     = useState<SessionWithLokasi[]>([])
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([])
  const [loading, setLoading]       = useState(true)

  // Filters
  const [filterLokasi,   setFilterLokasi]   = useState('ALL')
  const [filterBulan,    setFilterBulan]    = useState('ALL')
  const [filterKategori, setFilterKategori] = useState('ALL')
  const [search,         setSearch]         = useState('')

  // Detail modal
  const [detail, setDetail] = useState<SessionWithLokasi | null>(null)
  const [detailResults, setDetailResults] = useState<AuditResult[]>([])

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

  // ── Filtered sessions ─────────────────────────────────────────
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

  // ── Load detail ───────────────────────────────────────────────
  async function openDetail(s: SessionWithLokasi) {
    setDetail(s)
    const { data } = await supabase
      .from('audit_results').select('*').eq('session_id', s.id).order('created_at')
    if (data) setDetailResults(data)
  }

  // ── Delete session ────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Hapus riwayat audit ini?')) return
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (detail?.id === id) setDetail(null)
  }

  // ── Export Excel (semua sesi yang terfilter) ──────────────────
  async function exportExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map(s => ({
      'ID':          s.id,
      'Lokasi':      s.lokasi.nama,
      'Tanggal':     s.tanggal,
      'Auditor 1':   s.auditor1,
      'Auditor 2':   s.auditor2 ?? '—',
      'Avg Score %': s.avg_score_pct ?? '—',
      'Waktu Proses': s.waktu_proses ?? '—',
      'Total Auditee': s.audit_results.length,
      'Di-skip':     s.audit_results.filter(r => r.skipped).length,
      'Excellent':   s.audit_results.filter(r => r.kategori === 'EX').length,
      'Standard':    s.audit_results.filter(r => r.kategori === 'SD').length,
      'Need Improvement': s.audit_results.filter(r => r.kategori === 'NI').length,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Riwayat Audit')
    XLSX.writeFile(wb, `6S-History_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ── Export PDF (tabel ringkasan) ──────────────────────────────
  async function exportPDF() {
    const { default: jsPDF }     = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('RIWAYAT AUDIT 6S', 14, 15)
    doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}  |  Total: ${filtered.length} sesi`, 14, 21)

    autoTable(doc, {
      head: [['#','Lokasi','Tanggal','Auditor','Avg%','EX','SD','NI','Skip','Waktu']],
      body: filtered.map((s, i) => [
        i + 1,
        s.lokasi.nama,
        new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID'),
        s.auditor1 + (s.auditor2 ? ' & ' + s.auditor2 : ''),
        `${s.avg_score_pct ?? '—'}%`,
        s.audit_results.filter(r => r.kategori === 'EX').length,
        s.audit_results.filter(r => r.kategori === 'SD').length,
        s.audit_results.filter(r => r.kategori === 'NI').length,
        s.audit_results.filter(r => r.skipped).length,
        s.waktu_proses ?? '—',
      ]),
      startY: 25,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [124, 110, 245] },
      alternateRowStyles: { fillColor: [244, 243, 255] },
    })

    doc.save(`6S-History_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  // ── Import CSV/Excel ──────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    alert('Fitur import akan digunakan untuk migrasi data lama. Pastikan format kolom sesuai template export.')
    e.target.value = ''
  }

  function formatTanggal(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function KategoriBadge({ k }: { k: string | null }) {
    if (!k) return null
    const cls = k === 'EX' ? 'badge-ex' : k === 'SD' ? 'badge-sd' : 'badge-ni'
    return <span className={cls}>{k}</span>
  }

  return (
    <div className="min-h-screen pb-20">

      {/* Header */}
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
          {/* Export */}
          <button onClick={exportExcel}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-success-light text-success hover:bg-success hover:text-white transition-all">
            <span className="material-icons-round text-sm">table_chart</span> Excel
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-danger-light text-danger hover:bg-danger hover:text-white transition-all">
            <span className="material-icons-round text-sm">picture_as_pdf</span> PDF
          </button>
          {/* Import */}
          <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-brand-pale text-brand hover:bg-brand hover:text-white transition-all cursor-pointer">
            <span className="material-icons-round text-sm">upload</span> Import
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">

        {/* Filter card */}
        <div className="card fade-up">
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">filter_list</span></div>
            <div className="text-sm font-bold text-ink">Filter & Cari</div>
          </div>
          <div className="p-4 flex flex-col gap-3">

            {/* Search */}
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-xl">search</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari auditor, lokasi, atau bulan..."
                className="inp pl-10" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Filter lokasi */}
              <select value={filterLokasi} onChange={e => setFilterLokasi(e.target.value)} className="inp text-xs py-2">
                <option value="ALL">Semua Lokasi</option>
                {lokasiList.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}
              </select>

              {/* Filter bulan */}
              <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)} className="inp text-xs py-2">
                <option value="ALL">Semua Bulan</option>
                {BULAN_ID.map((b, i) => <option key={i} value={i}>{b}</option>)}
              </select>

              {/* Filter kategori */}
              <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className="inp text-xs py-2">
                <option value="ALL">Semua Kategori</option>
                <option value="EX">Excellent</option>
                <option value="SD">Standard</option>
                <option value="NI">Need Improvement</option>
              </select>
            </div>

            {/* Reset */}
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
          {loading && (
            <div className="text-center py-12 text-ink-3 text-sm">Memuat riwayat...</div>
          )}
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

      {/* ── DETAIL MODAL ─────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(22,22,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-card-hover flex flex-col max-h-[85vh]">

            {/* Modal header */}
            <div className="p-4 border-b border-surface-border flex items-center gap-3 flex-shrink-0">
              <div className="flex-1">
                <div className="text-sm font-extrabold text-ink">{detail.lokasi.nama} — {formatTanggal(detail.tanggal)}</div>
                <div className="text-[11px] text-ink-3">PIC: {detail.auditor1}{detail.auditor2 ? ' & ' + detail.auditor2 : ''}</div>
              </div>
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
            <div className="overflow-y-auto p-4 flex flex-col gap-3">

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Avg Score', value: `${detail.avg_score_pct ?? '—'}%`, color: 'text-brand' },
                  { label: 'Waktu',     value: detail.waktu_proses ?? '—',        color: 'text-ink' },
                  { label: 'Total',     value: `${detail.audit_results.length} orang`, color: 'text-ink' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-surface rounded-2xl p-3 text-center">
                    <div className="text-[10px] text-ink-3 mb-0.5">{label}</div>
                    <div className={`text-sm font-extrabold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Results table */}
              <div className="overflow-x-auto rounded-2xl border border-surface-border">
                <table className="w-full text-xs">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-ink-2">#</th>
                      <th className="px-3 py-2 text-left font-bold text-ink-2">Nama</th>
                      <th className="px-3 py-2 text-center font-bold text-ink-2">%</th>
                      <th className="px-3 py-2 text-center font-bold text-ink-2">Kategori</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailResults.map((r, i) => (
                      <tr key={r.id} className="border-t border-surface-border">
                        <td className="px-3 py-2 text-ink-3">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold text-ink">{r.auditee_name}</td>
                        <td className="px-3 py-2 text-center text-ink">
                          {r.skipped ? <span className="text-ink-3">skip</span> : `${r.persen}%`}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.skipped
                            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-ink-3">{r.skip_reason?.split(' ')[0] ?? 'Skip'}</span>
                            : <KategoriBadge k={r.kategori ?? null} />
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
