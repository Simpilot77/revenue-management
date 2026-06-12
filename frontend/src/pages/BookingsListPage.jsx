import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../utils/format';
import { exportBookingsList } from '../utils/pdfExport';

// ─── Column definitions ──────────────────────────────────────────────────────
// editable: false = only navigate to form; type = input type or 'select'
const COLUMNS = [
  { key: 'booking_date',   label: 'Buchungsdatum', type: 'date' },
  { key: 'house_short',    label: 'Haus',          editable: false },
  { key: 'guest_name',     label: 'Gastname',      type: 'text' },
  { key: 'company_name',   label: 'Firma',         type: 'text' },
  { key: 'checkin_date',   label: 'Anreise',       type: 'date' },
  { key: 'checkout_date',  label: 'Abreise',       type: 'date' },
  { key: 'nights',         label: 'Nächte',        type: 'number' },
  { key: 'guest_count',    label: 'Gäste',         type: 'number' },
  { key: 'channel_name',   label: 'Kanal',         editable: false },
  { key: 'total_price',    label: 'Gesamtpreis',   type: 'number' },
  { key: 'invoice_number', label: 'Rechnungsnr.',  type: 'text' },
  { key: 'status',         label: 'Status',        type: 'select', options: STATUS_LABELS },
  { key: 'payment_status', label: 'Zahlung',       type: 'select', options: PAYMENT_STATUS_LABELS },
];

function SortIcon({ dir }) {
  if (!dir) return <span className="text-gray-300 ml-1">⇅</span>;
  return <span className="text-blue-600 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

// ─── Inline-editable cell ────────────────────────────────────────────────────
function EditableCell({ booking, col, editingCell, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit, isDuplicate }) {
  const inputRef = useRef(null);
  const isEditing = editingCell?.id === booking.id && editingCell?.field === col.key;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.select) inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onSaveEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (col.editable === false) return;
    onStartEdit(booking.id, col.key, booking[col.key] ?? '');
  };

  // ── Display mode ──
  if (!isEditing) {
    let display;
    if (col.key === 'booking_date' || col.key === 'checkin_date' || col.key === 'checkout_date') {
      display = <span className="whitespace-nowrap">{formatDate(booking[col.key])}</span>;
    } else if (col.key === 'total_price') {
      display = <span className="font-medium whitespace-nowrap">{formatCurrency(booking[col.key])}</span>;
    } else if (col.key === 'invoice_number') {
      if (isDuplicate && booking[col.key]) {
        display = (
          <span className="flex items-center gap-1">
            <span className="font-mono text-xs text-red-700 font-semibold">{booking[col.key]}</span>
            <span className="text-xs text-red-600 font-bold" title="Doppelte Rechnungsnummer!">⚠ doppelt</span>
          </span>
        );
      } else {
        display = booking[col.key]
          ? <span className="font-mono text-xs text-gray-600">{booking[col.key]}</span>
          : <span className="text-amber-500 text-xs">⚠ fehlt</span>;
      }
    } else if (col.key === 'status') {
      display = <span className={`badge ${STATUS_COLORS[booking[col.key]]}`}>{STATUS_LABELS[booking[col.key]]}</span>;
    } else if (col.key === 'payment_status') {
      display = <span className={`badge ${PAYMENT_STATUS_COLORS[booking[col.key]]}`}>{PAYMENT_STATUS_LABELS[booking[col.key]]}</span>;
    } else if (col.key === 'channel_name') {
      display = booking.channel_name
        ? <span className="badge text-white text-xs" style={{ backgroundColor: booking.channel_color }}>{booking.channel_short}</span>
        : null;
    } else if (col.key === 'guest_name') {
      display = (
        <>
          <div className="font-medium">{booking.guest_name}</div>
          {booking.company_name && col.key === 'guest_name' && (
            <div className="text-xs text-gray-400">{booking.company_name}</div>
          )}
        </>
      );
    } else {
      display = booking[col.key] ?? '';
    }

    const isEditable = col.editable !== false;
    return (
      <td
        className={`px-3 py-2 text-sm ${isEditable ? 'cursor-text hover:bg-blue-50 group relative' : ''}`}
        title={isEditable ? 'Klicken zum Bearbeiten' : undefined}
        onClick={handleClick}
      >
        {display}
        {isEditable && (
          <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 text-blue-400 text-xs pointer-events-none">✏</span>
        )}
      </td>
    );
  }

  // ── Edit mode ──
  const baseInputClass = 'w-full min-w-[80px] border border-blue-400 rounded px-1.5 py-0.5 text-sm outline-none ring-2 ring-blue-200 bg-white';

  if (col.type === 'select') {
    return (
      <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
        <select
          ref={inputRef}
          className={baseInputClass}
          value={editingCell.value}
          onChange={e => onChangeEdit(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={handleKeyDown}
        >
          {Object.entries(col.options).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </td>
    );
  }

  return (
    <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        type={col.type}
        step={col.key === 'total_price' ? '0.01' : undefined}
        min={col.type === 'number' ? '0' : undefined}
        className={baseInputClass}
        value={editingCell.value}
        onChange={e => onChangeEdit(e.target.value)}
        onBlur={onSaveEdit}
        onKeyDown={handleKeyDown}
      />
    </td>
  );
}

// ─── Invoice number helpers ──────────────────────────────────────────────────

/** Build the house prefix for invoice numbers: "15a", "15b", etc. */
function invoiceHousePrefix(booking) {
  const letter = (booking.house_short || '').toLowerCase() || String(booking.house_id || '');
  return `15${letter}`;
}

/** Suggest the next invoice number for a booking based on existing numbers */
function suggestInvoiceNumber(booking, allBookings) {
  const year = new Date().getFullYear();
  const prefix = invoiceHousePrefix(booking);
  const key = `${prefix}-${year}`;
  let max = 0;
  allBookings.forEach(b => {
    if (!b.invoice_number || b.id === booking.id) return;
    const parts = b.invoice_number.split('-');
    if (parts.length >= 3 && `${parts[0]}-${parts[1]}` === key) {
      const n = parseInt(parts[2]);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${key}-${String(max + 1).padStart(4, '0')}`;
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function BookingsListPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]); // full set for invoice logic
  const [total, setTotal] = useState(0);
  const [houses, setHouses] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', house_id: '', channel_id: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('checkin_date');
  const [sortDir, setSortDir] = useState('desc');
  const [gapWarnings, setGapWarnings] = useState([]);
  const [duplicateInvoices, setDuplicateInvoices] = useState(new Set()); // booking ids with duplicate invoice numbers
  const [invoiceLang, setInvoiceLang] = useState('de');
  const [editingCell, setEditingCell] = useState(null); // { id, field, value }
  const [dupConfirm, setDupConfirm] = useState(null); // { booking, newValue, existingIds }
  const limit = 25;

  const refreshInvoiceAnalysis = useCallback((all) => {
    const byHouseYear = {};
    const invoiceMap = {}; // invoice_number → [booking_ids]
    const activeAll = all.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status));

    activeAll.forEach(b => {
      if (!b.invoice_number) return;
      const inv = b.invoice_number.trim();
      if (!invoiceMap[inv]) invoiceMap[inv] = [];
      invoiceMap[inv].push(b.id);

      const parts = inv.split('-');
      if (parts.length >= 3) {
        const key = `${parts[0]}-${parts[1]}`;
        const num = parseInt(parts[2]);
        if (!isNaN(num)) {
          if (!byHouseYear[key]) byHouseYear[key] = [];
          byHouseYear[key].push(num);
        }
      }
    });

    // Gap warnings
    const warnings = [];
    Object.entries(byHouseYear).forEach(([key, nums]) => {
      const sorted = [...nums].sort((a, b) => a - b);
      const gaps = [];
      for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
        if (!sorted.includes(i)) gaps.push(i);
      }
      if (gaps.length) warnings.push(`${key}: fehlende Nr. ${gaps.map(n => String(n).padStart(4,'0')).join(', ')}`);
    });
    setGapWarnings(warnings);

    // Duplicate set
    const dupeIds = new Set();
    Object.values(invoiceMap).forEach(ids => {
      if (ids.length > 1) ids.forEach(id => dupeIds.add(id));
    });
    setDuplicateInvoices(dupeIds);
  }, []);

  const loadAllBookings = useCallback(() => {
    api.get('/bookings', { params: { limit: 500 } }).then(r => {
      const all = r.data.data || [];
      setAllBookings(all);
      refreshInvoiceAnalysis(all);
    });
  }, [refreshInvoiceAnalysis]);

  useEffect(() => {
    Promise.all([api.get('/meta/houses'), api.get('/meta/channels')]).then(([h, c]) => {
      setHouses(h.data);
      setChannels(c.data);
    });
    loadAllBookings();
  }, [loadAllBookings]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { ...filters, page, limit };
    Object.keys(params).forEach(k => !params[k] && delete params[k]);
    api.get('/bookings', { params }).then(r => {
      setBookings(r.data.data);
      setTotal(r.data.total);
    }).finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };

  const handleSort = (key) => {
    if (sortField === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(key);
      setSortDir('asc');
    }
  };

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [bookings, sortField, sortDir]);

  const exportAllForPdf = async () => {
    try {
      const params = { ...filters, page: 1, limit: 1000 };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const { data } = await api.get('/bookings', { params });
      await exportBookingsList(data.data, filters);
    } catch (err) {
      console.error('PDF Export Fehler:', err);
      alert(`PDF Export fehlgeschlagen: ${err?.message || err}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Buchung von "${name}" wirklich löschen?`)) return;
    await api.delete(`/bookings/${id}`);
    load();
    loadAllBookings();
  };

  const handleToggleStats = async (b) => {
    const updated = { ...b, included_in_stats: b.included_in_stats === false ? true : false };
    await api.put(`/bookings/${b.id}`, updated);
    load();
  };

  // ── Inline cell editing ──
  const startEdit = (id, field, value) => {
    let prefill = value ?? '';
    // Pre-fill invoice number if empty
    if (field === 'invoice_number' && !prefill) {
      const booking = bookings.find(b => b.id === id) || allBookings.find(b => b.id === id);
      if (booking) prefill = suggestInvoiceNumber(booking, allBookings);
    }
    setEditingCell({ id, field, value: prefill });
  };

  const changeEdit = (value) => {
    setEditingCell(prev => prev ? { ...prev, value } : null);
  };

  const doSaveEdit = async (id, field, val) => {
    const booking = bookings.find(b => b.id === id) || allBookings.find(b => b.id === id);
    if (!booking) return;
    const updated = { ...booking, [field]: val };
    setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
    setAllBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
    try {
      await api.put(`/bookings/${id}`, updated);
      // Refresh invoice analysis after save
      const freshAll = allBookings.map(b => b.id === updated.id ? updated : b);
      refreshInvoiceAnalysis(freshAll);
    } catch {
      load();
      loadAllBookings();
    }
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    let val = editingCell.value;
    const col = COLUMNS.find(c => c.key === editingCell.field);
    if (col?.type === 'number') val = parseFloat(val) || 0;

    setEditingCell(null);

    // Check for duplicate invoice numbers
    if (editingCell.field === 'invoice_number' && val) {
      const inv = String(val).trim();
      const existingIds = allBookings
        .filter(b => b.id !== editingCell.id && b.invoice_number?.trim() === inv && ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status))
        .map(b => b.id);
      if (existingIds.length > 0) {
        const existing = allBookings.find(b => b.id === existingIds[0]);
        setDupConfirm({
          bookingId: editingCell.id,
          field: editingCell.field,
          value: inv,
          existingGuest: existing?.guest_name || '—',
          existingHouse: existing?.house_short || '—',
          existingDate: existing?.checkin_date?.slice(0,10) || '—',
        });
        return; // wait for user confirmation
      }
    }

    await doSaveEdit(editingCell.id, editingCell.field, val);
  };

  const cancelEdit = () => setEditingCell(null);

  const totalPages = Math.ceil(total / limit);
  // +3 = # col + actions col + data cols
  const colCount = COLUMNS.length + 3;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Buchungen <span className="text-gray-400 text-lg font-normal">({total})</span>
        </h1>
        <div className="flex gap-2 items-center">
          <button onClick={exportAllForPdf} className="btn-secondary flex items-center gap-2" title="Aktuelle Ansicht als PDF exportieren">
            📄 PDF Export
          </button>
          <Link to="/bookings/new" className="btn-primary">+ Neue Buchung</Link>
        </div>
      </div>

      {/* Hint */}
      <div className="text-xs text-gray-400 flex items-center gap-1">
        <span>✏️</span>
        <span>Zelleninhalt anklicken zum direkten Bearbeiten — Enter zum Speichern, Escape zum Abbrechen</span>
      </div>

      {duplicateInvoices.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 space-y-1">
          <div className="font-semibold">🚨 Doppelte Rechnungsnummern erkannt</div>
          <div className="text-xs">
            {duplicateInvoices.size} Buchungen haben eine doppelt vergebene Rechnungsnummer (rot markiert). Bitte korrigieren.
          </div>
        </div>
      )}
      {gapWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 space-y-1">
          <div className="font-semibold">⚠️ Lücken in den Rechnungsnummern erkannt</div>
          {gapWarnings.map((w, i) => <div key={i} className="text-xs font-mono">{w}</div>)}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input className="form-input" placeholder="🔍 Suche…" value={filters.search} onChange={e => setFilter('search', e.target.value)} />
          <select className="form-select" value={filters.house_id} onChange={e => setFilter('house_id', e.target.value)}>
            <option value="">Alle Häuser</option>
            {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select className="form-select" value={filters.channel_id} onChange={e => setFilter('channel_id', e.target.value)}>
            <option value="">Alle Kanäle</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" className="form-input" value={filters.from} onChange={e => setFilter('from', e.target.value)} title="Von (Anreise)" />
          <input type="date" className="form-input" value={filters.to} onChange={e => setFilter('to', e.target.value)} title="Bis (Anreise)" />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {/* Row number */}
                <th className="px-3 py-3 text-gray-400 font-medium text-center w-10">#</th>
                {/* Actions – left */}
                <th className="px-3 py-3 text-gray-500 font-medium whitespace-nowrap">Aktionen</th>
                {/* Data columns */}
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className="text-left text-gray-500 font-medium px-3 py-3 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortIcon dir={sortField === col.key ? sortDir : null} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={colCount} className="text-center text-gray-400 py-8">Laden…</td></tr>
              ) : sortedBookings.length === 0 ? (
                <tr><td colSpan={colCount} className="text-center text-gray-400 py-8">Keine Buchungen gefunden</td></tr>
              ) : sortedBookings.map((b, idx) => (
                <tr
                  key={b.id}
                  className={`hover:bg-gray-50 ${editingCell?.id === b.id ? 'bg-blue-50/40' : ''} ${duplicateInvoices.has(b.id) ? 'bg-red-50/60' : ''}`}
                >
                  {/* Row number */}
                  <td className="px-3 py-2 text-center text-xs text-gray-400 font-mono select-none">
                    {(page - 1) * limit + idx + 1}
                  </td>

                  {/* Actions – left */}
                  <td className="px-2 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/bookings/${b.id}/edit`)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium border border-blue-200 transition-colors"
                        title="Buchung bearbeiten"
                      >
                        ✏ Bearbeiten
                      </button>
                      <button
                        onClick={() => handleToggleStats(b)}
                        title={b.included_in_stats === false ? 'Nicht in Auswertung – klicken zum Aktivieren' : 'In Auswertung – klicken zum Deaktivieren'}
                        className={`text-base leading-none ${b.included_in_stats === false ? 'text-gray-300 hover:text-gray-500' : 'text-green-500 hover:text-green-700'}`}
                      >📊</button>
                      <button
                        onClick={() => handleDelete(b.id, b.guest_name)}
                        className="text-base leading-none text-red-400 hover:text-red-600"
                        title="Buchung löschen"
                      >🗑</button>
                    </div>
                  </td>

                  {/* Data columns */}
                  {COLUMNS.map(col => (
                    <EditableCell
                      key={col.key}
                      booking={b}
                      col={col}
                      editingCell={editingCell?.id === b.id ? editingCell : null}
                      onStartEdit={startEdit}
                      onChangeEdit={changeEdit}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      isDuplicate={col.key === 'invoice_number' && duplicateInvoices.has(b.id)}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Seite {page} von {totalPages} · {total} Einträge</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Zurück</button>
              <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Weiter →</button>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate invoice confirmation modal */}
      {dupConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDupConfirm(null)}
        >
          <div
            className="card"
            style={{ minWidth: '360px', maxWidth: '460px', padding: '28px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">🚨</span>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Doppelte Rechnungsnummer</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Die Rechnungsnummer <span className="font-mono font-bold text-red-700">{dupConfirm.value}</span> ist bereits vergeben:
                </p>
                <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-800">
                  <span className="font-semibold">{dupConfirm.existingGuest}</span>
                  {' · '}Haus {dupConfirm.existingHouse}
                  {' · '}Anreise {dupConfirm.existingDate}
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Möchtest du die Nummer trotzdem übernehmen? Beide Einträge werden dann als „doppelt" markiert, bis du es korrigierst.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="btn-secondary text-sm"
                onClick={() => setDupConfirm(null)}
              >
                Abbrechen
              </button>
              <button
                className="text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                onClick={async () => {
                  const conf = dupConfirm;
                  setDupConfirm(null);
                  await doSaveEdit(conf.bookingId, conf.field, conf.value);
                }}
              >
                Trotzdem speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
