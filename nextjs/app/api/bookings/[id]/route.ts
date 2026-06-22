import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// Fields that Lodgify sync can overwrite — tracked in manual_fields when user changes them
const SYNC_OWNED_FIELDS = [
  'guest_name','guest_email','guest_phone','company_name','nationality',
  'total_price','daily_rate','payment_status','payment_method',
  'internal_notes','guest_notes','status','guest_count','adults','children',
]

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  // Track which sync-owned fields the user manually changed
  const { data: current } = await supabase.from('bookings').select('*').eq('id', id).single()
  if (current) {
    const existingManual: string[] = current.manual_fields || []
    const newManual = new Set(existingManual)
    for (const field of SYNC_OWNED_FIELDS) {
      if (field in body && body[field] !== current[field]) newManual.add(field)
    }
    body.manual_fields = [...newManual]
  }

  const { data, error } = await supabase.from('bookings').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  // Save external_reference before deleting so this booking is skipped on future syncs
  const { data: booking } = await supabase.from('bookings').select('external_reference').eq('id', id).single()
  if (booking?.external_reference) {
    await supabase.from('deleted_bookings').upsert({ external_reference: booking.external_reference })
  }
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
