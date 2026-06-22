import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const CHANNEL_MAP: Record<string, { id: number | null; name: string; short: string }> = {
  manual:            { id: 1,    name: 'Direkt',           short: 'DIREKT'  },
  direct:            { id: 1,    name: 'Direkt',           short: 'DIREKT'  },
  website:           { id: 1,    name: 'Direkt',           short: 'DIREKT'  },
  bookingcom:        { id: 2,    name: 'Booking.com',      short: 'BDC'     },
  booking:           { id: 2,    name: 'Booking.com',      short: 'BDC'     },
  airbnbintegration: { id: 3,    name: 'Airbnb',           short: 'AIRBNB'  },
  airbnb:            { id: 3,    name: 'Airbnb',           short: 'AIRBNB'  },
  hrs:               { id: 4,    name: 'HRS',              short: 'HRS'     },
  homeaway:          { id: 5,    name: 'Expedia/HomeAway', short: 'EXPEDIA' },
  expedia:           { id: 5,    name: 'Expedia',          short: 'EXPEDIA' },
  owner:             { id: null, name: 'Eigentümer',       short: 'OWNER'   },
  ownerblock:        { id: null, name: 'Eigentümer',       short: 'OWNER'   },
  blocked:           { id: null, name: 'Eigentümer',       short: 'OWNER'   },
}

const STATUS_MAP: Record<string, string> = {
  booked: 'bestaetigt', open: 'angefragt', bookingrequest: 'angefragt',
  tentative: 'angefragt', cancelled: 'storniert', canceled: 'storniert',
  declined: 'storniert', checkedin: 'eingecheckt', checkedout: 'ausgecheckt',
  closed: 'ausgecheckt', completed: 'ausgecheckt',
}

const OWNER_SOURCES = new Set(['owner', 'ownerblock', 'owneruse', 'blocked', 'maintenance', 'unavailable'])
const OWNER_TYPES   = new Set(['ownerblock', 'blocked', 'unavailable', 'maintenance'])

function clean(s: string) { return (s || '').toLowerCase().replace(/[\s._-]/g, '') }
function isOwnerBlock(r: any) {
  return !!(r.is_blocked || r.is_owner_block || OWNER_SOURCES.has(clean(r.source)) || OWNER_TYPES.has(clean(r.type)))
}
function getChannel(source: string) {
  const key = clean(source)
  return CHANNEL_MAP[key]
    || Object.entries(CHANNEL_MAP).find(([k]) => key.includes(k) || k.includes(key))?.[1]
    || { id: 7, name: source, short: source.slice(0, 6).toUpperCase() }
}
function dateStr(val: any) {
  if (!val) return ''
  return String(val).slice(0, 10)
}
function nightsBetween(a: string, b: string) {
  try { return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)) }
  catch { return 0 }
}

async function lodgifyGet(apiKey: string, path: string, params: Record<string, any> = {}) {
  const url = new URL('https://api.lodgify.com' + path)
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)))
  const res = await fetch(url.toString(), {
    headers: { 'X-ApiKey': apiKey, 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Lodgify ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

export async function POST(request: Request) {
  const supabase = await createClient()

  // mode: 'new_only' (default) = only insert/update, no deletes
  //       'full_sync'           = delete all bookings first, then re-import everything
  let mode = 'new_only'
  try { const body = await request.json(); mode = body.mode || 'new_only' } catch (_) {}

  // Load settings (API key + house map)
  const { data: settings } = await supabase.from('company_settings').select('*').order('id').limit(1).maybeSingle()
  const extra = settings?.extra_settings || {}
  const apiKey = extra.lodgify_api_key || ''
  const houseMapRaw = extra.lodgify_house_map || '{}'

  if (!apiKey) return NextResponse.json({ error: 'Kein Lodgify API-Schlüssel hinterlegt. Bitte zuerst in Einstellungen speichern.' }, { status: 400 })

  let houseMap: Record<string, number> = {}
  try { houseMap = JSON.parse(houseMapRaw) } catch (_) {}

  // Load houses from Supabase
  const { data: houses } = await supabase.from('houses').select('id, name, short_name')
  const houseList = houses || []

  // 1. Lodgify properties
  const rawProps = await lodgifyGet(apiKey, '/v2/properties')
  const propsList: any[] = Array.isArray(rawProps) ? rawProps : (rawProps.items || [])

  const propMap: Record<number, { house_id: number; house_name: string; house_short: string }> = {}
  propsList.forEach((p, idx) => {
    const pid = p.id
    const houseId = houseMap[String(pid)] ?? (idx + 1)
    const h = houseList.find(h => h.id === houseId)
    propMap[pid] = {
      house_id:   houseId,
      house_name: h?.name || p.name || `Haus ${houseId}`,
      house_short: h?.short_name || String.fromCharCode(65 + idx),
    }
  })

  // 2. All reservations (paginated)
  const allReservations: any[] = []
  const limit = 50
  let offset = 0
  while (true) {
    const data = await lodgifyGet(apiKey, '/v1/reservation', { offset, limit })
    const items: any[] = data.items || []
    if (!items.length) break
    allReservations.push(...items)
    const total = data.total ?? 0
    if (allReservations.length >= total || items.length < limit) break
    offset += limit
  }

  // 3. Transform
  const today = new Date().toISOString().slice(0, 10)
  const bookingsToUpsert: any[] = []

  for (const r of allReservations) {
    const arrival = dateStr(r.arrival)
    const departure = dateStr(r.departure)
    if (!arrival || !departure || arrival >= departure) continue

    const isBlock = isOwnerBlock(r)
    const pid = r.property_id || r.rooms?.[0]?.property_id
    const prop = (pid && propMap[pid]) ? propMap[pid] : (Object.values(propMap)[0] || { house_id: 1, house_name: 'Haus 1', house_short: 'A' })
    const channel = isBlock ? CHANNEL_MAP.owner : getChannel(r.source || '')
    const nights = r.nights || nightsBetween(arrival, departure)
    const statusRaw = (r.status || '').toLowerCase().replace(/[\s_]/g, '')
    const status = isBlock ? 'gesperrt' : (STATUS_MAP[statusRaw] || 'bestaetigt')

    const guest: any = (typeof r.guest === 'object' && r.guest) ? r.guest : {}
    const gnRaw = r.guest_name
    const gnObj = (typeof gnRaw === 'object' && gnRaw) ? gnRaw : null
    const guestName = isBlock ? 'Eigentümer (gesperrt)'
      : (gnObj?.full_name || (gnObj ? `${gnObj.first_name||''} ${gnObj.last_name||''}`.trim() : '')
         || guest.full_name || guest.name
         || `${guest.first_name||''} ${guest.last_name||''}`.trim()
         || (typeof gnRaw === 'string' ? gnRaw : '') || 'Unbekannt')

    const people: any = r.people || {}
    const adults = typeof people === 'object' ? (people.adults || people.adults_count || 0) : Number(people || 1)
    const children = typeof people === 'object' ? (people.children || people.children_count || 0) : 0
    const totalPrice = parseFloat(r.total_amount || r.total_price || 0) || 0

    const h = houseList.find(h => h.id === prop.house_id)

    bookingsToUpsert.push({
      external_reference: String(r.id),
      house_id:           prop.house_id,
      house_name:         prop.house_name,
      house_short:        prop.house_short,
      channel_id:         channel.id,
      channel_name:       channel.name,
      channel_short:      channel.short,
      booking_date:       dateStr(r.created_at) || today,
      checkin_date:       arrival,
      checkout_date:      departure,
      nights,
      guest_name:         guestName,
      company_name:       guest.company || null,
      guest_email:        guest.email || null,
      guest_phone:        guest.phone || (Array.isArray(guest.phone_numbers) ? guest.phone_numbers[0] : null),
      nationality:        guest.country_code || guest.country_name || null,
      guest_count:        adults + children || (isBlock ? 0 : 1),
      adults,
      children,
      total_price:        totalPrice,
      daily_rate:         nights > 0 && totalPrice > 0 ? +(totalPrice / nights).toFixed(2) : 0,
      currency:           (typeof r.currency === 'object' ? (r.currency?.code || 'EUR') : r.currency) || 'EUR',
      payment_method:     'ueberweisung',
      payment_status:     (r.total_paid >= r.total_amount && r.total_amount > 0) ? 'bezahlt' : 'offen',
      status,
      is_owner_block:     isBlock,
      block_reason:       isBlock ? (r.notes || r.reason || null) : null,
      guest_notes:        guest.notes || null,
      internal_notes:     r.notes || null,
      included_in_stats:  !isBlock,
    })
  }

  // Deduplicate by external_reference
  const seen = new Set<string>()
  const unique = bookingsToUpsert.filter(b => {
    if (seen.has(b.external_reference)) return false
    seen.add(b.external_reference); return true
  })

  if (!unique.length) return NextResponse.json({ synced: 0, total: 0 })

  // full_sync: clear deleted-list, delete all bookings, re-import everything fresh
  if (mode === 'full_sync') {
    await supabase.from('deleted_bookings').delete().neq('external_reference', '')
    const { error: delErr } = await supabase.from('bookings').delete().neq('id', 0)
    if (delErr) return NextResponse.json({ error: 'Löschen fehlgeschlagen: ' + delErr.message }, { status: 500 })
    const { error: insErr } = await supabase.from('bookings').insert(unique)
    if (insErr) return NextResponse.json({ error: 'Import fehlgeschlagen: ' + insErr.message }, { status: 500 })
    return NextResponse.json({
      synced: unique.length, inserted: unique.length, updated: 0, deleted: 'all',
      regular: unique.filter(b => !b.is_owner_block).length,
      ownerBlocks: unique.filter(b => b.is_owner_block).length,
      syncedAt: new Date().toISOString(),
    })
  }

  // Load manually-deleted external references to skip on new_only sync
  const { data: deletedRows } = await supabase.from('deleted_bookings').select('external_reference')
  const deletedRefs = new Set((deletedRows || []).map((r: any) => r.external_reference))

  // Fetch ALL existing bookings to match by external_reference OR by house+dates
  const { data: allExisting } = await supabase
    .from('bookings')
    .select('id, external_reference, house_id, checkin_date, checkout_date, invoice_number')

  // Match by external_reference first, then fallback to house_id+checkin+checkout
  const byExtRef: Record<string, any> = {}
  const byDateKey: Record<string, any> = {}
  ;(allExisting || []).forEach(e => {
    if (e.external_reference) byExtRef[e.external_reference] = e
    const dk = `${e.house_id}|${e.checkin_date?.slice(0,10)}|${e.checkout_date?.slice(0,10)}`
    byDateKey[dk] = e
  })

  const toInsert: any[] = []
  const toUpdate: any[] = []

  for (const b of unique) {
    // Skip bookings that were manually deleted
    if (deletedRefs.has(b.external_reference)) continue

    const byRef = byExtRef[b.external_reference]
    const dk = `${b.house_id}|${b.checkin_date}|${b.checkout_date}`
    const byDate = !byRef ? byDateKey[dk] : null
    const match = byRef || byDate

    if (match) {
      toUpdate.push({ booking: b, existing: match })
    } else {
      toInsert.push(b)
    }
  }

  let errors: string[] = []

  // Insert truly new bookings
  if (toInsert.length) {
    const { error } = await supabase.from('bookings').insert(toInsert)
    if (error) errors.push('insert: ' + error.message)
  }

  // Update existing — preserve invoice_number, set external_reference if missing
  for (const { booking, existing } of toUpdate) {
    const payload: any = { ...booking }
    if (existing.invoice_number) payload.invoice_number = existing.invoice_number
    const { error } = await supabase.from('bookings').update(payload).eq('id', existing.id)
    if (error) errors.push(`update ${booking.external_reference}: ${error.message}`)
  }

  if (errors.length) return NextResponse.json({ error: errors.join('; ') }, { status: 500 })

  return NextResponse.json({
    synced: unique.length,
    inserted: toInsert.length,
    updated: toUpdate.length,
    regular: unique.filter(b => !b.is_owner_block).length,
    ownerBlocks: unique.filter(b => b.is_owner_block).length,
    syncedAt: new Date().toISOString(),
  })
}
