'use client'
// app/settings/page.tsx

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Lokasi, Member, ChecklistItem, ScoreConfig } from '@/types/database'

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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('lokasi')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'lokasi',    label: 'Lokasi',    icon: 'location_on' },
    { id: 'member',    label: 'Member',    icon: 'group' },
    { id: 'checklist', label: 'Checklist', icon: 'checklist' },
    { id: 'score',     label: 'Skor',      icon: 'star' },
  ]

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
            <div className="text-[15px] font-extrabold text-ink">Pengaturan</div>
            <div className="text-[11px] text-ink-3">Lokasi · Member · Checklist · Skor</div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">
        {/* Tab nav */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#E8E6FF] rounded-2xl border border-surface-border">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-ink-2 hover:text-brand'
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
function LokasiTab() {
  const [list, setList]       = useState<Lokasi[]>([])
  const [nama, setNama]       = useState('')
  const [kode, setKode]       = useState('')
  const [pic, setPic]         = useState(1)
  const [saving, setSaving]   = useState(false)
  const [editId, setEditId]   = useState<string | null>(null)
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
        body: JSON.stringify({ nama, kode: kode.toUpperCase(), jumlah_pic: pic }),
      })
    } else {
      await fetch('/api/settings/lokasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, kode: kode.toUpperCase(), jumlah_pic: pic }),
      })
    }
    setNama(''); setKode(''); setPic(1); setEditId(null)
    await load(); setSaving(false)
  }

  function handleEdit(l: Lokasi) {
    setEditId(l.id); setNama(l.nama); setKode(l.kode); setPic(l.jumlah_pic)
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

          {/* Form */}
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
            <div className="flex gap-2 mt-1">
              {editId && (
                <button onClick={() => { setEditId(null); setNama(''); setKode(''); setPic(1) }}
                  className="btn-secondary flex-1 text-xs py-2">Batal</button>
              )}
              <button onClick={handleSave} disabled={saving || !nama || !kode}
                className="btn-primary flex-1 text-xs py-2 disabled:opacity-50">
                {saving ? 'Menyimpan...' : editId ? 'Update' : 'Tambah'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex flex-col gap-2">
            {list.map(l => (
              <div key={l.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${l.aktif ? 'border-surface-border bg-white' : 'border-surface-border bg-surface opacity-60'}`}>
                <div className="w-8 h-8 rounded-xl bg-brand-pale flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-extrabold text-brand">{l.kode}</span>
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

// ── TAB: MEMBER ───────────────────────────────────────────────
function MemberTab() {
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([])
  const [lokasiId,   setLokasiId]   = useState('')
  const [members,    setMembers]    = useState<Member[]>([])
  const [newName,    setNewName]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [dragIdx,    setDragIdx]    = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)

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
    setNewName('')
    const { data } = await supabase.from('members').select('*').eq('lokasi_id', lokasiId).eq('aktif', true).order('urutan')
    if (data) setMembers(data)
    setSaving(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await fetch(`/api/settings/members/${deleteTarget.id}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  async function saveOrder(newList: Member[]) {
    await fetch('/api/settings/members/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: newList.map((m, i) => ({ id: m.id, urutan: i + 1 })) }),
    })
  }

  return (
    <>
      <div className="card fade-up">
        <div className="card-head flex items-center gap-3">
          <div className="ico-wrap ico-brand"><span className="material-icons-round">group</span></div>
          <div>
            <div className="text-sm font-bold text-ink">Kelola Member</div>
            <div className="text-[11px] text-ink-3">Tambah / hapus / urutkan auditee</div>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-4">

          {/* Pilih lokasi */}
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

          {/* List member */}
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
            {members.map((m, i) => (
              <div key={m.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={e => { e.preventDefault() }}
                onDrop={() => {
                  if (dragIdx === null || dragIdx === i) return
                  const newList = [...members]
                  const [moved] = newList.splice(dragIdx, 1)
                  newList.splice(i, 0, moved)
                  setMembers(newList)
                  setDragIdx(null)
                  saveOrder(newList)
                }}
                className="flex items-center gap-2 p-2.5 bg-surface rounded-xl border border-surface-border hover:border-brand/30 transition-all cursor-grab active:cursor-grabbing">
                <span className="material-icons-round text-ink-3 text-base">drag_indicator</span>
                <span className="w-5 h-5 rounded-md bg-brand-pale flex items-center justify-center text-[10px] font-bold text-brand flex-shrink-0">{i + 1}</span>
                <span className="flex-1 text-xs font-semibold text-ink">{m.nama}</span>
                <button onClick={() => setDeleteTarget(m)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-danger hover:bg-danger-light transition-all">
                  <span className="material-icons-round text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>

          {/* Add */}
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nama member baru..." className="inp text-xs flex-1" />
            <button onClick={handleAdd} disabled={saving || !newName}
              className="btn-primary text-xs px-4 disabled:opacity-50">Tambah</button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={`Member "${deleteTarget.nama}" akan dihapus dari daftar auditee.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
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
  const [form,       setForm]       = useState({ item: '', deskripsi: '', bobot: '1' })
  const [saving,     setSaving]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null)

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

  async function handleSave() {
    if (!form.item.trim()) return
    setSaving(true)
    if (editId) {
      await fetch(`/api/settings/checklist/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: form.item, deskripsi: form.deskripsi, bobot: parseFloat(form.bobot) || 1 }),
      })
    } else {
      await fetch('/api/settings/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lokasi_id: lokasiId, nomor: items.length + 1, item: form.item, deskripsi: form.deskripsi, bobot: parseFloat(form.bobot) || 1 }),
      })
    }
    setForm({ item: '', deskripsi: '', bobot: '1' }); setEditId(null)
    const { data } = await supabase.from('checklist_items').select('*').eq('lokasi_id', lokasiId).order('nomor')
    if (data) setItems(data)
    setSaving(false)
  }

  async function handleToggle(c: ChecklistItem) {
    await fetch(`/api/settings/checklist/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: !c.aktif }),
    })
    setItems(prev => prev.map(i => i.id === c.id ? { ...i, aktif: !c.aktif } : i))
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await fetch(`/api/settings/checklist/${deleteTarget.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <>
      <div className="card fade-up">
        <div className="card-head flex items-center gap-3">
          <div className="ico-wrap ico-brand"><span className="material-icons-round">checklist</span></div>
          <div>
            <div className="text-sm font-bold text-ink">Kelola Checklist</div>
            <div className="text-[11px] text-ink-3">Item & bobot per lokasi</div>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-4">

          {/* Pilih lokasi */}
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
          <div className="flex flex-col gap-2 p-3 bg-brand-pale rounded-2xl">
            <div className="text-xs font-bold text-brand">{editId ? 'Edit Item' : 'Tambah Item Baru'}</div>
            <input value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
              placeholder="Nama item checklist..." className="inp text-xs" />
            <input value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
              placeholder="Deskripsi (opsional)..." className="inp text-xs" />
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-ink-2 font-bold whitespace-nowrap">Bobot:</label>
              <input type="number" value={form.bobot} onChange={e => setForm(f => ({ ...f, bobot: e.target.value }))}
                min="0.1" max="5" step="0.1" className="inp text-xs w-24" />
              <span className="text-[11px] text-ink-3">(default: 1.0)</span>
            </div>
            <div className="flex gap-2">
              {editId && (
                <button onClick={() => { setEditId(null); setForm({ item: '', deskripsi: '', bobot: '1' }) }}
                  className="btn-secondary flex-1 text-xs py-2">Batal</button>
              )}
              <button onClick={handleSave} disabled={saving || !form.item}
                className="btn-primary flex-1 text-xs py-2 disabled:opacity-50">
                {saving ? 'Menyimpan...' : editId ? 'Update' : 'Tambah'}
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {items.map(c => (
              <div key={c.id} className={`flex items-start gap-2 p-3 rounded-xl border transition-all ${c.aktif ? 'border-surface-border bg-white' : 'border-surface-border bg-surface opacity-50'}`}>
                <span className="w-5 h-5 rounded-md bg-brand-pale flex items-center justify-center text-[10px] font-bold text-brand flex-shrink-0 mt-0.5">{c.nomor}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-ink">{c.item}</div>
                  {c.deskripsi && <div className="text-[11px] text-ink-3 truncate">{c.deskripsi}</div>}
                  <div className="text-[11px] text-ink-3">Bobot: {c.bobot}</div>
                </div>
                <button onClick={() => { setEditId(c.id); setForm({ item: c.item, deskripsi: c.deskripsi ?? '', bobot: String(c.bobot) }) }}
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
            ))}
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

        {/* Form edit */}
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

        {/* List score config */}
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
