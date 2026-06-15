import axios from 'axios';
import {
  HOUSES, CHANNELS, BOOKINGS, CUSTOMERS,
  calcKpis, calcMonthly, calcChannels, calcPickup,
  calcLeadTime, calcYoY, calcForecast, calcHouses, calcGuestDistribution, calcCashflow,
} from './mockData';
import { runLodgifySync, ENV_API_KEY, ENV_HOUSE_MAP } from './lodgifyClient';
import { formatDateFull, formatCurrency } from './format';

// In-memory mutable customers array
let _customers = [...CUSTOMERS];

// Read-only access to the in-memory customers array (for conflict checks etc.)
export function getCustomers() { return _customers; }

// ── Buchungen aus letztem Lodgify-Import laden (überschreibt Mock-Daten) ─────
// Normalize fields that Lodgify can return as objects instead of primitives
function normalizeBookings(list) {
  list.forEach(b => {
    // guest_name: Lodgify may return {first_name, last_name, full_name}
    if (typeof b.guest_name === 'object' && b.guest_name !== null) {
      const gn = b.guest_name;
      b.guest_name = gn.full_name
        || `${gn.first_name || ''} ${gn.last_name || ''}`.trim()
        || 'Unbekannt';
    }
    // currency: Lodgify may return {id, code, name, ...}
    if (typeof b.currency === 'object' && b.currency !== null) {
      b.currency = b.currency.code || 'EUR';
    }
  });
  return list;
}

function enrichBookings(list) {
  const PORTAL_IDS = new Set([2, 3, 4, 5, 7]);
  list.forEach(b => {
    if (PORTAL_IDS.has(b.channel_id)) b.payment_status = b.payment_status ?? 'bezahlt';
    b.commission_rate      = b.commission_rate      ?? (PORTAL_IDS.has(b.channel_id) ? 15 : 0);
    b.commission_amount    = b.commission_overridden ? b.commission_amount
                              : +(((b.commission_rate ?? 0) / 100) * (b.total_price ?? 0)).toFixed(2);
    b.commission_overridden = b.commission_overridden ?? false;
    b.deposit_taken        = b.deposit_taken        ?? false;
    b.deposit_returned     = b.deposit_returned     ?? false;
    b.invoice_sent         = b.invoice_sent         ?? false;
    b.guests_registered    = b.guests_registered    ?? false;
    b.included_in_stats    = b.included_in_stats    ?? !b.is_owner_block;
  });
  return list;
}

// ── Manual overrides: fields the user edited manually, protected from import ──
export const MANUAL_OVERRIDES_KEY = 'manual_overrides';

// Fields that can be manually locked (Lodgify might overwrite these on import)
const LOCKABLE_FIELDS = [
  'invoice_number', 'status', 'payment_status',
  'guest_name', 'company_name', 'total_price',
  'checkin_date', 'checkout_date', 'nights', 'guest_count', 'booking_date',
];

function loadManualOverrides() {
  try { return JSON.parse(localStorage.getItem(MANUAL_OVERRIDES_KEY) || '{}'); } catch { return {}; }
}
function saveManualOverrides(o) {
  try { localStorage.setItem(MANUAL_OVERRIDES_KEY, JSON.stringify(o)); } catch (_) {}
}

/** Stamp each booking with its manual override flags (mutates list in-place). */
function applyManualOverrides(bookings) {
  const overrides = loadManualOverrides();
  bookings.forEach(b => {
    const ov = overrides[b.id];
    if (ov && Object.keys(ov.fields).length > 0) {
      Object.assign(b, ov.fields);
      b._has_manual_overrides = true;
      b._manual_fields        = Object.keys(ov.fields);
      b._manual_modified_at   = ov.modified_at;
    } else {
      delete b._has_manual_overrides;
      delete b._manual_fields;
      delete b._manual_modified_at;
    }
  });
  return bookings;
}

try {
  const saved = localStorage.getItem('lodgify_bookings');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      normalizeBookings(parsed);
      enrichBookings(parsed);
      BOOKINGS.splice(0, BOOKINGS.length, ...parsed);
    }
  }
} catch (_) {}

// Apply persisted included_in_stats overrides from localStorage
try {
  const _statsOverrides = JSON.parse(localStorage.getItem('booking_stats_overrides') || '{}');
  Object.entries(_statsOverrides).forEach(([id, val]) => {
    const b = BOOKINGS.find(b => b.id === parseInt(id));
    if (b) b.included_in_stats = val;
  });
} catch (_) {}

// ── Persistierter Mock-Zustand (Buchungen/Kunden inkl. lokaler Änderungen) ────
// Überschreibt sowohl die Seed-Daten als auch einen evtl. älteren Lodgify-Import,
// da er der zuletzt gespeicherte Stand inklusive aller lokalen Bearbeitungen ist.
try {
  const savedBookings = localStorage.getItem('mock_bookings');
  if (savedBookings) {
    const parsed = JSON.parse(savedBookings);
    if (Array.isArray(parsed) && parsed.length > 0) {
      normalizeBookings(parsed);
      enrichBookings(parsed);
      BOOKINGS.splice(0, BOOKINGS.length, ...parsed);
    }
  }
} catch (_) {}

try {
  const savedCustomers = localStorage.getItem('mock_customers');
  if (savedCustomers) {
    const parsed = JSON.parse(savedCustomers);
    if (Array.isArray(parsed)) _customers.splice(0, _customers.length, ...parsed);
  }
} catch (_) {}

// Apply manual field overrides (always – works for both mock and Lodgify data)
applyManualOverrides(BOOKINGS);

/** Persistiert den aktuellen Stand von BOOKINGS und _customers in localStorage. */
export function persistMockState() {
  try {
    localStorage.setItem('mock_bookings', JSON.stringify(BOOKINGS));
    localStorage.setItem('mock_customers', JSON.stringify(_customers));
  } catch (_) {}
}

const MOCK = true; // set to false when backend is live

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Mock interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (!MOCK) return config;

  const url = config.url?.replace(/^\//, '');
  const params = config.params || {};
  const from = params.from || '2025-01-01';
  const to   = params.to   || '2026-12-31';
  const houseId = params.house_id || null;

  let data = null;

  // Meta
  if (url === 'meta/houses') data = HOUSES;
  else if (url === 'meta/channels') data = CHANNELS;

  // Auth
  else if (url === 'auth/me') data = { id: 1, name: 'Administrator', email: 'info@workation-wolfsburg.com', role: 'admin' };

  // Users
  else if (url === 'users' && config.method === 'get') {
    data = [{ id: 1, name: 'Administrator', email: 'info@workation-wolfsburg.com', role: 'admin', active: true, created_at: '2025-01-01' }];
  }

  // Bookings list
  else if (url === 'bookings' && config.method !== 'post') {
    let filtered = [...BOOKINGS];
    // match any booking that overlaps the requested range
    if (params.from) filtered = filtered.filter(b => b.checkout_date >= params.from);
    if (params.to)   filtered = filtered.filter(b => b.checkin_date  <= params.to);
    if (params.house_id)   filtered = filtered.filter(b => b.house_id === parseInt(params.house_id));
    if (params.channel_id) filtered = filtered.filter(b => b.channel_id === parseInt(params.channel_id));
    if (params.status)         filtered = filtered.filter(b => b.status === params.status);
    if (params.payment_status) filtered = filtered.filter(b => b.payment_status === params.payment_status);
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(b =>
        b.guest_name?.toLowerCase().includes(q) ||
        b.company_name?.toLowerCase().includes(q) ||
        b.external_reference?.toLowerCase().includes(q) ||
        b.invoice_number?.toLowerCase().includes(q) ||
        formatCurrency(b.total_price).toLowerCase().includes(q) ||
        formatDateFull(b.checkin_date).includes(q) ||
        formatDateFull(b.checkout_date).includes(q) ||
        formatDateFull(b.booking_date).includes(q)
      );
    }
    filtered.sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));
    const page  = parseInt(params.page  || 1);
    const limit = parseInt(params.limit || 25);
    data = { data: filtered.slice((page-1)*limit, page*limit), total: filtered.length, page, limit };
  }

  // Single booking GET
  else if (/^bookings\/\d+$/.test(url) && config.method === 'get') {
    const id = parseInt(url.split('/')[1]);
    data = BOOKINGS.find(b => b.id === id) || null;
  }

  // Update booking
  else if (/^bookings\/\d+$/.test(url) && config.method === 'put') {
    const id = parseInt(url.split('/')[1]);
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    const idx = BOOKINGS.findIndex(b => b.id === id);
    if (idx >= 0) {
      const prev = BOOKINGS[idx];
      BOOKINGS[idx] = { ...prev, ...body, id };
      // Persist included_in_stats override
      if ('included_in_stats' in body) {
        try {
          const soMap = JSON.parse(localStorage.getItem('booking_stats_overrides') || '{}');
          if (body.included_in_stats === false) soMap[id] = false;
          else delete soMap[id];
          localStorage.setItem('booking_stats_overrides', JSON.stringify(soMap));
        } catch (_) {}
      }
      // Track manual field overrides for any lockable field that changed
      const moMap = loadManualOverrides();
      if (!moMap[id]) moMap[id] = { fields: {}, modified_at: new Date().toISOString() };
      let changed = false;
      LOCKABLE_FIELDS.forEach(f => {
        if (f in body && String(body[f]) !== String(prev[f] ?? '')) {
          moMap[id].fields[f] = body[f];
          changed = true;
        }
      });
      if (changed) {
        moMap[id].modified_at = new Date().toISOString();
        saveManualOverrides(moMap);
        BOOKINGS[idx]._has_manual_overrides = true;
        BOOKINGS[idx]._manual_fields        = Object.keys(moMap[id].fields);
        BOOKINGS[idx]._manual_modified_at   = moMap[id].modified_at;
      }
      data = BOOKINGS[idx];
      persistMockState();
    } else {
      data = null;
    }
  }

  // Clear manual overrides for a booking (unlock)
  else if (/^bookings\/\d+\/clear-overrides$/.test(url) && config.method === 'delete') {
    const id = parseInt(url.split('/')[1]);
    const moMap = loadManualOverrides();
    delete moMap[id];
    saveManualOverrides(moMap);
    const b = BOOKINGS.find(b => b.id === id);
    if (b) { delete b._has_manual_overrides; delete b._manual_fields; delete b._manual_modified_at; }
    data = { success: true };
    persistMockState();
  }

  // Unlock a single manually-overridden field for a booking
  else if (/^bookings\/\d+\/unlock-field$/.test(url) && config.method === 'delete') {
    const id = parseInt(url.split('/')[1]);
    const field = params.field;
    const moMap = loadManualOverrides();
    if (moMap[id] && field in moMap[id].fields) {
      delete moMap[id].fields[field];
      if (Object.keys(moMap[id].fields).length === 0) {
        delete moMap[id];
      } else {
        moMap[id].modified_at = new Date().toISOString();
      }
      saveManualOverrides(moMap);
      const b = BOOKINGS.find(b => b.id === id);
      if (b) {
        const ov = moMap[id];
        if (ov && Object.keys(ov.fields).length > 0) {
          b._has_manual_overrides = true;
          b._manual_fields        = Object.keys(ov.fields);
          b._manual_modified_at   = ov.modified_at;
        } else {
          delete b._has_manual_overrides;
          delete b._manual_fields;
          delete b._manual_modified_at;
        }
      }
    }
    data = { success: true };
    persistMockState();
  }

  // Delete booking
  else if (/^bookings\/\d+$/.test(url) && config.method === 'delete') {
    const id = parseInt(url.split('/')[1]);
    const idx = BOOKINGS.findIndex(b => b.id === id);
    if (idx >= 0) BOOKINGS.splice(idx, 1);
    data = { success: true };
    persistMockState();
  }

  // Create booking
  else if (url === 'bookings' && config.method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    const newId = BOOKINGS.length > 0 ? Math.max(...BOOKINGS.map(b => b.id)) + 1 : 1;
    const newBooking = { ...body, id: newId, included_in_stats: body.included_in_stats ?? true };
    BOOKINGS.push(newBooking);
    data = newBooking;
    persistMockState();
  }

  // Drill-down: fetch bookings by IDs
  else if (url === 'reports/drill-down') {
    const ids = params.ids ? params.ids.split(',').map(Number).filter(Boolean) : [];
    data = { data: BOOKINGS.filter(b => ids.includes(b.id)) };
  }

  // Customer bookings
  else if (url === 'customers/bookings') {
    const guestName = (params.guest_name || '').toLowerCase().trim();
    data = { data: BOOKINGS.filter(b => (b.guest_name || '').toLowerCase().trim() === guestName && ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status)) };
  }

  // Next invoice number
  else if (url === 'bookings/next-invoice-number') {
    const year = new Date().getFullYear();
    const house = HOUSES.find(h => h.id === parseInt(params.house_id));
    const houseNum = house?.house_number || '15a';
    const prefix = `${houseNum}-${year}-`;
    const existing = BOOKINGS
      .filter(b => b.house_id === parseInt(params.house_id))
      .flatMap(b => [b.invoice_number, ...(b.invoices || []).map(i => i.invoice_number)])
      .filter(num => num?.startsWith(prefix))
      .map(num => parseInt(num.split('-').pop() || 0));
    const next = existing.length ? Math.max(...existing) + 1 : 1;
    data = { invoice_number: `${prefix}${String(next).padStart(4, '0')}` };
  }

  // Reports
  else if (url === 'reports/kpis')              data = calcKpis(from, to, houseId);
  else if (url === 'reports/occupancy-monthly') data = calcMonthly(from, to, houseId);
  else if (url === 'reports/cashflow')          data = calcCashflow(from, to, houseId);
  else if (url === 'reports/channels')          data = calcChannels(from, to, houseId);
  else if (url === 'reports/pickup')            data = calcPickup(from, to, houseId);
  else if (url === 'reports/lead-time')         data = calcLeadTime(from, to, houseId);
  else if (url === 'reports/yoy')               data = calcYoY(houseId);
  else if (url === 'reports/forecast')          data = calcForecast(houseId);
  else if (url === 'reports/houses')            data = calcHouses(from, to);
  else if (url === 'reports/guest-distribution') data = calcGuestDistribution(from, to, houseId);

  // Next available customer number (fills gaps first)
  else if (url === 'customers/next-number' && config.method === 'get') {
    const nums = _customers
      .map(c => parseInt(c.customer_number, 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
    let next = 1;
    for (const n of nums) {
      if (n === next) next++;
      else if (n > next) break;
    }
    data = { customer_number: String(next).padStart(4, '0') };
  }

  // Check if customer number exists
  else if (url === 'customers/check-number' && config.method === 'get') {
    const num = params.customer_number;
    const exists = _customers.some(c => c.customer_number === num);
    data = { exists };
  }

  // Customers list
  else if (url === 'customers' && config.method === 'get') {
    let filtered = [..._customers];
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(c =>
        c.guest_name?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    const page  = parseInt(params.page  || 1);
    const limit = parseInt(params.limit || 50);
    data = { data: filtered.slice((page-1)*limit, page*limit), total: filtered.length, page, limit };
  }

  // Single customer
  else if (/^customers\/\d+$/.test(url) && config.method === 'get') {
    const id = parseInt(url.split('/')[1]);
    data = _customers.find(c => c.id === id) || null;
  }

  // Create customer
  else if (url === 'customers' && config.method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    const newId = _customers.length > 0 ? Math.max(..._customers.map(c => c.id)) + 1 : 1;
    // Auto-assign next available customer number if not provided
    let custNum = body.customer_number;
    if (!custNum) {
      const nums = _customers.map(c => parseInt(c.customer_number, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      let next = 1;
      for (const n of nums) { if (n === next) next++; else if (n > next) break; }
      custNum = String(next).padStart(4, '0');
    }
    const newCustomer = {
      ...body,
      id: newId,
      customer_number: custNum,
      bookings_count: body.bookings_count || 0,
      total_revenue: body.total_revenue || 0,
      created_at: new Date().toISOString().slice(0, 10),
    };
    _customers.push(newCustomer);
    data = newCustomer;
    persistMockState();
  }

  // Update customer
  else if (/^customers\/\d+$/.test(url) && config.method === 'put') {
    const id = parseInt(url.split('/')[1]);
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    const idx = _customers.findIndex(c => c.id === id);
    if (idx >= 0) {
      _customers[idx] = { ..._customers[idx], ...body, id };
      data = _customers[idx];
      persistMockState();
    } else {
      data = null;
    }
  }

  // Delete customer
  else if (/^customers\/\d+$/.test(url) && config.method === 'delete') {
    const id = parseInt(url.split('/')[1]);
    const idx = _customers.findIndex(c => c.id === id);
    if (idx >= 0) _customers.splice(idx, 1);
    data = { success: true };
    persistMockState();
  }

  // Lodgify sync
  // Lokal (DEV): direkter API-Aufruf über Vite-Proxy
  // Live (Produktion): liest sync.json, die GitHub Actions automatisch befüllt
  else if (url === 'admin/lodgify-sync' && config.method === 'post') {

    // ── Produktion: sync.json lesen ──────────────────────────────────────────
    if (!import.meta.env.DEV) {
      const base = import.meta.env.BASE_URL || '/';
      const syncUrl = base + 'data/sync.json';
      return fetch(syncUrl, { cache: 'no-store' })
        .then(async res => {
          const text = await res.text();
          if (!text.trim().startsWith('{')) throw new Error('Noch kein Sync durchgeführt');
          const syncData = JSON.parse(text);
          const incoming = Array.isArray(syncData.bookings) ? syncData.bookings : [];
          if (!incoming.length) throw new Error('sync.json enthält keine Buchungen');
          normalizeBookings(incoming);
          enrichBookings(incoming);
          applyManualOverrides(incoming);
          BOOKINGS.splice(0, BOOKINGS.length, ...incoming);
          try { localStorage.setItem('lodgify_bookings', JSON.stringify(incoming)); } catch (_) {}
          persistMockState();
          const reservations = incoming.filter(b => !b.is_owner_block);
          const blocks       = incoming.filter(b =>  b.is_owner_block);
          const syncedAt = syncData.synced_at ? new Date(syncData.synced_at).toLocaleString('de-DE') : '—';
          data = {
            imported: reservations.length, owner_blocks: blocks.length,
            synced_at: syncData.synced_at,
            message: `✅ ${reservations.length} Buchungen + ${blocks.length} Eigentümer-Sperren geladen (Stand: ${syncedAt})`,
          };
          return Promise.reject({ isMockResponse: true, response: { status: 200, data, headers: {}, config } });
        })
        .catch(err => {
          if (err.isMockResponse) return Promise.reject(err);
          data = { imported: 0, owner_blocks: 0, synced_at: null,
            message: `⚠️ Sync läuft automatisch alle 6 Stunden (${err.message})` };
          return Promise.reject({ isMockResponse: true, response: { status: 200, data, headers: {}, config } });
        });
    }

    // ── Lokal (DEV): direkter API-Aufruf über Vite-Proxy ────────────────────
    let settings = {};
    try { settings = JSON.parse(localStorage.getItem('company_settings') || '{}'); } catch (_) {}
    const apiKey      = settings.lodgify_api_key  || ENV_API_KEY   || '';
    const houseMapRaw = settings.lodgify_house_map || ENV_HOUSE_MAP || '';

    if (!apiKey) {
      data = {
        imported: 0, owner_blocks: 0, synced_at: null,
        message: '❌ Kein API-Schlüssel hinterlegt. Bitte unter Einstellungen → Lodgify-Integration eingeben.',
      };
      return Promise.reject({ isMockResponse: true, response: { status: 200, data, headers: {}, config } });
    }

    return runLodgifySync(apiKey, houseMapRaw)
      .then(result => {
        normalizeBookings(result.bookings);
        enrichBookings(result.bookings);
        applyManualOverrides(result.bookings);
        BOOKINGS.splice(0, BOOKINGS.length, ...result.bookings);
        try { localStorage.setItem('lodgify_bookings', JSON.stringify(result.bookings)); } catch (_) {}
        persistMockState();
        const syncedAt = new Date(result.syncedAt).toLocaleString('de-DE');
        data = {
          imported: result.regular, owner_blocks: result.ownerBlocks,
          synced_at: result.syncedAt,
          message: `✅ Sync erfolgreich – ${result.regular} Buchungen + ${result.ownerBlocks} Eigentümer-Sperren (Stand: ${syncedAt})`,
        };
        return Promise.reject({ isMockResponse: true, response: { status: 200, data, headers: {}, config } });
      })
      .catch(err => {
        if (err.isMockResponse) return Promise.reject(err);
        data = { imported: 0, owner_blocks: 0, synced_at: null,
          message: `❌ Sync fehlgeschlagen: ${err.message}` };
        return Promise.reject({ isMockResponse: true, response: { status: 200, data, headers: {}, config } });
      });
  }

  if (data !== null) {
    return Promise.reject({
      isMockResponse: true,
      response: { status: 200, data, headers: {}, config },
    });
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.isMockResponse) return Promise.resolve(err.response);
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Database export / import ────────────────────────────────────────────────

// All localStorage keys that are part of the app state
const LS_KEYS = [
  'booking_stats_overrides', // stats exclusions per booking
  'cleaning_markers',        // manual cleaning day markers
  'booking_tasks',           // task completion state per booking
  'booking_task_dues',       // custom due date overrides per task
  'company_settings',        // company name, address, bank details etc.
  'lodgify_bookings',        // letzter Lodgify-Import (persistiert über Reloads)
  MANUAL_OVERRIDES_KEY,      // manuell gesperrte Felder je Buchung
];

export function getDatabase() {
  const ls = {};
  for (const key of LS_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      ls[key] = raw ? JSON.parse(raw) : null;
    } catch { ls[key] = null; }
  }
  return {
    version: 2,
    exported_at: new Date().toISOString(),
    bookings: BOOKINGS,
    customers: _customers,
    ...ls,
  };
}

export function importDatabase(data) {
  if (!data || !Array.isArray(data.bookings)) throw new Error('Ungültiges Format');
  // Replace BOOKINGS in-place
  BOOKINGS.splice(0, BOOKINGS.length, ...data.bookings);
  // Replace customers in-place
  if (Array.isArray(data.customers)) {
    _customers.splice(0, _customers.length, ...data.customers);
  }
  // Restore all localStorage keys
  for (const key of LS_KEYS) {
    if (data[key] != null) {
      localStorage.setItem(key, JSON.stringify(data[key]));
    } else {
      localStorage.removeItem(key);
    }
  }
  persistMockState();
}
