import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { nightsBetween, formatCurrency, formatDate, STATUS_LABELS } from '../utils/format';
import { splitInvoiceNumber, composeInvoiceNumber, isManualInvoiceNumber } from '../utils/numbering';
import InvoiceListSection from '../components/InvoiceListSection';

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  house_id: '',
  channel_id: '',
  external_reference: '',
  booking_date: today(),
  checkin_date: '',
  checkout_date: '',
  guest_name: '',
  company_name: '',
  guest_email: '',
  guest_phone: '',
  nationality: '',
  is_returning_guest: false,
  billing_street: '',
  billing_zip: '',
  billing_city: '',
  billing_country: '',
  guest_count: 1,
  adults: 1,
  children: 0,
  daily_rate: '',
  cleaning_fee: '',
  discount_percent: 0,
  total_price: '',
  currency: 'EUR',
  payment_method: 'ueberweisung',
  payment_status: 'offen',
  payment_date: '',
  invoice_number: '',
  commission_amount: '',
  commission_overridden: false,
  deposit_taken: false,
  deposit_amount: '',
  deposit_returned: false,
  invoice_sent: false,
  guests_registered: false,
  included_in_stats: true,
  cleaning_date: '',
  cleaning_required: true,
  status: 'bestaetigt',
  cancellation_date: '',
  cancellation_reason: '',
  guest_notes: '',
  internal_notes: '',
};

function Section({ title, children }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children, span = 1, hint }) {
  const spanClass = span === 2 ? 'md:col-span-2' : span === 3 ? 'col-span-full' : '';
  return (
    <div className={spanClass}>
      <label className="form-label">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function BookingFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [savedBooking, setSavedBooking] = useState(null);
  const [houses, setHouses] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceLang] = useState('de');
  const [duplicates, setDuplicates] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // booking to delete
  const [lastInvNum, setLastInvNum] = useState(null); // last issued invoice number for this house
  const [guestChangeModal, setGuestChangeModal] = useState(null); // { payload, otherBookings, guestFields }
  const [depositModal, setDepositModal] = useState(null); // { amount } while editing deposit amount
  const [statusWarning, setStatusWarning] = useState(null); // Warntext bei Status-Logikcheck
  const cleaningDateTouched = useRef(false);

  // ── localStorage helpers for task sync ──
  const loadBookingTasks = (bookingId) => {
    try { return JSON.parse(localStorage.getItem('booking_tasks') || '{}')?.[bookingId] || {}; } catch { return {}; }
  };
  const saveBookingTaskField = (bookingId, key, value) => {
    try {
      const all = JSON.parse(localStorage.getItem('booking_tasks') || '{}');
      if (!all[bookingId]) all[bookingId] = {};
      all[bookingId][key] = value;
      localStorage.setItem('booking_tasks', JSON.stringify(all));
    } catch (_) {}
  };

  useEffect(() => {
    Promise.all([api.get('/meta/houses'), api.get('/meta/channels')]).then(([h, c]) => {
      setHouses(h.data);
      setChannels(c.data);
      if (!isEdit && h.data.length) setForm(f => ({ ...f, house_id: h.data[0].id }));
    });
    if (isEdit) {
      api.get(`/bookings/${id}`).then(r => {
        const b = r.data;
        setSavedBooking(b);
        // Merge task-state from localStorage for invoice_sent / guests_registered
        const taskState = loadBookingTasks(b.id);
        setForm({
          ...EMPTY_FORM,
          ...b,
          house_id: b.house_id ?? '',
          channel_id: b.channel_id ?? '',
          checkin_date: b.checkin_date?.slice(0, 10) ?? '',
          checkout_date: b.checkout_date?.slice(0, 10) ?? '',
          booking_date: b.booking_date?.slice(0, 10) ?? today(),
          cancellation_date: b.cancellation_date?.slice(0, 10) ?? '',
          cleaning_date: b.cleaning_date?.slice(0, 10) ?? b.checkout_date?.slice(0, 10) ?? '',
          cleaning_required: b.cleaning_required ?? true,
          billing_street: b.billing_address?.street ?? b.billing_street ?? '',
          billing_zip: b.billing_address?.zip ?? b.billing_zip ?? '',
          billing_city: b.billing_address?.city ?? b.billing_city ?? '',
          billing_country: b.billing_address?.country ?? b.billing_country ?? '',
          daily_rate: b.daily_rate ?? '',
          cleaning_fee: b.cleaning_fee ?? '',
          total_price: b.total_price ?? '',
          commission_amount: b.commission_amount ?? '',
          commission_overridden: b.commission_overridden ?? false,
          deposit_taken: b.deposit_taken ?? false,
          deposit_amount: b.deposit_amount ?? '',
          deposit_returned: b.deposit_returned ?? false,
          invoice_sent: taskState.invoice ?? b.invoice_sent ?? false,
          guests_registered: taskState.guests ?? b.guests_registered ?? false,
          included_in_stats: b.included_in_stats ?? true,
        });
      });
    }
  }, [id, isEdit]);

  // Auto-calculate total price
  useEffect(() => {
    const nights = nightsBetween(form.checkin_date, form.checkout_date);
    const daily = parseFloat(form.daily_rate) || 0;
    const cleaning = parseFloat(form.cleaning_fee) || 0;
    const discount = parseFloat(form.discount_percent) || 0;
    if (daily > 0 && nights > 0) {
      const subtotal = daily * nights + cleaning;
      const total = subtotal * (1 - discount / 100);
      setForm(f => ({ ...f, total_price: total.toFixed(2) }));
    }
  }, [form.checkin_date, form.checkout_date, form.daily_rate, form.cleaning_fee, form.discount_percent]);

  // Auto-calculate commission when channel or total_price changes (unless overridden)
  useEffect(() => {
    if (form.commission_overridden) return;
    const ch = channels.find(c => c.id === parseInt(form.channel_id));
    const rate = ch?.commission_rate ?? 0;
    const gross = parseFloat(form.total_price) || 0;
    const calc = parseFloat((gross * rate / 100).toFixed(2));
    setForm(f => ({ ...f, commission_amount: calc > 0 ? calc : '' }));
  }, [form.channel_id, form.total_price, form.commission_overridden, channels]);

  // Auto-set payment_status to 'offen' when status is 'angefragt'
  useEffect(() => {
    if (form.status === 'angefragt') {
      setForm(f => ({ ...f, payment_status: 'offen' }));
    }
  }, [form.status]);

  // Auto-set cleaning_date to checkout_date if not manually touched
  useEffect(() => {
    if (!cleaningDateTouched.current && form.checkout_date) {
      setForm(f => ({ ...f, cleaning_date: form.checkout_date }));
    }
  }, [form.checkout_date]);

  // Duplicate detection: same house, overlapping dates, other booking
  useEffect(() => {
    if (!form.house_id || !form.checkin_date || !form.checkout_date) {
      setDuplicates([]);
      return;
    }
    api.get('/bookings', { params: {
      house_id: form.house_id,
      from: form.checkin_date,
      to: form.checkout_date,
      limit: 100,
    }}).then(r => {
      const others = (r.data.data || []).filter(b => {
        if (isEdit && b.id === parseInt(id)) return false;
        if (!['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status)) return false;
        return b.checkin_date < form.checkout_date && b.checkout_date > form.checkin_date;
      });
      setDuplicates(others);
    }).catch(() => {});
  }, [form.house_id, form.checkin_date, form.checkout_date]);

  const handleDeleteDuplicate = async (bookingId) => {
    try {
      await api.delete(`/bookings/${bookingId}`);
      setDuplicates(prev => prev.filter(b => b.id !== bookingId));
      setDeleteConfirm(null);
    } catch {
      alert('Fehler beim Löschen der Buchung.');
    }
  };

  // Fetch last invoice number when house changes
  useEffect(() => {
    if (!form.house_id) { setLastInvNum(null); return; }
    api.get('/bookings/next-invoice-number', { params: { house_id: form.house_id } })
      .then(({ data }) => {
        // Deduce "last" from "next": extract trailing 4-digit seq and subtract 1
        const inv = data.invoice_number || '';
        const match = inv.match(/(\D+-)(\d{4})$/);
        if (match) {
          const seq = parseInt(match[2], 10);
          setLastInvNum(seq > 1 ? `${match[1]}${String(seq - 1).padStart(4, '0')}` : null);
        } else {
          setLastInvNum(null);
        }
      })
      .catch(() => setLastInvNum(null));
  }, [form.house_id]);

  const set = (key, value) => {
    if (key === 'cleaning_date') cleaningDateTouched.current = true;
    // Sync invoice_sent / guests_registered ↔ booking_tasks localStorage
    if (isEdit && id) {
      if (key === 'invoice_sent')      saveBookingTaskField(parseInt(id), 'invoice', value);
      if (key === 'guests_registered') saveBookingTaskField(parseInt(id), 'guests', value);
    }
    setForm(f => ({ ...f, [key]: value }));
  };
  const setNum = (key, value) => setForm(f => ({ ...f, [key]: value === '' ? '' : Number(value) }));

  // Rechnungsnummer in 3 Felder (Präfix / Jahr / Suffix) aufgeteilt
  const [invParts, setInvParts] = useState(() => splitInvoiceNumber(form.invoice_number));
  const lastComposedRef = useRef(composeInvoiceNumber(invParts));

  // Externe Änderungen an form.invoice_number (Laden, Auto-Button) in die 3 Felder übernehmen
  useEffect(() => {
    if (form.invoice_number !== lastComposedRef.current) {
      lastComposedRef.current = form.invoice_number;
      setInvParts(splitInvoiceNumber(form.invoice_number));
    }
  }, [form.invoice_number]);

  // Änderungen an den 3 Feldern wieder zu form.invoice_number zusammensetzen
  useEffect(() => {
    const composed = composeInvoiceNumber(invParts);
    if (composed !== lastComposedRef.current) {
      lastComposedRef.current = composed;
      set('invoice_number', composed);
    }
  }, [invParts]);

  const setInvPart = (part, value) => setInvParts(prev => ({ ...prev, [part]: value }));

  const generateInvoiceNumber = async () => {
    setInvoiceLoading(true);
    try {
      const { data } = await api.get('/bookings/next-invoice-number', { params: { house_id: form.house_id } });
      set('invoice_number', data.invoice_number);
    } catch {
      const year = new Date().getFullYear();
      set('invoice_number', `RE-${year}-0001`);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const nights = nightsBetween(form.checkin_date, form.checkout_date);

  const selectedHouse = houses.find(h => h.id === parseInt(form.house_id));

  const selectedChannel = channels.find(c => c.id === parseInt(form.channel_id));
  const autoCommRate = selectedChannel?.commission_rate ?? 0;

  // Guest fields that may be copied to other bookings of same guest
  const GUEST_FIELDS = ['guest_name', 'company_name', 'guest_email', 'guest_phone',
    'billing_street', 'billing_zip', 'billing_city', 'billing_country', 'nationality'];

  const buildPayload = () => ({
    ...form,
    house_id: parseInt(form.house_id),
    channel_id: form.channel_id ? parseInt(form.channel_id) : null,
    guest_count: parseInt(form.guest_count) || 1,
    adults: parseInt(form.adults) || 1,
    children: parseInt(form.children) || 0,
    daily_rate: form.daily_rate !== '' ? parseFloat(form.daily_rate) : null,
    cleaning_fee: form.cleaning_fee !== '' ? parseFloat(form.cleaning_fee) : 0,
    discount_percent: parseFloat(form.discount_percent) || 0,
    total_price: parseFloat(form.total_price),
    commission_amount: form.commission_amount !== '' ? parseFloat(form.commission_amount) : 0,
    deposit_amount: form.deposit_amount !== '' ? parseFloat(form.deposit_amount) : null,
    cancellation_date: form.cancellation_date || null,
    billing_address: {
      street: form.billing_street || '',
      zip: form.billing_zip || '',
      city: form.billing_city || '',
      country: form.billing_country || '',
    },
  });

  const savePayload = async (payload, applyToBookings = []) => {
    if (isEdit) {
      await api.put(`/bookings/${id}`, payload);
    } else {
      await api.post('/bookings', payload);
    }
    // Apply guest field changes to other bookings
    if (applyToBookings.length > 0) {
      const guestPatch = Object.fromEntries(
        GUEST_FIELDS.map(k => [k, payload[k]])
      );
      await Promise.all(applyToBookings.map(b =>
        api.put(`/bookings/${b.id}`, { ...b, ...guestPatch })
      ));
    }
    // Sync cleaning_date into localStorage cleaning_markers
    if (payload.cleaning_required !== false && payload.cleaning_date && payload.house_id) {
      try {
        const markers = JSON.parse(localStorage.getItem('cleaning_markers') || '{}');
        markers[`${payload.house_id}_${payload.cleaning_date}`] = true;
        localStorage.setItem('cleaning_markers', JSON.stringify(markers));
      } catch (_) {}
    }
    navigate('/bookings');
  };

  // Prüft, ob der gewählte Status zu den Anreise-/Abreisedaten passt.
  // Gibt einen Warntext zurück oder null, wenn alles plausibel ist.
  const checkStatusConsistency = () => {
    const today = new Date().toISOString().slice(0, 10);
    const ci = form.checkin_date, co = form.checkout_date;
    if (!ci || !co) return null;
    if (form.status === 'ausgecheckt' && co > today) {
      return `Status „${STATUS_LABELS.ausgecheckt}" ist gesetzt, aber das Abreisedatum (${formatDate(co)}) liegt in der Zukunft.`;
    }
    if (form.status === 'eingecheckt' && ci > today) {
      return `Status „${STATUS_LABELS.eingecheckt}" ist gesetzt, aber das Anreisedatum (${formatDate(ci)}) liegt in der Zukunft.`;
    }
    if (form.status === 'eingecheckt' && co < today) {
      return `Status „${STATUS_LABELS.eingecheckt}" ist gesetzt, aber das Abreisedatum (${formatDate(co)}) liegt bereits in der Vergangenheit.`;
    }
    if (['bestaetigt', 'angefragt'].includes(form.status) && co < today) {
      return `Status „${STATUS_LABELS[form.status]}" ist gesetzt, aber der Aufenthalt (bis ${formatDate(co)}) liegt bereits vollständig in der Vergangenheit.`;
    }
    return null;
  };

  const proceedSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const payload = buildPayload();

      // ── Guest change detection (only on edit) ──
      if (isEdit && savedBooking) {
        const originalName = (savedBooking.guest_name || '').toLowerCase().trim();
        const changedFields = GUEST_FIELDS.filter(k => {
          const oldVal = savedBooking[k] ?? '';
          const newVal = form[k] ?? '';
          return String(oldVal).trim() !== String(newVal).trim();
        });
        if (changedFields.length > 0 && originalName) {
          const res = await api.get('/customers/bookings', {
            params: { guest_name: savedBooking.guest_name }
          });
          const otherBookings = (res.data.data || []).filter(b => b.id !== parseInt(id));
          if (otherBookings.length > 0) {
            setGuestChangeModal({ payload, otherBookings, changedFields });
            setLoading(false);
            return;
          }
        }
      }

      await savePayload(payload, []);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const warning = checkStatusConsistency();
    if (warning) {
      setStatusWarning(warning);
      return;
    }
    await proceedSubmit();
  };

  const GUEST_FIELD_LABELS = {
    guest_name: 'Gastname', company_name: 'Firmenname', guest_email: 'E-Mail',
    guest_phone: 'Telefon', billing_street: 'Straße', billing_zip: 'PLZ',
    billing_city: 'Stadt', billing_country: 'Land', nationality: 'Nationalität',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Guest Change Modal */}
      {guestChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Gastdaten geändert</h2>
              <p className="text-sm text-gray-500 mt-1">
                Diese Änderungen betreffen auch andere Buchungen dieses Gastes.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Geänderte Felder:</span>{' '}
                {guestChangeModal.changedFields.map(f => GUEST_FIELD_LABELS[f] || f).join(', ')}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <span className="font-semibold">
                  {guestChangeModal.otherBookings.length} weitere Buchung{guestChangeModal.otherBookings.length !== 1 ? 'en' : ''}
                </span>{' '}gefunden:
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {guestChangeModal.otherBookings.slice(0, 5).map(b => (
                    <li key={b.id} className="text-amber-700">
                      · {b.house_short || `Haus ${b.house_id}`} · {b.checkin_date?.slice(0,10)} → {b.checkout_date?.slice(0,10)}
                    </li>
                  ))}
                  {guestChangeModal.otherBookings.length > 5 && (
                    <li className="text-amber-600">… und {guestChangeModal.otherBookings.length - 5} weitere</li>
                  )}
                </ul>
              </div>
              <p className="text-sm text-gray-600">
                Sollen die Änderungen auf <strong>alle</strong> Buchungen dieses Gastes übernommen werden?
              </p>
            </div>
            <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
              <button
                className="btn flex-1 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 rounded-lg"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await savePayload(guestChangeModal.payload, guestChangeModal.otherBookings);
                  } catch (err) {
                    setError(err.response?.data?.error || 'Fehler beim Speichern');
                  } finally {
                    setLoading(false);
                    setGuestChangeModal(null);
                  }
                }}
              >
                Ja, alle aktualisieren
              </button>
              <button
                className="btn flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await savePayload(guestChangeModal.payload, []);
                  } catch (err) {
                    setError(err.response?.data?.error || 'Fehler beim Speichern');
                  } finally {
                    setLoading(false);
                    setGuestChangeModal(null);
                  }
                }}
              >
                Nur diese Buchung
              </button>
              <button
                className="btn flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 py-2 rounded-lg"
                onClick={() => setGuestChangeModal(null)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status-Logikcheck-Warnung */}
      {statusWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">⚠️ Status prüfen</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700">{statusWarning}</p>
            </div>
            <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
              <button
                className="btn flex-1 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 rounded-lg"
                onClick={async () => {
                  setStatusWarning(null);
                  await proceedSubmit();
                }}
              >
                Trotzdem speichern
              </button>
              <button
                className="btn flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 py-2 rounded-lg"
                onClick={() => setStatusWarning(null)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Buchung bearbeiten' : 'Neue Buchung'}</h1>
          {nights > 0 && (
            <p className="text-gray-500 text-sm mt-1">{nights} Nacht{nights !== 1 ? 'e' : ''} · {form.total_price ? formatCurrency(parseFloat(form.total_price)) : '—'}</p>
          )}
        </div>
        {/* Quick status selector — most important action, right at the top */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Status:</span>
            <select
              className="text-sm font-semibold border-0 bg-transparent focus:ring-0 focus:outline-none pr-1 cursor-pointer"
              style={{
                color: {
                  angefragt:   '#d97706',
                  bestaetigt:  '#1d4ed8',
                  eingecheckt: '#16a34a',
                  ausgecheckt: '#6b7280',
                  storniert:   '#dc2626',
                  no_show:     '#7c3aed',
                }[form.status] || '#1d4ed8'
              }}
              value={form.status}
              onChange={e => set('status', e.target.value)}
            >
              <option value="angefragt">⏳ Angefragt</option>
              <option value="bestaetigt">✅ Bestätigt</option>
              <option value="eingecheckt">🏠 Eingecheckt</option>
              <option value="ausgecheckt">🏁 Ausgecheckt</option>
              <option value="storniert">❌ Storniert</option>
              <option value="no_show">👻 No-Show</option>
            </select>
          </div>
          <button onClick={() => navigate(-1)} className="btn-secondary">← Zurück</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Object & Channel */}
        <Section title="📍 Objekt, Kanal & Belegung">
          <Field label="Haus *">
            <select className="form-select" value={form.house_id} onChange={e => set('house_id', e.target.value)} required>
              <option value="">Bitte wählen…</option>
              {houses.map(h => <option key={h.id} value={h.id}>{h.name} ({h.capacity} Betten)</option>)}
            </select>
          </Field>
          <Field label="Buchungskanal">
            <select className="form-select" value={form.channel_id} onChange={e => set('channel_id', e.target.value)}>
              <option value="">Unbekannt</option>
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Externe Buchungsnr.">
            <input className="form-input" value={form.external_reference} onChange={e => set('external_reference', e.target.value)} placeholder="BDC-12345678" />
          </Field>
          <Field label="Anzahl Gäste gesamt *">
            <input type="number" className="form-input" min="1" max="20" value={form.guest_count} onChange={e => setNum('guest_count', e.target.value)} required />
          </Field>
          <Field label="davon Erwachsene">
            <input type="number" className="form-input" min="0" max="20" value={form.adults} onChange={e => setNum('adults', e.target.value)} />
          </Field>
          <Field label="davon Kinder">
            <input type="number" className="form-input" min="0" max="20" value={form.children} onChange={e => setNum('children', e.target.value)} />
          </Field>
        </Section>

        {/* Dates */}
        <Section title="📅 Zeitraum">
          <Field label="Buchungsdatum *">
            <input type="date" className="form-input" value={form.booking_date} onChange={e => set('booking_date', e.target.value)} required />
          </Field>
          <Field label="Anreise (Check-in) *">
            <input type="date" className="form-input" value={form.checkin_date} onChange={e => set('checkin_date', e.target.value)} required />
          </Field>
          <Field label="Abreise (Check-out) *">
            <input type="date" className="form-input" value={form.checkout_date} onChange={e => set('checkout_date', e.target.value)} required min={form.checkin_date} />
          </Field>
          <Field label=" ">
            <label className={`flex items-center gap-2 mt-1 cursor-pointer rounded-lg px-3 py-2 transition-colors ${form.cleaning_required ? 'bg-amber-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
              <input type="checkbox" className="rounded text-amber-500" checked={form.cleaning_required} onChange={e => set('cleaning_required', e.target.checked)} />
              <span className={`text-sm ${form.cleaning_required ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>🧹 Reinigung erforderlich</span>
            </label>
          </Field>
          {form.cleaning_required && (
            <Field label="Reinigungsdatum">
              <input
                type="date"
                className="form-input"
                value={form.cleaning_date}
                onChange={e => set('cleaning_date', e.target.value)}
                min={form.checkin_date}
              />
              <p className="text-xs text-gray-400 mt-1">Standard: Abreisedatum. Im Kalender 🧹 markiert.</p>
            </Field>
          )}
          {nights > 0 && (
            <div className="md:col-span-3">
              <span className="badge bg-blue-100 text-blue-700">🌙 {nights} Nacht{nights !== 1 ? 'e' : ''}</span>
            </div>
          )}
        </Section>

        {/* Guest */}
        <Section title="👤 Gast">
          <Field label="Gastname *">
            <input className="form-input" value={form.guest_name} onChange={e => set('guest_name', e.target.value)} required placeholder="Max Mustermann" />
          </Field>
          <Field label="Firma / Unternehmen">
            <input className="form-input" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Mustermann GmbH" />
          </Field>
          <Field label="Nationalität">
            <input className="form-input" value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="Deutsch" />
          </Field>
          <Field label="E-Mail">
            <input type="email" className="form-input" value={form.guest_email} onChange={e => set('guest_email', e.target.value)} />
          </Field>
          <Field label="Telefon">
            <input type="tel" className="form-input" value={form.guest_phone} onChange={e => set('guest_phone', e.target.value)} placeholder="+49 151 …" />
          </Field>
          <Field label=" ">
            <label className="flex items-center gap-2 mt-6 cursor-pointer">
              <input type="checkbox" className="rounded" checked={form.is_returning_guest} onChange={e => set('is_returning_guest', e.target.checked)} />
              <span className="text-sm text-gray-700">⭐ Stammgast / Wiederholungsbuchung</span>
            </label>
          </Field>

          {/* Billing address subsection */}
          <div className="col-span-full mt-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span>📬 Rechnungsadresse</span>
              <span className="text-gray-300 font-normal normal-case tracking-normal">— leer lassen = Aufenthaltsadresse (Haus) wird verwendet</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Straße + Hausnummer" span={1}>
                <input className="form-input" value={form.billing_street} onChange={e => set('billing_street', e.target.value)} placeholder="Musterstraße 12" />
              </Field>
              <Field label="PLZ" span={1}>
                <input className="form-input" value={form.billing_zip} onChange={e => set('billing_zip', e.target.value)} placeholder="12345" />
              </Field>
              <Field label="Ort" span={1}>
                <input className="form-input" value={form.billing_city} onChange={e => set('billing_city', e.target.value)} placeholder="Musterstadt" />
              </Field>
              <Field label="Land" span={1}>
                <input className="form-input" value={form.billing_country} onChange={e => set('billing_country', e.target.value)} placeholder="Deutschland" />
              </Field>
            </div>
          </div>
        </Section>

        {/* Pricing */}
        <Section title="💶 Preise">
          <Field label="Tagespreis (€)">
            <input type="number" className="form-input" min="0" step="0.01" value={form.daily_rate} onChange={e => set('daily_rate', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Reinigungsgebühr (€)">
            <input type="number" className="form-input" min="0" step="0.01" value={form.cleaning_fee} onChange={e => set('cleaning_fee', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Rabatt (%)">
            <input type="number" className="form-input" min="0" max="100" step="0.1" value={form.discount_percent} onChange={e => set('discount_percent', e.target.value)} />
          </Field>
          <Field label="Gesamtpreis (€) *">
            <input type="number" className="form-input font-bold" min="0" step="0.01" value={form.total_price} onChange={e => set('total_price', e.target.value)} required placeholder="Wird automatisch berechnet" />
          </Field>
          <Field label="Währung">
            <select className="form-select" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="EUR">EUR €</option>
              <option value="CHF">CHF</option>
              <option value="USD">USD $</option>
            </select>
          </Field>
        </Section>

        {/* Commission */}
        <Section title="📊 Portalkommission">
          <Field label={`Kommission ${autoCommRate > 0 ? `(${autoCommRate}% ${selectedChannel?.name ?? ''})` : ''}`}>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`form-input pr-16 ${form.commission_overridden ? 'border-amber-400 bg-amber-50' : ''}`}
                  value={form.commission_amount}
                  onChange={e => set('commission_amount', e.target.value)}
                  onFocus={() => set('commission_overridden', true)}
                  placeholder="0.00"
                />
                {form.commission_overridden && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-600 font-medium">⚠ manuell</span>
                )}
              </div>
              {form.commission_overridden && (
                <button
                  type="button"
                  className="btn-secondary text-xs px-2 py-1.5 whitespace-nowrap"
                  onClick={() => set('commission_overridden', false)}
                  title="Auf automatisch zurücksetzen"
                >↺ Auto</button>
              )}
            </div>
            {autoCommRate > 0 && !form.commission_overridden && (
              <p className="text-xs text-gray-400 mt-1">Automatisch berechnet ({autoCommRate}% von {formatCurrency(parseFloat(form.total_price) || 0)})</p>
            )}
          </Field>
        </Section>

        {/* Payment */}
        <Section title="💳 Zahlung & Rechnung">
          <Field label="Zahlungseingang (Datum)" hint="Leer lassen = Check-in-Datum wird für Cashflow verwendet">
            <input
              type="date"
              className="form-input"
              value={form.payment_date || ''}
              onChange={e => set('payment_date', e.target.value)}
            />
          </Field>
          <Field label="Zahlungsart">
            <select className="form-select" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
              <option value="ueberweisung">Überweisung</option>
              <option value="bar">Bar</option>
              <option value="kreditkarte">Kreditkarte</option>
              <option value="paypal">PayPal</option>
              <option value="sonstige">Sonstige</option>
            </select>
          </Field>
          <Field label="Zahlungsstatus">
            <select className="form-select" value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
              <option value="offen">Offen</option>
              <option value="anzahlung">Anzahlung erhalten</option>
              <option value="bezahlt">Vollständig bezahlt</option>
              <option value="erstattet">Erstattet</option>
            </select>
          </Field>
          <Field label={<>Rechnungsnummer (Präfix / Jahr / Nr.){isManualInvoiceNumber(savedBooking) && <span className="ml-1" title="Manuell eingegeben">✍️</span>}</>}>
            <div className="flex gap-1 items-center">
              <input
                className="form-input font-mono text-sm"
                style={{ maxWidth: '70px' }}
                value={invParts.prefix}
                onChange={e => setInvPart('prefix', e.target.value)}
                placeholder="15a"
              />
              <span className="text-gray-400">-</span>
              <input
                className="form-input font-mono text-sm"
                style={{ maxWidth: '64px' }}
                value={invParts.year}
                onChange={e => setInvPart('year', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="2026"
                maxLength={4}
              />
              <span className="text-gray-400">-</span>
              <input
                className="form-input font-mono text-sm"
                style={{ maxWidth: '70px' }}
                value={invParts.suffix}
                onChange={e => setInvPart('suffix', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="0001"
                maxLength={4}
              />
              <button
                type="button"
                onClick={generateInvoiceNumber}
                disabled={invoiceLoading}
                className="btn-secondary px-3 whitespace-nowrap text-xs"
                title="Nächste Rechnungsnummer automatisch vergeben"
              >
                {invoiceLoading ? '…' : '🔢 Auto'}
              </button>
            </div>
            {form.invoice_number && (
              <p className="text-xs text-gray-400 mt-1 font-mono">{form.invoice_number}</p>
            )}
            {lastInvNum && (
              <p className="text-xs text-gray-400 mt-0.5">Letzte vergebene Nr.: <span className="font-mono text-gray-500">{lastInvNum}</span></p>
            )}
          </Field>
          {(form.status === 'storniert' || form.status === 'no_show') && (
            <>
              <Field label="Stornierungsdatum">
                <input type="date" className="form-input" value={form.cancellation_date} onChange={e => set('cancellation_date', e.target.value)} />
              </Field>
              <Field label="Stornierungsgrund" span={2}>
                <input className="form-input" value={form.cancellation_reason} onChange={e => set('cancellation_reason', e.target.value)} placeholder="Grund der Stornierung…" />
              </Field>
            </>
          )}
        </Section>

        {/* Invoices list */}
        {isEdit && savedBooking && (
          <InvoiceListSection
            booking={{
              ...savedBooking, ...form,
              house_name: houses.find(h => h.id === parseInt(form.house_id))?.name || savedBooking.house_name,
              channel_name: channels.find(c => c.id === parseInt(form.channel_id))?.name || savedBooking.channel_name,
            }}
            invoiceLang={invoiceLang}
            onUpdate={() => api.get(`/bookings/${savedBooking.id}`).then(r => setSavedBooking(r.data))}
          />
        )}

        {/* Status checkboxes */}
        <Section title="✅ Checkliste">
          <Field label=" ">
            <label className={`flex items-center gap-2 mt-1 cursor-pointer rounded-lg px-3 py-2 transition-colors ${form.deposit_taken ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
              <input
                type="checkbox"
                className="rounded text-green-600"
                checked={form.deposit_taken}
                onChange={e => {
                  if (e.target.checked) {
                    setDepositModal({ amount: form.deposit_amount || '' });
                  } else {
                    setForm(f => ({ ...f, deposit_taken: false, deposit_amount: '', deposit_returned: false }));
                  }
                }}
              />
              <span className={`text-sm ${form.deposit_taken ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                🔒 Kaution genommen
                {form.deposit_taken && form.deposit_amount !== '' && (
                  <span className="ml-1 font-semibold">· {formatCurrency(form.deposit_amount)}</span>
                )}
              </span>
              {form.deposit_taken && (
                <button
                  type="button"
                  className="ml-auto text-xs text-blue-600 hover:underline"
                  onClick={(e) => { e.preventDefault(); setDepositModal({ amount: form.deposit_amount || '' }); }}
                >
                  Betrag ändern
                </button>
              )}
            </label>
          </Field>
          {form.deposit_taken && (
            <Field label=" ">
              <label className={`flex items-center gap-2 mt-1 cursor-pointer rounded-lg px-3 py-2 transition-colors ${form.deposit_returned ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                <input type="checkbox" className="rounded text-green-600" checked={form.deposit_returned} onChange={e => set('deposit_returned', e.target.checked)} />
                <span className={`text-sm ${form.deposit_returned ? 'text-green-700 font-medium' : 'text-gray-700'}`}>🔓 Kaution zurückgezahlt</span>
              </label>
            </Field>
          )}
          {[
            { key: 'invoice_sent',      label: '📧 Rechnung verschickt' },
            { key: 'guests_registered', label: '📋 Gäste registriert (Meldepflicht)' },
            { key: 'included_in_stats', label: '📊 In Auswertungen berücksichtigen' },
          ].map(({ key, label }) => (
            <Field key={key} label=" ">
              <label className={`flex items-center gap-2 mt-1 cursor-pointer rounded-lg px-3 py-2 transition-colors ${form[key] ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                <input type="checkbox" className="rounded text-green-600" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                <span className={`text-sm ${form[key] ? 'text-green-700 font-medium' : 'text-gray-700'}`}>{label}</span>
              </label>
            </Field>
          ))}
        </Section>

        {/* Deposit amount modal */}
        {depositModal && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
            onClick={() => {
            if (form.deposit_amount === '') setForm(f => ({ ...f, deposit_taken: false }));
            setDepositModal(null);
          }}
          >
            <div className="card" style={{ minWidth: 320, maxWidth: 380, padding: 24 }} onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-gray-900 mb-1">🔒 Kautionsbetrag</h3>
              <p className="text-sm text-gray-500 mb-4">Bitte trage den Betrag der erhaltenen Kaution ein.</p>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input w-full"
                placeholder="0,00"
                autoFocus
                value={depositModal.amount}
                onChange={e => setDepositModal({ amount: e.target.value })}
              />
              <div className="flex gap-3 justify-end mt-4">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    // Cancel: if no amount was saved yet, undo "Kaution genommen"
                    if (form.deposit_amount === '') setForm(f => ({ ...f, deposit_taken: false }));
                    setDepositModal(null);
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={depositModal.amount === ''}
                  onClick={() => {
                    setForm(f => ({ ...f, deposit_taken: true, deposit_amount: depositModal.amount }));
                    setDepositModal(null);
                  }}
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <Section title="📝 Notizen">
          <Field label="Gastnotizen (für Gast sichtbar)" span={3}>
            <textarea className="form-input" rows="2" value={form.guest_notes} onChange={e => set('guest_notes', e.target.value)} placeholder="Besondere Wünsche, Anmerkungen des Gastes…" />
          </Field>
          <Field label="Interne Notizen (nur intern)" span={3}>
            <textarea className="form-input" rows="2" value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} placeholder="Interne Hinweise, Aufgaben…" />
          </Field>
        </Section>

        {/* Duplicate booking warning */}
        {duplicates.length > 0 && (
          <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-orange-800">
              ⚠️ Doppelbelegung erkannt — {duplicates.length} überlappende Buchung{duplicates.length > 1 ? 'en' : ''} für dieses Haus
            </div>
            <div className="space-y-2">
              {duplicates.map(b => (
                <div key={b.id} className="flex items-center justify-between bg-white rounded-lg border border-orange-200 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{b.guest_name}</span>
                    <span className="text-gray-500 ml-2">{b.checkin_date?.slice(0,10)} → {b.checkout_date?.slice(0,10)}</span>
                    <span className="text-gray-400 ml-2 text-xs">({b.nights} Nächte)</span>
                  </div>
                  <button
                    type="button"
                    className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
                    onClick={() => setDeleteConfirm(b)}
                  >
                    🗑 Löschen
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-orange-600">Bitte entscheiden Sie, welche Buchung gelöscht werden soll, oder passen Sie die Daten an.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setDeleteConfirm(null)}>
            <div className="card" style={{ minWidth: '340px', maxWidth: '460px', padding: '24px' }} onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-gray-900 mb-2">🗑 Buchung wirklich löschen?</h3>
              <div className="bg-gray-50 rounded-lg px-3 py-3 mb-4 text-sm space-y-1">
                <div className="font-semibold text-gray-900">{deleteConfirm.guest_name}</div>
                <div className="text-gray-600">{deleteConfirm.checkin_date?.slice(0,10)} → {deleteConfirm.checkout_date?.slice(0,10)} · {deleteConfirm.nights} Nächte</div>
                {deleteConfirm.invoice_number && <div className="text-gray-500 font-mono text-xs">🧾 {deleteConfirm.invoice_number}</div>}
              </div>
              <p className="text-sm text-red-700 mb-4">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary text-sm" onClick={() => setDeleteConfirm(null)}>Abbrechen</button>
                <button
                  type="button"
                  className="text-sm px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                  onClick={() => handleDeleteDuplicate(deleteConfirm.id)}
                >
                  Ja, endgültig löschen
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end items-center pb-6">
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary px-8" disabled={loading}>
              {loading ? 'Speichern…' : isEdit ? '💾 Änderungen speichern' : '✅ Buchung anlegen'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
