import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { email, name, confirm } = await req.json()

  if (!email && !name) {
    return NextResponse.json({ error: 'Parameter "email" oder "name" erforderlich' }, { status: 400 })
  }
  if (!confirm) {
    return NextResponse.json({ error: 'Bestätigung erforderlich (confirm: true)' }, { status: 400 })
  }

  let query = supabase.from('bookings').select('id,guest_name,guest_email,checkout_date')
  if (email) query = query.ilike('guest_email', email)
  if (name) query = query.ilike('guest_name', `%${name}%`)

  const { data: bookings, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!bookings?.length) return NextResponse.json({ message: 'Keine Daten gefunden' })

  const now = new Date()
  const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())
  const canDelete = bookings.filter(b => !b.checkout_date || new Date(b.checkout_date) < tenYearsAgo)
  const mustRetain = bookings.filter(b => b.checkout_date && new Date(b.checkout_date) >= tenYearsAgo)

  if (canDelete.length > 0) {
    await supabase.from('bookings')
      .update({ guest_name: 'Anonymisiert', guest_email: null, guest_phone: null, company_name: null, nationality: null })
      .in('id', canDelete.map(b => b.id))
  }

  if (mustRetain.length > 0) {
    await supabase.from('bookings')
      .update({ guest_email: null, guest_phone: null })
      .in('id', mustRetain.map(b => b.id))
  }

  await supabase.from('dsgvo_audit_log').insert({
    action: 'loeschung',
    details: {
      email, name,
      vollstaendig_anonymisiert: canDelete.length,
      kontaktdaten_geloescht: mustRetain.length,
      aufbewahrungspflicht_bis: mustRetain.map(b => ({
        id: b.id,
        checkout: b.checkout_date,
        aufbewahrung_bis: b.checkout_date ? new Date(new Date(b.checkout_date).getFullYear() + 10, 0, 1).toISOString().slice(0, 10) : null,
      })),
    },
  })

  return NextResponse.json({
    message: 'Löschung durchgeführt',
    vollstaendig_anonymisiert: canDelete.length,
    kontaktdaten_geloescht: mustRetain.length,
    hinweis_aufbewahrungspflicht: mustRetain.length > 0
      ? `${mustRetain.length} Buchung(en) unterliegen noch der steuerlichen Aufbewahrungspflicht (§ 147 AO). Name und Buchungsdaten werden nach Ablauf automatisch anonymisiert. E-Mail und Telefon wurden bereits jetzt gelöscht.`
      : undefined,
  })
}
