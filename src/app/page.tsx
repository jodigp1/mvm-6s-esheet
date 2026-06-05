'use client'
// app/page.tsx — Setup Sesi (halaman utama)

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Lokasi, Member, AuditSession } from '@/types/database'
import Link from 'next/link'

export default function SetupSesiPage() {
  const router = useRouter()

  // Data dari Supabase
  const [lokasiList, setLokasiList]   = useState<Lokasi[]>([])
  const [memberList, setMemberList]   = useState<Member[]>([])
  const [draftSesi, setDraftSesi]     = useState<(AuditSession & { lokasi: { nama: string } })[]>([])

  // Form state
  const [lokasiId,  setLokasiId]   = useState('')
  const [tanggal,   setTanggal]    = useState(new Date().toISOString().split('T')[0])
  const [auditor1,  setAuditor1]   = useState('')
  const [auditor2,  setAuditor2]   = useState('')
  const [loading,   setLoading]    = useState(false)

  const lokasiSelected = lokasiList.find(l => l.id === lokasiId)
  const butuhDuaPic    = lokasiSelected ? lokasiSelected.jumlah_pic >= 2 : false

  // Load lokasi saat mount
  useEffect(() => {
    supabase.from('lokasi').select('*').eq('aktif', true).order('nama')
      .then(({ data }) => {
        if (data) setLokasiList(data)
      })

    // Load draft sessions
    fetch('/api/sessions')
      .then(r => r.json())
      .then(json => { if (json.ok) setDraftSesi(json.data) })
  }, [])

  // Load members kalau lokasi berubah
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

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lokasi_id: lokasiId, tanggal, auditor1, auditor2: butuhDuaPic ? auditor2 : null }),
    })
    const json = await res.json()
    if (!json.ok) { alert('Gagal membuat sesi: ' + json.error); setLoading(false); return }

    // Simpan state sesi ke sessionStorage untuk dipakai di /audit
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

  function handleResume(sesi: AuditSession & { lokasi: { nama: string }, audit_results: { auditee_name: string }[] }) {
    // Re-load member list untuk lokasi ini lalu resume
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

  return (
    <div className="min-h-screen">
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
              { href: '/dashboard', icon: 'bar_chart', label: 'Dashboard' },
              { href: '/history',   icon: 'history',   label: 'Riwayat' },
              { href: '/settings',  icon: 'settings',  label: 'Settings' },
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

      <main className="max-w-lg mx-auto px-5 py-8 pb-20 flex flex-col gap-4">

        {/* Banner resume draft */}
        {draftSesi.length > 0 && (
          <div className="card border-warning bg-warning/5 fade-up">
            <div className="card-head">
              <div className="flex items-center gap-3">
                <div className="ico-wrap bg-warning/10 text-warning"><span className="material-icons-round">pending_actions</span></div>
                <div>
                  <div className="text-sm font-bold text-ink">Sesi audit belum selesai</div>
                  <div className="text-[11px] text-ink-3">Lanjutkan atau buat sesi baru</div>
                </div>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {draftSesi.slice(0, 3).map((sesi: any) => (
                <div key={sesi.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-surface-border">
                  <div>
                    <div className="text-xs font-bold text-ink">{sesi.lokasi?.nama} — {new Date(sesi.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="text-[11px] text-ink-3">PIC: {sesi.auditor1}{sesi.auditor2 ? ' & ' + sesi.auditor2 : ''} · {sesi.audit_results?.length ?? 0} sudah diisi</div>
                  </div>
                  <button onClick={() => handleResume(sesi)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1">
                    <span className="material-icons-round text-sm">play_arrow</span> Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form setup */}
        <div className="card fade-up" style={{ animationDelay: '0.05s' }}>
          <div className="card-head flex items-center gap-3">
            <div className="ico-wrap ico-brand"><span className="material-icons-round">add_task</span></div>
            <div>
              <div className="text-sm font-bold text-ink">Buat Sesi Audit Baru</div>
              <div className="text-[11px] text-ink-3">Isi detail sesi sebelum mulai audit</div>
            </div>
          </div>
          <div className="p-5 flex flex-col gap-4">

            {/* Lokasi */}
            <div>
              <label className="text-xs font-bold text-ink-2 mb-1.5 block">Lokasi Audit</label>
              <select value={lokasiId} onChange={e => setLokasiId(e.target.value)} className="inp">
                <option value="">— Pilih lokasi —</option>
                {lokasiList.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}
              </select>
            </div>

            {/* Tanggal */}
            <div>
              <label className="text-xs font-bold text-ink-2 mb-1.5 block">Tanggal Audit</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="inp" />
            </div>

            {/* Auditor */}
            {lokasiId && (
              <>
                <div>
                  <label className="text-xs font-bold text-ink-2 mb-1.5 block">
                    PIC Auditor {butuhDuaPic ? '1' : ''}
                  </label>
                  <select value={auditor1} onChange={e => setAuditor1(e.target.value)} className="inp">
                    <option value="">— Pilih auditor —</option>
                    {auditorOptions.filter(n => n !== auditor2).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                {butuhDuaPic && (
                  <div>
                    <label className="text-xs font-bold text-ink-2 mb-1.5 block">PIC Auditor 2</label>
                    <select value={auditor2} onChange={e => setAuditor2(e.target.value)} className="inp">
                      <option value="">— Pilih auditor —</option>
                      {auditorOptions.filter(n => n !== auditor1).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}

                <div className="p-3 bg-brand-pale rounded-2xl flex items-center gap-2">
                  <span className="material-icons-round text-brand text-base">group</span>
                  <span className="text-xs text-brand font-semibold">{memberList.length} auditee terdaftar di lokasi ini</span>
                </div>
              </>
            )}

            <button
              onClick={handleStart}
              disabled={loading || !lokasiId || !tanggal || !auditor1 || (butuhDuaPic && !auditor2)}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading
                ? <><span className="material-icons-round text-sm animate-spin">sync</span> Mempersiapkan...</>
                : <><span className="material-icons-round text-sm">play_arrow</span> Mulai Audit</>
              }
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}
