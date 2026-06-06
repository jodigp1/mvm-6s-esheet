import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  const { items } = await req.json() // [{ id, urutan }]
  const sb = supabaseAdmin()
  await Promise.all(
    items.map(({ id, urutan }: { id: string; urutan: number }) =>
      sb.from('members').update({ urutan }).eq('id', id)
    )
  )
  return NextResponse.json({ ok: true })
}
