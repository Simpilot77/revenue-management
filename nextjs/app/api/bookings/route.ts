import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const houseId = searchParams.get('house_id')
  const status = searchParams.get('status')
  const paymentStatus = searchParams.get('payment_status')
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') ?? '25')
  const page = parseInt(searchParams.get('page') ?? '1')
  const offset = (page - 1) * limit

  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase.from('bookings').select('*', { count: 'exact' }).order('checkin_date', { ascending: false }).range(offset, offset + limit - 1)
  if (houseId) query = query.eq('house_id', houseId)
  if (status) query = query.eq('status', status)
  if (paymentStatus) query = query.eq('payment_status', paymentStatus)
  if (search) query = query.or(`guest_name.ilike.%${search}%,company_name.ilike.%${search}%,invoice_number.ilike.%${search}%`)
  // Overlap filter: bookings that overlap [from, to] range
  if (from) query = query.gt('checkout_date', from)
  if (to) query = query.lte('checkin_date', to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count ?? 0 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { data, error } = await supabase.from('bookings').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
