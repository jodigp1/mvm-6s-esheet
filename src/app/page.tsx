'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Lokasi, Member, AuditSession } from '@/types/database'
import Link from 'next/link'

// ── Lokasi accent config ────────────────────────────────────────
type LokasiAccent = { icon: string; color: string; bg: string; ring: string; selectedBg: string }
const LOKASI_ACCENT: Record<string, LokasiAccent> = {
  otc:   { icon: 'business',  color: '#3B82F6', bg: '#EFF6FF', ring: '#3B82F6', selectedBg: '#DBEAFE' },
  cabin: { icon: 'warehouse', color: '#10B981', bg: '#ECFDF5', ring: '#10B981', selectedBg: '#D1FAE5' },
}
const DEFAULT_ACCENT: LokasiAccent = { icon: 'location_on', color: '#7C6EF5', bg: '#F0EEFF', ring: '#7C6EF5', selectedBg: '#E9E6FF' }

function getAccent(nama: string): LokasiAccent {
  const key = nama.toLowerCase()
  for (const [k, v] of Object.entries(LOKASI_ACCENT)) {
    if (key.includes(k)) return v
  }
  return DEFAULT_ACCENT
}

const HARI = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg']
const BULAN_PANJANG = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

// ── Custom Date Picker ──────────────────────────────────────────
function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const ref = useRef<HTMLDivElement>(null)

  const selected = value ? new Date(value + 'T00:00:00') : null
  const today = new Date(); today.setHours(0,0,0,0)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pickDay(day: number) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    onChange(iso)
    setOpen(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow    = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7 // Mon=0

  const displayDate = selected
    ? selected.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Pilih tanggal...'

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inp w-full text-left flex items-center gap-3 cursor-pointer">
        <span className="material-icons-round text-brand text-xl flex-shrink-0">event</span>
        <span className={`flex-1 text-sm ${selected ? 'font-semibold text-ink' : 'text-ink-3'}`}>{displayDate}</span>
        <span className="material-icons-round text-ink-3 text-lg transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-card-hover border border-surface-border z-50 overflow-hidden">
          {/* Quick picks */}
          <div className="p-3 flex gap-2 border-b border-surface-border">
            {[
              { label: 'Hari ini', delta: 0 },
              { label: 'Kemarin', delta: -1 },
            ].map(({ label, delta }) => {
              const d = new Date(); d.setDate(d.getDate() + delta)
              const iso = d.toISOString().split('T')[0]
              const isActive = value === iso
              return (
                <button key={label} onClick={() => { onChange(iso); setOpen(false) }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive ? 'bg-brand text-white' : 'bg-surface text-ink-2 hover:bg-brand-pale hover:text-brand'
                  }`}>
                  {label}
                </button>
              )
            })}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:text-brand transition-all">
              <span className="material-icons-round text-lg">chevron_left</span>
            </button>
            <span className="text-sm font-extrabold text-ink">{BULAN_PANJANG[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:text-brand transition-all">
              <span className="material-icons-round text-lg">chevron_right</span>
            </button>
          </div>

          {/* Grid */}
          <div className="px-3 pb-4">
            <div className="grid grid-cols-7 mb-1">
              {HARI.map(h => (
                <div key={h} className="text-center text-[10px] font-bold text-ink-3 py-1">{h}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const t = new Date(viewYear, viewMonth, day); t.setHours(0,0,0,0)
                const isToday    = t.getTime() === today.getTime()
                const isSelected = selected && t.getTime() === selected.getTime()
                return (
                  <button key={day} type="button" onClick={() => pickDay(day)}
                    className={`h-8 w-full rounded-xl text-xs font-semibold transition-all ${
                      isSelected ? 'bg-brand text-white font-extrabold shadow-sm' :
                      isToday    ? 'bg-brand-pale text-brand font-bold ring-1 ring-brand/30' :
                                   'text-ink hover:bg-surface'
                    }`}>
                    {day}
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

// ── Searchable Dropdown ─────────────────────────────────────────
function SearchableSelect({
  options, value, onChange, placeholder, disabled, exclude,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  exclude?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter(o => o !== exclude && o.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(opt: string) {
    onChange(opt); setOpen(false); setQuery('')
  }

  function toggle() {
    if (disabled) return
    setOpen(v => !v)
    if (!open) setTimeout(() => inputRef.current?.focus(), 60)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle}
        className={`inp w-full text-left flex items-center gap-3 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className="material-icons-round text-brand text-xl flex-shrink-0">person</span>
        <span className={`flex-1 text-sm truncate ${value ? 'font-semibold text-ink' : 'text-ink-3'}`}>
          {value || placeholder}
        </span>
        {value && (
          <button type="button" onClick={e => { e.stopPropagation(); onChange('') }}
            className="text-ink-3 hover:text-danger transition-colors flex-shrink-0">
            <span className="material-icons-round text-base">close</span>
          </button>
        )}
        {!value && (
          <span className="material-icons-round text-ink-3 text-lg transition-transform flex-shrink-0"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-card-hover border border-surface-border z-50 overflow-hidden">
          <div className="p-2.5 border-b border-surface-border">
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-lg">search</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cari nama..."
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-surface rounded-xl border border-transparent focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1.5">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-3">Tidak ada hasil untuk "{query}"</div>
            ) : (
              filtered.map(opt => (
                <button key={opt} type="button" onClick={() => select(opt)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2.5 ${
                    value === opt
                      ? 'bg-brand-pale text-brand font-bold'
                      : 'text-ink hover:bg-surface'
                  }`}>
                  <span className="material-icons-round text-base opacity-50">person</span>
                  {opt}
                  {value === opt && <span className="material-icons-round text-sm ml-auto">check</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────
export default function SetupSesiPage() {
  const router = useRouter()

  const [lokasiList, setLokasiList] = useState<Lokasi[]>([])
  const [memberList, setMemberList] = useState<Member[]>([])
  const [draftSesi,  setDraftSesi]  = useState<(AuditSession & { lokasi: { nama: string }; audit_results: { auditee_name: string }[] })[]>([])

  const [lokasiId, setLokasiId] = useState('')
  const [tanggal,  setTanggal]  = useState(new Date().toISOString().split('T')[0])
  const [auditor1, setAuditor1] = useState('')
  const [auditor2, setAuditor2] = useState('')
  const [loading,  setLoading]  = useState(false)

  const lokasiSelected = lokasiList.find(l => l.id === lokasiId)
  const butuhDuaPic    = (lokasiSelected?.jumlah_pic ?? 0) >= 2

  useEffect(() => {
    supabase.from('lokasi').select('*').eq('aktif', true).order('nama')
      .then(({ data }) => { if (data) setLokasiList(data) })
    fetch('/api/sessions')
      .then(r => r.json())
      .then(json => { if (json.ok) setDraftSesi(json.data) })
  }, [])

  useEffect(() => {
    if (!lokasiId) { setMemberList([]); return }
    supabase.from('members').select('*')
      .eq('lokasi_id', lokasiId).eq('aktif', true).order('urutan')
      .then(({ data }) => { if (data) setMemberList(data) })
    setAuditor1(''); setAuditor2('')
  }, [lokasiId])

  async function handleStart() {
    if (!lokasiId || !tanggal || !auditor1) return
    if (butuhDuaPic && !auditor2) return
    setLoading(true)
    const res  = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lokasi_id: lokasiId, tanggal, auditor1, auditor2: butuhDuaPic ? auditor2 : null }),
    })
    const json = await res.json()
    if (!json.ok) { alert('Gagal membuat sesi: ' + json.error); setLoading(false); return }
    sessionStorage.setItem('activeSession', JSON.stringify({
      sessionId:  json.data.id,
      lokasiId,
      lokasiNama: lokasiSelected?.nama,
      tanggal,
      auditor1,
      auditor2: butuhDuaPic ? auditor2 : undefined,
      members:  memberList.map(m => m.nama),
      startTime: Date.now(),
    }))
    router.push('/audit')
  }

  function handleResume(sesi: AuditSession & { lokasi: { nama: string }; audit_results: { auditee_name: string }[] }) {
    supabase.from('members').select('*')
      .eq('lokasi_id', sesi.lokasi_id).eq('aktif', true).order('urutan')
      .then(({ data }) => {
        sessionStorage.setItem('activeSession', JSON.stringify({
          sessionId:  sesi.id,
          lokasiId:   sesi.lokasi_id,
          lokasiNama: sesi.lokasi.nama,
          tanggal:    sesi.tanggal,
          auditor1:   sesi.auditor1,
          auditor2:   sesi.auditor2,
          members:    (data ?? []).map(m => m.nama),
          startTime:  Date.now(),
        }))
        router.push('/audit')
      })
  }

  const auditorOptions = memberList.map(m => m.nama)
  const canStart = lokasiId && tanggal && auditor1 && (!butuhDuaPic || auditor2)

  // Step completion state for visual progress
  const step1Done = !!lokasiId
  const step2Done = !!tanggal
  const step3Done = !!auditor1 && (!butuhDuaPic || !!auditor2)

  return (
    <div className="min-h-screen pb-24">

      {/* Header */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-50 shadow-card">
        <div className="max-w-lg mx-auto px-5 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center">
              <span className="material-icons-round text-white text-base">verified</span>
            </div>
            <div>
              <div className="text-[15px] font-extrabold text-ink tracking-tight">6S Audit MVM</div>
              <div className="text-[11px] text-ink-3">Setup Sesi Audit</div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            {[
              { href: '/dashboard', icon: 'bar_chart',  label: 'Dashboard' },
              { href: '/history',   icon: 'history',    label: 'Riwayat' },
              { href: '/settings',  icon: 'settings',   label: 'Settings' },
            ].map(({ href, icon, label }) => (
              <Link key={href} href={href}
                className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all"
                title={label}>
                <span className="material-icons-round text-lg">{icon}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">

        {/* ── RESUME DRAFT ────────────────────────────────────── */}
        {draftSesi.length > 0 && (
          <div className="card border-warning/40 bg-warning/5 fade-up">
            <div className="card-head flex items-center gap-3">
              <div className="ico-wrap bg-warning/10 text-warning"><span className="material-icons-round">pending_actions</span></div>
              <div>
                <div className="text-sm font-bold text-ink">Sesi audit belum selesai</div>
                <div className="text-[11px] text-ink-3">Lanjutkan atau buat sesi baru</div>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {draftSesi.slice(0, 3).map((sesi: any) => (
                <div key={sesi.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-surface-border">
                  <div>
                    <div className="text-xs font-bold text-ink">{sesi.lokasi?.nama} — {new Date(sesi.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="text-[11px] text-ink-3">PIC: {sesi.auditor1}{sesi.auditor2 ? ' & ' + sesi.auditor2 : ''} · {sesi.audit_results?.length ?? 0} sudah diisi</div>
                  </div>
                  <button onClick={() => handleResume(sesi)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1 flex-shrink-0">
                    <span className="material-icons-round text-sm">play_arrow</span> Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONTAINER 1: PILIH LOKASI ────────────────────── */}
        <div className={`card fade-up transition-all ${step1Done ? 'ring-2 ring-brand/20' : ''}`} style={{ animationDelay: '0.04s' }}>
          <div className="card-head flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-all ${
              step1Done ? 'bg-brand text-white' : 'bg-surface-border text-ink-3'
            }`}>1</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">Pilih Lokasi</div>
              <div className="text-[11px] text-ink-3">Tentukan lokasi audit hari ini</div>
            </div>
            {step1Done && <span className="material-icons-round text-brand text-xl">check_circle</span>}
          </div>
          <div className="p-4">
            {lokasiList.length === 0 ? (
              <div className="text-center py-4 text-xs text-ink-3">Memuat lokasi...</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {lokasiList.map(lokasi => {
                  const acc    = getAccent(lokasi.nama)
                  const active = lokasiId === lokasi.id
                  return (
                    <button key={lokasi.id} type="button"
                      onClick={() => setLokasiId(active ? '' : lokasi.id)}
                      className="relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all text-center"
                      style={{
                        borderColor:    active ? acc.color : 'var(--tw-border-opacity, #E8E6FF)',
                        background:     active ? acc.selectedBg : '#FAFAFE',
                        boxShadow:      active ? `0 0 0 3px ${acc.color}18` : 'none',
                      }}>
                      {/* Icon circle */}
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all"
                        style={{ background: active ? acc.color : acc.bg }}>
                        <span className="material-icons-round text-2xl"
                          style={{ color: active ? '#fff' : acc.color }}>
                          {acc.icon}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-ink">{lokasi.nama}</div>
                        <div className="text-[10px] mt-0.5 font-semibold"
                          style={{ color: active ? acc.color : '#9CA3AF' }}>
                          {lokasi.jumlah_pic >= 2 ? '2 PIC Auditor' : '1 PIC Auditor'}
                        </div>
                      </div>
                      {active && (
                        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: acc.color }}>
                          <span className="material-icons-round text-white text-xs">check</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CONTAINER 2: TANGGAL ────────────────────────── */}
        <div className={`card fade-up transition-all ${step2Done ? 'ring-2 ring-brand/20' : ''}`} style={{ animationDelay: '0.08s' }}>
          <div className="card-head flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-all ${
              step2Done ? 'bg-brand text-white' : 'bg-surface-border text-ink-3'
            }`}>2</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">Tanggal Audit</div>
              <div className="text-[11px] text-ink-3">Hari ini atau tanggal tertentu</div>
            </div>
            {step2Done && <span className="material-icons-round text-brand text-xl">check_circle</span>}
          </div>
          <div className="p-4">
            <DatePicker value={tanggal} onChange={setTanggal} />
          </div>
        </div>

        {/* ── CONTAINER 3: PIC AUDITOR ────────────────────── */}
        <div className={`card fade-up transition-all ${step3Done ? 'ring-2 ring-brand/20' : ''}`} style={{ animationDelay: '0.12s' }}>
          <div className="card-head flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-all ${
              step3Done ? 'bg-brand text-white' : 'bg-surface-border text-ink-3'
            }`}>3</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-ink">PIC Auditor</div>
              <div className="text-[11px] text-ink-3">
                {lokasiId
                  ? butuhDuaPic
                    ? 'Pilih 2 orang PIC untuk lokasi ini'
                    : 'Pilih 1 orang PIC untuk lokasi ini'
                  : 'Pilih lokasi terlebih dahulu'}
              </div>
            </div>
            {step3Done && <span className="material-icons-round text-brand text-xl">check_circle</span>}
          </div>
          <div className="p-4 flex flex-col gap-3">
            {!lokasiId ? (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-surface-border">
                <span className="material-icons-round text-ink-3 text-xl">info</span>
                <span className="text-xs text-ink-3">Pilih lokasi di langkah 1 untuk memilih auditor</span>
              </div>
            ) : memberList.length === 0 ? (
              <div className="text-center py-4 text-xs text-ink-3">Memuat daftar anggota...</div>
            ) : (
              <>
                <div>
                  <div className="text-[11px] font-bold text-ink-2 mb-1.5">
                    {butuhDuaPic ? 'PIC Auditor 1' : 'PIC Auditor'}
                  </div>
                  <SearchableSelect
                    options={auditorOptions}
                    value={auditor1}
                    onChange={setAuditor1}
                    placeholder="Pilih auditor..."
                    exclude={auditor2}
                  />
                </div>

                {butuhDuaPic && (
                  <div>
                    <div className="text-[11px] font-bold text-ink-2 mb-1.5">PIC Auditor 2</div>
                    <SearchableSelect
                      options={auditorOptions}
                      value={auditor2}
                      onChange={setAuditor2}
                      placeholder="Pilih auditor 2..."
                      exclude={auditor1}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-surface border border-surface-border">
                  <span className="material-icons-round text-brand text-base">group</span>
                  <span className="text-xs text-ink-2 font-semibold">{memberList.length} auditee terdaftar</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── BUTTON MULAI ────────────────────────────────── */}
        <button
          onClick={handleStart}
          disabled={loading || !canStart}
          className="fade-up relative overflow-hidden py-4 rounded-2xl text-sm font-extrabold text-white border-none cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none hover:-translate-y-0.5 hover:shadow-card-hover"
          style={{
            background: canStart
              ? 'linear-gradient(135deg, #7C6EF5 0%, #9F95F7 50%, #7C6EF5 100%)'
              : '#E8E6FF',
            color: canStart ? '#fff' : '#9CA3AF',
            animationDelay: '0.16s',
          }}>
          {loading
            ? <><span className="material-icons-round text-base animate-spin">sync</span> Mempersiapkan sesi...</>
            : <><span className="material-icons-round text-base">play_circle</span> Mulai Audit</>
          }
        </button>

      </main>
    </div>
  )
}
