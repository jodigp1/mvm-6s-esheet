// app/api/sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const sb = supabaseAdmin()
  const { error } = await sb.from('audit_sessions').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
