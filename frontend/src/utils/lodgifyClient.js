/**
 * Client-seitiger Lodgify API-Client.
 * Im Dev-Server läuft alles über den Vite-Proxy /lodgify-proxy → api.lodgify.com,
 * damit CORS kein Problem ist.
 * In der Produktion wird api.lodgify.com direkt angesprochen (CORS muss von Lodgify erlaubt sein).
 */

import { HOUSES } from './mockData';

const LODGIFY_BASE = import.meta.env.DEV
  ? '/lodgify-proxy'
  : 'https://api.lodgify.com';

const today = new Date().toISOString().slice(0, 10);
const dateFrom = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
const dateTo   = new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10);

async function get(apiKey, path, params = {}) {
  const url = new URL(
    LODGIFY_BASE + path,
    // Bei relativem Proxy-Pfad brauchen wir eine Basis-URL
    LODGIFY_BASE.startsWith('/') ? window.location.origin : undefined
  );
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: {
      'X-ApiKey': apiKey,
      'Accept':   'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Lodgify API ${path} → ${res.status} ${res.statusText}${text ? ': ' + text.slice(0, 200) : ''}`);
  }
  return res.json();
}

async function fetchAllPages(apiKey, path, baseParams = {}) {
  const results = [];
  let page = 1;
  const size = 50;
  while (true) {
    const data = await get(apiKey, path, { ...baseParams, page, size });
    const items = Array.isArray(data) ? data : (data.items || []);
    results.push(...items);
    const total = typeof data === 'object' ? (data.total_count || data.total || items.length) : items.length;
    if (results.length >= total || items.length < size) break;
    page++;
  }
  return results;
}

// ─── Kanal-Mapping ───────────────────────────────────────────────────────────

const CHANNEL_MAP = {
  airbnb:      { id: 3, name: 'Airbnb',          short: 'AIRBNB',  color: '#ff5a5f' },
  booking:     { id: 2, name: 'Booking.com',      short: 'BDC',     color: '#003580' },
  bookingcom:  { id: 2, name: 'Booking.com',      short: 'BDC',     color: '#003580' },
  direct:      { id: 1, name: 'Direkt',           short: 'DIREKT',  color: '#10b981' },
  website:     { id: 1, name: 'Direkt',           short: 'DIREKT',  color: '#10b981' },
  manual:      { id: 1, name: 'Direkt',           short: 'DIREKT',  color: '#10b981' },
  homeaway:    { id: 5, name: 'Expedia/HomeAway', short: 'EXPEDIA', color: '#ffc107' },
  expedia:     { id: 5, name: 'Expedia',          short: 'EXPEDIA', color: '#ffc107' },
  hrs:         { id: 4, name: 'HRS',              short: 'HRS',     color: '#e65100' },
  owner:       { id: null, name: 'Eigentümer',    short: 'OWNER',   color: '#64748b' },
  ownerblock:  { id: null, name: 'Eigentümer',    short: 'OWNER',   color: '#64748b' },
  blocked:     { id: null, name: 'Eigentümer',    short: 'OWNER',   color: '#64748b' },
  maintenance: { id: null, name: 'Wartung',       short: 'MAINT',   color: '#64748b' },
};

function getChannel(source) {
  if (!source) return CHANNEL_MAP.direct;
  const key = source.toLowerCase().replace(/[\s._-]/g, '');
  for (const [k, v] of Object.entries(CHANNEL_MAP)) {
    if (k === key || key.includes(k) || k.includes(key)) return v;
  }
  return { id: 7, name: source, short: source.slice(0, 6).toUpperCase(), color: '#6b7280' };
}

const STATUS_MAP = {
  accepted:    'bestaetigt',
  approved:    'bestaetigt',
  confirmed:   'bestaetigt',
  pending:     'angefragt',
  request:     'angefragt',
  inquiry:     'angefragt',
  tentative:   'angefragt',
  cancelled:   'storniert',
  canceled:    'storniert',
  declined:    'storniert',
  checkedin:   'eingecheckt',
  checkedout:  'ausgecheckt',
  closed:      'ausgecheckt',
  completed:   'ausgecheckt',
};

const OWNER_SOURCES = new Set([
  'owner', 'ownerblock', 'owneruse', 'blocked', 'maintenance', 'unavailable', 'block',
]);

function isOwnerBlock(r) {
  const clean = s => (s || '').toLowerCase().replace(/[\s._-]/g, '');
  return !!(
    r.is_blocked || r.is_owner_block || r.owner_block ||
    OWNER_SOURCES.has(clean(r.source)) ||
    OWNER_SOURCES.has(clean(r.type)) ||
    OWNER_SOURCES.has(clean(r.status))
  );
}

function dateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function nightsBetween(a, b) {
  try {
    return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
  } catch { return 0; }
}

// ─── Haupt-Export ────────────────────────────────────────────────────────────

export async function runLodgifySync(apiKey, houseMapRaw) {
  // 1. Properties laden
  const rawProps = await get(apiKey, '/v2/properties');
  const propsList = Array.isArray(rawProps) ? rawProps : (rawProps.items || []);

  // House-Map aus Settings oder automatisch nach Reihenfolge
  let houseMap = {};
  if (houseMapRaw) {
    try { houseMap = JSON.parse(houseMapRaw); } catch (_) {}
  }

  const propMap = {};
  const shortLabels = ['A', 'B', 'C', 'D', 'E'];
  propsList.forEach((p, idx) => {
    const pid = p.id;
    const houseId = houseMap[String(pid)] ?? (idx + 1);
    const appHouse = HOUSES.find(h => h.id === houseId);
    propMap[pid] = {
      house_id:       houseId,
      house_name:     appHouse?.name || p.name || `Haus ${houseId}`,
      house_short:    shortLabels[houseId - 1] || String(houseId),
      house_capacity: p.guests_max || p.max_people || 6,
    };
  });

  // 2. Buchungen laden — probiere verschiedene Datum-Parameter
  let reservations = [];
  const paramVariants = [
    { dateDepartureStart: dateFrom, dateDepartureEnd: dateTo, includeExternal: 'true' },
    { dateArrivalStart: dateFrom, dateDepartureEnd: dateTo, includeExternal: 'true' },
    { includeExternal: 'true' },
  ];
  for (const params of paramVariants) {
    try {
      reservations = await fetchAllPages(apiKey, '/v2/reservations', params);
      if (reservations.length > 0) break;
    } catch (_) {}
  }

  // 3. Eigentümer-Sperren — explizit per type-Filter
  const extraBlocks = [];
  for (const blockType of ['OwnerBlock', 'Blocked']) {
    try {
      const data = await get(apiKey, '/v2/reservations', {
        dateDepartureStart: dateFrom, dateDepartureEnd: dateTo,
        type: blockType, size: 200,
      });
      const items = Array.isArray(data) ? data : (data.items || []);
      if (items.length) extraBlocks.push(...items);
    } catch (_) {}
  }

  // 4. Transformation
  const allRecords = [...reservations];
  const seenIds = new Set(reservations.map(r => r.id));
  for (const b of extraBlocks) {
    if (!seenIds.has(b.id)) { allRecords.push(b); seenIds.add(b.id); }
  }

  const getProp = r => {
    const pid = r.property_id || r._property_id || r.property?.id
      || (Array.isArray(r.rooms) && r.rooms[0]?.property_id);
    if (pid && propMap[pid]) return propMap[pid];
    return Object.values(propMap)[0] || { house_id: 1, house_name: 'Haus 1', house_short: 'A', house_capacity: 6 };
  };

  const bookings = [];
  for (const r of allRecords) {
    const arrival   = dateStr(r.arrival   || r.checkin_date  || r.start_date || r.from || r.start || r.date_arrival);
    const departure = dateStr(r.departure || r.checkout_date || r.end_date   || r.to   || r.end   || r.date_departure);
    if (!arrival || !departure || arrival >= departure) continue;
    if (departure < dateFrom || arrival > dateTo) continue;

    const isBlock = isOwnerBlock(r);
    const prop    = getProp(r);
    const channel = isBlock ? CHANNEL_MAP.owner : getChannel(r.source || '');
    const nights  = r.nights || nightsBetween(arrival, departure);
    const status  = isBlock ? 'gesperrt'
      : (STATUS_MAP[(r.status || '').toLowerCase().replace(/[\s_]/g, '')] || 'bestaetigt');

    const guest = (typeof r.guest === 'object' && r.guest) ? r.guest : {};
    const guestName = isBlock ? 'Eigentümer (gesperrt)'
      : (guest.name || `${guest.first_name || ''} ${guest.last_name || ''}`.trim() || r.guest_name || r.name || 'Unbekannt');

    const people = r.people || r.guests || {};
    const adults   = typeof people === 'object' ? (people.adults || people.adults_count || 0) : Number(people || 1);
    const children = typeof people === 'object' ? (people.children || people.children_count || 0) : 0;

    const totalPrice = parseFloat(r.total_amount || r.total_price || r.price || r.amount || 0) || 0;
    const dailyRate  = nights > 0 && totalPrice > 0 ? +(totalPrice / nights).toFixed(2) : 0;

    bookings.push({
      id:               r.id || Math.abs((`${arrival}${departure}${prop.house_id}`).split('').reduce((a, c) => a + c.charCodeAt(0), 0)),
      house_id:         prop.house_id,
      house_name:       prop.house_name,
      house_short:      prop.house_short,
      house_capacity:   prop.house_capacity,
      channel_id:       channel.id,
      channel_name:     channel.name,
      channel_short:    channel.short,
      channel_color:    channel.color,
      external_reference: String(r.id || ''),
      booking_date:     dateStr(r.created_at || r.booking_date || r.created) || today,
      checkin_date:     arrival,
      checkout_date:    departure,
      nights,
      guest_name:       guestName,
      company_name:     guest.company || null,
      guest_email:      guest.email || r.guest_email || null,
      guest_phone:      guest.phone || null,
      nationality:      guest.country_code || guest.country || null,
      is_returning_guest: !!r.is_returning_guest,
      guest_count:      adults + children || (isBlock ? 0 : 1),
      adults,
      children,
      daily_rate:       dailyRate,
      cleaning_fee:     parseFloat(r.cleaning_fee || 0) || 0,
      discount_percent: 0,
      total_price:      totalPrice,
      currency:         r.currency_code || 'EUR',
      payment_method:   'ueberweisung',
      payment_status:   (r.is_paid || r.paid) ? 'bezahlt' : 'offen',
      invoice_number:   r.invoice_number || null,
      status,
      is_owner_block:   isBlock,
      block_reason:     isBlock ? (r.reason || r.block_reason || r.note || r.notes || r.name || '') : null,
      cancellation_date:    dateStr(r.cancelled_at || r.cancellation_date) || null,
      cancellation_reason:  r.cancellation_reason || null,
      breakfast_included:   !!r.breakfast_included,
      pets_allowed:         !!r.pets_allowed,
      parking:              true,
      guest_notes:          guest.notes || null,
      internal_notes:       r.notes || r.internal_notes || null,
      guests_registered:    false,
      deposit_taken:        false,
      deposit_returned:     false,
      created_by:           1,
      included_in_stats:    !isBlock,
    });
  }

  // Deduplizieren
  const uniqueBookings = [];
  const finalIds = new Set();
  for (const b of bookings) {
    if (!finalIds.has(b.id)) { finalIds.add(b.id); uniqueBookings.push(b); }
  }

  const regular = uniqueBookings.filter(b => !b.is_owner_block);
  const blocks  = uniqueBookings.filter(b =>  b.is_owner_block);

  return {
    bookings:    uniqueBookings,
    regular:     regular.length,
    ownerBlocks: blocks.length,
    syncedAt:    new Date().toISOString(),
    properties:  Object.values(propMap),
  };
}
