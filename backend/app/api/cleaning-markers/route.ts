import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  let query = supabase.from('cleaning_markers').select('*')
  if (from) query = query.gte('marker_date', from)
  if (to)   query = query.lte('marker_date', to)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const body = await req.json()

  // For manual markers (no booking_id), conflict key is house_id+marker_date.
  // For booking-linked markers, conflict key is booking_id+marker_date.
  if (body.booking_id) {
    const { data, error } = await supabase
      .from('cleaning_markers')
      .upsert(body, { onConflict: 'booking_id,marker_date' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  // Manual marker — delete existing for same house+date first, then insert fresh
  if (body.house_id && body.marker_date) {
    await supabase
      .from('cleaning_markers')
      .delete()
      .eq('house_id', body.house_id)
      .eq('marker_date', body.marker_date)
      .is('booking_id', null)
  }
  const { data, error } = await supabase
    .from('cleaning_markers')
    .insert(body)
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const bookingId = searchParams.get('booking_id')
  const date = searchParams.get('date')
  let q = supabase.from('cleaning_markers').delete()
  if (id) q = q.eq('id', id)
  else if (bookingId && date) q = q.eq('booking_id', bookingId).eq('marker_date', date)
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
