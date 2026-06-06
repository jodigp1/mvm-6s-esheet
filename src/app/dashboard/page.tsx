'use client'
// app/dashboard/page.tsx

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import type { Lokasi } from '@/types/database'

interface DashboardData {
  kpi: {
    totalSesi: number; totalAuditee: number; totalSkipped: number
    avgScore: number; exCount: number; sdCount: number; niCount: number
  }
  distribusi:    { name: string; value: number; color: string; key: string }[]
  trenBulan:     { bulan: string; EX: number; SD: number; NI: number; avg: number }[]
  trenSemester:  { bulan: string; EX: number; SD: number; NI: number; avg: number }[]
  perLokasi:     { lokasi: string; avg: number; EX: number; SD: number; NI: number; total: number }[]
  ranking:       { nama: string; lokasi: string; totalAudit: number; avgPct: number; dominanKat: string | null; exCount: number; sdCount: number; niCount: number }[]
  skippedList:   { nama: string; lokasi: string; tanggal: string }[]
}

const KAT_COLOR = { EX: '#10C98F', SD: '#FACC15', NI: '#FF5C7A' }

// ── Export PNG — hides .no-export elements during capture ─────
function ExportPNGButton({ targetRef, filename }: { targetRef: React.RefObject<HTMLDivElement>; filename: string }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (!targetRef.current) return
    setExporting(true)
    // Hide all .no-export elements inside the card before capture
    const hidden = targetRef.current.querySelectorAll<HTMLElement>('.no-export')
    hidden.forEach(el => { el.style.visibility = 'hidden' })
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        removeContainer: true,
      })
      const a = document.createElement('a')
      a.download = `${filename}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } finally {
      hidden.forEach(el => { el.style.visibility = '' })
      setExporting(false)
    }
  }

  return (
    <button onClick={handleExport} disabled={exporting}
      className="no-export flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-brand-pale text-brand hover:bg-brand hover:text-white transition-all disabled:opacity-50">
      <span className="material-icons-round text-sm">{exporting ? 'hourglass_empty' : 'image'}</span>
      PNG
    </button>
  )
}

// ── Custom filter dropdown (no OS default style) ──────────────
function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
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
    <div>
      <label className="text-[11px] font-bold text-ink-2 mb-1 block">{label}</label>
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-2 bg-white border border-surface-border rounded-xl px-3 py-2 text-xs font-semibold text-ink cursor-pointer hover:border-brand hover:bg-brand-pale hover:text-brand transition-all">
          <span className="flex-1 text-left truncate">{selected?.label ?? '—'}</span>
          <span className="material-icons-round text-ink-3 text-sm flex-shrink-0 transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-card-hover border border-surface-border z-50 overflow-hidden py-1">
            {options.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${
                  value === opt.value ? 'bg-brand-pale font-bold text-brand' : 'text-ink hover:bg-surface'
                }`}>
                {value === opt.value
                  ? <span className="material-icons-round text-brand text-sm">check</span>
                  : <span className="w-5" />
                }
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data,       setData]       = useState<DashboardData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([])
  const [availYears, setAvailYears] = useState<string[]>([])

  const [tahun,    setTahun]    = useState('')
  const [lokasiId, setLokasiId] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [trenMode, setTrenMode] = useState<'bulan' | 'semester'>('bulan')
  const [filterKat, setFilterKat] = useState('ALL')

  const refDonut   = useRef<HTMLDivElement>(null)
  const refLokasi  = useRef<HTMLDivElement>(null)
  const refTren    = useRef<HTMLDivElement>(null)
  const refRanking = useRef<HTMLDivElement>(null)
  const refSkipped = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('lokasi').select('*').eq('aktif', true).order('nama')
      .then(({ data: l }) => { if (l) setLokasiList(l) })

    supabase.from('audit_sessions').select('tanggal').eq('status', 'completed')
      .then(({ data: sessions }) => {
        if (!sessions) return
        const years = Array.from(new Set(
          sessions.map(s => new Date(s.tanggal + 'T00:00:00').getFullYear().toString())
        )).sort((a, b) => parseInt(b) - parseInt(a))
        setAvailYears(years)
        setTahun(years[0] ?? String(new Date().getFullYear()))
      })
  }, [])

  useEffect(() => {
    if (!tahun) return
    setLoading(true)
    const params = new URLSearchParams({ tahun })
    if (lokasiId !== 'ALL') params.set('lokasi_id', lokasiId)
    if (semester !== 'ALL') params.set('semester', semester)
    fetch(`/api/dashboard?${params}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setData(json.data) })
      .finally(() => setLoading(false))
  }, [tahun, lokasiId, semester])

  const ranking = useMemo(() => {
    if (!data) return []
    let list = [...data.ranking]
    if (filterKat !== 'ALL') list = list.filter(r => r.dominanKat === filterKat)
    list.sort((a, b) => b.avgPct - a.avgPct)
    return list
  }, [data, filterKat])

  const trenData = trenMode === 'bulan' ? data?.trenBulan : data?.trenSemester

  const periodLabel = useMemo(() => {
    if (!tahun) return ''
    const parts: string[] = [tahun]
    if (semester !== 'ALL') parts.push(`Semester ${semester}`)
    if (lokasiId !== 'ALL') {
      const nama = lokasiList.find(l => l.id === lokasiId)?.nama
      if (nama) parts.push(nama)
    }
    return parts.join(' · ')
  }, [tahun, semester, lokasiId, lokasiList])

  const exportRankingCSV = useCallback(() => {
    const rows = [
      ['#', 'Nama', 'Lokasi', 'Total Audit', 'Avg %', 'Dominan', 'EX', 'SD', 'NI'],
      ...ranking.map((r, i) => [i + 1, r.nama, r.lokasi, r.totalAudit, r.avgPct, r.dominanKat ?? '—', r.exCount, r.sdCount, r.niCount]),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `6S-Ranking_${tahun}.csv`; a.click()
  }, [ranking, tahun])

  const exportTrenCSV = useCallback(() => {
    if (!trenData) return
    const rows = [
      ['Periode', 'EX', 'SD', 'NI', 'Total', 'Avg %'],
      ...trenData.map(r => [r.bulan, r.EX, r.SD, r.NI, r.EX + r.SD + r.NI, r.avg]),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `6S-Tren_${tahun}.csv`; a.click()
  }, [trenData, tahun])

  const exportLokasiCSV = useCallback(() => {
    if (!data) return
    const rows = [
      ['Lokasi', 'Avg %', 'EX', 'SD', 'NI', 'Total'],
      ...data.perLokasi.map(r => [r.lokasi, r.avg, r.EX, r.SD, r.NI, r.total]),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `6S-PerLokasi_${tahun}.csv`; a.click()
  }, [data, tahun])

  // Filter options
  const tahunOptions = [
    ...(availYears.length === 0 && tahun ? [{ value: tahun, label: tahun }] : []),
    ...availYears.map(y => ({ value: y, label: y })),
  ]
  const lokasiOptions = [
    { value: 'ALL', label: 'Semua Lokasi' },
    ...lokasiList.map(l => ({ value: l.id, label: l.nama })),
  ]
  const semesterOptions = [
    { value: 'ALL', label: 'Semua Semester' },
    { value: '1',   label: 'Semester 1 (Jan–Jun)' },
    { value: '2',   label: 'Semester 2 (Jul–Des)' },
  ]
  const katOptions = [
    { value: 'ALL', label: 'Semua Kategori' },
    { value: 'EX',  label: 'Excellent' },
    { value: 'SD',  label: 'Standard' },
    { value: 'NI',  label: 'Need Improvement' },
  ]

  return (
    <div className="min-h-screen pb-20">

      {/* Header */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-50 shadow-card">
        <div className="max-w-2xl mx-auto px-5 h-[60px] flex items-center gap-3">
          <Link href="/"
            className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
            <span className="material-icons-round text-lg">arrow_back</span>
          </Link>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-ink">Dashboard Analisis</div>
            <div className="text-[11px] text-ink-3">6S Audit MVM{tahun ? ` — ${periodLabel}` : ''}</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 flex flex-col gap-5">

        {/* ── FILTER GLOBAL ─────────────────────────────────── */}
        <div className="card fade-up" style={{ position: 'relative', zIndex: 20 }}>
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">tune</span></div>
            <div className="text-sm font-bold text-ink">Filter</div>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FilterSelect label="Tahun"    value={tahun}     onChange={setTahun}     options={tahunOptions} />
            <FilterSelect label="Lokasi"   value={lokasiId}  onChange={setLokasiId}  options={lokasiOptions} />
            <FilterSelect label="Semester" value={semester}  onChange={setSemester}  options={semesterOptions} />
            <FilterSelect label="Kategori" value={filterKat} onChange={setFilterKat} options={katOptions} />
          </div>
        </div>

        {loading && (
          <div className="text-center py-16 text-ink-3 text-sm fade-up">Memuat data...</div>
        )}

        {!loading && data && (
          <>
            {/* ── KPI CARDS ──────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 fade-up">
              <div className="rounded-3xl shadow-card border border-brand/30 p-4 flex items-center gap-3"
                style={{ background: '#7C6EF5' }}>
                <span className="material-icons-round text-2xl" style={{ color: 'rgba(255,255,255,0.75)' }}>assignment</span>
                <div>
                  <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>Total Sesi</div>
                  <div className="text-lg font-extrabold text-white">{data.kpi.totalSesi}</div>
                </div>
              </div>
              <div className="rounded-3xl shadow-card border border-success/30 p-4 flex items-center gap-3"
                style={{ background: '#10C98F' }}>
                <span className="material-icons-round text-2xl" style={{ color: 'rgba(255,255,255,0.75)' }}>people</span>
                <div>
                  <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>Auditee Dinilai</div>
                  <div className="text-lg font-extrabold text-white">{data.kpi.totalAuditee}</div>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3 bg-success-light">
                <span className="material-icons-round text-2xl text-success">percent</span>
                <div>
                  <div className="text-[11px] text-ink-3">Avg Score</div>
                  <div className="text-lg font-extrabold text-success">{data.kpi.avgScore}%</div>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3 bg-warning-light">
                <span className="material-icons-round text-2xl text-warning">person_off</span>
                <div>
                  <div className="text-[11px] text-ink-3">Di-skip</div>
                  <div className="text-lg font-extrabold text-warning">{data.kpi.totalSkipped}</div>
                </div>
              </div>
            </div>

            {/* ── KPI KATEGORI ───────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 fade-up">
              {[
                { label: 'Excellent',        value: data.kpi.exCount, pct: data.kpi.totalAuditee ? Math.round(data.kpi.exCount / data.kpi.totalAuditee * 100) : 0, color: 'text-success', bg: 'bg-success-light', bar: '#10C98F' },
                { label: 'Standard',         value: data.kpi.sdCount, pct: data.kpi.totalAuditee ? Math.round(data.kpi.sdCount / data.kpi.totalAuditee * 100) : 0, color: 'text-yellow',  bg: 'bg-yellow-light',  bar: '#FACC15' },
                { label: 'Need Improvement', value: data.kpi.niCount, pct: data.kpi.totalAuditee ? Math.round(data.kpi.niCount / data.kpi.totalAuditee * 100) : 0, color: 'text-danger',  bg: 'bg-danger-light',  bar: '#FF5C7A' },
              ].map(({ label, value, pct, color, bg, bar }) => (
                <div key={label} className={`card p-4 ${bg}`}>
                  <div className={`text-xl font-extrabold ${color}`}>{value}</div>
                  <div className="text-[11px] text-ink-3 mb-2">{label}</div>
                  <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: bar }} />
                  </div>
                  <div className={`text-[11px] font-bold mt-1 ${color}`}>{pct}%</div>
                </div>
              ))}
            </div>

            {/* ── DONUT + PER LOKASI ──────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div ref={refDonut} className="card fade-up">
                <div className="card-head flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="ico-wrap ico-brand"><span className="material-icons-round">donut_large</span></div>
                    <div>
                      <div className="text-sm font-bold text-ink">Distribusi Kategori</div>
                      <div className="text-[11px] text-ink-3">{periodLabel}</div>
                    </div>
                  </div>
                  <ExportPNGButton targetRef={refDonut} filename={`6S-Distribusi_${periodLabel}`} />
                </div>
                <div className="p-4">
                  {data.kpi.totalAuditee === 0 ? (
                    <div className="text-center py-8 text-ink-3 text-sm">Belum ada data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={data.distribusi.filter(d => d.value > 0)} cx="50%" cy="50%"
                          innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {data.distribusi.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number, name: string) => [
                          `${v} orang (${data.kpi.totalAuditee ? Math.round(v / data.kpi.totalAuditee * 100) : 0}%)`,
                          name
                        ]} />
                        <Legend iconType="circle" iconSize={8}
                          formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div ref={refLokasi} className="card fade-up">
                <div className="card-head flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="ico-wrap ico-brand"><span className="material-icons-round">location_on</span></div>
                    <div>
                      <div className="text-sm font-bold text-ink">Per Lokasi</div>
                      <div className="text-[11px] text-ink-3">{periodLabel}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 no-export">
                    <ExportPNGButton targetRef={refLokasi} filename={`6S-PerLokasi_${periodLabel}`} />
                    <button onClick={exportLokasiCSV}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-success-light text-success hover:bg-success hover:text-white transition-all">
                      <span className="material-icons-round text-sm">download</span> CSV
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  {data.perLokasi.length === 0 ? (
                    <div className="text-center py-8 text-ink-3 text-sm">Belum ada data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.perLokasi} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E6FF" />
                        <XAxis dataKey="lokasi" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Avg Score']} />
                        <Bar dataKey="avg" fill="#7C6EF5" radius={[6, 6, 0, 0]}
                          label={{ position: 'top', fontSize: 10, formatter: (v: number) => `${v}%` }} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* ── STACKED BAR TREN ───────────────────────────── */}
            <div ref={refTren} className="card fade-up">
              <div className="card-head flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="ico-wrap ico-brand"><span className="material-icons-round">bar_chart</span></div>
                  <div>
                    <div className="text-sm font-bold text-ink">Tren Distribusi Kategori</div>
                    <div className="text-[11px] text-ink-3">{periodLabel} · {trenMode === 'bulan' ? 'Per Bulan' : 'Per Semester'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 no-export">
                  <ExportPNGButton targetRef={refTren} filename={`6S-Tren_${periodLabel}`} />
                  <button onClick={exportTrenCSV}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-success-light text-success hover:bg-success hover:text-white transition-all">
                    <span className="material-icons-round text-sm">download</span> CSV
                  </button>
                  <div className="flex gap-1 bg-surface rounded-xl p-1">
                    {(['bulan', 'semester'] as const).map(m => (
                      <button key={m} onClick={() => setTrenMode(m)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          trenMode === m ? 'bg-white text-brand shadow-sm' : 'text-ink-3 hover:text-ink'
                        }`}>
                        {m === 'bulan' ? 'Bulanan' : 'Semester'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4">
                {!trenData || trenData.every(t => t.EX + t.SD + t.NI === 0) ? (
                  <div className="text-center py-8 text-ink-3 text-sm">Belum ada data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={trenData} barSize={trenMode === 'semester' ? 60 : 20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E6FF" />
                      <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend iconType="circle" iconSize={8}
                        formatter={(v) => <span style={{ fontSize: 11 }}>{v === 'EX' ? 'Excellent' : v === 'SD' ? 'Standard' : 'Need Improvement'}</span>} />
                      <Bar dataKey="EX" stackId="a" fill={KAT_COLOR.EX} name="EX" radius={[0,0,0,0]} />
                      <Bar dataKey="SD" stackId="a" fill={KAT_COLOR.SD} name="SD" />
                      <Bar dataKey="NI" stackId="a" fill={KAT_COLOR.NI} name="NI" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── RANKING AUDITEE ────────────────────────────── */}
            <div ref={refRanking} className="card fade-up">
              <div className="card-head flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="ico-wrap ico-brand"><span className="material-icons-round">emoji_events</span></div>
                  <div>
                    <div className="text-sm font-bold text-ink">Ranking Auditee</div>
                    <div className="text-[11px] text-ink-3">{periodLabel} · {ranking.length} auditee</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 no-export">
                  <ExportPNGButton targetRef={refRanking} filename={`6S-Ranking_${periodLabel}`} />
                  <button onClick={exportRankingCSV}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-success-light text-success hover:bg-success hover:text-white transition-all">
                    <span className="material-icons-round text-sm">download</span> CSV
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface">
                      <th className="px-4 py-2.5 text-left font-bold text-ink-2">#</th>
                      <th className="px-4 py-2.5 text-left font-bold text-ink-2">Nama</th>
                      <th className="px-4 py-2.5 text-left font-bold text-ink-2">Lokasi</th>
                      <th className="px-4 py-2.5 text-center font-bold text-ink-2">Audit</th>
                      <th className="px-4 py-2.5 text-center font-bold text-ink-2">Avg %</th>
                      <th className="px-4 py-2.5 text-center font-bold text-ink-2">EX</th>
                      <th className="px-4 py-2.5 text-center font-bold text-ink-2">SD</th>
                      <th className="px-4 py-2.5 text-center font-bold text-ink-2">NI</th>
                      <th className="px-4 py-2.5 text-center font-bold text-ink-2">Dominan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-8 text-ink-3">Belum ada data</td></tr>
                    )}
                    {ranking.map((r, i) => (
                      <tr key={r.nama + r.lokasi} className="border-t border-surface-border hover:bg-surface/50 transition-colors">
                        <td className="px-4 py-2.5 text-ink-3 font-bold">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-ink whitespace-nowrap">{r.nama}</td>
                        <td className="px-4 py-2.5 text-ink-3 whitespace-nowrap">{r.lokasi}</td>
                        <td className="px-4 py-2.5 text-center text-ink-2">{r.totalAudit}x</td>
                        <td className="px-4 py-2.5 text-center font-extrabold text-brand">{r.avgPct}%</td>
                        <td className="px-4 py-2.5 text-center text-success font-bold">{r.exCount}</td>
                        <td className="px-4 py-2.5 text-center text-yellow font-bold">{r.sdCount}</td>
                        <td className="px-4 py-2.5 text-center text-danger font-bold">{r.niCount}</td>
                        <td className="px-4 py-2.5 text-center">
                          {r.dominanKat === 'EX' && <span className="badge-ex">EX</span>}
                          {r.dominanKat === 'SD' && <span className="badge-sd">SD</span>}
                          {r.dominanKat === 'NI' && <span className="badge-ni">NI</span>}
                          {!r.dominanKat && <span className="text-ink-3">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── SKIPPED LIST ───────────────────────────────── */}
            {data.skippedList.length > 0 && (
              <div ref={refSkipped} className="card fade-up">
                <div className="card-head flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="ico-wrap bg-warning-light text-warning"><span className="material-icons-round">person_off</span></div>
                    <div>
                      <div className="text-sm font-bold text-ink">Auditee Di-skip</div>
                      <div className="text-[11px] text-ink-3">{periodLabel} · {data.skippedList.length} entri</div>
                    </div>
                  </div>
                  <ExportPNGButton targetRef={refSkipped} filename={`6S-Skipped_${periodLabel}`} />
                </div>
                <div className="p-4 flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {data.skippedList.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-surface rounded-xl border border-surface-border">
                      <span className="text-[11px] font-bold text-ink flex-1">{s.nama}</span>
                      <span className="text-[11px] text-ink-3">{s.lokasi}</span>
                      <span className="text-[11px] text-ink-3">{new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}
