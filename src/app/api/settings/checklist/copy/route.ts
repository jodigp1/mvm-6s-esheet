import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Copy checklist items from one lokasi to another.
// Only items whose `item` name doesn't already exist in the target are inserted.
export async function POST(req: NextRequest) {
  const { from_lokasi_id, to_lokasi_id, item_ids } = await req.json()
  if (!from_lokasi_id || !to_lokasi_id || from_lokasi_id === to_lokasi_id)
    return NextResponse.json({ error: 'Invalid lokasi' }, { status: 400 })
  if (!Array.isArray(item_ids) || item_ids.length === 0)
    return NextResponse.json({ error: 'Pilih minimal 1 item' }, { status: 400 })

  const sb = supabaseAdmin()

  const [{ data: sourceItems }, { data: targetItems }] = await Promise.all([
    sb.from('checklist_items').select('*').in('id', item_ids),
    sb.from('checklist_items').select('item').eq('lokasi_id', to_lokasi_id).eq('aktif', true),
  ])

  if (!sourceItems?.length) return NextResponse.json({ ok: true, copied: 0 })

  const existingNames = new Set((targetItems ?? []).map((i: { item: string }) => i.item.toLowerCase()))
  const toInsert = sourceItems
    .filter(i => !existingNames.has(i.item.toLowerCase()))
    .map(({ id: _id, lokasi_id: _lid, ...rest }) => ({ ...rest, lokasi_id: to_lokasi_id }))

  if (!toInsert.length) return NextResponse.json({ ok: true, copied: 0 })

  const { error } = await sb.from('checklist_items').insert(toInsert as any)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, copied: toInsert.length })
}
