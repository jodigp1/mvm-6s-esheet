'use client'
// app/login/page.tsx

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginContent() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const from         = searchParams.get('from') || '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push(from)
      router.refresh()
    } else {
      const json = await res.json()
      setError(json.error || 'Login gagal')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-content-center px-5"
         style={{ backgroundImage: 'radial-gradient(ellipse 70% 50% at 10% -10%, rgba(124,110,245,.15) 0%, transparent 60%)' }}>
      <div className="w-full max-w-sm mx-auto fade-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-brand mx-auto mb-4 flex items-center justify-center shadow-card-hover">
            <span className="material-icons-round text-white text-2xl">verified</span>
          </div>
          <h1 className="text-xl font-extrabold text-ink tracking-tight">6S Audit MVM</h1>
          <p className="text-xs text-ink-3 mt-1">Sistem Audit Lingkungan Kerja</p>
        </div>

        {/* Form */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-ink-2 mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                className="inp"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-danger bg-danger-light px-3 py-2.5 rounded-xl">
                <span className="material-icons-round text-sm">error_outline</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading
                ? <><span className="material-icons-round text-sm animate-spin">sync</span> Masuk...</>
                : <><span className="material-icons-round text-sm">lock_open</span> Masuk</>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-ink-3 mt-5">Internal Tool</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
