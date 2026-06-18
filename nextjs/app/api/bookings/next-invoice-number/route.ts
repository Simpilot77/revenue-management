import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const houseId = searchParams.get('house_id')

  if (!houseId) return NextResponse.json({ error: 'house_id required' }, { status: 400 })

  const { data: house } = await supabase.from('houses').select('house_number').eq('id', houseId).single()
  const prefix = house?.house_number || houseId
  const year = new Date().getFullYear().toString()

  const { data: invoices } = await supabase.from('invoices').select('invoice_number').ilike('invoice_number', `${prefix}-${year}-%`)
  const { data: bookings } = await supabase.from('bookings').select('invoice_number').ilike('invoice_number', `${prefix}-${year}-%`)

  const allNums = [
    ...(invoices || []).map((r: any) => r.invoice_number),
    ...(bookings || []).map((r: any) => r.invoice_number),
  ]
  const highest = allNums.reduce((max, inv) => {
    const parts = String(inv || '').split('-')
    const n = parts.length >= 3 ? parseInt(parts[2]) : 0
    return isNaN(n) ? max : Math.max(max, n)
  }, 999)

  const next = `${prefix}-${year}-${String(highest + 1).padStart(4, '0')}`
  return NextResponse.json({ invoice_number: next })
}
