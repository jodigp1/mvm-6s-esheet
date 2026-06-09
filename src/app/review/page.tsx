'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ActiveSession, AuditResult, ChecklistItem, ScoreConfig, CustomAnswer } from '@/types/database'
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

  const bobotChecklist    = checklist.filter(i => i.tipe !== 'non_bobot')
  const nonBobotChecklist = checklist.filter(i => i.tipe === 'non_bobot')
  const nonSkipped = results.filter(r => !r.skipped)
  const skipped    = results.filter(r => r.skipped)
  const avgPct     = nonSkipped.length > 0
    ? Math.round(nonSkipped.reduce((s, r) => s + (r.persen ?? 0), 0) / nonSkipped.length)
    : 0
  const exCount = nonSkipped.filter(r => r.kategori === 'EX').length

  const bulan      = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const tanggalFmt = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  const lokasiKey  = lokasiNama.toLowerCase()
  const heroGradient = lokasiKey.includes('cabin')
    ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
    : lokasiKey.includes('otc')
      ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)'
      : 'linear-gradient(135deg, #7C6EF5 0%, #5A4ED4 100%)'

  // ordered member list from results (preserves audit order)
  const allMembers = session.members

  async function handleSubmit() {
    if (!session) return
    setSubmitting(true)
    await fetch('/api/audit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.sessionId, waktu_proses: waktuProses, checklist_snapshot: checklist }),
    })
    sessionStorage.removeItem('activeSession')
    sessionStorage.removeItem('auditTimer')
    setSubmitted(true)
    setSubmitting(false)
  }

  /* Export functions disabled — gunakan History > klik sesi untuk export
  async function exportExcel() {
    if (!session) return
    const XLSX = await import('xlsx')
    const bobotItems    = checklist.filter(i => i.tipe !== 'non_bobot')
    const nonBobotItems = checklist.filter(i => i.tipe === 'non_bobot')
    const rows = allMembers.map((name, i) => {
      const r = results.find(res => res.auditee_name === name)
      const isSkipped = r?.skipped ?? false
      const scores          = (r?.scores as Record<string, number>) ?? {}
      const nonBobotAnswers = (r?.non_bobot_answers as Record<string, string>) ?? {}
      const remarks         = (r?.remarks as Record<string, string>) ?? {}
      const row: Record<string, string | number> = {
        '#': i + 1,
        'Nama Auditee': name,
        'Lokasi': lokasiNama,
        'Tanggal': session.tanggal,
      }
      bobotItems.forEach(item => {
        row[`${item.nomor}. ${item.item}`] = isSkipped ? '—' : (scores[item.id] ?? '—')
      })
      row['Total Score'] = isSkipped ? '—' : (r?.total_score ?? 0)
      row['Max Score']   = isSkipped ? '—' : (r?.max_score ?? 0)
      row['Persen (%)']  = isSkipped ? '—' : (r?.persen ?? 0)
      row['Kategori']    = isSkipped ? 'Dilewati' : (r?.kategori ? KATEGORI_LABEL[r.kategori] : '—')
      nonBobotItems.forEach(item => {
        row[`[NB] ${item.item}`]         = isSkipped ? '—' : (nonBobotAnswers[item.id] ?? '—')
        row[`[NB] ${item.item} (Catatan)`] = remarks[item.id] ?? ''
      })
      return row
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Hasil Audit')
    XLSX.writeFile(wb, `6S-Audit_${lokasiNama}_${session.tanggal}.xlsx`)
  }

  function exportPDF() {
    window.print()
  }
  */

  function ChecklistLegend() {
    if (checklist.length === 0) return null
    const bobotCount = checklist.filter(i => i.tipe !== 'non_bobot').length
    const nbCount    = checklist.filter(i => i.tipe === 'non_bobot').length
    return (
      <div className="rounded-3xl overflow-hidden border border-surface-border shadow-card fade-up print:break-before-page" style={{ animationDelay: '0.12s' }}>
        <div className="bg-white">
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">list_alt</span></div>
            <div>
              <div className="text-sm font-bold text-ink">Keterangan Item Checklist</div>
              <div className="text-[11px] text-ink-3">{checklist.length} item · {bobotCount} bobot · {nbCount} non-bobot</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface">
                  <th className="px-3 py-2.5 text-center font-bold text-ink-2 w-8">#</th>
                  <th className="px-3 py-2.5 text-left font-bold text-ink-2">Nama Item</th>
                  <th className="px-3 py-2.5 text-left font-bold text-ink-2">Deskripsi</th>
                  <th className="px-3 py-2.5 text-left font-bold text-ink-2 whitespace-nowrap">Tipe</th>
                  <th className="px-3 py-2.5 text-left font-bold text-ink-2">Bobot / Pilihan Jawaban</th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((item, i) => {
                  const isNB    = item.tipe === 'non_bobot'
                  const jawaban = (item.jawaban_custom as CustomAnswer[] | null) ?? []
                  return (
                    <tr key={item.id} className="border-t border-surface-border">
                      <td className="px-3 py-2 text-ink-3 text-center">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-ink">{item.item}</td>
                      <td className="px-3 py-2 text-ink-3">{item.deskripsi || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isNB
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">Non-Bobot</span>
                          : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-pale text-brand">Bobot {item.bobot}</span>
                        }
                      </td>
                      <td className="px-3 py-2">
                        {isNB
                          ? <div className="flex flex-wrap gap-1">
                              {jawaban.map((j, k) => (
                                <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${j.wajib_komentar ? 'bg-warning/10 text-warning' : 'bg-surface text-ink-3'}`}>
                                  {j.label}{j.wajib_komentar ? ' 💬' : ''}
                                </span>
                              ))}
                            </div>
                          : <span className="text-ink-2 font-semibold">{item.bobot}</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function ScoreBubble({ val }: { val: number | undefined }) {
    if (val === undefined || val < 0) return <span className="text-ink-3">—</span>
    const sc = scoreConfig.find(s => s.nilai === val)
    const color = sc?.warna ?? '#9CA3AF'
    return (
      <span className="score-bubble inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold"
        style={{ background: color + '22', color }}>
        {val}
      </span>
    )
  }

  function KategoriBadge({ k }: { k: string | null }) {
    if (!k) return null
    const label = KATEGORI_LABEL[k] ?? k
    const cls   = k === 'EX' ? 'badge-ex' : k === 'SD' ? 'badge-sd' : 'badge-ni'
    return (
      <>
        <span className={`${cls} no-print`}>{k}</span>
        <span className={`hidden print:inline font-bold text-xs ${k === 'EX' ? 'text-ex' : k === 'SD' ? 'text-yellow' : 'text-danger'}`}>{label}</span>
      </>
    )
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
      <header className="no-print bg-white border-b border-surface-border sticky top-0 z-50 shadow-card">
        <div className="max-w-6xl mx-auto px-5 h-[60px] flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
            <span className="material-icons-round text-lg">arrow_back</span>
          </button>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-ink">Review & Export</div>
            <div className="text-[11px] text-ink-3">{lokasiNama} · {tanggalFmt} · PIC: {session.auditor1}</div>
          </div>
          {/* Export buttons disabled — gunakan History > klik sesi untuk export
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-success-light text-success hover:bg-success hover:text-white transition-all">
            <span className="material-icons-round text-sm">table_chart</span> Excel
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-danger-light text-danger hover:bg-danger hover:text-white transition-all">
            <span className="material-icons-round text-sm">picture_as_pdf</span> PDF
          </button>
          */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 flex flex-col gap-5">

        {/* ── HERO + TABLE (connected) ─────────────────────────── */}
        <div className="rounded-3xl overflow-hidden shadow-card-hover fade-up border border-surface-border">

          {/* Hero header */}
          <div style={{ background: heroGradient }}>
            <div className="p-6 text-white relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 bg-white" />
              <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full opacity-10 bg-white" />
              <div className="relative">
                <h1 className="text-2xl font-extrabold mb-1">Hasil Audit 6S MVM ({bulan})</h1>
                <p className="text-sm opacity-80 mb-4">{lokasiNama} — {tanggalFmt}</p>
                <div className="flex flex-wrap gap-4 text-sm mb-5">
                  <div className="flex items-center gap-1.5 opacity-90">
                    <span className="material-icons-round text-base">person</span>
                    PIC Auditor: {session.auditor1}{session.auditor2 ? ` & ${session.auditor2}` : ''}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-90">
                    <span className="material-icons-round text-base">checklist</span>
                    {bobotChecklist.length} Item Bobot{nonBobotChecklist.length > 0 ? ` · ${nonBobotChecklist.length} Non-Bobot` : ''}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-90">
                    <span className="material-icons-round text-base">timer</span>
                    Waktu (Durasi): {waktuProses}
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
          <div className="bg-white">
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
                  <th className="px-2 py-2.5 text-left font-bold text-ink-2 whitespace-nowrap">#</th>
                  <th className="py-2.5 text-left font-bold text-ink-2" style={{ maxWidth: '90px', padding: '6px 8px' }}>NAMA</th>
                  {bobotChecklist.map(item => {
                    const words = item.item.split(' ')
                    const n = item.item.length
                    const fs = n <= 8 ? 9 : n <= 13 ? 8 : n <= 19 ? 7 : 6.5
                    return (
                      <th key={item.id} style={{ padding: '5px 3px', textAlign: 'center', verticalAlign: 'bottom' }}>
                        <div style={{
                          maxWidth: '58px', margin: '0 auto',
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
                  {nonBobotChecklist.map(item => {
                    const words = item.item.split(' ')
                    const n = item.item.length
                    const fs = n <= 8 ? 9 : n <= 13 ? 8 : n <= 19 ? 7 : 6.5
                    return (
                      <th key={item.id} style={{ padding: '5px 3px', textAlign: 'center', verticalAlign: 'bottom', background: '#f0fdf4' }}>
                        <div style={{
                          maxWidth: '58px', margin: '0 auto',
                          fontSize: `${fs}px`, fontWeight: 700, textTransform: 'uppercase',
                          lineHeight: 1.4, color: '#15803d',
                          wordBreak: 'break-word',
                        }}>
                          {words.map((word, i) => (
                            <Fragment key={i}>{word}{i < words.length - 1 && <br />}</Fragment>
                          ))}
                        </div>
                        <div style={{ fontSize: '7px', color: '#86efac', fontWeight: 700, marginTop: '2px' }}>NB</div>
                      </th>
                    )
                  })}
                  <th className="px-2 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap text-[10px]">TOTAL</th>
                  <th className="px-2 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap text-[10px]">%</th>
                  <th className="px-2 py-2.5 text-center font-bold text-ink-2 whitespace-nowrap text-[10px]">KAT</th>
                </tr>
              </thead>
              <tbody>
                {allMembers.map((name, i) => {
                  const r = results.find(res => res.auditee_name === name)
                  const isSkipped       = r?.skipped ?? !r
                  const scores          = (r?.scores as Record<string, number>) ?? {}
                  const remarks         = (r?.remarks as Record<string, string>) ?? {}
                  const nonBobotAnswers = (r?.non_bobot_answers as Record<string, string>) ?? {}
                  const allCommentItems = [...bobotChecklist, ...nonBobotChecklist].filter(item => remarks[item.id]?.trim())
                  const totalCols      = bobotChecklist.length + nonBobotChecklist.length + 4
                  return (
                    <Fragment key={name}>
                      <tr className={`border-t border-surface-border transition-colors ${isSkipped ? 'opacity-50' : 'hover:bg-surface/50'}`}>
                        <td className="px-3 py-2.5 text-ink-3 text-[11px]">{i + 1}</td>
                        <td className={`px-3 py-2.5 ${isSkipped ? 'text-ink-3' : 'font-bold text-ink'}`} style={{ maxWidth: '90px', wordBreak: 'break-word' }}>{name}</td>
                        {bobotChecklist.map(item => (
                          <td key={item.id} className="px-2 py-2.5 text-center">
                            {isSkipped ? <span className="text-ink-3">—</span> : <ScoreBubble val={scores[item.id]} />}
                          </td>
                        ))}
                        {nonBobotChecklist.map(item => (
                          <td key={item.id} className="px-2 py-2 text-center" style={{ background: '#f0fdf4' }}>
                            {!isSkipped && nonBobotAnswers[item.id]
                              ? <div className="text-[11px] font-bold text-emerald-700 leading-tight">{nonBobotAnswers[item.id]}</div>
                              : <span className="text-ink-3">—</span>
                            }
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
                      {/* Catatan — bobot + NB digabung */}
                      {!isSkipped && allCommentItems.length > 0 && (
                        <tr key={`${name}-remarks`} className="bg-warning/5 border-t border-warning/20">
                          <td />
                          <td colSpan={totalCols} className="px-3 py-2">
                            <div className="flex items-start gap-1.5 flex-wrap">
                              <span className="material-icons-round text-warning text-sm mt-0.5 flex-shrink-0">chat_bubble_outline</span>
                              <div className="flex flex-wrap gap-2">
                                {allCommentItems.map(item => (
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

        </div>{/* end table */}
        </div>{/* end hero+table wrapper */}

        {/* ── SIGN APPROVAL ──────────────────────────────────── */}
        <div className="bg-white border border-surface-border rounded-3xl shadow-card fade-up" style={{ animationDelay: '0.07s' }}>
          <div className={`p-6 grid gap-8 ${session.auditor2 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
            <div>
              <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-3">PIC Auditor 6S</div>
              <div className="text-4xl text-brand mb-1" style={{ fontFamily: "'Dancing Script', cursive" }}>
                {session.auditor1}
              </div>
              <div className="border-b border-ink-3/30 mb-2 w-48" />
              <div className="font-bold text-sm text-ink mb-0.5">{session.auditor1}</div>
              <div className="text-[11px] text-ink-3">PIC 6S {lokasiNama}</div>
            </div>
            {session.auditor2 && (
              <div>
                <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-3">PIC Auditor 6S</div>
                <div className="text-4xl text-brand mb-1" style={{ fontFamily: "'Dancing Script', cursive" }}>
                  {session.auditor2}
                </div>
                <div className="border-b border-ink-3/30 mb-2 w-48" />
                <div className="font-bold text-sm text-ink mb-0.5">{session.auditor2}</div>
                <div className="text-[11px] text-ink-3">PIC 6S {lokasiNama}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── SKIPPED WARNING ─────────────────────────────────── */}
        {skipped.length > 0 && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3 fade-up mb-5" style={{ animationDelay: '0.08s' }}>
            <span className="material-icons-round text-warning text-xl mt-0.5">warning_amber</span>
            <div>
              <div className="text-sm font-bold text-warning">{skipped.length} Auditee Dilewati</div>
              <div className="text-[11px] text-ink-3 mt-0.5">{skipped.map(r => r.auditee_name).join(', ')}</div>
            </div>
          </div>
        )}

        {/* ── SUBMIT ──────────────────────────────────────────── */}
        <div className="no-print card p-4 fade-up border-success/30 bg-success-light/30" style={{ animationDelay: '0.1s' }}>
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

        {/* ── KETERANGAN CHECKLIST ────────────────────────────── */}
        <ChecklistLegend />

      </main>
    </div>
  )
}
