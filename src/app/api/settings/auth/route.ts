import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: 'Password diperlukan' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data } = await sb
    .from('app_config')
    .select('value')
    .eq('key', 'settings_password')
    .single()

  const storedPassword = data?.value ?? process.env.SETTINGS_PASSWORD ?? 'admin'

  if (password !== storedPassword) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
