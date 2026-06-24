import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const email = req.nextUrl.searchParams.get('email')
  const name = req.nextUrl.searchParams.get('name')

  if (!email && !name) {
    return NextResponse.json({ error: 'Parameter "email" oder "name" erforderlich' }, { status: 400 })
  }

  let query = supabase
    .from('bookings')
    .select('id,guest_name,guest_email,guest_phone,company_name,nationality,house_name,checkin_date,checkout_date,nights,total_price,status,channel_name,created_at')
    .order('checkin_date', { ascending: false })

  if (email) query = query.ilike('guest_email', email)
  if (name) query = query.ilike('guest_name', `%${name}%`)

  const { data: bookings, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id,invoice_number,type,brutto_total,invoice_date,booking_id')
    .in('booking_id', (bookings || []).map(b => b.id))

  const response = {
    auskunft_datum: new Date().toISOString(),
    hinweis: 'Datenauskunft gemäß Art. 15 DSGVO',
    person: {
      name: bookings?.[0]?.guest_name || name,
      email: bookings?.[0]?.guest_email || email,
      phone: bookings?.[0]?.guest_phone || null,
      company: bookings?.[0]?.company_name || null,
      nationality: bookings?.[0]?.nationality || null,
    },
    buchungen: (bookings || []).map(b => ({
      buchungs_id: b.id,
      haus: b.house_name,
      checkin: b.checkin_date,
      checkout: b.checkout_date,
      naechte: b.nights,
      betrag: b.total_price,
      status: b.status,
      kanal: b.channel_name,
      erstellt_am: b.created_at,
    })),
    rechnungen: (invoices || []).map(i => ({
      rechnungsnummer: i.invoice_number,
      typ: i.type,
      betrag: i.brutto_total,
      datum: i.invoice_date,
    })),
    gespeicherte_datenkategorien: [
      'Name', 'E-Mail-Adresse', 'Telefonnummer', 'Firma',
      'Nationalität', 'Buchungsdaten', 'Rechnungsdaten',
    ],
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)',
    aufbewahrungsfrist: '10 Jahre nach Checkout (steuerliche Aufbewahrungspflicht, § 147 AO)',
    empfaenger: ['Supabase Inc. (Auftragsverarbeiter, EU-Rechenzentrum Frankfurt)'],
  }

  await supabase.from('dsgvo_audit_log').insert({
    action: 'auskunft',
    details: { email, name, bookings_count: bookings?.length || 0 },
  })

  return NextResponse.json(response)
}
