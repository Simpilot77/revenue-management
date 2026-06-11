import axios from 'axios';
import {
  HOUSES, CHANNELS, BOOKINGS, CUSTOMERS,
  calcKpis, calcMonthly, calcChannels, calcPickup,
  calcLeadTime, calcYoY, calcForecast, calcHouses, calcGuestDistribution,
} from './mockData';

// In-memory mutable customers array
let _customers = [...CUSTOMERS];

// Apply persisted included_in_stats overrides from localStorage
try {
  const _statsOverrides = JSON.parse(localStorage.getItem('booking_stats_overrides') || '{}');
  Object.entries(_statsOverrides).forEach(([id, val]) => {
    const b = BOOKINGS.find(b => b.id === parseInt(id));
    if (b) b.included_in_stats = val;
  });
} catch (_) {}

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
    if (params.status)     filtered = filtered.filter(b => b.status === params.status);
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(b =>
        b.guest_name?.toLowerCase().includes(q) ||
        b.company_name?.toLowerCase().includes(q) ||
        b.external_reference?.toLowerCase().includes(q)
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
      BOOKINGS[idx] = { ...BOOKINGS[idx], ...body, id };
      // Persist included_in_stats override
      if ('included_in_stats' in body) {
        try {
          const overrides = JSON.parse(localStorage.getItem('booking_stats_overrides') || '{}');
          if (body.included_in_stats === false) {
            overrides[id] = false;
          } else {
            delete overrides[id]; // remove override → default true
          }
          localStorage.setItem('booking_stats_overrides', JSON.stringify(overrides));
        } catch (_) {}
      }
      data = BOOKINGS[idx];
    } else {
      data = null;
    }
  }

  // Delete booking
  else if (/^bookings\/\d+$/.test(url) && config.method === 'delete') {
    const id = parseInt(url.split('/')[1]);
    const idx = BOOKINGS.findIndex(b => b.id === id);
    if (idx >= 0) BOOKINGS.splice(idx, 1);
    data = { success: true };
  }

  // Create booking
  else if (url === 'bookings' && config.method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    const newId = BOOKINGS.length > 0 ? Math.max(...BOOKINGS.map(b => b.id)) + 1 : 1;
    const newBooking = { ...body, id: newId, included_in_stats: body.included_in_stats ?? true };
    BOOKINGS.push(newBooking);
    data = newBooking;
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
      .filter(b => b.house_id === parseInt(params.house_id) && b.invoice_number?.startsWith(prefix))
      .map(b => parseInt(b.invoice_number.split('-').pop() || 0));
    const next = existing.length ? Math.max(...existing) + 1 : 1;
    data = { invoice_number: `${prefix}${String(next).padStart(4, '0')}` };
  }

  // Reports
  else if (url === 'reports/kpis')              data = calcKpis(from, to, houseId);
  else if (url === 'reports/occupancy-monthly') data = calcMonthly(from, to, houseId);
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
  }

  // Update customer
  else if (/^customers\/\d+$/.test(url) && config.method === 'put') {
    const id = parseInt(url.split('/')[1]);
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
    const idx = _customers.findIndex(c => c.id === id);
    if (idx >= 0) {
      _customers[idx] = { ..._customers[idx], ...body, id };
      data = _customers[idx];
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
  }

  // Lodgify sync (mock: returns success)
  else if (url === 'admin/lodgify-sync' && config.method === 'post') {
    data = { imported: BOOKINGS.length, updated: 0, message: `Sync abgeschlossen – ${BOOKINGS.length} Buchungen geladen` };
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
}
