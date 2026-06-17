import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const log: string[] = []

  try {
    // 1. Check settings
    const { data: settings, error: sErr } = await supabase.from('company_settings').select('*').order('id').limit(1).maybeSingle()
    if (sErr) return NextResponse.json({ step: 'settings', error: sErr.message, log })
    log.push('✅ Settings geladen')

    const extra = settings?.extra_settings || {}
    const apiKey = extra.lodgify_api_key || ''
    const houseMapRaw = extra.lodgify_house_map || '{}'
    log.push(`API-Key vorhanden: ${apiKey ? 'JA (' + apiKey.slice(0,8) + '...)' : 'NEIN'}`)
    log.push(`Haus-Map: ${houseMapRaw}`)

    if (!apiKey) return NextResponse.json({ step: 'api_key', error: 'Kein API-Key hinterlegt', log })

    // 2. Test Lodgify properties endpoint
    const propsRes = await fetch('https://api.lodgify.com/v2/properties', {
      headers: { 'X-ApiKey': apiKey, 'Accept': 'application/json' },
    })
    log.push(`Lodgify /v2/properties → HTTP ${propsRes.status}`)
    if (!propsRes.ok) {
      const text = await propsRes.text().catch(() => '')
      return NextResponse.json({ step: 'lodgify_properties', error: `HTTP ${propsRes.status}: ${text.slice(0,300)}`, log })
    }
    const propsData = await propsRes.json()
    const props = Array.isArray(propsData) ? propsData : (propsData.items || [])
    log.push(`Properties: ${props.length} gefunden — IDs: ${props.map((p: any) => p.id).join(', ')}`)

    // 3. Test reservations endpoint (first page only)
    const resRes = await fetch('https://api.lodgify.com/v1/reservation?offset=0&limit=5', {
      headers: { 'X-ApiKey': apiKey, 'Accept': 'application/json' },
    })
    log.push(`Lodgify /v1/reservation → HTTP ${resRes.status}`)
    if (!resRes.ok) {
      const text = await resRes.text().catch(() => '')
      return NextResponse.json({ step: 'lodgify_reservations', error: `HTTP ${resRes.status}: ${text.slice(0,300)}`, log })
    }
    const resData = await resRes.json()
    const items = resData.items || []
    log.push(`Reservierungen: total=${resData.total}, erste 5 IDs: ${items.map((r: any) => r.id).join(', ')}`)

    if (items.length > 0) {
      const sample = items[0]
      log.push(`Sample-Buchung: id=${sample.id}, status=${sample.status}, source=${sample.source}, arrival=${sample.arrival}, departure=${sample.departure}, total=${sample.total_amount}`)
      log.push(`Sample guest: ${JSON.stringify(sample.guest_name || sample.guest || 'kein Gast')}`)
    }

    return NextResponse.json({ ok: true, log })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, log })
  }
}
