import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { exportCustomers } from '../utils/pdfExport';
import { formatDate, formatCurrency, STATUS_LABELS, STATUS_COLORS } from '../utils/format';

function CustomerDetailModal({ customer, onClose, onEdit }) {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/customers/bookings', { params: { guest_name: customer.guest_name } })
      .then(r => setBookings(r.data.data || []))
      .finally(() => setLoading(false));
  }, [customer.guest_name]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{customer.guest_name}</h2>
            {customer.company_name && <p className="text-sm text-slate-500">{customer.company_name}</p>}
            <p className="text-xs text-slate-400 font-mono">{customer.customer_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="btn-secondary text-sm">✏️ Bearbeiten</button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none">×</button>
          </div>
        </div>
        {/* Customer info */}
        <div className="px-6 py-4 grid grid-cols-3 gap-4 text-sm border-b bg-slate-50">
          <div><span className="text-slate-400">E-Mail</span><div className="font-medium">{customer.email || '—'}</div></div>
          <div><span className="text-slate-400">Telefon</span><div className="font-medium">{customer.phone || '—'}</div></div>
          <div><span className="text-slate-400">Buchungen / Umsatz</span><div className="font-medium">{customer.bookings_count} · {formatCurrency(customer.total_revenue)}</div></div>
        </div>
        {/* Bookings */}
        <div className="flex-1 overflow-auto">
          <div className="px-6 py-3 text-sm font-semibold text-slate-600 border-b bg-white sticky top-0">
            Buchungen {loading ? '…' : `(${bookings.length})`}
          </div>
          {loading ? (
            <div className="text-center py-8 text-slate-400">Lade…</div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Keine Buchungen gefunden</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {['Haus','Anreise','Abreise','N.','Kanal','Gesamtpreis','Status'].map(h => (
                    <th key={h} className="text-left text-slate-500 font-medium px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => { onClose(); navigate(`/bookings/${b.id}/edit`); }}>
                    <td className="px-4 py-2 font-medium">{b.house_short}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(b.checkin_date)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(b.checkout_date)}</td>
                    <td className="px-4 py-2 text-center">{b.nights}</td>
                    <td className="px-4 py-2">
                      {b.channel_short && <span className="badge text-white text-xs" style={{ backgroundColor: b.channel_color }}>{b.channel_short}</span>}
                    </td>
                    <td className="px-4 py-2 font-medium">{formatCurrency(b.total_price)}</td>
                    <td className="px-4 py-2"><span className={`badge ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_CUSTOMER = {
  guest_name: '',
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  billing_address: { street: '', zip: '', city: '', country: 'DE' },
  tax_id: '',
  vat_id: '',
  notes: '',
  is_returning_guest: false,
};

function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState(
    customer
      ? {
          ...customer,
          billing_address: customer.billing_address || { street: '', zip: '', city: '', country: 'DE' },
        }
      : { ...EMPTY_CUSTOMER }
  );
  const [numDuplicate, setNumDuplicate] = useState(false);
  const [numLoading, setNumLoading]     = useState(false);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const setAddr = (field, value) =>
    setForm(f => ({ ...f, billing_address: { ...f.billing_address, [field]: value } }));

  // Check for duplicate customer number (debounced on change)
  const handleNumChange = async (val) => {
    set('customer_number', val);
    if (!val) { setNumDuplicate(false); return; }
    // Don't warn if unchanged from original
    if (customer && customer.customer_number === val) { setNumDuplicate(false); return; }
    try {
      const { data } = await api.get('/customers/check-number', { params: { customer_number: val } });
      setNumDuplicate(data.exists);
    } catch { setNumDuplicate(false); }
  };

  const suggestNextNumber = async () => {
    setNumLoading(true);
    try {
      const { data } = await api.get('/customers/next-number');
      set('customer_number', data.customer_number);
      setNumDuplicate(false);
    } catch (_) {}
    finally { setNumLoading(false); }
  };

  // Auto-suggest on open for new customers
  useEffect(() => {
    if (!customer) suggestNextNumber();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (numDuplicate) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">
            {customer ? 'Kunde bearbeiten' : 'Neuer Kunde'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer number */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Kundennummer</label>
              <div className="flex gap-2 items-center">
                <input
                  className={`form-input font-mono text-sm w-28 ${numDuplicate ? 'border-red-400 bg-red-50' : ''}`}
                  value={form.customer_number || ''}
                  onChange={e => handleNumChange(e.target.value.replace(/\D/g, '').slice(0, 4).padStart(form.customer_number?.length > 0 ? 0 : 0, ''))}
                  placeholder="0001"
                  maxLength={4}
                />
                <button type="button" onClick={suggestNextNumber} disabled={numLoading}
                  className="text-xs px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 font-medium whitespace-nowrap">
                  {numLoading ? '…' : '🔢 Auto'}
                </button>
                {numDuplicate && (
                  <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    ⚠ Nummer bereits vergeben!
                  </span>
                )}
                {!numDuplicate && form.customer_number && (
                  <span className="text-xs text-emerald-600 font-medium">✓ Verfügbar</span>
                )}
              </div>
            </div>
          </div>

          {/* Personal */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Persönliche Daten</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name / Gast *</label>
                <input
                  className="form-input w-full"
                  value={form.guest_name}
                  onChange={e => set('guest_name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                <input
                  className="form-input w-full"
                  value={form.company_name || ''}
                  onChange={e => set('company_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ansprechpartner</label>
                <input
                  className="form-input w-full"
                  value={form.contact_person || ''}
                  onChange={e => set('contact_person', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  className="form-input w-full"
                  value={form.email || ''}
                  onChange={e => set('email', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                <input
                  className="form-input w-full"
                  value={form.phone || ''}
                  onChange={e => set('phone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Rechnungsadresse</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Straße</label>
                <input
                  className="form-input w-full"
                  value={form.billing_address?.street || ''}
                  onChange={e => setAddr('street', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PLZ</label>
                <input
                  className="form-input w-full"
                  value={form.billing_address?.zip || ''}
                  onChange={e => setAddr('zip', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stadt</label>
                <input
                  className="form-input w-full"
                  value={form.billing_address?.city || ''}
                  onChange={e => setAddr('city', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Land</label>
                <input
                  className="form-input w-full"
                  value={form.billing_address?.country || ''}
                  onChange={e => setAddr('country', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tax */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Steuer</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Steuernummer</label>
                <input
                  className="form-input w-full"
                  value={form.tax_id || ''}
                  onChange={e => set('tax_id', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">USt-IdNr.</label>
                <input
                  className="form-input w-full"
                  value={form.vat_id || ''}
                  onChange={e => set('vat_id', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes + returning */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notizen</label>
            <textarea
              className="form-input w-full"
              rows={3}
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_returning_guest || false}
              onChange={e => set('is_returning_guest', e.target.checked)}
            />
            Stammgast
          </label>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary">Speichern</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalCustomer, setModalCustomer] = useState(null); // null = closed, {} = new, obj = edit
  const [modalOpen, setModalOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const importRef = useRef();

  const fetchCustomers = async (q = '') => {
    setLoading(true);
    try {
      const res = await api.get('/customers', { params: { search: q, limit: 100 } });
      setCustomers(res.data.data || res.data);
      setTotal(res.data.total ?? (res.data.data?.length ?? res.data.length));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(search);
  }, [search]);

  const openNew = () => { setModalCustomer(null); setModalOpen(true); };
  const openEdit = (c) => { setModalCustomer(c); setModalOpen(true); setDetailCustomer(null); };
  const closeModal = () => setModalOpen(false);

  const handleSave = async (form) => {
    if (modalCustomer) {
      await api.put(`/customers/${modalCustomer.id}`, form);
    } else {
      await api.post('/customers', form);
    }
    closeModal();
    fetchCustomers(search);
  };

  const handleDelete = async (id) => {
    if (!confirm('Kunden wirklich löschen?')) return;
    await api.delete(`/customers/${id}`);
    fetchCustomers(search);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(customers, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kunden_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleExportPDF = () => {
    exportCustomers(customers);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        const arr = Array.isArray(imported) ? imported : [imported];
        for (const c of arr) {
          // Try to match by customer_number or guest_name
          const existing = customers.find(
            x => x.customer_number === c.customer_number || x.guest_name?.toLowerCase() === c.guest_name?.toLowerCase()
          );
          if (existing) {
            await api.put(`/customers/${existing.id}`, { ...existing, ...c, id: existing.id });
          } else {
            await api.post('/customers', c);
          }
        }
        fetchCustomers(search);
      } catch {
        alert('Fehler beim Importieren der JSON-Datei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const fmt = (v) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0);

  return (
    <div className="p-6 space-y-5">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kundendatenbank</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} Kunden gesamt</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => importRef.current?.click()} className="btn-secondary text-sm">
            Import JSON
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button onClick={handleExportJSON} className="btn-secondary text-sm">
            Export JSON
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-sm">
            Export PDF
          </button>
          <button onClick={openNew} className="btn-primary text-sm">
            + Neuer Kunde
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4">
        <input
          type="search"
          placeholder="Suche nach Name, Firma, E-Mail ..."
          className="form-input w-full max-w-md"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {detailCustomer && (
        <CustomerDetailModal
          customer={detailCustomer}
          onClose={() => setDetailCustomer(null)}
          onEdit={() => openEdit(detailCustomer)}
        />
      )}
      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Kundennr.</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Name / Firma</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">E-Mail</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Telefon</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Buchungen</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Umsatz</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">Lade Daten...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">Keine Kunden gefunden.</td>
                </tr>
              ) : (
                customers.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}
                    onClick={() => setDetailCustomer(c)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.customer_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{c.guest_name}</div>
                      {c.company_name && <div className="text-xs text-slate-500">{c.company_name}</div>}
                      {c.is_returning_guest && (
                        <span className="inline-block mt-0.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          Stammgast
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium">
                        {c.bookings_count ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(c.total_revenue)}</td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
                        onClick={() => openEdit(c)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                        onClick={() => handleDelete(c.id)}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <CustomerModal
          customer={modalCustomer}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
