import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  const { items } = await req.json() // [{ id, nomor }]
  const sb = supabaseAdmin()
  await Promise.all(
    items.map(({ id, nomor }: { id: string; nomor: number }) =>
      sb.from('checklist_items').update({ nomor }).eq('id', id)
    )
  )
  return NextResponse.json({ ok: true })
}
