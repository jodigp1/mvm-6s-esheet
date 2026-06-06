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

  if (!session) return null

  const nonSkipped = results.filter(r => !r.skipped)
  const skipped    = results.filter(r => r.skipped)
  const avgPct     = nonSkipped.length > 0
    ? Math.round(nonSkipped.reduce((s, r) => s + (r.persen ?? 0), 0) / nonSkipped.length)
    : 0
  const exCount = nonSkipped.filter(r => r.kategori === 'EX').length

  const bulan = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const tanggalFmt = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

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
    const summaryRows = nonSkipped.map(r => {
      const scores = (r.scores as Record<string, number>) ?? {}
      const row: Record<string, string | number> = {
        'Nama Auditee': r.auditee_name,
        'Lokasi': lokasiNama,
        'Tanggal': session.tanggal,
      }
      checklist.forEach(item => { row[`${item.nomor}. ${item.item}`] = scores[item.id] ?? 0 })
      row['Total Score'] = r.total_score ?? 0
      row['Max Score']   = r.max_score ?? 0
      row['Persen (%)']  = r.persen ?? 0
      row['Kategori']    = r.kategori ? KATEGORI_LABEL[r.kategori] : '—'
      return row
    })
    const skippedRows = skipped.map(r => ({
      'Nama Auditee': r.auditee_name,
      'Alasan Skip':  r.skip_reason ?? '—',
      'Tanggal':      session.tanggal,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Hasil Audit')
    if (skippedRows.length > 0)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(skippedRows), 'Auditee Skip')
    XLSX.writeFile(wb, `6S-Audit_${lokasiNama}_${session.tanggal}.xlsx`)
  }

  async function exportPDF() {
    if (!session) return
    const { default: jsPDF }     = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.setFontSize(14); doc.setFont('helvetica', 'bold')
    doc.text('LAPORAN AUDIT 6S', 14, 16)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text(`Lokasi: ${lokasiNama}`, 14, 23)
    doc.text(`Tanggal: ${tanggalFmt}`, 14, 28)
    doc.text(`PIC: ${session.auditor1}${session.auditor2 ? ' & ' + session.auditor2 : ''}`, 14, 33)
    doc.text(`Waktu Proses: ${waktuProses}`, 14, 38)
    doc.text(`Avg Score: ${avgPct}%  |  EX: ${exCount}  Skip: ${skipped.length}`, 14, 43)

    const head = [['#', 'Nama Auditee', ...checklist.map(c => `${c.nomor}`), 'Total', '%', 'Kategori']]
    const body = nonSkipped.map((r, i) => {
      const scores = (r.scores as Record<string, number>) ?? {}
      return [i + 1, r.auditee_name, ...checklist.map(c => scores[c.id] ?? 0),
        r.total_score ?? 0, `${r.persen ?? 0}%`, r.kategori ? KATEGORI_LABEL[r.kategori] : '—']
    })

    autoTable(doc, {
      head, body, startY: 48,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [16, 201, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 255, 250] },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const val = data.cell.raw
          if (val === 'Excellent')        data.cell.styles.textColor = [16, 201, 143]
          if (val === 'Standard')         data.cell.styles.textColor = [234, 179, 8]
          if (val === 'Need Improvement') data.cell.styles.textColor = [255, 92, 122]
        }
      },
    })

    if (skipped.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY + 8
      doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text('Auditee yang Di-skip', 14, finalY)
      autoTable(doc, {
        head: [['#', 'Nama Auditee', 'Alasan Skip']],
        body: skipped.map((r, i) => [i + 1, r.auditee_name, r.skip_reason ?? '—']),
        startY: finalY + 4,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [255, 92, 122] },
      })
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

      {/* Header bar */}
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

        {/* ── HERO HEADER CARD ─────────────────────────────── */}
        <div className="rounded-3xl overflow-hidden shadow-card-hover fade-up"
          style={{ background: 'linear-gradient(135deg, #10C98F 0%, #0db87e 50%, #0ea572 100%)' }}>
          <div className="p-6 text-white relative overflow-hidden">
            {/* decorative circle */}
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
              style={{ background: 'white' }} />
            <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full opacity-10"
              style={{ background: 'white' }} />

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

              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Jumlah Auditee', value: nonSkipped.length },
                  { label: 'Rata-rata',      value: `${avgPct}%` },
                  { label: 'Jumlah Excellent', value: exCount },
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

        {/* ── REKAP TABLE ───────────────────────────────────── */}
        <div className="card fade-up" style={{ animationDelay: '0.05s' }}>
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">table_view</span></div>
            <div>
              <div className="text-sm font-bold text-ink">
                Rekap audit penilaian 6S di {lokasiNama} ({bulan}) | Auditor: {session.auditor1}
              </div>
              <div className="text-[11px] text-ink-3">{nonSkipped.length} dari {results.length} auditee dinilai</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface">
                  <th className="px-3 py-2.5 text-left font-bold text-ink-2 sticky left-0 bg-surface z-10 whitespace-nowrap">#</th>
                  <th className="px-3 py-2.5 text-left font-bold text-ink-2 sticky left-6 bg-surface z-10 whitespace-nowrap min-w-[120px]">NAMA</th>
                  {checklist.map(item => (
                    <th key={item.id} className="px-2 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap min-w-[80px]">
                      {item.item.length > 10 ? item.item.substring(0, 10) + '…' : item.item}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap">%</th>
                  <th className="px-3 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap">Kategori</th>
                </tr>
              </thead>
              <tbody>
                {session.members.map((memberName, i) => {
                  const result = results.find(r => r.auditee_name === memberName)
                  const isSkipped = result?.skipped ?? false
                  const scores = (result?.scores as Record<string, number>) ?? {}
                  return (
                    <tr key={memberName} className={`border-t border-surface-border ${isSkipped ? 'opacity-50' : 'hover:bg-surface/50'} transition-colors`}>
                      <td className="px-3 py-2.5 text-ink-3 sticky left-0 bg-white z-10">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink sticky left-6 bg-white z-10 whitespace-nowrap">
                        {memberName}
                      </td>
                      {checklist.map(item => (
                        <td key={item.id} className="px-2 py-2.5 text-center">
                          {isSkipped
                            ? <span className="text-ink-3">—</span>
                            : <ScoreBubble val={scores[item.id]} />
                          }
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center font-bold text-ink">
                        {isSkipped ? <span className="text-ink-3">skip</span> : `${result?.persen ?? 0}%`}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isSkipped
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-ink-3">
                              {result?.skip_reason?.split('—')[0]?.trim() ?? 'Skip'}
                            </span>
                          : <KategoriBadge k={result?.kategori ?? null} />
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── SIGN APPROVAL ──────────────────────────────── */}
          <div className="p-6 border-t border-surface-border grid grid-cols-2 gap-8 mt-2">
            <div>
              <div className="text-[11px] font-bold text-ink-3 uppercase tracking-wider mb-8">PIC Auditor 6S</div>
              <div className="border-b border-ink-3 mb-2 w-36" />
              <div className="font-bold text-sm text-ink">{session.auditor1}</div>
              <div className="text-[11px] text-ink-3">PIC 6S {lokasiNama}</div>
            </div>
            {session.auditor2 && (
              <div className="text-right">
                <div className="text-[11px] font-bold text-ink-3 uppercase tracking-wider mb-8">Mengetahui:</div>
                <div className="border-b border-ink-3 mb-2 w-36 ml-auto" />
                <div className="font-bold text-sm text-ink">{session.auditor2}</div>
                <div className="text-[11px] text-ink-3">Safety Coordinator</div>
              </div>
            )}
          </div>
        </div>

        {/* ── SKIPPED WARNING ───────────────────────────────── */}
        {skipped.length > 0 && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3 fade-up" style={{ animationDelay: '0.08s' }}>
            <span className="material-icons-round text-warning text-xl mt-0.5">warning_amber</span>
            <div>
              <div className="text-sm font-bold text-ink">{skipped.length} Auditee Dilewati</div>
              <div className="text-[11px] text-ink-3 mt-0.5">
                {skipped.map(r => r.auditee_name).join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* ── SUBMIT ───────────────────────────────────────── */}
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
