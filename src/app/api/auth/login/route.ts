// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const tokenSecret = process.env.AUTH_TOKEN_SECRET
  if (!tokenSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Cek password dari DB dulu, fallback ke env var
  let appPassword = process.env.APP_PASSWORD ?? ''
  try {
    const sb = supabaseAdmin()
    const { data } = await sb
      .from('app_config')
      .select('value')
      .eq('key', 'app_password')
      .single()
    if (data?.value) appPassword = data.value
  } catch {
    // gunakan env var sebagai fallback
  }

  if (!appPassword || password !== appPassword) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('audit_auth', tokenSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return res
}
