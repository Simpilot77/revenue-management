import { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDateFull } from '../utils/format';
import { onDataChange, emitDataChange } from '../utils/syncBus';
import { exportCleaningSchedule } from '../utils/pdfExport';

// ─── localStorage helpers (mirrors CalendarPage.jsx) ──────────────────────────

function loadMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function saveMap(key, m) { localStorage.setItem(key, JSON.stringify(m)); }
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('company_settings') || '{}'); } catch { return {}; }
}

const DEFAULT_DETAILS = { scope: 'reinigung', windows: false, deadlineTime: '', durationMin: '', cost: '', notes: '', cleanerConfirmed: false };
const SCOPE_LABELS = { grund: 'Grundreinigung', reinigung: 'Zwischenreinigung', bettwaesche: 'Bettwäsche-Wechsel' };
const STATUS_LABELS = { planned: 'Geplant', organized: 'Organisiert', done: 'Erledigt' };
const STATUS_STYLES = {
  planned:   'bg-red-100 text-red-700',
  organized: 'bg-amber-100 text-amber-700',
  done:      'bg-green-100 text-green-700',
};

function buildMessage(template, entry) {
  return (template || '')
    .replace(/\s*·\s*Dauer:\s*{dauer}\s*Min\.\s*·\s*Kosten:\s*{kosten}\s*€/g, '')
    .replace(/{dauer}/g, '')
    .replace(/{kosten}/g, '')
    .replace(/{haus}/g, entry.houseName || '')
    .replace(/{datum}/g, formatDateFull(entry.date))
    .replace(/{uhrzeit}/g, entry.deadlineTime || '–')
    .replace(/{umfang}/g, SCOPE_LABELS[entry.scope] || entry.scope || '–')
    .replace(/{fenster}/g, entry.windows ? ' · Fenster putzen' : '')
    .replace(/{notizen}/g, entry.notes || '–');
}

function buildEntries(houses, bookings, markers, exclusions, details, tasks) {
  const entries = [];
  const seen = new Set();
  for (const b of bookings) {
    if (b.cleaning_required === false) continue;
    const house = houses.find(h => h.id === b.house_id);
    if (!house) continue;
    const ds = b.cleaning_date?.slice(0, 10) || b.checkout_date?.slice(0, 10);
    if (!ds) continue;
    const key = `${house.id}_${ds}`;
    if (exclusions[key]) continue;
    const bt = tasks[b.id] || {};
    const status = bt.cleaning_done ? 'done' : bt.cleaning_org ? 'organized' : 'planned';
    entries.push({
      key, houseId: house.id, houseName: house.name, date: ds, status,
      bookingId: b.id, guestName: b.guest_name,
      ...DEFAULT_DETAILS, ...(details[key] || {}),
    });
    seen.add(key);
  }
  for (const key of Object.keys(markers)) {
    if (seen.has(key)) continue;
    const idx = key.indexOf('_');
    const houseId = Number(key.slice(0, idx));
    const date = key.slice(idx + 1);
    const house = houses.find(h => h.id === houseId);
    if (!house) continue;
    entries.push({
      key, houseId, houseName: house.name, date, status: 'planned',
      bookingId: null, guestName: null,
      ...DEFAULT_DETAILS, ...(details[key] || {}),
    });
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.houseId - b.houseId);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CleaningManagementPage() {
  const [houses, setHouses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [markers, setMarkers] = useState(() => loadMap('cleaning_markers'));
  const [exclusions, setExclusions] = useState(() => loadMap('cleaning_exclusions'));
  const [details, setDetails] = useState(() => loadMap('cleaning_details'));
  const [tasks, setTasks] = useState(() => loadMap('booking_tasks'));
  const [settings, setSettings] = useState(() => loadSettings());

  const [houseFilter, setHouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  });

  const [editEntry, setEditEntry] = useState(null);
  const [form, setForm] = useState(DEFAULT_DETAILS);

  useEffect(() => {
    const past30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const next365 = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    Promise.all([
      api.get('/meta/houses'),
      api.get('/bookings', { params: { limit: 500, from: past30, to: next365 } }),
    ]).then(([hRes, bRes]) => {
      setHouses(hRes.data || []);
      setBookings((bRes.data?.data || []).filter(b => ['bestaetigt', 'eingecheckt', 'ausgecheckt'].includes(b.status)));
    });
  }, []);

  useEffect(() => onDataChange((e) => {
    if (e.detail?.type === 'cleaning') {
      setMarkers(loadMap('cleaning_markers'));
      setExclusions(loadMap('cleaning_exclusions'));
      setDetails(loadMap('cleaning_details'));
      setTasks(loadMap('booking_tasks'));
    }
  }), []);

  useEffect(() => onDataChange((e) => {
    if (e.detail?.type === 'settings') setSettings(loadSettings());
  }), []);

  const entries = useMemo(
    () => buildEntries(houses, bookings, markers, exclusions, details, tasks),
    [houses, bookings, markers, exclusions, details, tasks]
  );

  const filtered = entries.filter(e => {
    if (houseFilter && String(e.houseId) !== houseFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveDetails = (key, det) => {
    const updated = { ...details, [key]: det };
    setDetails(updated);
    saveMap('cleaning_details', updated);
    emitDataChange({ type: 'cleaning' });
  };

  const setBookingFlags = (bookingId, flags) => {
    const updated = { ...tasks, [bookingId]: { ...(tasks[bookingId] || {}), ...flags } };
    setTasks(updated);
    saveMap('booking_tasks', updated);
    emitDataChange({ type: 'cleaning' });
  };

  const excludeBooking = (key) => {
    const updated = { ...exclusions, [key]: true };
    setExclusions(updated);
    saveMap('cleaning_exclusions', updated);
    emitDataChange({ type: 'cleaning' });
  };

  const toggleMarker = (key) => {
    const updated = { ...markers };
    if (updated[key]) delete updated[key]; else updated[key] = true;
    setMarkers(updated);
    saveMap('cleaning_markers', updated);
    emitDataChange({ type: 'cleaning' });
  };

  // ── Edit modal ────────────────────────────────────────────────────────────

  const openEdit = (entry) => {
    setEditEntry(entry);
    setForm({ ...DEFAULT_DETAILS, ...(details[entry.key] || {}) });
  };

  // ── SMS / WhatsApp ────────────────────────────────────────────────────────

  const phone = settings.cleaning_notification?.phone || '';
  const template = settings.cleaning_notification?.template || '';

  const sendSms = (entry) => {
    if (!phone) { alert('Bitte zuerst in den Einstellungen eine Telefonnummer für Reinigungs-Benachrichtigungen festlegen.'); return; }
    const msg = buildMessage(template, { ...entry, ...form, key: entry.key });
    window.location.href = `sms:${phone}?body=${encodeURIComponent(msg)}`;
  };

  const sendWhatsapp = (entry) => {
    if (!phone) { alert('Bitte zuerst in den Einstellungen eine Telefonnummer für Reinigungs-Benachrichtigungen festlegen.'); return; }
    const msg = buildMessage(template, { ...entry, ...form, key: entry.key });
    const digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">🧹 Reinigungsmanagement</h1>
          <p className="text-xs text-gray-400 mt-0.5">Alle Reinigungen mit Details, Status und SMS/WhatsApp-Benachrichtigung</p>
        </div>
        <button className="btn-secondary text-sm" onClick={() => exportCleaningSchedule(filtered)}>
          📄 PDF Export
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Haus</label>
          <select className="form-input text-sm" value={houseFilter} onChange={e => setHouseFilter(e.target.value)}>
            <option value="">Alle Häuser</option>
            {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select className="form-input text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Alle</option>
            <option value="planned">Geplant</option>
            <option value="organized">Organisiert</option>
            <option value="done">Erledigt</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Von</label>
          <input type="date" className="form-input text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bis</label>
          <input type="date" className="form-input text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="text-sm text-gray-400 pb-2">{filtered.length} Reinigung{filtered.length !== 1 ? 'en' : ''}</div>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Datum</th>
              <th className="text-left px-4 py-2">Haus</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Bestätigt</th>
              <th className="text-left px-4 py-2">Umfang</th>
              <th className="text-left px-4 py-2">Fenster</th>
              <th className="text-left px-4 py-2">Uhrzeit</th>
              <th className="text-left px-4 py-2">Dauer</th>
              <th className="text-left px-4 py-2">Kosten</th>
              <th className="text-left px-4 py-2">Notizen</th>
              <th className="text-right px-4 py-2">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(entry => (
              <tr key={entry.key} className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap">{formatDateFull(entry.date)}</td>
                <td className="px-4 py-2 whitespace-nowrap">{entry.houseName}{entry.guestName ? <span className="text-gray-400"> · {entry.guestName}</span> : ''}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[entry.status]}`}>
                    {STATUS_LABELS[entry.status]}
                  </span>
                </td>
                <td className="px-4 py-2">{entry.cleanerConfirmed ? '✅' : '–'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{SCOPE_LABELS[entry.scope] || '–'}</td>
                <td className="px-4 py-2">{entry.windows ? '🪟' : '–'}</td>
                <td className="px-4 py-2">{entry.deadlineTime || '–'}</td>
                <td className="px-4 py-2">{entry.durationMin ? `${entry.durationMin} Min.` : '–'}</td>
                <td className="px-4 py-2">{entry.cost ? formatCurrency(Number(entry.cost)) : '–'}</td>
                <td className="px-4 py-2 max-w-[200px] truncate text-gray-500">{entry.notes || '–'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className="btn-secondary text-xs py-1 px-2 mr-1" onClick={() => openEdit(entry)}>✏️ Bearbeiten</button>
                  <button className="btn-secondary text-xs py-1 px-2 mr-1" onClick={() => sendSms(entry)}>📱 SMS</button>
                  <button className="btn-secondary text-xs py-1 px-2" onClick={() => sendWhatsapp(entry)}>💬 WhatsApp</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Keine Reinigungen im gewählten Zeitraum.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Edit modal ── */}
      {editEntry && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setEditEntry(null)}
        >
          <div className="card" style={{ minWidth: 340, maxWidth: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">🧹 Reinigung – {editEntry.houseName}</h3>
            <p className="text-sm text-gray-500 mb-4">{formatDateFull(editEntry.date)}</p>
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
              Status: {STATUS_LABELS[editEntry.status]}{editEntry.guestName ? ` · ${editEntry.guestName}` : ''}
            </p>

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Uhrzeit (Deadline)</label>
                  <input type="time" className="form-input w-full text-sm"
                    value={form.deadlineTime}
                    onChange={e => setForm(f => ({ ...f, deadlineTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Umfang</label>
                  <select className="form-input w-full text-sm"
                    value={form.scope}
                    onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
                    <option value="grund">Grundreinigung</option>
                    <option value="reinigung">Zwischenreinigung</option>
                    <option value="bettwaesche">Bettwäsche-Wechsel</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dauer (Minuten)</label>
                  <input type="number" min="0" className="form-input w-full text-sm"
                    value={form.durationMin}
                    onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kosten (€)</label>
                  <input type="number" min="0" step="0.01" className="form-input w-full text-sm"
                    value={form.cost}
                    onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.windows}
                  onChange={e => setForm(f => ({ ...f, windows: e.target.checked }))} />
                🪟 Fenster putzen
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!form.cleanerConfirmed}
                  onChange={e => setForm(f => ({ ...f, cleanerConfirmed: e.target.checked }))} />
                ✅ Reinigungskraft bestätigt
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notizen</label>
                <textarea className="form-input w-full text-sm" rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button className="btn-secondary text-sm" onClick={() => setEditEntry(null)}>Abbrechen</button>
              <button className="btn-secondary text-sm" onClick={() => { saveDetails(editEntry.key, form); setEditEntry(null); }}>💾 Speichern</button>
              {editEntry.bookingId ? (
                <>
                  {editEntry.status !== 'planned' && (
                    <button className="btn-secondary text-sm" onClick={() => { saveDetails(editEntry.key, form); setBookingFlags(editEntry.bookingId, { cleaning_org: false, cleaning_done: false }); setEditEntry(null); }}>↺ Zurücksetzen</button>
                  )}
                  {editEntry.status === 'planned' && (
                    <button className="btn-primary text-sm" style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }} onClick={() => { saveDetails(editEntry.key, form); setBookingFlags(editEntry.bookingId, { cleaning_org: true, cleaning_done: false }); setEditEntry(null); }}>📋 Als organisiert markieren</button>
                  )}
                  {editEntry.status !== 'done' && (
                    <button className="btn-primary text-sm bg-green-600 hover:bg-green-700" onClick={() => { saveDetails(editEntry.key, form); setBookingFlags(editEntry.bookingId, { cleaning_org: true, cleaning_done: true }); setEditEntry(null); }}>✅ Als erledigt markieren</button>
                  )}
                  <button className="btn-primary text-sm bg-red-600 hover:bg-red-700" onClick={() => { excludeBooking(editEntry.key); setEditEntry(null); }}>🗑 Komplett löschen</button>
                </>
              ) : (
                <button className="btn-primary text-sm bg-red-600 hover:bg-red-700" onClick={() => { toggleMarker(editEntry.key); setEditEntry(null); }}>🗑 Komplett löschen</button>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-1">Vorschau Nachricht</div>
              <p className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">
                {buildMessage(template, { ...editEntry, ...form })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
