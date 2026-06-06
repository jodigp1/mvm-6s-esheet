'use client'
// app/review/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ActiveSession, AuditResult, ChecklistItem, ScoreConfig } from '@/types/database'
import { KATEGORI_LABEL } from '@/types/database'

export default function ReviewPage() {
  const router = useRouter()

  const [session, setSession]       = useState<ActiveSession | null>(null)
  const [results, setResults]       = useState<AuditResult[]>([])
  const [checklist, setChecklist]   = useState<ChecklistItem[]>([])
  const [scoreConfig, setScoreConfig] = useState<ScoreConfig[]>([])
  const [lokasiNama, setLokasiNama] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [waktuProses, setWaktuProses] = useState('')

  useEffect(() => {
    const raw = sessionStorage.getItem('activeSession')
    if (!raw) { router.push('/'); return }
    const sess: ActiveSession = JSON.parse(raw)
    setSession(sess)
    setLokasiNama(sess.lokasiNama)

    const timer = sessionStorage.getItem('auditTimer') ?? '—'
    setWaktuProses(timer)

    // Load results dari Supabase
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

  // ── Stats ─────────────────────────────────────────────────────
  const nonSkipped  = results.filter(r => !r.skipped)
  const skipped     = results.filter(r => r.skipped)
  const avgPct      = nonSkipped.length > 0
    ? Math.round(nonSkipped.reduce((s, r) => s + (r.persen ?? 0), 0) / nonSkipped.length)
    : 0
  const exCount = nonSkipped.filter(r => r.kategori === 'EX').length
  const sdCount = nonSkipped.filter(r => r.kategori === 'SD').length
  const niCount = nonSkipped.filter(r => r.kategori === 'NI').length

  const tanggalFmt = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  // ── Submit (finalize session) ─────────────────────────────────
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

  // ── Export Excel ──────────────────────────────────────────────
  async function exportExcel() {
    const XLSX = await import('xlsx')

    // Sheet 1: Summary
    const summaryRows = nonSkipped.map(r => {
      const scores = (r.scores as Record<string, number>) ?? {}
      const row: Record<string, string | number> = {
        'Nama Auditee': r.auditee_name,
        'Lokasi': lokasiNama,
        'Tanggal': session.tanggal,
      }
      checklist.forEach(item => {
        row[`${item.nomor}. ${item.item}`] = scores[item.id] ?? 0
      })
      row['Total Score'] = r.total_score ?? 0
      row['Max Score']   = r.max_score ?? 0
      row['Persen (%)']  = r.persen ?? 0
      row['Kategori']    = r.kategori ? KATEGORI_LABEL[r.kategori] : '—'
      return row
    })

    // Sheet 2: Skipped
    const skippedRows = skipped.map(r => ({
      'Nama Auditee': r.auditee_name,
      'Alasan Skip':  r.skip_reason ?? '—',
      'Tanggal':      session.tanggal,
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows),  'Hasil Audit')
    if (skippedRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(skippedRows), 'Auditee Skip')
    }

    const filename = `6S-Audit_${lokasiNama}_${session.tanggal}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  // ── Export PDF ────────────────────────────────────────────────
  async function exportPDF() {
    const { default: jsPDF }     = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('LAPORAN AUDIT 6S', 14, 16)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Lokasi: ${lokasiNama}`, 14, 23)
    doc.text(`Tanggal: ${tanggalFmt}`, 14, 28)
    doc.text(`PIC: ${session.auditor1}${session.auditor2 ? ' & ' + session.auditor2 : ''}`, 14, 33)
    doc.text(`Waktu Proses: ${waktuProses}`, 14, 38)
    doc.text(`Avg Score: ${avgPct}%  |  EX: ${exCount}  SD: ${sdCount}  NI: ${niCount}  Skip: ${skipped.length}`, 14, 43)

    // Tabel hasil
    const head = [['#', 'Nama Auditee', ...checklist.map(c => `${c.nomor}`), 'Total', '%', 'Kategori']]
    const body = nonSkipped.map((r, i) => {
      const scores = (r.scores as Record<string, number>) ?? {}
      return [
        i + 1,
        r.auditee_name,
        ...checklist.map(c => scores[c.id] ?? 0),
        r.total_score ?? 0,
        `${r.persen ?? 0}%`,
        r.kategori ? KATEGORI_LABEL[r.kategori] : '—',
      ]
    })

    autoTable(doc, {
      head, body,
      startY: 48,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [124, 110, 245], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 243, 255] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 35 },
        [checklist.length + 2]: { cellWidth: 12 },
        [checklist.length + 3]: { cellWidth: 12 },
        [checklist.length + 4]: { cellWidth: 22 },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const val = data.cell.raw
          if (val === 'Excellent')         data.cell.styles.textColor = [16, 201, 143]
          if (val === 'Standard')          data.cell.styles.textColor = [234, 179, 8]
          if (val === 'Need Improvement')  data.cell.styles.textColor = [255, 92, 122]
        }
      },
    })

    // Tabel skipped (kalau ada)
    if (skipped.length > 0) {
      const finalY = (doc as any).lastAutoTable.finalY + 8
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
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

  // ── Kategori badge ─────────────────────────────────────────────
  function KategoriBadge({ k }: { k: string | null }) {
    if (!k) return null
    const cls = k === 'EX' ? 'badge-ex' : k === 'SD' ? 'badge-sd' : 'badge-ni'
    return <span className={cls}>{KATEGORI_LABEL[k] ?? k}</span>
  }

  // ── Submitted state ──────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="max-w-sm w-full text-center fade-up">
          <div className="w-16 h-16 rounded-3xl bg-success-light mx-auto mb-5 flex items-center justify-center">
            <span className="material-icons-round text-success text-3xl">task_alt</span>
          </div>
          <h1 className="text-xl font-extrabold text-ink mb-2">Audit Selesai!</h1>
          <p className="text-sm text-ink-3 mb-6">
            Sesi audit {lokasiNama} tanggal {tanggalFmt} berhasil disimpan.
          </p>
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
    <div className="min-h-screen pb-32">

      {/* Header */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-50 shadow-card">
        <div className="max-w-lg mx-auto px-5 h-[60px] flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
            <span className="material-icons-round text-lg">arrow_back</span>
          </button>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-ink">Review Hasil Audit</div>
            <div className="text-[11px] text-ink-3">{lokasiNama} · {tanggalFmt}</div>
          </div>
          {/* Export buttons */}
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

      <main className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">

        {/* KPI Summary */}
        <div className="grid grid-cols-2 gap-3 fade-up">
          {[
            { label: 'Avg Score',    value: `${avgPct}%`,          icon: 'percent',        bg: 'bg-brand-pale',    text: 'text-brand' },
            { label: 'Waktu Proses', value: waktuProses,           icon: 'timer',          bg: 'bg-brand-pale',    text: 'text-brand' },
            { label: 'Excellent',    value: `${exCount} auditee`,  icon: 'verified',       bg: 'bg-success-light', text: 'text-success' },
            { label: 'Std / NI',     value: `${sdCount} / ${niCount}`, icon: 'info',       bg: 'bg-warning-light bg-yellow-light', text: 'text-yellow' },
          ].map(({ label, value, icon, bg, text }) => (
            <div key={label} className={`card p-4 flex items-center gap-3 ${bg}`}>
              <span className={`material-icons-round text-2xl ${text}`}>{icon}</span>
              <div>
                <div className="text-[11px] text-ink-3">{label}</div>
                <div className={`text-base font-extrabold ${text}`}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Info sesi */}
        <div className="card fade-up" style={{ animationDelay: '0.05s' }}>
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">assignment</span></div>
            <div>
              <div className="text-sm font-bold text-ink">Detail Sesi</div>
              <div className="text-[11px] text-ink-3">Informasi audit</div>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'Lokasi',   value: lokasiNama },
              { label: 'Tanggal',  value: tanggalFmt },
              { label: 'Auditor 1', value: session.auditor1 },
              { label: 'Auditor 2', value: session.auditor2 ?? '—' },
              { label: 'Total Auditee', value: `${results.length} orang` },
              { label: 'Di-skip',  value: `${skipped.length} orang` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-ink-3 mb-0.5">{label}</div>
                <div className="font-bold text-ink">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabel hasil */}
        <div className="card fade-up" style={{ animationDelay: '0.08s' }}>
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">table_view</span></div>
            <div>
              <div className="text-sm font-bold text-ink">Hasil per Auditee</div>
              <div className="text-[11px] text-ink-3">{nonSkipped.length} auditee dinilai</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface">
                  <th className="px-4 py-2.5 text-left font-bold text-ink-2 whitespace-nowrap">#</th>
                  <th className="px-4 py-2.5 text-left font-bold text-ink-2 whitespace-nowrap">Nama</th>
                  <th className="px-4 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap">Skor</th>
                  <th className="px-4 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap">%</th>
                  <th className="px-4 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap">Kategori</th>
                </tr>
              </thead>
              <tbody>
                {nonSkipped.map((r, i) => (
                  <tr key={r.id} className="border-t border-surface-border hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-2.5 text-ink-3">{i + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink whitespace-nowrap">{r.auditee_name}</td>
                    <td className="px-4 py-2.5 text-center text-ink-2">{r.total_score}/{r.max_score}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-ink">{r.persen}%</td>
                    <td className="px-4 py-2.5 text-center"><KategoriBadge k={r.kategori ?? null} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel skipped */}
        {skipped.length > 0 && (
          <div className="card fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="card-head flex items-center gap-3">
              <div className="ico-wrap bg-danger-light text-danger"><span className="material-icons-round">person_off</span></div>
              <div>
                <div className="text-sm font-bold text-ink">Auditee Di-skip</div>
                <div className="text-[11px] text-ink-3">{skipped.length} auditee tidak dinilai</div>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {skipped.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-danger-light/50 rounded-2xl">
                  <div className="w-6 h-6 rounded-lg bg-danger-light flex items-center justify-center text-[11px] font-bold text-danger flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-ink">{r.auditee_name}</div>
                    <div className="text-[11px] text-ink-3">{r.skip_reason ?? '—'}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-light text-danger">Skip</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="card p-4 fade-up border-success/30 bg-success-light/30" style={{ animationDelay: '0.12s' }}>
          <div className="flex items-start gap-3 mb-4">
            <span className="material-icons-round text-success text-xl mt-0.5">info</span>
            <p className="text-xs text-ink-2 leading-relaxed">
              Setelah submit, sesi ini akan ditandai <strong>selesai</strong> dan masuk ke riwayat. Data tidak dapat diubah kecuali oleh admin di Supabase.
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
