// middleware.ts — cek cookie auth sebelum masuk ke semua halaman
// Kalau belum login → redirect ke /login

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Halaman yang tidak butuh auth
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip public paths & static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Cek cookie
  const authToken = request.cookies.get('audit_auth')?.value
  const expectedToken = process.env.AUTH_TOKEN_SECRET

  if (!authToken || authToken !== expectedToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
