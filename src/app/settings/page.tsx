'use client'
// app/settings/page.tsx

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Lokasi, Member, ChecklistItem, ScoreConfig, CustomAnswer } from '@/types/database'

type Tab = 'lokasi' | 'member' | 'checklist' | 'score'

// ── Shared confirm modal ──────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(22,22,42,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-hover p-5 flex flex-col gap-4 animate-[fadeUp_0.2s_ease]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-danger-light flex items-center justify-center flex-shrink-0">
            <span className="material-icons-round text-danger text-xl">delete_forever</span>
          </div>
          <div>
            <div className="text-sm font-extrabold text-ink">Hapus data ini?</div>
            <div className="text-[11px] text-ink-3 mt-0.5">{message}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1 text-sm py-3">Batal</button>
          <button onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white border-none cursor-pointer bg-danger flex items-center justify-center gap-1.5 hover:-translate-y-0.5 transition-all">
            <span className="material-icons-round text-base">delete</span> Hapus
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Settings Password Gate ────────────────────────────────────
const SETTINGS_TIMEOUT_MS = 15 * 60 * 1000 // 15 menit

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw]     = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pw.trim()) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/settings/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    setLoading(false)
    if (res.ok) {
      onUnlock()
    } else {
      setError('Password salah')
      setPw('')
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(22,22,42,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-hover p-6 flex flex-col gap-5 animate-[fadeUp_0.25s_ease]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-3xl bg-brand-pale flex items-center justify-center">
            <span className="material-icons-round text-brand text-3xl">lock</span>
          </div>
          <div className="text-center">
            <div className="text-base font-extrabold text-ink">Pengaturan Terkunci</div>
            <div className="text-[11px] text-ink-3 mt-1">Masukkan password untuk membuka. Sesi berlaku 3 menit.</div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError('') }}
            placeholder="Password pengaturan..."
            autoFocus
            className={`inp text-sm ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
          />
          {error && (
            <div className="flex items-center gap-1.5 text-danger text-xs">
              <span className="material-icons-round text-sm">error</span> {error}
            </div>
          )}
          <button type="submit" disabled={loading || !pw.trim()} className="btn-primary py-3 text-sm disabled:opacity-50">
            {loading ? 'Memverifikasi...' : 'Buka Pengaturan'}
          </button>
        </form>
        <Link href="/" className="text-center text-xs text-ink-3 hover:text-brand transition-colors">
          ← Kembali ke beranda
        </Link>
      </div>
    </div>
  )
}

// ── Change Password Modal ─────────────────────────────────────
function PasswordSection({ title, subtitle, bg, type, onClose }: {
  title: string
  subtitle: string
  bg: string
  type: 'app' | 'settings'
  onClose: () => void
}) {
  const [pw, setPw]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')

  const mismatch = confirm.length > 0 && pw !== confirm
  const canSave  = pw.trim().length > 0 && pw === confirm

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/settings/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, new_password: pw.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg('✓ Berhasil diubah')
      setPw(''); setConfirm('')
    } else {
      setMsg('Gagal menyimpan')
    }
  }

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-2xl ${bg}`}>
      <div className="text-xs font-bold text-ink">{title}</div>
      <div className="text-[11px] text-ink-3">{subtitle}</div>
      <input
        type="password"
        value={pw}
        onChange={e => { setPw(e.target.value); setMsg('') }}
        placeholder="Password baru..."
        className="inp text-xs"
      />
      <input
        type="password"
        value={confirm}
        onChange={e => { setConfirm(e.target.value); setMsg('') }}
        placeholder="Konfirmasi password baru..."
        className={`inp text-xs ${mismatch ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}`}
      />
      {mismatch && <div className="text-[11px] text-danger font-semibold">Password tidak cocok</div>}
      {msg && <div className={`text-xs font-bold ${msg.startsWith('✓') ? 'text-success' : 'text-danger'}`}>{msg}</div>}
      <button onClick={handleSave} disabled={saving || !canSave}
        className="btn-primary text-xs py-2 disabled:opacity-50">
        {saving ? 'Menyimpan...' : `Ubah ${type === 'app' ? 'Password Login' : 'Password Setting'}`}
      </button>
    </div>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{ background: 'rgba(22,22,42,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-hover p-5 flex flex-col gap-5 animate-[fadeUp_0.2s_ease]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-pale flex items-center justify-center flex-shrink-0">
            <span className="material-icons-round text-brand text-xl">lock_reset</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-ink">Ganti Password</div>
            <div className="text-[11px] text-ink-3">Ubah password akses halaman atau pengaturan</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-surface transition-all">
            <span className="material-icons-round text-lg">close</span>
          </button>
        </div>

        <PasswordSection
          title="Password Buka Halaman (Login)"
          subtitle="Digunakan saat login ke aplikasi"
          bg="bg-surface"
          type="app"
          onClose={onClose}
        />
        <PasswordSection
          title="Password Masuk Pengaturan"
          subtitle="Digunakan saat membuka halaman ini"
          bg="bg-brand-pale"
          type="settings"
          onClose={onClose}
        />
      </div>
    </div>
  )
}

const SETTINGS_UNLOCK_KEY = 'settings_unlock_at'

// ── Main Page ─────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab]       = useState<Tab>('lokasi')
  const [isUnlocked, setIsUnlocked]     = useState(false)
  const [unlockTime, setUnlockTime]     = useState<number>(0)
  const [showChangePw, setShowChangePw] = useState(false)
  const [timeLeft, setTimeLeft]         = useState(SETTINGS_TIMEOUT_MS)
  const timerRef = useRef<NodeJS.Timeout>()

  // Cek sessionStorage saat pertama mount — resume sesi kalau masih valid
  useEffect(() => {
    const stored = sessionStorage.getItem(SETTINGS_UNLOCK_KEY)
    if (stored) {
      const t = parseInt(stored, 10)
      const remaining = SETTINGS_TIMEOUT_MS - (Date.now() - t)
      if (remaining > 0) {
        setIsUnlocked(true)
        setUnlockTime(t)
        setTimeLeft(remaining)
      } else {
        sessionStorage.removeItem(SETTINGS_UNLOCK_KEY)
      }
    }
  }, [])

  function handleUnlock() {
    const now = Date.now()
    sessionStorage.setItem(SETTINGS_UNLOCK_KEY, String(now))
    setIsUnlocked(true)
    setUnlockTime(now)
  }

  // Countdown & auto-lock setelah timeout
  useEffect(() => {
    if (!isUnlocked) return
    timerRef.current = setInterval(() => {
      const remaining = SETTINGS_TIMEOUT_MS - (Date.now() - unlockTime)
      if (remaining <= 0) {
        sessionStorage.removeItem(SETTINGS_UNLOCK_KEY)
        setIsUnlocked(false)
        setUnlockTime(0)
        setTimeLeft(SETTINGS_TIMEOUT_MS)
        clearInterval(timerRef.current)
      } else {
        setTimeLeft(remaining)
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [isUnlocked, unlockTime])

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'lokasi',    label: 'Lokasi',    icon: 'location_on' },
    { id: 'member',    label: 'Member',    icon: 'group' },
    { id: 'checklist', label: 'Checklist', icon: 'checklist' },
    { id: 'score',     label: 'Skor',      icon: 'star' },
  ]
  const tabIndex = tabs.findIndex(t => t.id === activeTab)

  const timeLeftSec = Math.ceil(timeLeft / 1000)
  const timeLeftMin = Math.floor(timeLeftSec / 60)
  const timeLeftSecRem = timeLeftSec % 60
  const timerLabel = `${timeLeftMin}:${timeLeftSecRem.toString().padStart(2, '0')}`

  return (
    <div className="min-h-screen pb-20">
      {!isUnlocked && <PasswordGate onUnlock={handleUnlock} />}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      {/* Header */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-50 shadow-card">
        <div className="max-w-lg mx-auto px-5 h-[60px] flex items-center gap-3">
          <Link href="/"
            className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
            <span className="material-icons-round text-lg">arrow_back</span>
          </Link>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-ink">Pengaturan</div>
            <div className="text-[11px] text-ink-3">Lokasi · Member · Checklist · Skor</div>
          </div>
          {isUnlocked && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-warning/10 text-warning">
              <span className="material-icons-round text-sm">timer</span>
              <span className="text-[11px] font-bold font-mono">{timerLabel}</span>
            </div>
          )}
          <button
            onClick={() => setShowChangePw(true)}
            title="Ganti Password"
            className="w-9 h-9 rounded-xl border border-surface-border flex items-center justify-center text-ink-2 hover:bg-brand-pale hover:border-brand hover:text-brand transition-all">
            <span className="material-icons-round text-lg">lock</span>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">
        {/* Tab nav */}
        <div className="relative grid grid-cols-4 gap-1.5 p-1 bg-[#E8E6FF] rounded-2xl border border-surface-border">
          {/* Sliding pill */}
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-white shadow-sm pointer-events-none transition-all duration-300 ease-out"
            style={{
              width: 'calc((100% - 26px) / 4)',
              left: `calc(4px + ${tabIndex} * ((100% - 26px) / 4 + 6px))`,
            }}
          />
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`relative z-10 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[11px] font-bold transition-colors duration-200 ${
                activeTab === t.id ? 'text-brand' : 'text-ink-2 hover:text-brand'
              }`}>
              <span className="material-icons-round text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {activeTab === 'lokasi'    && <LokasiTab />}
        {activeTab === 'member'    && <MemberTab />}
        {activeTab === 'checklist' && <ChecklistTab />}
        {activeTab === 'score'     && <ScoreTab />}
      </main>
    </div>
  )
}

// ── TAB: LOKASI ───────────────────────────────────────────────
const LOKASI_ICONS = [
  { icon: 'location_on',    label: 'Lokasi' },
  { icon: 'business',       label: 'Kantor' },
  { icon: 'warehouse',      label: 'Gudang' },
  { icon: 'factory',        label: 'Pabrik' },
  { icon: 'store',          label: 'Toko' },
  { icon: 'science',        label: 'Lab' },
  { icon: 'construction',   label: 'Proyek' },
  { icon: 'home_work',      label: 'Workshop' },
  { icon: 'local_shipping', label: 'Logistik' },
  { icon: 'apartment',      label: 'Gedung' },
]
const LOKASI_COLORS = [
  '#7C6EF5', '#10B981', '#3B82F6', '#F59E0B',
  '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4',
]

function LokasiTab() {
  const [list, setList]           = useState<Lokasi[]>([])
  const [nama, setNama]           = useState('')
  const [kode, setKode]           = useState('')
  const [pic, setPic]             = useState(1)
  const [lokasiIcon, setLokasiIcon]   = useState('location_on')
  const [lokasiColor, setLokasiColor] = useState('#7C6EF5')
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lokasi | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('lokasi').select('*').order('nama')
    if (data) setList(data)
  }

  async function handleSave() {
    if (!nama.trim() || !kode.trim()) return
    setSaving(true)
    if (editId) {
      await fetch(`/api/settings/lokasi/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, kode: kode.toUpperCase(), jumlah_pic: pic, icon: lokasiIcon, color: lokasiColor }),
      })
    } else {
      await fetch('/api/settings/lokasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, kode: kode.toUpperCase(), jumlah_pic: pic, icon: lokasiIcon, color: lokasiColor }),
      })
    }
    setNama(''); setKode(''); setPic(1); setLokasiIcon('location_on'); setLokasiColor('#7C6EF5'); setEditId(null)
    await load(); setSaving(false)
  }

  function handleEdit(l: Lokasi) {
    setEditId(l.id); setNama(l.nama); setKode(l.kode); setPic(l.jumlah_pic)
    setLokasiIcon(l.icon ?? 'location_on'); setLokasiColor(l.color ?? '#7C6EF5')
  }

  async function handleToggle(l: Lokasi) {
    await fetch(`/api/settings/lokasi/${l.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: !l.aktif }),
    })
    await load()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await fetch(`/api/settings/lokasi/${deleteTarget.id}`, { method: 'DELETE' })
    setList(prev => prev.filter(l => l.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <>
      <div className="card fade-up">
        <div className="card-head flex items-center gap-3">
          <div className="ico-wrap ico-brand"><span className="material-icons-round">location_on</span></div>
          <div>
            <div className="text-sm font-bold text-ink">Kelola Lokasi</div>
            <div className="text-[11px] text-ink-3">Tambah / edit lokasi audit</div>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 p-3 bg-brand-pale rounded-2xl">
            <div className="text-xs font-bold text-brand mb-1">{editId ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}</div>
            <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama lokasi (cth: Tech Build 1)" className="inp text-xs" />
            <input value={kode} onChange={e => setKode(e.target.value)} placeholder="Kode (cth: TB1)" className="inp text-xs" />
            <div>
              <label className="text-[11px] font-bold text-ink-2 mb-1 block">Jumlah PIC Auditor</label>
              <div className="flex gap-2">
                {[1, 2].map(n => (
                  <button key={n} onClick={() => setPic(n)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                      pic === n ? 'border-brand bg-white text-brand' : 'border-transparent bg-white/60 text-ink-2'
                    }`}>
                    {n} PIC
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-ink-2 mb-1.5 block">Icon Lokasi</label>
              <div className="flex flex-wrap gap-1.5">
                {LOKASI_ICONS.map(o => (
                  <button key={o.icon} type="button" onClick={() => setLokasiIcon(o.icon)}
                    title={o.label}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border-2 ${
                      lokasiIcon === o.icon ? 'border-brand bg-white text-brand' : 'border-transparent bg-white/60 text-ink-2 hover:border-brand/40'
                    }`}>
                    <span className="material-icons-round text-base">{o.icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-ink-2 mb-1.5 block">Warna Aksen</label>
              <div className="flex flex-wrap gap-2">
                {LOKASI_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setLokasiColor(c)}
                    className={`w-7 h-7 rounded-full border-4 transition-all ${
                      lokasiColor === c ? 'border-ink/30 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              {editId && (
                <button onClick={() => { setEditId(null); setNama(''); setKode(''); setPic(1); setLokasiIcon('location_on'); setLokasiColor('#7C6EF5') }}
                  className="btn-secondary flex-1 text-xs py-2">Batal</button>
              )}
              <button onClick={handleSave} disabled={saving || !nama || !kode}
                className="btn-primary flex-1 text-xs py-2 disabled:opacity-50">
                {saving ? 'Menyimpan...' : editId ? 'Update' : 'Tambah'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {list.map(l => (
              <div key={l.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${l.aktif ? 'border-surface-border bg-white' : 'border-surface-border bg-surface opacity-60'}`}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${l.color ?? '#7C6EF5'}18` }}>
                  <span className="material-icons-round text-base" style={{ color: l.color ?? '#7C6EF5' }}>{l.icon ?? 'location_on'}</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-ink">{l.nama}</div>
                  <div className="text-[11px] text-ink-3">{l.jumlah_pic} PIC · {l.aktif ? 'Aktif' : 'Non-aktif'}</div>
                </div>
                <button onClick={() => handleEdit(l)} className="w-7 h-7 rounded-lg flex items-center justify-center text-brand hover:bg-brand-pale transition-all">
                  <span className="material-icons-round text-sm">edit</span>
                </button>
                <button onClick={() => handleToggle(l)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${l.aktif ? 'text-ink-3 hover:bg-surface' : 'text-success hover:bg-success-light'}`}>
                  <span className="material-icons-round text-sm">{l.aktif ? 'toggle_on' : 'toggle_off'}</span>
                </button>
                <button onClick={() => setDeleteTarget(l)} className="w-7 h-7 rounded-lg flex items-center justify-center text-danger hover:bg-danger-light transition-all">
                  <span className="material-icons-round text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={`Lokasi "${deleteTarget.nama}" akan dihapus permanen beserta semua data terkait.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

// ── Equipment Modal ───────────────────────────────────────────
function EquipmentModal({ member, type, onClose, onSaved, onMemberUpdate, onToast }: {
  member: Member
  type: 'camera' | 'ht'
  onClose: () => void
  onSaved: (id: string, field: 'sn_camera' | 'sn_ht', val: string | null) => void
  onMemberUpdate: (id: string, patch: Partial<Member>) => void
  onToast: (msg: string) => void
}) {
  const field   = type === 'camera' ? 'sn_camera' : 'sn_ht'
  const current = member[field] ?? ''
  const [sn, setSn]             = useState(current)
  const [camRequired, setCamRequired] = useState(member.cam_required !== false)
  const [htRequired, setHtRequired]   = useState(member.ht_required !== false)
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState('')

  const icon  = type === 'camera' ? 'photo_camera' : 'settings_remote'
  const label = type === 'camera' ? 'Camera' : 'Handy Talky (HT)'
  const color = type === 'camera' ? '#7C6EF5' : '#10B981'

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    const val = sn.trim() || null
    const patch: Record<string, unknown> = { [field]: val }
    if (type === 'camera') patch.cam_required = camRequired
    if (type === 'ht')     patch.ht_required  = htRequired
    const res = await fetch(`/api/settings/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setSaveError(body.error ?? 'Gagal menyimpan. Coba jalankan migration_v3.sql di Supabase.')
      setSaving(false)
      return
    }
    onSaved(member.id, field, val)
    if (type === 'camera') onMemberUpdate(member.id, { cam_required: camRequired })
    if (type === 'ht')     onMemberUpdate(member.id, { ht_required: htRequired })
    const typeLabel = type === 'camera' ? 'Camera' : 'HT'
    onToast(`Berhasil disimpan ${member.nama} > ${typeLabel}`)
    setSaving(false)
    onClose()
  }

  async function handleClear() {
    setSaving(true)
    setSaveError('')
    const res = await fetch(`/api/settings/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: null }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setSaveError(body.error ?? 'Gagal menghapus serial.')
      setSaving(false)
      return
    }
    onSaved(member.id, field, null)
    const typeLabel = type === 'camera' ? 'Camera' : 'HT'
    onToast(`Berhasil dihapus ${member.nama} > ${typeLabel}`)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(22,22,42,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-card-hover p-5 flex flex-col gap-4 animate-[fadeUp_0.2s_ease]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: color + '18' }}>
            <span className="material-icons-round text-xl" style={{ color }}>{icon}</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-ink">Serial No. {label}</div>
            <div className="text-[11px] text-ink-3">{member.nama}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-surface transition-all">
            <span className="material-icons-round text-lg">close</span>
          </button>
        </div>

        {/* Toggle wajib Camera */}
        {type === 'camera' && (
          <button
            type="button"
            onClick={() => setCamRequired(v => !v)}
            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
              camRequired
                ? 'border-purple-300 bg-purple-50'
                : 'border-surface-border bg-surface'
            }`}>
            <span className={`material-icons-round text-xl ${camRequired ? 'text-purple-500' : 'text-ink-3'}`}>
              {camRequired ? 'toggle_on' : 'toggle_off'}
            </span>
            <div>
              <div className={`text-xs font-bold ${camRequired ? 'text-purple-700' : 'text-ink-2'}`}>
                {camRequired ? 'Wajib pegang Camera' : 'Tidak wajib pegang Camera'}
              </div>
              <div className="text-[10px] text-ink-3">
                {camRequired ? 'Member ini harus memiliki Camera' : 'Member ini tidak diwajibkan membawa Camera'}
              </div>
            </div>
          </button>
        )}

        {/* Toggle wajib HT */}
        {type === 'ht' && (
          <button
            type="button"
            onClick={() => setHtRequired(v => !v)}
            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
              htRequired
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-surface-border bg-surface'
            }`}>
            <span className={`material-icons-round text-xl ${htRequired ? 'text-emerald-500' : 'text-ink-3'}`}>
              {htRequired ? 'toggle_on' : 'toggle_off'}
            </span>
            <div>
              <div className={`text-xs font-bold ${htRequired ? 'text-emerald-700' : 'text-ink-2'}`}>
                {htRequired ? 'Wajib pegang HT' : 'Tidak wajib pegang HT'}
              </div>
              <div className="text-[10px] text-ink-3">
                {htRequired ? 'Member ini harus memiliki HT' : 'Member ini tidak diwajibkan membawa HT'}
              </div>
            </div>
          </button>
        )}

        <input
          type="text"
          value={sn}
          onChange={e => setSn(e.target.value)}
          placeholder={`Contoh: ${type === 'camera' ? '14D05D1426' : 'MVM-ASET-HT-01'}`}
          disabled={(type === 'camera' && !camRequired) || (type === 'ht' && !htRequired)}
          autoFocus
          className={`inp text-sm ${(type === 'camera' && !camRequired) || (type === 'ht' && !htRequired) ? 'opacity-40' : ''}`}
        />

        {saveError && (
          <div className="rounded-xl bg-danger-light border border-danger/20 px-3 py-2 text-[11px] text-danger font-semibold">
            {saveError}
          </div>
        )}

        <div className="flex gap-2">
          {current && (
            <button onClick={handleClear} disabled={saving}
              className="px-3 py-2.5 rounded-2xl text-xs font-bold text-danger border border-danger/30 hover:bg-danger-light transition-all disabled:opacity-50">
              Hapus SN
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1 text-sm py-2.5">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TAB: MEMBER ───────────────────────────────────────────────
function MemberTab() {
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([])
  const [lokasiId,   setLokasiId]   = useState('')
  const [members,    setMembers]    = useState<Member[]>([])
  const [newName,    setNewName]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [dragIdx,    setDragIdx]    = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [equipModal,   setEquipModal]   = useState<{ member: Member; type: 'camera' | 'ht' } | null>(null)
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set())
  const [syncingId,    setSyncingId]    = useState<string | null>(null)
  const [editNameId,   setEditNameId]   = useState<string | null>(null)
  const [editNameVal,  setEditNameVal]  = useState('')
  const [toast,        setToast]        = useState('')
  const toastRef = useRef<NodeJS.Timeout>()

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    supabase.from('lokasi').select('*').eq('aktif', true).order('nama')
      .then(({ data }) => {
        if (data) { setLokasiList(data); if (data.length > 0) setLokasiId(data[0].id) }
      })
  }, [])

  useEffect(() => {
    if (!lokasiId) return
    supabase.from('members').select('*').eq('lokasi_id', lokasiId).eq('aktif', true).order('urutan')
      .then(({ data }) => { if (data) setMembers(data) })
  }, [lokasiId])

  async function handleAdd() {
    if (!newName.trim() || !lokasiId) return
    setSaving(true)
    await fetch('/api/settings/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lokasi_id: lokasiId, nama: newName.trim(), urutan: members.length + 1 }),
    })
    const addedName = newName.trim()
    setNewName('')
    const { data } = await supabase.from('members').select('*').eq('lokasi_id', lokasiId).eq('aktif', true).order('urutan')
    if (data) setMembers(data)
    setSaving(false)
    showToast(`${addedName} ditambahkan`)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const deletedName = deleteTarget.nama
    await fetch(`/api/settings/members/${deleteTarget.id}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.id !== deleteTarget.id))
    setDeleteTarget(null)
    showToast(`${deletedName} dihapus`)
  }

  async function handleToggleAuditor(m: Member) {
    const newVal = !(m.is_auditor !== false)
    await fetch(`/api/settings/members/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_auditor: newVal }),
    })
    setMembers(prev => prev.map(x => x.id === m.id ? { ...x, is_auditor: newVal } : x))
    showToast(`${m.nama} — ${newVal ? 'Auditor' : 'Auditee'}`)
  }

  async function saveOrder(newList: Member[]) {
    await fetch('/api/settings/members/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: newList.map((m, i) => ({ id: m.id, urutan: i + 1 })) }),
    })
  }

  function moveUp(i: number) {
    if (i === 0) return
    const newList = [...members]
    ;[newList[i - 1], newList[i]] = [newList[i], newList[i - 1]]
    setMembers(newList); saveOrder(newList)
  }

  function moveDown(i: number) {
    if (i === members.length - 1) return
    const newList = [...members]
    ;[newList[i], newList[i + 1]] = [newList[i + 1], newList[i]]
    setMembers(newList); saveOrder(newList)
  }

  async function handleRenameMember(id: string) {
    const nama = editNameVal.trim()
    if (!nama) return
    const res = await fetch(`/api/settings/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama }),
    })
    if (!res.ok) return
    setMembers(prev => prev.map(m => m.id === id ? { ...m, nama } : m))
    setEditNameId(null)
    showToast(`Nama diubah ke "${nama}"`)
  }

  function handleEquipSaved(id: string, field: 'sn_camera' | 'sn_ht', val: string | null) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, [field]: val } : m))
  }

  function handleMemberUpdate(id: string, patch: Partial<Member>) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  async function handleSync(m: Member) {
    setSyncingId(m.id)
    const res = await fetch('/api/settings/members/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: m.nama,
        sn_camera: m.sn_camera,
        sn_ht: m.sn_ht,
        cam_required: m.cam_required,
        ht_required: m.ht_required,
      }),
    })
    setSyncingId(null)
    if (res.ok) showToast(`${m.nama} — data disync ke semua lokasi`)
    else showToast(`Gagal sync ${m.nama}`)
  }

  return (
    <>
      <div className="card fade-up">
        <div className="card-head flex items-center gap-3">
          <div className="ico-wrap ico-brand"><span className="material-icons-round">group</span></div>
          <div className="flex-1">
            <div className="text-sm font-bold text-ink">Kelola Member</div>
            <div className="text-[11px] text-ink-3">Tambah / hapus / urutkan auditee</div>
          </div>
          <button
            onClick={() => {
              const allExpanded = members.length > 0 && members.every(m => expandedIds.has(m.id))
              if (allExpanded) setExpandedIds(new Set())
              else setExpandedIds(new Set(members.map(m => m.id)))
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-ink-2 bg-surface hover:bg-brand-pale hover:text-brand transition-all border border-surface-border">
            <span className="material-icons-round text-sm">
              {expandedIds.size > 0 ? 'unfold_less' : 'unfold_more'}
            </span>
            {expandedIds.size > 0 ? 'Tutup semua' : 'Buka semua'}
          </button>
        </div>
        <div className="p-4 flex flex-col gap-4">

          <div className="flex gap-1.5 flex-wrap">
            {lokasiList.map(l => (
              <button key={l.id} onClick={() => { setLokasiId(l.id); setExpandedIds(new Set()) }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  lokasiId === l.id ? 'border-brand bg-brand-pale text-brand' : 'border-surface-border text-ink-2 hover:border-brand/40'
                }`}>
                {l.nama}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 max-h-[520px] overflow-y-auto pr-1">
            {members.map((m, i) => {
              const isExpanded = expandedIds.has(m.id)
              const htLabel = m.sn_ht ? m.sn_ht : '—'
              const camLabel = m.sn_camera ? m.sn_camera : '—'
              return (
                <div key={m.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx === null || dragIdx === i) return
                    const newList = [...members]
                    const [moved] = newList.splice(dragIdx, 1)
                    newList.splice(i, 0, moved)
                    setMembers(newList); setDragIdx(null); saveOrder(newList)
                  }}
                  className={`rounded-xl border transition-all ${isExpanded ? 'border-brand/40 bg-white shadow-sm' : 'border-surface-border bg-surface hover:border-brand/30'}`}>

                  {/* Row utama */}
                  <div className="flex items-center gap-1.5 p-2 cursor-grab active:cursor-grabbing">
                    <div className="flex flex-col gap-px sm:hidden">
                      <button type="button" onClick={e => { e.stopPropagation(); moveUp(i) }} disabled={i === 0}
                        className="w-4 h-4 flex items-center justify-center text-ink-3 disabled:opacity-20">
                        <span className="material-icons-round text-xs leading-none">arrow_drop_up</span>
                      </button>
                      <button type="button" onClick={e => { e.stopPropagation(); moveDown(i) }} disabled={i === members.length - 1}
                        className="w-4 h-4 flex items-center justify-center text-ink-3 disabled:opacity-20">
                        <span className="material-icons-round text-xs leading-none">arrow_drop_down</span>
                      </button>
                    </div>
                    <span className="material-icons-round text-ink-3 text-base hidden sm:block">drag_indicator</span>
                    <span className="w-5 h-5 rounded-md bg-brand-pale flex items-center justify-center text-[10px] font-bold text-brand flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 text-xs font-semibold text-ink truncate">{m.nama}</span>

                    {/* Expand toggle */}
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedIds(prev => { const s = new Set(prev); isExpanded ? s.delete(m.id) : s.add(m.id); return s }) }}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'text-brand bg-brand-pale' : 'text-ink-3 hover:bg-surface'}`}>
                      <span className="material-icons-round text-sm">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                    </button>

                    <button onClick={() => setDeleteTarget(m)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-danger hover:bg-danger-light transition-all">
                      <span className="material-icons-round text-sm">delete</span>
                    </button>
                  </div>

                  {/* Expand panel: equipment */}
                  {isExpanded && (
                    <div className="px-3 pb-3 flex flex-col gap-1.5 border-t border-surface-border pt-2.5">

                      {/* Edit nama */}
                      {editNameId === m.id ? (
                        <div className="flex gap-1.5 items-center p-2">
                          <input
                            autoFocus
                            value={editNameVal}
                            onChange={e => setEditNameVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameMember(m.id)
                              if (e.key === 'Escape') setEditNameId(null)
                            }}
                            className="inp text-sm flex-1 py-1.5"
                          />
                          <button onClick={() => handleRenameMember(m.id)}
                            className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white flex-shrink-0">
                            <span className="material-icons-round text-sm">check</span>
                          </button>
                          <button onClick={() => setEditNameId(null)}
                            className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center text-ink-3 flex-shrink-0">
                            <span className="material-icons-round text-sm">close</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditNameId(m.id); setEditNameVal(m.nama) }}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-brand-pale transition-all text-left w-full group">
                          <span className="material-icons-round text-base flex-shrink-0 text-brand">badge</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">Nama</div>
                            <div className="text-sm font-bold text-ink truncate">{m.nama}</div>
                          </div>
                          <span className="material-icons-round text-ink-3 text-sm opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                        </button>
                      )}

                      {/* Camera row */}
                      <button
                        onClick={() => setEquipModal({ member: m, type: 'camera' })}
                        className={`flex items-center gap-2.5 p-2 rounded-xl transition-all text-left w-full group ${m.cam_required !== false ? 'hover:bg-purple-50' : 'hover:bg-surface'}`}>
                        <span className="material-icons-round text-base flex-shrink-0"
                          style={{ color: m.cam_required !== false ? '#7C6EF5' : '#9CA3AF' }}>photo_camera</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">Camera</div>
                          <div className={`text-sm font-bold truncate ${
                            m.cam_required === false ? 'text-ink-3 italic' :
                            m.sn_camera ? 'text-purple-700' : 'text-ink-3'
                          }`}>
                            {m.cam_required === false ? 'Tidak wajib pegang' : camLabel}
                          </div>
                        </div>
                        <span className="material-icons-round text-ink-3 text-sm opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                      </button>

                      {/* HT row */}
                      <button
                        onClick={() => setEquipModal({ member: m, type: 'ht' })}
                        className={`flex items-center gap-2.5 p-2 rounded-xl transition-all text-left w-full group ${m.ht_required !== false ? 'hover:bg-emerald-50' : 'hover:bg-surface'}`}>
                        <span className="material-icons-round text-base flex-shrink-0"
                          style={{ color: m.ht_required !== false ? '#10B981' : '#9CA3AF' }}>settings_remote</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">HT</div>
                          <div className={`text-sm font-bold truncate ${
                            m.ht_required === false ? 'text-ink-3 italic' :
                            m.sn_ht ? 'text-emerald-700' : 'text-ink-3'
                          }`}>
                            {m.ht_required === false ? 'Tidak wajib pegang' : htLabel}
                          </div>
                        </div>
                        <span className="material-icons-round text-ink-3 text-sm opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                      </button>

                      {/* Auditor toggle row */}
                      <button
                        onClick={() => handleToggleAuditor(m)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl transition-all text-left w-full group ${
                          m.is_auditor !== false ? 'hover:bg-blue-50' : 'hover:bg-surface'
                        }`}>
                        <span className={`material-icons-round text-base flex-shrink-0 ${m.is_auditor !== false ? 'text-brand' : 'text-ink-3'}`}>
                          {m.is_auditor !== false ? 'manage_accounts' : 'person'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">Peran</div>
                          <div className={`text-sm font-bold ${m.is_auditor !== false ? 'text-brand' : 'text-ink-2'}`}>
                            {m.is_auditor !== false ? 'Bisa jadi Auditor' : 'Auditee saja'}
                          </div>
                        </div>
                        <span className="material-icons-round text-ink-3 text-sm opacity-0 group-hover:opacity-100 transition-opacity">swap_horiz</span>
                      </button>

                      {/* Sync ke lokasi lain */}
                      <button
                        onClick={() => handleSync(m)}
                        disabled={syncingId === m.id}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-orange-50 transition-all text-left w-full group disabled:opacity-50">
                        <span className="material-icons-round text-base flex-shrink-0 text-orange-400">
                          {syncingId === m.id ? 'sync' : 'sync'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">Sinkronisasi</div>
                          <div className="text-sm font-bold text-orange-600">
                            {syncingId === m.id ? 'Menyinkronkan...' : 'Terapkan ke semua lokasi'}
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nama member baru..." className="inp text-xs flex-1" />
            <button onClick={handleAdd} disabled={saving || !newName}
              className="btn-primary text-xs px-4 disabled:opacity-50">Tambah</button>
          </div>
        </div>
      </div>

      {equipModal && (
        <EquipmentModal
          member={equipModal.member}
          type={equipModal.type}
          onClose={() => setEquipModal(null)}
          onSaved={handleEquipSaved}
          onMemberUpdate={handleMemberUpdate}
          onToast={showToast}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Member "${deleteTarget.nama}" akan dihapus dari daftar auditee.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast snackbar */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-2xl shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </>
  )
}

// ── TAB: CHECKLIST ────────────────────────────────────────────
function ChecklistTab() {
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([])
  const [lokasiId,   setLokasiId]   = useState('')
  const [items,      setItems]      = useState<ChecklistItem[]>([])
  const [editId,     setEditId]     = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null)
  const [dragIdx,      setDragIdx]      = useState<number | null>(null)
  const [copyModal,    setCopyModal]    = useState(false)
  const [copyFrom,     setCopyFrom]     = useState('')
  const [copyFromItems, setCopyFromItems] = useState<ChecklistItem[]>([])
  const [copySelected, setCopySelected] = useState<Set<string>>(new Set())
  const [copying,      setCopying]      = useState(false)
  const [copyResult,   setCopyResult]   = useState<string | null>(null)

  // Form state
  const [formItem,        setFormItem]        = useState('')
  const [formDesc,        setFormDesc]        = useState('')
  const [formBobot,       setFormBobot]       = useState('1')
  const [formTipe,        setFormTipe]        = useState<'bobot' | 'non_bobot'>('bobot')
  const [formJawaban,     setFormJawaban]     = useState<CustomAnswer[]>([])
  const [newJawabanLabel, setNewJawabanLabel] = useState('')

  function resetForm() {
    setFormItem(''); setFormDesc(''); setFormBobot('1')
    setFormTipe('bobot'); setFormJawaban([]); setNewJawabanLabel('')
    setEditId(null)
  }

  async function loadCopyFromItems(fromId: string) {
    setCopyFrom(fromId)
    setCopySelected(new Set())
    setCopyResult(null)
    const { data } = await supabase.from('checklist_items').select('*').eq('lokasi_id', fromId).eq('aktif', true).order('nomor')
    setCopyFromItems(data ?? [])
  }

  function toggleCopyItem(id: string) {
    setCopySelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCopy() {
    if (!copyFrom || !lokasiId || copySelected.size === 0) return
    setCopying(true)
    setCopyResult(null)
    const res = await fetch('/api/settings/checklist/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_lokasi_id: copyFrom, to_lokasi_id: lokasiId, item_ids: Array.from(copySelected) }),
    })
    const body = await res.json()
    if (!res.ok) { setCopyResult(`Gagal: ${body.error}`); setCopying(false); return }
    if (body.copied === 0) { setCopyResult('Item yang dipilih sudah ada di lokasi ini.'); setCopying(false); return }
    const { data } = await supabase.from('checklist_items').select('*').eq('lokasi_id', lokasiId).order('nomor')
    if (data) setItems(data)
    setCopyResult(`${body.copied} item berhasil disalin.`)
    setCopying(false)
  }

  useEffect(() => {
    supabase.from('lokasi').select('*').eq('aktif', true).order('nama')
      .then(({ data }) => {
        if (data) { setLokasiList(data); if (data.length > 0) setLokasiId(data[0].id) }
      })
  }, [])

  useEffect(() => {
    if (!lokasiId) return
    supabase.from('checklist_items').select('*').eq('lokasi_id', lokasiId).order('nomor')
      .then(({ data }) => { if (data) setItems(data) })
  }, [lokasiId])

  function addJawaban() {
    const label = newJawabanLabel.trim()
    if (!label) return
    if (formJawaban.some(j => j.label === label)) return
    setFormJawaban(prev => [...prev, { label, wajib_komentar: false }])
    setNewJawabanLabel('')
  }

  function removeJawaban(idx: number) {
    setFormJawaban(prev => prev.filter((_, i) => i !== idx))
  }

  function toggleWajibKomentar(idx: number) {
    setFormJawaban(prev => prev.map((j, i) => i === idx ? { ...j, wajib_komentar: !j.wajib_komentar } : j))
  }

  async function handleSave() {
    if (!formItem.trim()) return
    if (formTipe === 'non_bobot' && formJawaban.length < 2) {
      setSaveError('Tambahkan minimal 2 pilihan jawaban untuk checklist non-bobot.')
      return
    }
    setSaving(true)
    setSaveError('')
    const payload = formTipe === 'bobot'
      ? { item: formItem, deskripsi: formDesc, bobot: parseFloat(formBobot) || 1, tipe: 'bobot', jawaban_custom: null }
      : { item: formItem, deskripsi: formDesc, bobot: 0, tipe: 'non_bobot', jawaban_custom: formJawaban }

    let res: Response
    if (editId) {
      res = await fetch(`/api/settings/checklist/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/settings/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lokasi_id: lokasiId, nomor: items.length + 1, ...payload }),
      })
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setSaveError(body.error ?? `Gagal menyimpan (${res.status}). Pastikan migration_v2.sql sudah dijalankan di Supabase.`)
      setSaving(false)
      return
    }

    resetForm()
    const { data } = await supabase.from('checklist_items').select('*').eq('lokasi_id', lokasiId).order('nomor')
    if (data) setItems(data)
    setSaving(false)
  }

  function handleEdit(c: ChecklistItem) {
    setEditId(c.id)
    setFormItem(c.item)
    setFormDesc(c.deskripsi ?? '')
    setFormBobot(String(c.bobot))
    setFormTipe(c.tipe ?? 'bobot')
    setFormJawaban((c.jawaban_custom as CustomAnswer[]) ?? [])
  }

  async function handleToggle(c: ChecklistItem) {
    await fetch(`/api/settings/checklist/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: !c.aktif }),
    })
    setItems(prev => prev.map(i => i.id === c.id ? { ...i, aktif: !c.aktif } : i))
  }

  async function saveOrder(newList: ChecklistItem[]) {
    await fetch('/api/settings/checklist/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: newList.map((c, i) => ({ id: c.id, nomor: i + 1 })) }),
    })
  }

  function moveUp(i: number) {
    if (i === 0) return
    const newList = [...items]
    ;[newList[i - 1], newList[i]] = [newList[i], newList[i - 1]]
    setItems(newList); saveOrder(newList)
  }

  function moveDown(i: number) {
    if (i === items.length - 1) return
    const newList = [...items]
    ;[newList[i], newList[i + 1]] = [newList[i + 1], newList[i]]
    setItems(newList); saveOrder(newList)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await fetch(`/api/settings/checklist/${deleteTarget.id}`, { method: 'DELETE' })
    const newList = items.filter(i => i.id !== deleteTarget.id)
    setItems(newList)
    saveOrder(newList)
    setDeleteTarget(null)
  }

  return (
    <>
      <div className="card fade-up">
        <div className="card-head flex items-center gap-3">
          <div className="ico-wrap ico-brand"><span className="material-icons-round">checklist</span></div>
          <div className="flex-1">
            <div className="text-sm font-bold text-ink">Kelola Checklist</div>
            <div className="text-[11px] text-ink-3">Item bobot & non-bobot per lokasi</div>
          </div>
          <button
            onClick={() => { setCopyModal(true); setCopyFrom(''); setCopyResult(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-brand bg-brand-pale hover:bg-brand hover:text-white transition-all">
            <span className="material-icons-round text-sm">content_copy</span> Salin dari lokasi lain
          </button>
        </div>
        <div className="p-4 flex flex-col gap-4">

          <div className="flex gap-1.5 flex-wrap">
            {lokasiList.map(l => (
              <button key={l.id} onClick={() => setLokasiId(l.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                  lokasiId === l.id ? 'border-brand bg-brand-pale text-brand' : 'border-surface-border text-ink-2 hover:border-brand/40'
                }`}>
                {l.nama}
              </button>
            ))}
          </div>

          {/* Form tambah/edit */}
          <div className="flex flex-col gap-3 p-3 bg-brand-pale rounded-2xl">
            <div className="text-xs font-bold text-brand">{editId ? 'Edit Item' : 'Tambah Item Baru'}</div>

            <input value={formItem} onChange={e => setFormItem(e.target.value)}
              placeholder="Nama item checklist..." className="inp text-xs" />
            <input value={formDesc} onChange={e => setFormDesc(e.target.value)}
              placeholder="Deskripsi (opsional)..." className="inp text-xs" />

            {/* Tipe toggle */}
            <div>
              <div className="text-[11px] font-bold text-ink-2 mb-1.5">Tipe Checklist</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFormTipe('bobot')}
                  className={`py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1 ${
                    formTipe === 'bobot' ? 'border-brand bg-white text-brand' : 'border-transparent bg-white/60 text-ink-2'
                  }`}>
                  <span className="material-icons-round text-sm">star</span> Berbobot (Nilai 0–4)
                </button>
                <button type="button" onClick={() => setFormTipe('non_bobot')}
                  className={`py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1 ${
                    formTipe === 'non_bobot' ? 'border-[#10B981] bg-white text-[#10B981]' : 'border-transparent bg-white/60 text-ink-2'
                  }`}>
                  <span className="material-icons-round text-sm">rule</span> Non-Bobot (Pilihan)
                </button>
              </div>
            </div>

            {/* Bobot — hanya jika bobot */}
            {formTipe === 'bobot' && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-ink-2 font-bold whitespace-nowrap">Bobot:</label>
                <input type="number" value={formBobot} onChange={e => setFormBobot(e.target.value)}
                  min="0.1" max="5" step="0.1" className="inp text-xs w-24" />
                <span className="text-[11px] text-ink-3">(default: 1.0)</span>
              </div>
            )}

            {/* Custom answers — hanya jika non_bobot */}
            {formTipe === 'non_bobot' && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] font-bold text-ink-2">Pilihan Jawaban</div>
                <div className="text-[10px] text-ink-3">Tambah pilihan jawaban. Toggle 💬 untuk wajibkan komentar.</div>

                {formJawaban.map((j, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-surface-border">
                    <span className="flex-1 text-xs font-semibold text-ink">{j.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleWajibKomentar(idx)}
                      title={j.wajib_komentar ? 'Komentar wajib' : 'Komentar opsional'}
                      className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        j.wajib_komentar
                          ? 'border-warning/40 bg-warning/10 text-warning'
                          : 'border-surface-border text-ink-3 hover:border-brand/40'
                      }`}>
                      <span className="material-icons-round text-xs">chat_bubble</span>
                      {j.wajib_komentar ? 'Wajib' : 'Opsional'}
                    </button>
                    <button type="button" onClick={() => removeJawaban(idx)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-danger hover:bg-danger-light transition-all">
                      <span className="material-icons-round text-sm">close</span>
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    value={newJawabanLabel}
                    onChange={e => setNewJawabanLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addJawaban())}
                    placeholder="Tambah pilihan jawaban..."
                    className="inp text-xs flex-1"
                  />
                  <button type="button" onClick={addJawaban} disabled={!newJawabanLabel.trim()}
                    className="btn-primary text-xs px-3 disabled:opacity-50">
                    <span className="material-icons-round text-sm">add</span>
                  </button>
                </div>
              </div>
            )}

            {saveError && (
              <div className="flex items-start gap-1.5 p-2.5 rounded-xl bg-danger-light text-danger text-[11px] font-semibold">
                <span className="material-icons-round text-sm flex-shrink-0">error</span>
                {saveError}
              </div>
            )}
            <div className="flex gap-2 mt-1">
              {editId && (
                <button onClick={resetForm} className="btn-secondary flex-1 text-xs py-2">Batal</button>
              )}
              <button onClick={handleSave} disabled={saving || !formItem}
                className="btn-primary flex-1 text-xs py-2 disabled:opacity-50">
                {saving ? 'Menyimpan...' : editId ? 'Update' : 'Tambah'}
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
            {items.map((c, i) => {
              const isNonBobot = c.tipe === 'non_bobot'
              const jawaban = (c.jawaban_custom as CustomAnswer[] | null) ?? []
              return (
                <div key={c.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx === null || dragIdx === i) return
                    const newList = [...items]
                    const [moved] = newList.splice(dragIdx, 1)
                    newList.splice(i, 0, moved)
                    setItems(newList); setDragIdx(null); saveOrder(newList)
                  }}
                  className={`flex items-start gap-2 p-3 rounded-xl border transition-all ${c.aktif ? 'border-surface-border bg-white' : 'border-surface-border bg-surface opacity-50'}`}>
                  <div className="flex flex-col gap-px sm:hidden mt-0.5">
                    <button type="button" onClick={() => moveUp(i)} disabled={i === 0}
                      className="w-4 h-4 flex items-center justify-center text-ink-3 disabled:opacity-20">
                      <span className="material-icons-round text-xs leading-none">arrow_drop_up</span>
                    </button>
                    <button type="button" onClick={() => moveDown(i)} disabled={i === items.length - 1}
                      className="w-4 h-4 flex items-center justify-center text-ink-3 disabled:opacity-20">
                      <span className="material-icons-round text-xs leading-none">arrow_drop_down</span>
                    </button>
                  </div>
                  <span className="material-icons-round text-ink-3 text-base hidden sm:block mt-0.5 cursor-grab active:cursor-grabbing">drag_indicator</span>
                  <span className="w-5 h-5 rounded-md bg-brand-pale flex items-center justify-center text-[10px] font-bold text-brand flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-ink">{c.item}</span>
                      {isNonBobot
                        ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">Non-Bobot</span>
                        : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-pale text-brand">Bobot {c.bobot}</span>
                      }
                    </div>
                    {c.deskripsi && <div className="text-[11px] text-ink-3 truncate">{c.deskripsi}</div>}
                    {isNonBobot && jawaban.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {jawaban.map((j, i) => (
                          <span key={i} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            j.wajib_komentar ? 'bg-warning/10 text-warning' : 'bg-surface text-ink-3'
                          }`}>
                            {j.label}{j.wajib_komentar ? ' 💬' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleEdit(c)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-brand hover:bg-brand-pale transition-all flex-shrink-0">
                    <span className="material-icons-round text-sm">edit</span>
                  </button>
                  <button onClick={() => handleToggle(c)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${c.aktif ? 'text-ink-3 hover:bg-surface' : 'text-success hover:bg-success-light'}`}>
                    <span className="material-icons-round text-sm">{c.aktif ? 'visibility_off' : 'visibility'}</span>
                  </button>
                  <button onClick={() => setDeleteTarget(c)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-danger hover:bg-danger-light transition-all flex-shrink-0">
                    <span className="material-icons-round text-sm">delete</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={`Item "${deleteTarget.item}" akan dihapus permanen dari checklist.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Copy modal */}
      {copyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(22,22,42,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-card-hover flex flex-col max-h-[85vh] animate-[fadeUp_0.2s_ease]">
            {/* Header */}
            <div className="p-5 border-b border-surface-border flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-brand-pale flex items-center justify-center flex-shrink-0">
                <span className="material-icons-round text-brand text-xl">content_copy</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-extrabold text-ink">Salin Item Checklist</div>
                <div className="text-[11px] text-ink-3">
                  ke <span className="font-bold text-brand">{lokasiList.find(l => l.id === lokasiId)?.nama}</span>
                  {copySelected.size > 0 && <span className="ml-1 text-ink-2">· {copySelected.size} dipilih</span>}
                </div>
              </div>
              <button onClick={() => setCopyModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-surface transition-all">
                <span className="material-icons-round text-lg">close</span>
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Lokasi sumber */}
              <div className="w-36 flex-shrink-0 border-r border-surface-border p-3 flex flex-col gap-1 overflow-y-auto">
                <div className="text-[10px] font-bold text-ink-3 uppercase tracking-wider mb-1 px-1">Dari lokasi</div>
                {lokasiList.filter(l => l.id !== lokasiId).map(l => (
                  <button key={l.id} onClick={() => loadCopyFromItems(l.id)}
                    className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      copyFrom === l.id ? 'bg-brand text-white' : 'text-ink-2 hover:bg-brand-pale hover:text-brand'
                    }`}>
                    {l.nama}
                  </button>
                ))}
              </div>

              {/* Item list */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
                {!copyFrom && (
                  <div className="flex-1 flex items-center justify-center text-ink-3 text-xs text-center py-8">
                    Pilih lokasi sumber di kiri
                  </div>
                )}
                {copyFrom && copyFromItems.length === 0 && (
                  <div className="text-center text-ink-3 text-xs py-8">Tidak ada item</div>
                )}
                {copyFrom && copyFromItems.length > 0 && (
                  <>
                    <button onClick={() => {
                      if (copySelected.size === copyFromItems.length) setCopySelected(new Set())
                      else setCopySelected(new Set(copyFromItems.map(i => i.id)))
                    }} className="text-[11px] font-bold text-brand hover:underline text-left px-1 mb-1">
                      {copySelected.size === copyFromItems.length ? 'Batal pilih semua' : 'Pilih semua'}
                    </button>
                    {copyFromItems.map(item => (
                      <button key={item.id} onClick={() => toggleCopyItem(item.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                          copySelected.has(item.id)
                            ? 'border-brand bg-brand-pale'
                            : 'border-surface-border hover:border-brand/30'
                        }`}>
                        <span className={`material-icons-round text-base flex-shrink-0 ${copySelected.has(item.id) ? 'text-brand' : 'text-ink-3'}`}>
                          {copySelected.has(item.id) ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-ink truncate">{item.item}</div>
                          <div className="text-[10px] text-ink-3">
                            {item.tipe === 'non_bobot' ? '· Non-Bobot' : `· Bobot ${item.bobot}`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-surface-border flex-shrink-0 flex flex-col gap-2">
              {copyResult && (
                <div className={`rounded-xl px-3 py-2 text-[11px] font-semibold ${
                  copyResult.startsWith('Gagal') ? 'bg-danger-light text-danger' : 'bg-success-light text-success'
                }`}>
                  {copyResult}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setCopyModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Tutup</button>
                <button onClick={handleCopy} disabled={copySelected.size === 0 || copying}
                  className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-50">
                  {copying ? 'Menyalin...' : `Salin ${copySelected.size > 0 ? `(${copySelected.size})` : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── TAB: SCORE CONFIG ─────────────────────────────────────────
function ScoreTab() {
  const [items, setItems]   = useState<ScoreConfig[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm]     = useState({ label: '', deskripsi: '', warna: '#6b7280' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('score_config').select('*').order('nilai')
      .then(({ data }) => { if (data) setItems(data) })
  }, [])

  async function handleSave() {
    if (!editId || !form.label.trim()) return
    setSaving(true)
    await fetch(`/api/settings/score/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: form.label, deskripsi: form.deskripsi, warna: form.warna }),
    })
    const { data } = await supabase.from('score_config').select('*').order('nilai')
    if (data) setItems(data)
    setEditId(null); setForm({ label: '', deskripsi: '', warna: '#6b7280' })
    setSaving(false)
  }

  return (
    <div className="card fade-up">
      <div className="card-head flex items-center gap-3">
        <div className="ico-wrap ico-brand"><span className="material-icons-round">star</span></div>
        <div>
          <div className="text-sm font-bold text-ink">Konfigurasi Skor</div>
          <div className="text-[11px] text-ink-3">Edit label & deskripsi nilai 0–4</div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {editId && (
          <div className="flex flex-col gap-2 p-3 bg-brand-pale rounded-2xl">
            <div className="text-xs font-bold text-brand">Edit Skor {items.find(i => i.id === editId)?.nilai}</div>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Label singkat..." className="inp text-xs" />
            <input value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
              placeholder="Deskripsi lengkap..." className="inp text-xs" />
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-ink-2">Warna:</label>
              <input type="color" value={form.warna} onChange={e => setForm(f => ({ ...f, warna: e.target.value }))}
                className="w-10 h-8 rounded-lg border border-surface-border cursor-pointer" />
              <span className="text-[11px] font-mono text-ink-3">{form.warna}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditId(null)} className="btn-secondary flex-1 text-xs py-2">Batal</button>
              <button onClick={handleSave} disabled={saving || !form.label}
                className="btn-primary flex-1 text-xs py-2 disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Update'}
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {items.map(sc => (
            <div key={sc.id} className="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-white">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-extrabold flex-shrink-0"
                style={{ background: (sc.warna ?? '#6b7280') + '20', color: sc.warna ?? '#6b7280' }}>
                {sc.nilai}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-ink">{sc.label}</div>
                {sc.deskripsi && <div className="text-[11px] text-ink-3 line-clamp-1">{sc.deskripsi}</div>}
              </div>
              <button onClick={() => { setEditId(sc.id); setForm({ label: sc.label, deskripsi: sc.deskripsi ?? '', warna: sc.warna ?? '#6b7280' }) }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-brand hover:bg-brand-pale transition-all">
                <span className="material-icons-round text-sm">edit</span>
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ink-3 text-center">Nilai 0–4 tidak dapat ditambah/dihapus, hanya label & warna yang bisa diedit.</p>
      </div>
    </div>
  )
}
