'use client'
// app/audit/page.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ChecklistItem, ScoreConfig, ActiveSession, Member, CustomAnswer } from '@/types/database'
import { SKIP_REASONS, type SkipReason } from '@/types/database'

// ── Types lokal ────────────────────────────────────────────────
interface AuditeeResult {
  scores:          Record<string, number>   // { item_id: nilai } — bobot items only
  remarks:         Record<string, string>   // { item_id: catatan }
  nonBobotAnswers: Record<string, string>   // { item_id: chosen_label } — non_bobot items
  skipped:         boolean
  skip_reason:     string | null
  saved:           boolean
}

export default function AuditPage() {
  const router = useRouter()

  const [session, setSession]           = useState<ActiveSession | null>(null)
  const [checklist, setChecklist]       = useState<ChecklistItem[]>([])
  const [scoreConfig, setScoreConfig]   = useState<ScoreConfig[]>([])
  const [memberMap, setMemberMap]       = useState<Record<string, Member>>({})

  const [currentIdx, setCurrentIdx]     = useState(0)
  const [results, setResults]           = useState<Record<string, AuditeeResult>>({})
  const [saving, setSaving]             = useState(false)

  // Timer
  const [elapsed, setElapsed]           = useState(0)
  const timerRef                        = useRef<NodeJS.Timeout>()
  const elapsedRef                      = useRef(0)

  // Modals
  const [showSkip, setShowSkip]         = useState(false)
  const [skipReason, setSkipReason]     = useState<SkipReason>('Cuti')
  const [skipNote, setSkipNote]         = useState('')
  const [showList, setShowList]         = useState(false)

  // Toast
  const [toast, setToast]               = useState('')
  const toastRef                        = useRef<NodeJS.Timeout>()

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 3500)
  }

  // Load session & data
  useEffect(() => {
    const raw = sessionStorage.getItem('activeSession')
    if (!raw) { router.push('/'); return }
    const sess: ActiveSession = JSON.parse(raw)
    setSession(sess)
    const savedElapsed = sessionStorage.getItem('auditElapsedSec')
    setElapsed(savedElapsed ? parseInt(savedElapsed, 10) : Math.floor((Date.now() - sess.startTime) / 1000))

    Promise.all([
      supabase.from('checklist_items').select('*').eq('lokasi_id', sess.lokasiId).eq('aktif', true).order('nomor'),
      supabase.from('score_config').select('*').order('nilai'),
      supabase.from('members').select('*').eq('lokasi_id', sess.lokasiId).eq('aktif', true),
    ]).then(([{ data: cl }, { data: sc }, { data: mb }]) => {
      if (cl) setChecklist(cl)
      if (sc) setScoreConfig(sc)
      if (mb) {
        const map: Record<string, Member> = {}
        mb.forEach(m => { map[m.nama] = m })
        setMemberMap(map)
      }
    })

    supabase.from('audit_results').select('*').eq('session_id', sess.sessionId)
      .then(({ data }) => {
        if (!data) return
        const saved: Record<string, AuditeeResult> = {}
        data.forEach(r => {
          saved[r.auditee_name] = {
            scores:          (r.scores as Record<string, number>) ?? {},
            remarks:         (r.remarks as Record<string, string>) ?? {},
            nonBobotAnswers: (r.non_bobot_answers as Record<string, string>) ?? {},
            skipped:         r.skipped,
            skip_reason:     r.skip_reason,
            saved:           true,
          }
        })
        setResults(saved)
        if (sess.members.length > 0) {
          const firstUnsaved = sess.members.findIndex(m => !saved[m])
          setCurrentIdx(firstUnsaved >= 0 ? firstUnsaved : sess.members.length - 1)
        }
      })
  }, [router])

  // Sync elapsed ref (untuk save-on-unmount)
  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])

  // Timer — pause saat tab hidden / navigasi keluar, resume saat kembali
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

    function onVisibility() {
      if (document.hidden) {
        clearInterval(timerRef.current)
      } else {
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
      sessionStorage.setItem('auditElapsedSec', String(elapsedRef.current))
    }
  }, [])

  // Auto-set "Tidak pegang" untuk item camera/HT jika member tidak wajib pegang
  useEffect(() => {
    if (!session) return
    const auditeeName = session.members[currentIdx]
    if (!auditeeName) return
    const info = memberMap[auditeeName]
    if (!info) return
    const nbItems = checklist.filter(i => i.tipe === 'non_bobot')
    if (nbItems.length === 0) return

    setResults(prev => {
      const cur = prev[auditeeName] ?? { scores: {}, remarks: {}, nonBobotAnswers: {}, skipped: false, skip_reason: null, saved: false }
      const updates: Record<string, string> = {}

      nbItems.forEach(item => {
        if (cur.nonBobotAnswers[item.id]) return
        const lower = item.item.toLowerCase()
        const isCamera = lower.includes('camera') || lower.includes('kamera')
        const isHT = !isCamera && (lower.includes(' ht') || lower.includes('handy') || lower.startsWith('ht'))
        if (!isCamera && !isHT) return

        const notRequired = isCamera ? info.cam_required === false : info.ht_required === false
        if (!notRequired) return

        const jawaban = (item.jawaban_custom as CustomAnswer[] | null) ?? []
        const tidakPegang = jawaban.find(j => j.label.toLowerCase().includes('tidak pegang'))
        if (tidakPegang) updates[item.id] = tidakPegang.label
      })

      if (Object.keys(updates).length === 0) return prev
      return {
        ...prev,
        [auditeeName]: { ...cur, nonBobotAnswers: { ...cur.nonBobotAnswers, ...updates } },
      }
    })
  }, [currentIdx, session, memberMap, checklist])

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
    const bobotItems = checklist.filter(i => i.tipe !== 'non_bobot')
    const total   = bobotItems.reduce((s, item) => s + (data.scores[item.id] ?? 0) * item.bobot, 0)
    const maxPoss = bobotItems.reduce((s, item) => s + 4 * item.bobot, 0)

    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id:        session.sessionId,
        lokasi_id:         session.lokasiId,
        tanggal:           session.tanggal,
        auditee_name:      name,
        scores:            data.scores,
        remarks:           data.remarks,
        non_bobot_answers: data.nonBobotAnswers,
        total_score:       Math.round(total),
        max_score:         Math.round(maxPoss),
        skipped:           data.skipped,
        skip_reason:       data.skip_reason,
      }),
    })

    setResults(prev => ({ ...prev, [name]: { ...data, saved: true } }))
    setSaving(false)
  }, [session, checklist])

  if (!session) return null

  const members   = session.members
  const auditee   = members[currentIdx]
  const current   = results[auditee] ?? { scores: {}, remarks: {}, nonBobotAnswers: {}, skipped: false, skip_reason: null, saved: false }
  const doneCount = members.filter(m => results[m]?.saved).length

  // Equipment info untuk auditee aktif
  const auditeeInfo = memberMap[auditee]

  // ── Score hanya dari bobot items ──────────────────────────────
  function hitungScore() {
    const bobotItems = checklist.filter(i => i.tipe !== 'non_bobot')
    const total   = bobotItems.reduce((s, item) => s + (current.scores[item.id] ?? 0) * item.bobot, 0)
    const maxPoss = bobotItems.reduce((s, item) => s + 4 * item.bobot, 0)
    const persen  = maxPoss > 0 ? Math.round((total / maxPoss) * 100) : 0
    return { total: Math.round(total), max: Math.round(maxPoss), persen }
  }

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

  function setNonBobotAnswer(itemId: string, label: string) {
    setResults(prev => ({
      ...prev,
      [auditee]: { ...current, nonBobotAnswers: { ...current.nonBobotAnswers, [itemId]: label } },
    }))
  }

  // ── Validasi & lanjut ─────────────────────────────────────────
  async function handleNext() {
    if (!current.skipped) {
      const bobotItems   = checklist.filter(i => i.tipe !== 'non_bobot')
      const nonBobotItems = checklist.filter(i => i.tipe === 'non_bobot')

      // Cek bobot items
      const missingScore = bobotItems.filter(item => current.scores[item.id] === undefined)
      if (missingScore.length > 0) {
        showToast(`${missingScore.length} item belum dinilai: ${missingScore.map(i => i.item).join(', ')}`)
        return
      }

      // Cek bobot items — komentar wajib jika skor ≤ 2
      const missingRemark = bobotItems.filter(item => {
        const score = current.scores[item.id] ?? -1
        return score <= 2 && score >= 0 && !current.remarks[item.id]?.trim()
      })
      if (missingRemark.length > 0) {
        showToast(`Wajib isi catatan untuk skor rendah: ${missingRemark.map(i => i.item).join(', ')}`)
        return
      }

      // Cek non-bobot items
      for (const item of nonBobotItems) {
        const answer = current.nonBobotAnswers[item.id]
        if (!answer) {
          showToast(`Pilih jawaban untuk: ${item.item}`)
          return
        }
        const jawaban = (item.jawaban_custom as CustomAnswer[] | null) ?? []
        const answerConfig = jawaban.find(j => j.label === answer)
        if (answerConfig?.wajib_komentar && !current.remarks[item.id]?.trim()) {
          showToast(`Wajib isi komentar untuk "${answer}" pada: ${item.item}`)
          return
        }
      }
    }

    await saveResult(auditee, current)
    if (currentIdx < members.length - 1) {
      setCurrentIdx(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      sessionStorage.removeItem('auditElapsedSec')
      sessionStorage.setItem('auditTimer', formatTimer(elapsed))
      router.push('/review')
    }
  }

  async function handleSkip() {
    const skippedData: AuditeeResult = {
      scores: {}, remarks: {}, nonBobotAnswers: {}, skipped: true,
      skip_reason: skipNote ? `${skipReason} — ${skipNote}` : skipReason,
      saved: false,
    }
    setResults(prev => ({ ...prev, [auditee]: skippedData }))
    await saveResult(auditee, skippedData)
    setShowSkip(false); setSkipNote('')
    if (currentIdx < members.length - 1) {
      setCurrentIdx(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      sessionStorage.removeItem('auditElapsedSec')
      sessionStorage.setItem('auditTimer', formatTimer(elapsed))
      router.push('/review')
    }
  }

  const { persen } = hitungScore()
  const bulan = new Date(session.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const bobotItems    = checklist.filter(i => i.tipe !== 'non_bobot')
  const nonBobotItems = checklist.filter(i => i.tipe === 'non_bobot')

  // Deteksi apakah nama checklist item merujuk ke Camera atau HT
  function detectEquipment(itemName: string) {
    const lower = itemName.toLowerCase()
    if (lower.includes('camera') || lower.includes('kamera')) {
      return {
        type: 'camera' as const,
        sn:          auditeeInfo?.sn_camera ?? null,
        notRequired: auditeeInfo?.cam_required === false,
        hasSN:       !!auditeeInfo?.sn_camera,
      }
    }
    if (lower.includes(' ht') || lower.includes('handy') || lower.startsWith('ht')) {
      return {
        type: 'ht' as const,
        sn:          auditeeInfo?.sn_ht ?? null,
        notRequired: auditeeInfo?.ht_required === false,
        hasSN:       !!auditeeInfo?.sn_ht,
      }
    }
    return { type: null, sn: null, notRequired: false, hasSN: false }
  }

  return (
    <div className="min-h-screen pb-32">

      {/* ── TOAST ────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-xs w-full px-4 pointer-events-none">
          <div className="bg-danger text-white text-xs font-bold rounded-2xl px-4 py-3 shadow-card-hover flex items-start gap-2 animate-[fadeUp_0.25s_ease]">
            <span className="material-icons-round text-sm flex-shrink-0 mt-0.5">warning_amber</span>
            <span>{toast}</span>
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-1 bg-brand-pale text-brand px-2.5 py-1 rounded-xl">
              <span className="material-icons-round text-sm">timer</span>
              <span className="text-xs font-bold font-mono">{formatTimer(elapsed)}</span>
            </div>
            <button onClick={() => setShowList(true)}
              className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
              <span className="material-icons-round text-lg">format_list_bulleted</span>
            </button>
            <button onClick={() => setShowSkip(true)}
              className="w-9 h-9 rounded-xl border border-danger/30 flex items-center justify-center text-danger hover:bg-danger-light transition-all">
              <span className="material-icons-round text-lg">skip_next</span>
            </button>
          </div>

          {/* Row 2: equipment info */}
          {(auditeeInfo?.sn_camera || auditeeInfo?.sn_ht) && (
            <div className="flex items-center gap-3 pb-1.5 flex-wrap">
              {auditeeInfo.sn_camera && (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                  <span className="material-icons-round text-xs">photo_camera</span>
                  <span>{auditeeInfo.sn_camera}</span>
                </div>
              )}
              {auditeeInfo.sn_ht && (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <span className="material-icons-round text-xs">settings_remote</span>
                  <span>{auditeeInfo.sn_ht}</span>
                </div>
              )}
            </div>
          )}

          {/* Row 3: progress */}
          <div className="pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-ink-2">Auditee {currentIdx + 1} dari {members.length}</span>
              <span className="text-[11px] text-ink-3">{doneCount}/{members.length} selesai</span>
            </div>
            <div className="h-1.5 bg-surface-border rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-brand rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / members.length) * 100}%` }} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {members.map((m, i) => {
                const r = results[m]
                const isDone    = r?.saved
                const isSkipped = r?.skipped
                const isActive  = i === currentIdx
                return (
                  <button key={m} onClick={() => setCurrentIdx(i)} title={m}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      isActive  ? 'w-5 bg-brand' :
                      isSkipped ? 'w-2 bg-warning' :
                      isDone    ? 'w-2 bg-success' : 'w-2 bg-surface-border'
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
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-pale text-brand">{session.lokasiNama}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface text-ink-3">{bobotItems.length} item bobot</span>
                {nonBobotItems.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">{nonBobotItems.length} item lainnya</span>
                )}
                {current.saved && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-success-light text-success">✓ Tersimpan</span>}
              </div>
              {/* Camera & HT serial */}
              {(auditeeInfo?.sn_camera || auditeeInfo?.sn_ht) && (
                <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-surface-border">
                  {auditeeInfo.sn_camera && (
                    <div className="flex items-center gap-2">
                      <span className="material-icons-round text-base" style={{ color: '#7C6EF5' }}>photo_camera</span>
                      <span className="text-sm font-bold text-ink">{auditeeInfo.sn_camera}</span>
                    </div>
                  )}
                  {auditeeInfo?.ht_required !== false && auditeeInfo?.sn_ht && (
                    <div className="flex items-center gap-2">
                      <span className="material-icons-round text-base" style={{ color: '#10B981' }}>settings_remote</span>
                      <span className="text-sm font-bold text-ink">{auditeeInfo.sn_ht}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
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

        {/* ── BOBOT CHECKLIST ITEMS ─────────────────────────── */}
        {bobotItems.map((item, i) => {
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

        {/* ── NON-BOBOT CHECKLIST ITEMS ─────────────────────── */}
        {nonBobotItems.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-px bg-emerald-200" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Item Non-Bobot</span>
            <div className="flex-1 h-px bg-emerald-200" />
          </div>
        )}

        {nonBobotItems.map((item, i) => {
          const jawaban      = (item.jawaban_custom as CustomAnswer[] | null) ?? []
          const chosen       = current.nonBobotAnswers[item.id] ?? ''
          const chosenConfig = jawaban.find(j => j.label === chosen)
          const remark       = current.remarks[item.id] ?? ''
          const equip        = detectEquipment(item.item)

          return (
            <div key={item.id} className="card fade-up border-emerald-100" style={{ animationDelay: `${0.05 + (bobotItems.length + i) * 0.03}s` }}>
              <div className="card-head flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-extrabold text-emerald-600">{item.nomor}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-ink">{item.item}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">Non-Bobot</span>
                  </div>
                  {item.deskripsi && <div className="text-[11px] text-ink-3 mt-0.5">{item.deskripsi}</div>}
                  {/* Serial number equipment jika terdeteksi */}
                  {equip.type === 'camera' && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="material-icons-round text-lg" style={{ color: equip.notRequired ? '#9CA3AF' : '#7C6EF5' }}>photo_camera</span>
                      <span className={`text-sm font-bold ${equip.notRequired ? 'text-ink-3 italic' : equip.sn ? 'text-purple-700' : 'text-ink-3 italic'}`}>
                        {equip.notRequired ? 'Tidak wajib pegang' : (equip.sn ?? 'Serial belum diisi')}
                      </span>
                    </div>
                  )}
                  {equip.type === 'ht' && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="material-icons-round text-lg" style={{ color: equip.notRequired ? '#9CA3AF' : '#10B981' }}>settings_remote</span>
                      <span className={`text-sm font-bold ${equip.notRequired ? 'text-ink-3 italic' : equip.sn ? 'text-emerald-700' : 'text-ink-3 italic'}`}>
                        {equip.notRequired ? 'Tidak wajib pegang' : (equip.sn ?? 'Serial belum diisi')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {/* Custom answer buttons */}
                <div className="flex flex-wrap gap-2">
                  {jawaban.map(j => {
                    const isTidakPegang = j.label.toLowerCase().includes('tidak pegang')
                    // Disable jika item equipment: notRequired → semua disable; hasSN → "Tidak pegang" disable
                    const btnDisabled = equip.type !== null && (
                      equip.notRequired ? true : (equip.hasSN && isTidakPegang)
                    )
                    return (
                      <button
                        key={j.label}
                        onClick={() => setNonBobotAnswer(item.id, j.label)}
                        disabled={btnDisabled}
                        className="px-3 py-2 rounded-2xl text-xs font-bold border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          borderColor: chosen === j.label ? '#10B981' : 'transparent',
                          background:  chosen === j.label ? '#10B98115' : '#F4F3FF',
                          color:       chosen === j.label ? '#10B981' : '#9CA3AF',
                        }}>
                        {j.label}
                        {j.wajib_komentar && <span className="ml-1 text-[9px]">💬*</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Komentar */}
                {chosen && chosenConfig?.wajib_komentar ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="material-icons-round text-warning text-sm">warning_amber</span>
                      <span className="text-[11px] font-bold text-warning">Wajib isi komentar untuk "{chosen}"</span>
                    </div>
                    <textarea
                      rows={2}
                      value={remark}
                      onChange={e => setRemark(item.id, e.target.value)}
                      placeholder="Jelaskan kondisi / detail temuan..."
                      className="inp text-xs py-2.5 resize-none border-warning/60 focus:border-warning focus:ring-warning/20"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={remark}
                    onChange={e => setRemark(item.id, e.target.value)}
                    placeholder="Komentar (opsional)..."
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
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-hover p-5 flex flex-col gap-3 animate-[fadeUp_0.2s_ease]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-ink">Semua Auditee</div>
              <button onClick={() => setShowList(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-surface transition-all">
                <span className="material-icons-round text-lg">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
              {members.map((m, i) => {
                const r = results[m]
                const isDone    = r?.saved
                const isSkipped = r?.skipped
                const isActive  = i === currentIdx
                return (
                  <button key={m} onClick={() => { setCurrentIdx(i); setShowList(false) }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                      isActive ? 'border-brand bg-brand-pale' : 'border-surface-border hover:border-brand/30'
                    }`}>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      isActive ? 'bg-brand text-white' :
                      isSkipped ? 'bg-warning text-white' :
                      isDone ? 'bg-success text-white' : 'bg-surface text-ink-3'
                    }`}>{i + 1}</span>
                    <span className="flex-1 text-xs font-semibold text-ink truncate">{m}</span>
                    {isSkipped && <span className="text-[10px] text-warning font-bold">Skip</span>}
                    {isDone && !isSkipped && <span className="material-icons-round text-success text-sm">check_circle</span>}
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
