'use client'
// app/audit/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ChecklistItem, ScoreConfig, ActiveSession } from '@/types/database'
import { SKIP_REASONS, type SkipReason } from '@/types/database'

// ── Types lokal ────────────────────────────────────────────────
interface AuditeeResult {
  scores:      Record<string, number>   // { item_id: nilai }
  remarks:     Record<string, string>   // { item_id: catatan }
  skipped:     boolean
  skip_reason: string | null
  saved:       boolean
}

export default function AuditPage() {
  const router = useRouter()

  // Session dari sessionStorage
  const [session, setSession]           = useState<ActiveSession | null>(null)
  const [checklist, setChecklist]       = useState<ChecklistItem[]>([])
  const [scoreConfig, setScoreConfig]   = useState<ScoreConfig[]>([])

  // State audit
  const [currentIdx, setCurrentIdx]     = useState(0)
  const [results, setResults]           = useState<Record<string, AuditeeResult>>({})
  const [saving, setSaving]             = useState(false)

  // Timer
  const [elapsed, setElapsed]           = useState(0)
  const timerRef                        = useRef<NodeJS.Timeout>()

  // Modal skip
  const [showSkip, setShowSkip]         = useState(false)
  const [skipReason, setSkipReason]     = useState<SkipReason>('Cuti')
  const [skipNote, setSkipNote]         = useState('')

  // Modal list auditee
  const [showList, setShowList]         = useState(false)

  // Load session & data
  useEffect(() => {
    const raw = sessionStorage.getItem('activeSession')
    if (!raw) { router.push('/'); return }
    const sess: ActiveSession = JSON.parse(raw)
    setSession(sess)

    // Hitung elapsed dari startTime
    setElapsed(Math.floor((Date.now() - sess.startTime) / 1000))

    // Load checklist & score config
    Promise.all([
      supabase.from('checklist_items').select('*').eq('lokasi_id', sess.lokasiId).eq('aktif', true).order('nomor'),
      supabase.from('score_config').select('*').order('nilai'),
    ]).then(([{ data: cl }, { data: sc }]) => {
      if (cl) setChecklist(cl)
      if (sc) setScoreConfig(sc)
    })

    // Load hasil yang sudah tersimpan (resume)
    supabase.from('audit_results').select('*').eq('session_id', sess.sessionId)
      .then(({ data }) => {
        if (!data) return
        const saved: Record<string, AuditeeResult> = {}
        data.forEach(r => {
          saved[r.auditee_name] = {
            scores:      (r.scores as Record<string, number>) ?? {},
            remarks:     (r.remarks as Record<string, string>) ?? {},
            skipped:     r.skipped,
            skip_reason: r.skip_reason,
            saved:       true,
          }
        })
        setResults(saved)

        // Lanjut ke auditee yang belum diisi
        if (sess.members.length > 0) {
          const firstUnsaved = sess.members.findIndex(m => !saved[m])
          setCurrentIdx(firstUnsaved >= 0 ? firstUnsaved : sess.members.length - 1)
        }
      })
  }, [router])

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
      : `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  // ── Save ke Supabase ──────────────────────────────────────────
  const saveResult = useCallback(async (name: string, data: AuditeeResult) => {
    if (!session) return
    setSaving(true)
    const cl = checklist
    const total   = cl.reduce((s, item) => s + (data.scores[item.id] ?? 0) * item.bobot, 0)
    const maxPoss = cl.reduce((s, item) => s + 4 * item.bobot, 0)
    const persen  = maxPoss > 0 ? Math.round((total / maxPoss) * 100) : 0
    const kategori = data.skipped ? null
      : persen >= 85 ? 'EX' : persen >= 60 ? 'SD' : 'NI'

    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id:   session.sessionId,
        lokasi_id:    session.lokasiId,
        tanggal:      session.tanggal,
        auditee_name: name,
        scores:       data.scores,
        remarks:      data.remarks,
        total_score:  Math.round(total),
        max_score:    Math.round(maxPoss),
        skipped:      data.skipped,
        skip_reason:  data.skip_reason,
      }),
    })

    setResults(prev => ({ ...prev, [name]: { ...data, saved: true } }))
    setSaving(false)
  }, [session, checklist])

  if (!session) return null

  const members    = session.members
  const auditee    = members[currentIdx]
  const current    = results[auditee] ?? { scores: {}, remarks: {}, skipped: false, skip_reason: null, saved: false }
  const doneCount  = members.filter(m => results[m]?.saved).length

  // ── Hitung score current auditee ──────────────────────────────
  function hitungScore() {
    const total   = checklist.reduce((s, item) => s + (current.scores[item.id] ?? 0) * item.bobot, 0)
    const maxPoss = checklist.reduce((s, item) => s + 4 * item.bobot, 0)
    const persen  = maxPoss > 0 ? Math.round((total / maxPoss) * 100) : 0
    return { total: Math.round(total), max: Math.round(maxPoss), persen }
  }

  // ── Update score satu item ────────────────────────────────────
  function setScore(itemId: string, nilai: number) {
    setResults(prev => ({
      ...prev,
      [auditee]: { ...current, scores: { ...current.scores, [itemId]: nilai } },
    }))
  }

  function setRemark(itemId: string, text: string) {
    setResults(prev => ({
      ...prev,
      [auditee]: { ...current, remarks: { ...current.remarks, [itemId]: text } },
    }))
  }

  // ── Simpan & lanjut ke berikutnya ────────────────────────────
  async function handleNext() {
    await saveResult(auditee, current)
    if (currentIdx < members.length - 1) {
      setCurrentIdx(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Semua selesai → ke review
      sessionStorage.setItem('auditTimer', formatTimer(elapsed))
      router.push('/review')
    }
  }

  // ── Skip ─────────────────────────────────────────────────────
  async function handleSkip() {
    const skippedData: AuditeeResult = {
      scores: {}, remarks: {}, skipped: true,
      skip_reason: skipNote ? `${skipReason} — ${skipNote}` : skipReason,
      saved: false,
    }
    setResults(prev => ({ ...prev, [auditee]: skippedData }))
    await saveResult(auditee, skippedData)
    setShowSkip(false)
    setSkipNote('')
    if (currentIdx < members.length - 1) {
      setCurrentIdx(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      sessionStorage.setItem('auditTimer', formatTimer(elapsed))
      router.push('/review')
    }
  }

  const { persen } = hitungScore()
  const bulan = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen pb-32">

      {/* ── FIXED HEADER ─────────────────────────────────────── */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-50 shadow-card">
        <div className="max-w-lg mx-auto px-4">

          {/* Row 1: info + timer + actions */}
          <div className="flex items-center h-14 gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-extrabold text-ink truncate">
                {auditee} · {bulan} · <span className="text-brand">{session.lokasiNama}</span>
              </div>
              <div className="text-[11px] text-ink-3">
                PIC: {session.auditor1}{session.auditor2 ? ' & ' + session.auditor2 : ''}
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-1 bg-brand-pale text-brand px-2.5 py-1 rounded-xl">
              <span className="material-icons-round text-sm">timer</span>
              <span className="text-xs font-bold font-mono">{formatTimer(elapsed)}</span>
            </div>

            {/* List button */}
            <button onClick={() => setShowList(true)}
              className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
              <span className="material-icons-round text-lg">format_list_bulleted</span>
            </button>

            {/* Skip button */}
            <button onClick={() => setShowSkip(true)}
              className="w-9 h-9 rounded-xl border border-danger/30 flex items-center justify-center text-danger hover:bg-danger-light transition-all">
              <span className="material-icons-round text-lg">skip_next</span>
            </button>
          </div>

          {/* Row 2: progress */}
          <div className="pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-ink-2">Auditee {currentIdx + 1} dari {members.length}</span>
              <span className="text-[11px] text-ink-3">{doneCount}/{members.length} selesai</span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-surface-border rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-brand rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / members.length) * 100}%` }} />
            </div>

            {/* Dot indicator */}
            <div className="flex gap-1 flex-wrap">
              {members.map((m, i) => {
                const r = results[m]
                const isDone    = r?.saved
                const isSkipped = r?.skipped
                const isActive  = i === currentIdx
                return (
                  <button key={m} onClick={() => setCurrentIdx(i)}
                    title={m}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      isActive  ? 'w-5 bg-brand' :
                      isSkipped ? 'w-2 bg-warning' :
                      isDone    ? 'w-2 bg-success' :
                                  'w-2 bg-surface-border'
                    }`} />
                )
              })}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-4">

        {/* Card: sedang diaudit */}
        <div className="card fade-up">
          <div className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-brand flex items-center justify-center flex-shrink-0">
              <span className="material-icons-round text-white">person</span>
            </div>
            <div className="flex-1">
              <div className="text-[11px] text-ink-3 font-medium">Sedang diaudit</div>
              <div className="text-base font-extrabold text-ink">{auditee}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-pale text-brand">{session.lokasiNama}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface text-ink-3">{checklist.length} item</span>
                {current.saved && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-success-light text-success">✓ Tersimpan</span>}
              </div>
            </div>
            {/* Score preview */}
            <div className="text-right">
              <div className="text-xl font-extrabold text-brand">{persen}<span className="text-sm font-bold">%</span></div>
              <div className="text-[10px] text-ink-3">score</div>
            </div>
          </div>
        </div>

        {/* Referensi skor */}
        <div className="card p-3 fade-up" style={{ animationDelay: '0.05s' }}>
          <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-2">Referensi Skor</div>
          <div className="flex gap-1.5 flex-wrap">
            {scoreConfig.map(sc => (
              <span key={sc.nilai}
                className="text-[11px] font-semibold px-2 py-1 rounded-xl"
                style={{ background: sc.warna + '20', color: sc.warna ?? '#6b7280' }}>
                {sc.nilai} · {sc.label}
              </span>
            ))}
          </div>
        </div>

        {/* Checklist items */}
        {checklist.map((item, i) => {
          const scored = current.scores[item.id] ?? -1
          const remark = current.remarks[item.id] ?? ''
          return (
            <div key={item.id} className="card fade-up" style={{ animationDelay: `${0.05 + i * 0.03}s` }}>
              <div className="card-head flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-pale flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-extrabold text-brand">{item.nomor}</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-ink">{item.item}</div>
                  {item.deskripsi && <div className="text-[11px] text-ink-3 mt-0.5">{item.deskripsi}</div>}
                </div>
                {scored >= 0 && (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                    style={{
                      background: (scoreConfig.find(s => s.nilai === scored)?.warna ?? '#6b7280') + '20',
                      color: scoreConfig.find(s => s.nilai === scored)?.warna ?? '#6b7280',
                    }}>
                    {scored}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col gap-3">
                {/* Score buttons 0–4 */}
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4].map(n => {
                    const sc = scoreConfig.find(s => s.nilai === n)
                    const isActive = scored === n
                    return (
                      <button key={n} onClick={() => setScore(item.id, n)}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-2xl border-2 transition-all font-bold text-sm"
                        style={{
                          borderColor: isActive ? (sc?.warna ?? '#6b7280') : 'transparent',
                          background:  isActive ? (sc?.warna ?? '#6b7280') + '15' : 'var(--tw-bg-opacity, #F4F3FF)',
                          color:       isActive ? (sc?.warna ?? '#6b7280') : '#9CA3AF',
                        }}
                        title={sc?.label}>
                        <span className="text-base font-extrabold">{n}</span>
                        <span className="text-[9px] font-semibold leading-tight text-center px-1 hidden sm:block">{sc?.label?.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Remark input — wajib jika skor ≤ 2 */}
                {(scored <= 2 && scored >= 0) ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="material-icons-round text-warning text-sm">warning_amber</span>
                      <span className="text-[11px] font-bold text-warning">Wajib isi catatan untuk skor rendah</span>
                    </div>
                    <textarea
                      rows={2}
                      value={remark}
                      onChange={e => setRemark(item.id, e.target.value)}
                      placeholder="Jelaskan temuan / kondisi yang ditemukan..."
                      className="inp text-xs py-2.5 resize-none border-warning/60 focus:border-warning focus:ring-warning/20"
                      autoFocus={scored >= 0 && !remark}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={remark}
                    onChange={e => setRemark(item.id, e.target.value)}
                    placeholder="Catatan / temuan (opsional)..."
                    className="inp text-xs py-2.5"
                  />
                )}
              </div>
            </div>
          )
        })}

        {/* Tombol simpan & lanjut */}
        <button onClick={handleNext} disabled={saving}
          className="btn-primary flex items-center justify-center gap-2 w-full py-4 text-sm disabled:opacity-60 fade-up">
          {saving
            ? <><span className="material-icons-round text-base animate-spin">sync</span> Menyimpan...</>
            : currentIdx < members.length - 1
              ? <><span className="material-icons-round text-base">arrow_forward</span> Simpan & Auditee Berikutnya</>
              : <><span className="material-icons-round text-base">done_all</span> Selesai — Lihat Review</>
          }
        </button>

      </main>

      {/* ── MODAL SKIP ───────────────────────────────────────── */}
      {showSkip && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(22,22,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-hover p-5 flex flex-col gap-4 animate-[fadeUp_0.2s_ease]">
            <div className="flex items-center gap-3">
              <div className="ico-wrap bg-danger-light text-danger"><span className="material-icons-round">person_off</span></div>
              <div>
                <div className="text-sm font-extrabold text-ink">Skip auditee</div>
                <div className="text-[11px] text-ink-3">{auditee}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-ink-2 mb-2">Alasan skip</div>
              <div className="grid grid-cols-2 gap-2">
                {SKIP_REASONS.map(r => (
                  <button key={r} onClick={() => setSkipReason(r)}
                    className={`py-2.5 rounded-2xl text-xs font-bold border-2 transition-all ${
                      skipReason === r
                        ? 'border-danger bg-danger-light text-danger'
                        : 'border-surface-border text-ink-2 hover:border-danger/40'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-ink-2 mb-1.5">Keterangan tambahan (opsional)</div>
              <input type="text" value={skipNote} onChange={e => setSkipNote(e.target.value)}
                placeholder="cth: cuti tahunan s/d 15 Juli..."
                className="inp text-xs" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setShowSkip(false); setSkipNote('') }}
                className="btn-secondary flex-1 text-sm py-3">Batal</button>
              <button onClick={handleSkip}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white border-none cursor-pointer bg-danger flex items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5">
                <span className="material-icons-round text-base">skip_next</span> Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL LIST AUDITEE ───────────────────────────────── */}
      {showList && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(22,22,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-hover flex flex-col max-h-[70vh] animate-[fadeUp_0.2s_ease]">
            <div className="p-4 border-b border-surface-border flex items-center justify-between">
              <div className="text-sm font-extrabold text-ink">List Auditee</div>
              <button onClick={() => setShowList(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-surface transition-all">
                <span className="material-icons-round text-lg">close</span>
              </button>
            </div>
            <div className="overflow-y-auto p-3 flex flex-col gap-1.5">
              {members.map((m, i) => {
                const r = results[m]
                const isDone    = r?.saved && !r.skipped
                const isSkipped = r?.skipped
                const isActive  = i === currentIdx
                return (
                  <button key={m} onClick={() => { setCurrentIdx(i); setShowList(false) }}
                    className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                      isActive ? 'bg-brand-pale border-2 border-brand' : 'border border-surface-border hover:border-brand/40'
                    }`}>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                      isActive  ? 'bg-brand text-white' :
                      isSkipped ? 'bg-warning/20 text-warning' :
                      isDone    ? 'bg-success-light text-success' :
                                  'bg-surface text-ink-3'
                    }`}>
                      {isSkipped ? '–' : isDone ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs font-bold ${isActive ? 'text-brand' : 'text-ink'}`}>{m}</span>
                    {isSkipped && <span className="ml-auto text-[10px] text-warning font-semibold">Skip</span>}
                    {isDone    && <span className="ml-auto text-[10px] text-success font-semibold">{results[m] ? Math.round(Object.values(results[m].scores).reduce((a, b) => a + b, 0)) : 0}pt</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
