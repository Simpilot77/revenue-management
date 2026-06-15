import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS } from '../utils/format';
import { onDataChange } from '../utils/syncBus';

const ACTIVE_STATUSES = ['bestaetigt', 'eingecheckt', 'ausgecheckt'];

// Flattens each booking's invoices into one row per invoice. Bookings without
// an `invoices[]` (legacy data) fall back to a single synthetic row based on
// their `invoice_number` field.
function flattenInvoiceRows(bookings) {
  const rows = [];
  bookings
    .filter(b => ACTIVE_STATUSES.includes(b.status) && (b.invoice_number || b.invoices?.length))
    .forEach(b => {
      if (b.invoices?.length) {
        b.invoices.forEach(inv => {
          rows.push({
            rowId: `${b.id}-${inv.id}`,
            booking: b,
            invoice_number: (inv.invoice_number || '').trim(),
            type: inv.type || 'normal',
            reference_invoice_number: inv.reference_invoice_number || null,
            invoice_date: inv.invoice_date || null,
            brutto_total: inv.brutto_total,
          });
        });
      } else if (b.invoice_number) {
        rows.push({
          rowId: `${b.id}-legacy`,
          booking: b,
          invoice_number: b.invoice_number.trim(),
          type: 'normal',
          reference_invoice_number: null,
          invoice_date: null,
          brutto_total: Number(b.total_price),
        });
      }
    });
  return rows;
}

function analyzeInvoices(bookings) {
  const rows = flattenInvoiceRows(bookings);

  const byHouseYear = {};
  const invoiceMap = {};
  rows.forEach(row => {
    const inv = row.invoice_number;
    if (!inv) return;
    if (!invoiceMap[inv]) invoiceMap[inv] = [];
    invoiceMap[inv].push(row.rowId);

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

  const gaps = [];
  Object.entries(byHouseYear).forEach(([key, nums]) => {
    const sorted = [...nums].sort((a, b) => a - b);
    const missing = [];
    for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
      if (!sorted.includes(i)) missing.push(i);
    }
    if (missing.length) gaps.push({ key, missing });
  });

  const duplicates = new Set();
  Object.entries(invoiceMap).forEach(([inv, ids]) => {
    if (ids.length > 1) ids.forEach(id => duplicates.add(id));
  });

  const sorted = [...rows].sort((a, b) => a.invoice_number.localeCompare(b.invoice_number));

  return { sorted, gaps, duplicates };
}

export default function InvoiceManagementPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);

  const load = useCallback(() => {
    api.get('/bookings', { params: { limit: 500 } }).then(res => {
      setBookings(res.data?.data || []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => onDataChange((e) => {
    if (e.detail?.type === 'invoice' || e.detail?.type === 'customer') load();
  }), [load]);

  const { sorted, gaps, duplicates } = useMemo(() => analyzeInvoices(bookings), [bookings]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">🧾 Rechnungsmanagement</h1>
        <p className="text-xs text-gray-400 mt-0.5">Alle Rechnungen mit laufender Nummerierung, Lücken und Duplikaten</p>
      </div>

      {/* ── Summary banner ── */}
      {(gaps.length > 0 || duplicates.size > 0) && (
        <div className="space-y-2">
          {gaps.length > 0 && (
            <div className="card p-3 bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <span className="font-semibold">{gaps.reduce((s, g) => s + g.missing.length, 0)} Lücke{gaps.reduce((s, g) => s + g.missing.length, 0) !== 1 ? 'n' : ''} gefunden:</span>{' '}
              {gaps.map(g => `${g.key}: fehlende Nr. ${g.missing.map(n => String(n).padStart(4, '0')).join(', ')}`).join(' · ')}
            </div>
          )}
          {duplicates.size > 0 && (
            <div className="card p-3 bg-red-50 border border-red-200 text-sm text-red-700">
              <span className="font-semibold">{duplicates.size} doppelt vergebene Rechnungsnummer{duplicates.size !== 1 ? 'n' : ''}</span> – siehe rot markierte Zeilen unten.
            </div>
          )}
        </div>
      )}
      {gaps.length === 0 && duplicates.size === 0 && sorted.length > 0 && (
        <div className="card p-3 bg-green-50 border border-green-200 text-sm text-green-700">
          ✅ Keine Lücken oder Duplikate in der Rechnungsnummerierung.
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Rechnungsnr.</th>
              <th className="text-left px-4 py-2">Typ</th>
              <th className="text-left px-4 py-2">Haus</th>
              <th className="text-left px-4 py-2">Gast</th>
              <th className="text-left px-4 py-2">Datum</th>
              <th className="text-right px-4 py-2">Betrag</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(row => {
              const b = row.booking;
              return (
                <tr key={row.rowId} className={duplicates.has(row.rowId) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-2 font-mono whitespace-nowrap">
                    {row.invoice_number}
                    {duplicates.has(row.rowId) && <span className="ml-2 text-xs font-medium text-red-600">⚠ Duplikat</span>}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.type === 'storno' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {row.type === 'storno' ? 'Storno' : 'Normal'}
                    </span>
                    {row.type === 'storno' && row.reference_invoice_number && (
                      <div className="text-xs text-gray-400 mt-0.5">↩ {row.reference_invoice_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{b.house_name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{b.guest_name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.invoice_date || formatDate(b.checkin_date)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{formatCurrency(Number(row.brutto_total))}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button className="btn-secondary text-xs py-1 px-2" onClick={() => navigate(`/bookings/${b.id}/edit`)}>✏️ Öffnen</button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Keine Rechnungen mit Rechnungsnummer vorhanden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
