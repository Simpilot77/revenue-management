import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../utils/format';
import { exportBookingsList } from '../utils/pdfExport';
import { applyInvoiceNumber } from '../utils/numbering';
import { onDataChange } from '../utils/syncBus';

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

const FIELD_LABELS = {
  invoice_number: 'Rechnungsnr.', status: 'Status', payment_status: 'Zahlung',
  guest_name: 'Gastname', company_name: 'Firma', total_price: 'Gesamtpreis',
  checkin_date: 'Anreise', checkout_date: 'Abreise', nights: 'Nächte',
  guest_count: 'Gäste', booking_date: 'Buchungsdatum',
};

// ─── Inline-editable cell ────────────────────────────────────────────────────
function EditableCell({ booking, col, editingCell, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit, isDuplicate, isLocked, onUnlockField }) {
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
        className={`px-3 py-2 text-sm ${isEditable ? 'cursor-text hover:bg-blue-50 group relative' : ''} ${isLocked ? 'bg-amber-50/60' : ''}`}
        title={isLocked ? undefined : isEditable ? 'Klicken zum Bearbeiten' : undefined}
        onClick={handleClick}
      >
        {display}
        {isLocked && (
          <span
            className="absolute left-1 top-1 text-[9px] text-amber-500 leading-none cursor-pointer hover:text-amber-700"
            title="🔒 Manuell gesetzt – geschützt vor Import. Klicken zum Freigeben."
            onClick={e => { e.stopPropagation(); onUnlockField?.(booking, col.key); }}
          >🔒</span>
        )}
        {isEditable && !isLocked && (
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
  const [filters, setFilters] = useState({ search: '', house_id: '', channel_id: '', status: '', payment_status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('checkin_date');
  const [sortDir, setSortDir] = useState('desc');
  const [gapWarnings, setGapWarnings] = useState([]);
  const [duplicateInvoices, setDuplicateInvoices] = useState(new Set()); // booking ids with duplicate invoice numbers
  const [invoiceLang, setInvoiceLang] = useState('de');
  const [editingCell, setEditingCell] = useState(null); // { id, field, value }
  const [filteredAll, setFilteredAll] = useState([]); // all bookings matching current filters (for analytics)
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

  useEffect(() => {
    const params = { ...filters, page: 1, limit: 1000 };
    Object.keys(params).forEach(k => !params[k] && delete params[k]);
    api.get('/bookings', { params }).then(r => setFilteredAll(r.data.data || []));
  }, [filters]);

  const analytics = useMemo(() => {
    const relevant = filteredAll.filter(b => b.included_in_stats !== false);
    const totalRevenue = relevant.reduce((sum, b) => sum + (b.total_price || 0), 0);
    const byStatus = {};
    const byHouse = {};
    relevant.forEach(b => {
      byStatus[b.status] = byStatus[b.status] || { count: 0, revenue: 0 };
      byStatus[b.status].count++;
      byStatus[b.status].revenue += b.total_price || 0;

      const houseKey = b.house_short || `Haus ${b.house_id}`;
      byHouse[houseKey] = byHouse[houseKey] || { count: 0, revenue: 0 };
      byHouse[houseKey].count++;
      byHouse[houseKey].revenue += b.total_price || 0;
    });
    return { count: relevant.length, totalRevenue, byStatus, byHouse };
  }, [filteredAll]);

  useEffect(() => {
    return onDataChange((e) => {
      if (e.detail?.type === 'invoice' || e.detail?.type === 'customer') {
        load();
        loadAllBookings();
      }
    });
  }, [load, loadAllBookings]);

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

  const handleClearOverrides = async (b) => {
    const fields = (b._manual_fields || []).map(f => FIELD_LABELS[f] || f).join(', ');
    if (!confirm(`Manuelle Sperrung für „${b.guest_name}" aufheben?\nGesperrte Felder: ${fields}\n\nBeim nächsten Lodgify-Import werden diese Felder wieder überschrieben.`)) return;
    await api.delete(`/bookings/${b.id}/clear-overrides`);
    load();
    loadAllBookings();
  };

  const handleUnlockField = async (b, field) => {
    if (!confirm(`Feld „${FIELD_LABELS[field] || field}" für „${b.guest_name}" wieder freigeben?\n\nEs wird beim nächsten Lodgify-Import wieder automatisch überschrieben.`)) return;
    await api.delete(`/bookings/${b.id}/unlock-field`, { params: { field } });
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

    // Last-edit-wins for invoice numbers: applyInvoiceNumber handles conflict
    // confirmation and clears the number from any other booking that had it.
    if (editingCell.field === 'invoice_number') {
      const inv = String(val).trim();
      const ok = await applyInvoiceNumber(editingCell.id, inv);
      if (ok) { load(); loadAllBookings(); }
      return;
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

      {/* Analytics panel */}
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-4">
          <div className="bg-blue-50 rounded-lg px-4 py-2 min-w-[140px]">
            <div className="text-xs text-gray-500">Buchungen (gefiltert)</div>
            <div className="text-xl font-bold text-gray-900">{analytics.count}</div>
          </div>
          <div className="bg-green-50 rounded-lg px-4 py-2 min-w-[160px]">
            <div className="text-xs text-gray-500">Umsatz gesamt</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(analytics.totalRevenue)}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Nach Status</div>
            <div className="space-y-1">
              {Object.entries(analytics.byStatus).map(([status, v]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status] || status}</span>
                  <span className="text-gray-600">{v.count} · {formatCurrency(v.revenue)}</span>
                </div>
              ))}
              {Object.keys(analytics.byStatus).length === 0 && <div className="text-xs text-gray-400">Keine Daten</div>}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Nach Haus</div>
            <div className="space-y-1">
              {Object.entries(analytics.byHouse).map(([house, v]) => (
                <div key={house} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{house}</span>
                  <span className="text-gray-600">{v.count} · {formatCurrency(v.revenue)}</span>
                </div>
              ))}
              {Object.keys(analytics.byHouse).length === 0 && <div className="text-xs text-gray-400">Keine Daten</div>}
            </div>
          </div>
        </div>
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
      <div className="card space-y-3">
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
          <select className="form-select" value={filters.payment_status} onChange={e => setFilter('payment_status', e.target.value)}>
            <option value="">Alle Zahlungen</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="date" className="form-input flex-1" value={filters.from} onChange={e => setFilter('from', e.target.value)} title="Von (Anreise)" />
            <input type="date" className="form-input flex-1" value={filters.to} onChange={e => setFilter('to', e.target.value)} title="Bis (Anreise)" />
          </div>
        </div>
        {/* Quick filters */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
          <span className="text-xs text-gray-400">Schnellfilter:</span>
          <button
            type="button"
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filters.payment_status === 'offen' && filters.status === 'bestaetigt' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'}`}
            onClick={() => {
              if (filters.payment_status === 'offen' && filters.status === 'bestaetigt') {
                setFilters(f => ({ ...f, payment_status: '', status: '' }));
              } else {
                setFilters(f => ({ ...f, payment_status: 'offen', status: 'bestaetigt' }));
                setPage(1);
              }
            }}
          >
            💰 Offene Posten
          </button>
          <button
            type="button"
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${!Object.values(filters).some(Boolean) ? 'bg-gray-200 text-gray-500 cursor-default' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => { setFilters({ search: '', house_id: '', channel_id: '', status: '', payment_status: '', from: '', to: '' }); setPage(1); }}
            disabled={!Object.values(filters).some(Boolean)}
          >
            ✕ Filter zurücksetzen
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto table-scroll">
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
                  className={`hover:bg-gray-50 cursor-pointer ${editingCell?.id === b.id ? 'bg-blue-50/40' : ''} ${duplicateInvoices.has(b.id) ? 'bg-red-50/60' : ''}`}
                  onClick={() => navigate(`/bookings/${b.id}/edit`)}
                  title="Klicken zum Bearbeiten der Buchung"
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
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
                        title="Buchung bearbeiten"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => navigate(`/tasks?booking=${b.id}`)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 transition-colors"
                        title="Aufgaben anzeigen"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      </button>
                      <button
                        onClick={() => handleToggleStats(b)}
                        title={b.included_in_stats === false ? 'Nicht in Auswertung – klicken zum Aktivieren' : 'In Auswertung – klicken zum Deaktivieren'}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${b.included_in_stats === false ? 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                      </button>
                      {b._has_manual_overrides && (
                        <button
                          onClick={() => handleClearOverrides(b)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors"
                          title={`Manuell gesperrt: ${(b._manual_fields||[]).map(f=>FIELD_LABELS[f]||f).join(', ')} – Klicken zum Freigeben`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(b.id, b.guest_name)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors"
                        title="Buchung löschen"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
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
                      isLocked={b._has_manual_overrides && b._manual_fields?.includes(col.key)}
                      onUnlockField={handleUnlockField}
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
    </div>
  );
}
