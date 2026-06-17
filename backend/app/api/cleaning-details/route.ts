import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  let q = supabase.from('cleaning_details').select('*')
  if (bookingId) q = q.eq('booking_id', bookingId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const body = await req.json()
  const { booking_id, ...rest } = body
  const { data, error } = await supabase
    .from('cleaning_details')
    .upsert({ booking_id, ...rest }, { onConflict: 'booking_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
