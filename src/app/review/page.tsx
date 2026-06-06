'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ActiveSession, AuditResult, ChecklistItem, ScoreConfig } from '@/types/database'
import { KATEGORI_LABEL } from '@/types/database'

export default function ReviewPage() {
  const router = useRouter()

  const [session, setSession]         = useState<ActiveSession | null>(null)
  const [results, setResults]         = useState<AuditResult[]>([])
  const [checklist, setChecklist]     = useState<ChecklistItem[]>([])
  const [scoreConfig, setScoreConfig] = useState<ScoreConfig[]>([])
  const [lokasiNama, setLokasiNama]   = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(false)
  const [waktuProses, setWaktuProses] = useState('')

  useEffect(() => {
    const raw = sessionStorage.getItem('activeSession')
    if (!raw) { router.push('/'); return }
    const sess: ActiveSession = JSON.parse(raw)
    setSession(sess)
    setLokasiNama(sess.lokasiNama)
    setWaktuProses(sessionStorage.getItem('auditTimer') ?? '—')

    Promise.all([
      supabase.from('audit_results').select('*').eq('session_id', sess.sessionId).order('created_at'),
      supabase.from('checklist_items').select('*').eq('lokasi_id', sess.lokasiId).eq('aktif', true).order('nomor'),
      supabase.from('score_config').select('*').order('nilai'),
    ]).then(([{ data: r }, { data: cl }, { data: sc }]) => {
      if (r)  setResults(r)
      if (cl) setChecklist(cl)
      if (sc) setScoreConfig(sc)
    })
  }, [router])

  // ── Save ke Supabase ──────────────────────────────────────────
  const saveResult = async (name: string, data: AuditResult) => {
    if (!session) return
  }

  if (!session) return null

  const nonSkipped = results.filter(r => !r.skipped)
  const skipped    = results.filter(r => r.skipped)
  const avgPct     = nonSkipped.length > 0
    ? Math.round(nonSkipped.reduce((s, r) => s + (r.persen ?? 0), 0) / nonSkipped.length)
    : 0
  const exCount = nonSkipped.filter(r => r.kategori === 'EX').length

  const bulan      = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const tanggalFmt = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  // ordered member list from results (preserves audit order)
  const allMembers = session.members

  async function handleSubmit() {
    if (!session) return
    setSubmitting(true)
    await fetch('/api/audit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.sessionId, waktu_proses: waktuProses }),
    })
    sessionStorage.removeItem('activeSession')
    sessionStorage.removeItem('auditTimer')
    setSubmitted(true)
    setSubmitting(false)
  }

  async function exportExcel() {
    if (!session) return
    const XLSX = await import('xlsx')
    const rows = allMembers.map((name, i) => {
      const r = results.find(res => res.auditee_name === name)
      const isSkipped = r?.skipped ?? false
      const scores = (r?.scores as Record<string, number>) ?? {}
      const row: Record<string, string | number> = {
        '#': i + 1,
        'Nama Auditee': name,
        'Lokasi': lokasiNama,
        'Tanggal': session.tanggal,
      }
      checklist.forEach(item => {
        row[`${item.nomor}. ${item.item}`] = isSkipped ? '—' : (scores[item.id] ?? '—')
      })
      row['Total Score'] = isSkipped ? '—' : (r?.total_score ?? 0)
      row['Max Score']   = isSkipped ? '—' : (r?.max_score ?? 0)
      row['Persen (%)']  = isSkipped ? '—' : (r?.persen ?? 0)
      row['Kategori']    = isSkipped ? 'Dilewati' : (r?.kategori ? KATEGORI_LABEL[r.kategori] : '—')
      return row
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Hasil Audit')
    XLSX.writeFile(wb, `6S-Audit_${lokasiNama}_${session.tanggal}.xlsx`)
  }

  async function exportPDF() {
    if (!session) return
    const { default: jsPDF }     = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W = 297, M = 14

    // ── Green header ─────────────────────────────────────────────
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
      `PIC Auditor: ${session.auditor1}${session.auditor2 ? ' & ' + session.auditor2 : ''}   |   ${checklist.length} Item Checklist   |   Waktu: ${waktuProses}`,
      M + 8, 40
    )

    // KPI boxes
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

    // ── Table ────────────────────────────────────────────────────
    doc.setTextColor(0, 0, 0)
    const head = [['#', 'NAMA', ...checklist.map(c => c.item.length > 10 ? c.item.substring(0, 10) + '.' : c.item), 'TOTAL', '%', 'KATEGORI']]
    const body = allMembers.map((name, i) => {
      const r = results.find(res => res.auditee_name === name)
      const isSkipped = r?.skipped ?? !r
      const scores = (r?.scores as Record<string, number>) ?? {}
      if (isSkipped) {
        return [i + 1, name, ...checklist.map(() => '—'), '—', '—', 'Dilewati']
      }
      return [
        i + 1, name,
        ...checklist.map(c => scores[c.id] !== undefined ? scores[c.id] : '—'),
        r?.total_score ?? '—',
        r?.persen !== null && r?.persen !== undefined ? `${r.persen}%` : '—',
        r?.kategori ? KATEGORI_LABEL[r.kategori] : '—',
      ]
    })

    autoTable(doc, {
      head, body,
      startY: 76,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [240, 238, 255], textColor: [50, 40, 100], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [252, 251, 255] },
      columnStyles: { 1: { minCellWidth: 28, fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const raw = data.row.raw as (string | number)[]
          const isSkippedRow = raw[raw.length - 1] === 'Dilewati'
          if (isSkippedRow) {
            data.cell.styles.textColor = [160, 160, 160]
            data.cell.styles.fontStyle = 'italic'
          } else {
            const val = data.cell.raw
            if (val === 'Excellent')        { data.cell.styles.textColor = [16, 160, 110]; data.cell.styles.fontStyle = 'bold' }
            if (val === 'Standard')         { data.cell.styles.textColor = [180, 130, 0];  data.cell.styles.fontStyle = 'bold' }
            if (val === 'Need Improvement') { data.cell.styles.textColor = [200, 50, 80];  data.cell.styles.fontStyle = 'bold' }
            const col = data.column.index
            if (col >= 2 && col < 2 + checklist.length) {
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

    // ── Sign approval ────────────────────────────────────────────
    const tableBottom = (doc as any).lastAutoTable.finalY
    const signY = tableBottom + 10

    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
    doc.text('PIC AUDITOR 6S', M + 8, signY)
    if (session.auditor2) doc.text('MENGETAHUI:', W - M - 8 - 60, signY)

    doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.4)
    doc.line(M + 8, signY + 16, M + 70, signY + 16)
    if (session.auditor2) doc.line(W - M - 8 - 60, signY + 16, W - M - 8, signY + 16)

    doc.setTextColor(100, 85, 220); doc.setFontSize(10); doc.setFont('helvetica', 'bold')
    doc.text(session.auditor1, M + 8, signY + 21)
    doc.setTextColor(80, 80, 80); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    doc.text(`PIC 6S ${lokasiNama}`, M + 8, signY + 26)

    if (session.auditor2) {
      doc.setTextColor(100, 85, 220); doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text(session.auditor2, W - M - 8 - 60, signY + 21)
      doc.setTextColor(80, 80, 80); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text('Safety Coordinator', W - M - 8 - 60, signY + 26)
    }

    // ── Skipped warning ──────────────────────────────────────────
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

    doc.save(`6S-Audit_${lokasiNama}_${session.tanggal}.pdf`)
  }

  function ScoreBubble({ val }: { val: number | undefined }) {
    if (val === undefined || val < 0) return <span className="text-ink-3">—</span>
    const sc = scoreConfig.find(s => s.nilai === val)
    const color = sc?.warna ?? '#9CA3AF'
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold"
        style={{ background: color + '22', color }}>
        {val}
      </span>
    )
  }

  function KategoriBadge({ k }: { k: string | null }) {
    if (!k) return null
    const cls = k === 'EX' ? 'badge-ex' : k === 'SD' ? 'badge-sd' : 'badge-ni'
    return <span className={cls}>{k}</span>
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="max-w-sm w-full text-center fade-up">
          <div className="w-16 h-16 rounded-3xl bg-success-light mx-auto mb-5 flex items-center justify-center">
            <span className="material-icons-round text-success text-3xl">task_alt</span>
          </div>
          <h1 className="text-xl font-extrabold text-ink mb-2">Audit Selesai!</h1>
          <p className="text-sm text-ink-3 mb-6">Sesi audit {lokasiNama} tanggal {tanggalFmt} berhasil disimpan.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => router.push('/')} className="btn-primary flex items-center justify-center gap-2">
              <span className="material-icons-round text-base">add_task</span> Buat Sesi Baru
            </button>
            <button onClick={() => router.push('/history')} className="btn-secondary flex items-center justify-center gap-2">
              <span className="material-icons-round text-base">history</span> Lihat Riwayat
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-surface-border sticky top-0 z-50 shadow-card">
        <div className="max-w-3xl mx-auto px-5 h-[60px] flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
            <span className="material-icons-round text-lg">arrow_back</span>
          </button>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-ink">Review & Export</div>
            <div className="text-[11px] text-ink-3">{lokasiNama} · {tanggalFmt} · PIC: {session.auditor1}</div>
          </div>
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-success-light text-success hover:bg-success hover:text-white transition-all">
            <span className="material-icons-round text-sm">table_chart</span> Excel
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-danger-light text-danger hover:bg-danger hover:text-white transition-all">
            <span className="material-icons-round text-sm">picture_as_pdf</span> PDF
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-6 flex flex-col gap-5">

        {/* ── HERO HEADER ─────────────────────────────────────── */}
        <div className="rounded-3xl overflow-hidden shadow-card-hover fade-up"
          style={{ background: 'linear-gradient(135deg, #10C98F 0%, #0db87e 50%, #0ea572 100%)' }}>
          <div className="p-6 text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 bg-white" />
            <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full opacity-10 bg-white" />
            <div className="relative">
              <h1 className="text-xl font-extrabold mb-1">Hasil Audit 6S MVM ({bulan})</h1>
              <p className="text-sm opacity-80 mb-4">{lokasiNama} — {tanggalFmt}</p>
              <div className="flex flex-wrap gap-4 text-sm mb-5">
                <div className="flex items-center gap-1.5 opacity-90">
                  <span className="material-icons-round text-base">person</span>
                  PIC Auditor: {session.auditor1}{session.auditor2 ? ` & ${session.auditor2}` : ''}
                </div>
                <div className="flex items-center gap-1.5 opacity-90">
                  <span className="material-icons-round text-base">checklist</span>
                  {checklist.length} Item Checklist
                </div>
                <div className="flex items-center gap-1.5 opacity-90">
                  <span className="material-icons-round text-base">timer</span>
                  Waktu: {waktuProses}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Jumlah Auditee',   value: nonSkipped.length },
                  { label: 'Rata-rata',          value: `${avgPct}%` },
                  { label: 'Jumlah Excellent',   value: exCount },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.18)' }}>
                    <div className="text-xl font-extrabold">{value}</div>
                    <div className="text-[11px] opacity-75 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── REKAP TABLE ─────────────────────────────────────── */}
        <div className="card fade-up" style={{ animationDelay: '0.05s' }}>
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">table_view</span></div>
            <div>
              <div className="text-sm font-bold text-ink">
                Rekap audit penilaian 6S di {lokasiNama} ({bulan}) | Auditor: {session.auditor1}
              </div>
              <div className="text-[11px] text-ink-3">{nonSkipped.length} dari {allMembers.length} auditee dinilai</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface">
                  <th className="px-3 py-2.5 text-left font-bold text-ink-2 whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left font-bold text-ink-2 whitespace-nowrap min-w-[110px]">NAMA</th>
                  {checklist.map(item => (
                    <th key={item.id} className="px-2 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap min-w-[70px] uppercase text-[10px]">
                      {item.item.length > 8 ? item.item.substring(0, 8) + '…' : item.item}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap">TOTAL</th>
                  <th className="px-3 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap">%</th>
                  <th className="px-3 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap">KATEGORI</th>
                </tr>
              </thead>
              <tbody>
                {allMembers.map((name, i) => {
                  const r = results.find(res => res.auditee_name === name)
                  const isSkipped = r?.skipped ?? !r
                  const scores = (r?.scores as Record<string, number>) ?? {}
                  return (
                    <tr key={name} className={`border-t border-surface-border transition-colors ${isSkipped ? 'opacity-50' : 'hover:bg-surface/50'}`}>
                      <td className="px-3 py-2.5 text-ink-3">{i + 1}</td>
                      <td className={`px-3 py-2.5 whitespace-nowrap ${isSkipped ? 'text-ink-3' : 'font-bold text-ink'}`}>{name}</td>
                      {checklist.map(item => (
                        <td key={item.id} className="px-2 py-2.5 text-center">
                          {isSkipped ? <span className="text-ink-3">—</span> : <ScoreBubble val={scores[item.id]} />}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center font-bold text-ink">
                        {isSkipped ? <span className="text-ink-3">—</span> : (r?.total_score ?? '—')}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-brand">
                        {isSkipped ? <span className="text-ink-3">—</span> : `${r?.persen ?? 0}%`}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isSkipped
                          ? <span className="text-[10px] italic text-ink-3">Dilewati</span>
                          : <KategoriBadge k={r?.kategori ?? null} />
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── SIGN APPROVAL ──────────────────────────────────── */}
          <div className="p-6 border-t border-surface-border grid grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-10">PIC Auditor 6S</div>
              <div className="border-b-2 border-ink-2 mb-2 w-32" />
              <div className="font-bold text-sm text-brand">{session.auditor1}</div>
              <div className="text-[11px] text-ink-3">PIC 6S {lokasiNama}</div>
            </div>
            {session.auditor2 && (
              <div className="text-right">
                <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-10">Mengetahui:</div>
                <div className="border-b-2 border-ink-2 mb-2 w-32 ml-auto" />
                <div className="font-bold text-sm text-brand">{session.auditor2}</div>
                <div className="text-[11px] text-ink-3">Safety Coordinator</div>
              </div>
            )}
          </div>
        </div>

        {/* ── SKIPPED WARNING ─────────────────────────────────── */}
        {skipped.length > 0 && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3 fade-up" style={{ animationDelay: '0.08s' }}>
            <span className="material-icons-round text-warning text-xl mt-0.5">warning_amber</span>
            <div>
              <div className="text-sm font-bold text-warning">{skipped.length} Auditee Dilewati</div>
              <div className="text-[11px] text-ink-3 mt-0.5">{skipped.map(r => r.auditee_name).join(', ')}</div>
            </div>
          </div>
        )}

        {/* ── SUBMIT ──────────────────────────────────────────── */}
        <div className="card p-4 fade-up border-success/30 bg-success-light/30" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start gap-3 mb-4">
            <span className="material-icons-round text-success text-xl mt-0.5">info</span>
            <p className="text-xs text-ink-2 leading-relaxed">
              Setelah submit, sesi ini akan ditandai <strong>selesai</strong> dan masuk ke riwayat.
            </p>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 rounded-2xl text-sm font-bold text-white border-none cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #10C98F, #0ea572)' }}>
            {submitting
              ? <><span className="material-icons-round text-base animate-spin">sync</span> Menyimpan...</>
              : <><span className="material-icons-round text-base">cloud_done</span> Submit & Selesaikan Sesi</>
            }
          </button>
        </div>

      </main>
    </div>
  )
}
