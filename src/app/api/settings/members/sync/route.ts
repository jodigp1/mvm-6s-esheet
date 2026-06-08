import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { nama, sn_camera, sn_ht, cam_required, ht_required } = await req.json()
  const sb = supabaseAdmin()

  const { error, count } = await sb
    .from('members')
    .update({ sn_camera, sn_ht, cam_required, ht_required })
    .eq('nama', nama)
    .eq('aktif', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count })
}
