import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const houseId = searchParams.get('house_id')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') ?? '500')

  let query = supabase.from('bookings').select('*').limit(limit).order('checkin_date', { ascending: false })
  if (houseId) query = query.eq('house_id', houseId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: data.length })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { data, error } = await supabase.from('bookings').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
