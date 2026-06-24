import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('anonymize_old_bookings', { retention_years: 10 })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('dsgvo_audit_log').insert({
    action: 'auto_anonymisierung',
    details: { anonymisiert: data },
  })

  return NextResponse.json({
    message: `${data} Buchung(en) anonymisiert`,
    anonymisiert: data,
  })
}
