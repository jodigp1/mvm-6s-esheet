import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST { type: 'app' | 'settings', new_password: string }
export async function POST(req: NextRequest) {
  const { type, new_password } = await req.json()

  if (!type || !new_password?.trim()) {
    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 })
  }

  if (type !== 'app' && type !== 'settings') {
    return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 })
  }

  const key = type === 'app' ? 'app_password' : 'settings_password'
  const sb = supabaseAdmin()

  const { error } = await sb
    .from('app_config')
    .upsert({ key, value: new_password.trim() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
