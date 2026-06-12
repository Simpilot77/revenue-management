/**
 * Client-seitiger Lodgify API-Client (v1/reservation).
 * Im Dev-Server über Vite-Proxy /lodgify-proxy → api.lodgify.com.
 */

import { HOUSES } from './mockData';

const LODGIFY_BASE = import.meta.env.DEV
  ? '/lodgify-proxy'
  : 'https://api.lodgify.com';

// Credentials aus .env.local (gitignored, nie auf GitHub)
export const ENV_API_KEY    = import.meta.env.VITE_LODGIFY_API_KEY    || '';
export const ENV_ACCOUNT_ID = import.meta.env.VITE_LODGIFY_ACCOUNT_ID || '';
export const ENV_HOUSE_MAP  = import.meta.env.VITE_LODGIFY_HOUSE_MAP  || '';

const today    = new Date().toISOString().slice(0, 10);
const dateFrom = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
const dateTo   = new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10);

async function get(apiKey, path, params = {}) {
  // LODGIFY_BASE ist entweder '/lodgify-proxy' (dev) oder 'https://api.lodgify.com' (prod)
  const fullBase = LODGIFY_BASE.startsWith('/')
    ? window.location.origin + LODGIFY_BASE
    : LODGIFY_BASE;
  // path direkt anhängen (nicht als zweites URL-Argument, das würde absolute Pfade falsch auflösen)
  const url = new URL(fullBase + path);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: { 'X-ApiKey': apiKey, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Lodgify ${path} → HTTP ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`);
  }
  return res.json();
}

// ─── Kanal-Mapping ───────────────────────────────────────────────────────────

const CHANNEL_MAP = {
  manual:             { id: 1, name: 'Direkt',          short: 'DIREKT',  color: '#10b981' },
  direct:             { id: 1, name: 'Direkt',          short: 'DIREKT',  color: '#10b981' },
  website:            { id: 1, name: 'Direkt',          short: 'DIREKT',  color: '#10b981' },
  bookingcom:         { id: 2, name: 'Booking.com',     short: 'BDC',     color: '#003580' },
  booking:            { id: 2, name: 'Booking.com',     short: 'BDC',     color: '#003580' },
  airbnbintegration:  { id: 3, name: 'Airbnb',          short: 'AIRBNB',  color: '#ff5a5f' },
  airbnb:             { id: 3, name: 'Airbnb',          short: 'AIRBNB',  color: '#ff5a5f' },
  hrs:                { id: 4, name: 'HRS',              short: 'HRS',     color: '#e65100' },
  homeaway:           { id: 5, name: 'Expedia/HomeAway', short: 'EXPEDIA', color: '#ffc107' },
  expedia:            { id: 5, name: 'Expedia',          short: 'EXPEDIA', color: '#ffc107' },
  owner:              { id: null, name: 'Eigentümer',   short: 'OWNER',   color: '#64748b' },
  ownerblock:         { id: null, name: 'Eigentümer',   short: 'OWNER',   color: '#64748b' },
  blocked:            { id: null, name: 'Eigentümer',   short: 'OWNER',   color: '#64748b' },
};

function getChannel(source) {
  if (!source) return CHANNEL_MAP.manual;
  const key = source.toLowerCase().replace(/[\s._\-]/g, '');
  return CHANNEL_MAP[key]
    || Object.entries(CHANNEL_MAP).find(([k]) => key.includes(k) || k.includes(key))?.[1]
    || { id: 7, name: source, short: source.slice(0, 6).toUpperCase(), color: '#6b7280' };
}

// Lodgify v1 Status → App-Status
const STATUS_MAP = {
  booked:          'bestaetigt',
  open:            'angefragt',
  bookingrequest:  'angefragt',
  tentative:       'angefragt',
  cancelled:       'storniert',
  canceled:        'storniert',
  declined:        'storniert',
  checkedin:       'eingecheckt',
  checkedout:      'ausgecheckt',
  closed:          'ausgecheckt',
  completed:       'ausgecheckt',
};

const OWNER_SOURCES = new Set(['owner', 'ownerblock', 'owneruse', 'blocked', 'maintenance', 'unavailable']);
const OWNER_TYPES   = new Set(['ownerblock', 'blocked', 'unavailable', 'maintenance']);

function isOwnerBlock(r) {
  const clean = s => (s || '').toLowerCase().replace(/[\s._\-]/g, '');
  return !!(
    r.is_blocked || r.is_owner_block ||
    OWNER_SOURCES.has(clean(r.source)) ||
    OWNER_TYPES.has(clean(r.type))
  );
}

function dateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function nightsBetween(a, b) {
  try { return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000)); }
  catch { return 0; }
}

// ─── Haupt-Export ────────────────────────────────────────────────────────────

export async function runLodgifySync(apiKey, houseMapRaw) {

  // 1. Properties laden
  const rawProps = await get(apiKey, '/v2/properties');
  const propsList = Array.isArray(rawProps) ? rawProps : (rawProps.items || []);

  let houseMap = {};
  if (houseMapRaw) { try { houseMap = JSON.parse(houseMapRaw); } catch (_) {} }

  const propMap = {};
  const shortLabels = ['A', 'B', 'C', 'D', 'E'];
  propsList.forEach((p, idx) => {
    const pid     = p.id;
    const houseId = houseMap[String(pid)] ?? (idx + 1);
    const appHouse = HOUSES.find(h => h.id === houseId);
    propMap[pid] = {
      house_id:       houseId,
      house_name:     appHouse?.name || p.name || `Haus ${houseId}`,
      house_short:    shortLabels[houseId - 1] || String(houseId),
      house_capacity: p.guests_max || p.max_people || 6,
    };
  });

  // 2. Buchungen paginiert laden über /v1/reservation
  // Lodgify v1 verwendet offset/limit (nicht page/size), total statt count
  const allReservations = [];
  const limit = 50;
  let offset = 0;
  while (true) {
    const data = await get(apiKey, '/v1/reservation', { offset, limit });
    const items = data.items || [];
    if (!items.length) break;
    allReservations.push(...items);
    const total = data.total ?? 0;
    if (allReservations.length >= total || items.length < limit) break;
    offset += limit;
  }

  // 3. Transformation
  const getProp = (r) => {
    const pid = r.property_id || r.rooms?.[0]?.property_id;
    return (pid && propMap[pid]) ? propMap[pid]
      : Object.values(propMap)[0] || { house_id: 1, house_name: 'Haus 1', house_short: 'A', house_capacity: 6 };
  };

  const bookings = [];
  for (const r of allReservations) {
    const arrival   = dateStr(r.arrival);
    const departure = dateStr(r.departure);
    if (!arrival || !departure || arrival >= departure) continue;

    const isBlock  = isOwnerBlock(r);
    const prop     = getProp(r);
    const channel  = isBlock ? CHANNEL_MAP.owner : getChannel(r.source || '');
    const nights   = r.nights || nightsBetween(arrival, departure);
    const statusRaw = (r.status || '').toLowerCase().replace(/[\s_]/g, '');
    const status   = isBlock ? 'gesperrt' : (STATUS_MAP[statusRaw] || 'bestaetigt');

    const guest     = (typeof r.guest === 'object' && r.guest) ? r.guest : {};
    const guestName = isBlock ? 'Eigentümer (gesperrt)'
      : (guest.full_name || guest.guest_name || guest.name
         || `${guest.first_name || ''} ${guest.last_name || ''}`.trim()
         || r.guest_name || 'Unbekannt');

    const people   = r.people || {};
    const adults   = typeof people === 'object' ? (people.adults || people.adults_count || 0) : Number(people || 1);
    const children = typeof people === 'object' ? (people.children || people.children_count || 0) : 0;

    const totalPrice = parseFloat(r.total_amount || r.total_price || 0) || 0;
    const dailyRate  = nights > 0 && totalPrice > 0 ? +(totalPrice / nights).toFixed(2) : 0;

    bookings.push({
      id:               r.id,
      house_id:         prop.house_id,
      house_name:       prop.house_name,
      house_short:      prop.house_short,
      house_capacity:   prop.house_capacity,
      channel_id:       channel.id,
      channel_name:     channel.name,
      channel_short:    channel.short,
      channel_color:    channel.color,
      external_reference: String(r.id),
      booking_date:     dateStr(r.created_at) || today,
      checkin_date:     arrival,
      checkout_date:    departure,
      nights,
      guest_name:       guestName,
      company_name:     guest.company || null,
      guest_email:      guest.email || null,
      guest_phone:      guest.phone || (Array.isArray(guest.phone_numbers) ? guest.phone_numbers[0] : null),
      nationality:      guest.country_code || guest.country_name || null,
      is_returning_guest: false,
      guest_count:      adults + children || (isBlock ? 0 : 1),
      adults,
      children,
      daily_rate:       dailyRate,
      cleaning_fee:     0,
      discount_percent: 0,
      total_price:      totalPrice,
      currency:         r.currency || 'EUR',
      payment_method:   'ueberweisung',
      payment_status:   (r.total_paid >= r.total_amount && r.total_amount > 0) ? 'bezahlt' : 'offen',
      invoice_number:   null,
      status,
      is_owner_block:   isBlock,
      block_reason:     isBlock ? (r.notes || r.reason || '') : null,
      cancellation_date:    null,
      cancellation_reason:  null,
      breakfast_included:   false,
      pets_allowed:         false,
      parking:              true,
      guest_notes:          guest.notes || null,
      internal_notes:       r.notes || null,
      guests_registered:    false,
      deposit_taken:        false,
      deposit_returned:     false,
      created_by:           1,
      included_in_stats:    !isBlock,
    });
  }

  // Deduplizieren
  const seen = new Set();
  const uniqueBookings = bookings.filter(b => {
    if (seen.has(b.id)) return false;
    seen.add(b.id); return true;
  });

  return {
    bookings:    uniqueBookings,
    regular:     uniqueBookings.filter(b => !b.is_owner_block).length,
    ownerBlocks: uniqueBookings.filter(b =>  b.is_owner_block).length,
    syncedAt:    new Date().toISOString(),
  };
}
