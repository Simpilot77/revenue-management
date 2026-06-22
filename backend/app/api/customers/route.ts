import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id,guest_name,company_name,guest_email,guest_phone,nationality,house_name,channel_name,checkin_date,checkout_date,nights,total_price,status,invoice_number,is_owner_block')
    .not('guest_name', 'is', null)
    .or('is_owner_block.is.null,is_owner_block.eq.false')
    .order('checkin_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by guest_name
  const map: Record<string, any> = {}
  for (const b of bookings || []) {
    const key = (b.guest_name || '').trim().toLowerCase()
    if (!key) continue
    if (!map[key]) {
      map[key] = {
        guest_name: b.guest_name,
        company_name: b.company_name,
        guest_email: b.guest_email,
        guest_phone: b.guest_phone,
        nationality: b.nationality,
        bookings_count: 0,
        total_revenue: 0,
        nights_total: 0,
        last_checkin: null,
        bookings: [],
      }
    }
    const c = map[key]
    if (!c.company_name && b.company_name) c.company_name = b.company_name
    if (!c.guest_email && b.guest_email) c.guest_email = b.guest_email
    if (!c.guest_phone && b.guest_phone) c.guest_phone = b.guest_phone
    if (!c.nationality && b.nationality) c.nationality = b.nationality
    c.bookings_count++
    c.total_revenue += parseFloat(b.total_price || 0)
    c.nights_total += b.nights || 0
    if (!c.last_checkin || b.checkin_date > c.last_checkin) c.last_checkin = b.checkin_date
    c.bookings.push(b)
  }

  const customers = Object.values(map).sort((a: any, b: any) => (b.last_checkin || '') > (a.last_checkin || '') ? 1 : -1)
  return NextResponse.json(customers)
}
