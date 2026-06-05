// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const appPassword = process.env.APP_PASSWORD
  const tokenSecret = process.env.AUTH_TOKEN_SECRET

  if (!appPassword || !tokenSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (password !== appPassword) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })

  // Set httpOnly cookie — tidak bisa diakses JS di browser (lebih aman)
  res.cookies.set('audit_auth', tokenSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,  // 7 hari
    path: '/',
  })

  return res
}
