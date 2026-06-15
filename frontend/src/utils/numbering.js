// Shared "last edit wins + conflict warning" logic for invoice numbers (bookings)
// and customer numbers (customers). Both follow the identical pattern: if the new
// value is already assigned elsewhere, ask for confirmation, clear it from the old
// owner, set it on the target, and notify other pages via syncBus.
import api, { getCustomers } from './api';
import { BOOKINGS, HOUSES } from './mockData';
import { emitDataChange } from './syncBus';
import { buildInvoicePreviewData } from './pdfExport';

// Returns the first item in `list` (other than `excludeId`) that already has
// `value` for `field`, or null if there's no conflict.
export function findConflict(list, field, value, excludeId) {
  if (!value) return null;
  return list.find(item => item.id !== excludeId && item[field] && item[field] === value) || null;
}

// Splits an invoice number "15a-2026-0001" into { prefix: '15a', year: '2026', suffix: '0001' }.
// Falls back to empty strings for parts that can't be determined.
export function splitInvoiceNumber(invoiceNumber) {
  const parts = String(invoiceNumber || '').split('-');
  if (parts.length >= 3) {
    return { prefix: parts[0], year: parts[1], suffix: parts.slice(2).join('-') };
  }
  return { prefix: '', year: '', suffix: invoiceNumber || '' };
}

// Reassembles { prefix, year, suffix } into "prefix-year-suffix" (suffix padded to 4 digits).
// Returns '' if any part is missing.
export function composeInvoiceNumber({ prefix, year, suffix }) {
  if (!prefix || !year || !suffix) return '';
  const paddedSuffix = String(suffix).replace(/[^0-9]/g, '').padStart(4, '0');
  return `${prefix}-${year}-${paddedSuffix}`;
}

export async function suggestNextInvoiceNumber(houseId) {
  const { data } = await api.get('/bookings/next-invoice-number', { params: { house_id: houseId } });
  return data.invoice_number;
}

export async function suggestNextCustomerNumber() {
  const { data } = await api.get('/customers/next-number');
  return data.customer_number;
}

// Sets `field` on booking `bookingId`. If another booking already has this value
// for `field`, asks for confirmation and clears it there first ("last edit wins").
// Returns true if the value was applied, false if the user cancelled.
export async function applyBookingNumberField(bookingId, field, value, label) {
  const conflict = findConflict(BOOKINGS, field, value, bookingId);
  if (conflict) {
    const ok = window.confirm(
      `${label} "${value}" ist bereits für die Buchung von ${conflict.guest_name || 'Unbekannt'}` +
      `${conflict.checkin_date ? ` (${conflict.checkin_date.slice(0, 10)})` : ''} vergeben.\n\n` +
      `Trotzdem übernehmen? Die alte Zuweisung wird entfernt.`
    );
    if (!ok) return false;
    await api.put(`/bookings/${conflict.id}`, { ...conflict, [field]: '' });
  }
  const target = BOOKINGS.find(b => b.id === bookingId) || {};
  await api.put(`/bookings/${bookingId}`, { ...target, [field]: value });
  emitDataChange({ type: field === 'invoice_number' ? 'invoice' : 'customer' });
  return true;
}

// Sets invoice_number on booking `bookingId`, same "last edit wins" mechanism.
export async function applyInvoiceNumber(bookingId, value) {
  return applyBookingNumberField(bookingId, 'invoice_number', value, 'Rechnungsnummer');
}

// Flattens BOOKINGS into a list of all assigned invoice numbers (both the
// primary `invoice_number` field and every entry in `invoices[]`), optionally
// excluding one specific entry (e.g. the one currently being edited).
export function getAllInvoiceNumbers(excludeBookingId, excludeInvoiceId) {
  const result = [];
  for (const b of BOOKINGS) {
    if (b.invoice_number && !(b.id === excludeBookingId && excludeInvoiceId == null)) {
      result.push({ bookingId: b.id, invoiceId: null, invoice_number: b.invoice_number, guest_name: b.guest_name, type: 'normal' });
    }
    for (const inv of b.invoices || []) {
      if (b.id === excludeBookingId && inv.id === excludeInvoiceId) continue;
      result.push({ bookingId: b.id, invoiceId: inv.id, invoice_number: inv.invoice_number, guest_name: b.guest_name, type: inv.type });
    }
  }
  return result;
}

// Persists a generated invoice snapshot into `booking.invoices`. For normal
// invoices, also keeps `booking.invoice_number` in sync (as before).
export async function recordInvoice(bookingId, invoiceEntry) {
  const target = BOOKINGS.find(b => b.id === bookingId) || {};
  const invoices = [...(target.invoices || [])];
  // Bookings created before per-invoice tracking only have `invoice_number`.
  // Seed a synthetic "normal" entry for it so Storno/Teilrechnung can
  // reference a concrete invoice snapshot going forward.
  if (invoices.length === 0 && target.invoice_number) {
    invoices.push({
      id: `legacy-${bookingId}`,
      invoice_number: target.invoice_number,
      type: 'normal',
      invoice_date: null,
      brutto_total: Number(target.total_price || 0),
      lang: 'de',
      manual: isManualInvoiceNumber(target),
      data: buildInvoicePreviewData(target, 'de'),
    });
  }
  invoices.push(invoiceEntry);
  const updates = { ...target, invoices };
  if (invoiceEntry.type === 'normal' || invoiceEntry.type === 'partial') updates.invoice_number = invoiceEntry.invoice_number;
  await api.put(`/bookings/${bookingId}`, updates);
  emitDataChange({ type: 'invoice' });
}

// Groups invoice numbers by `${prefix}-${year}` (house + year, e.g. "15a-2026")
// and finds gaps in the sequence. Numbering always starts at 1000, so the
// expected range for each group is 1000..max(1000, highest assigned number).
// Returns { [key]: number[] } — groups without gaps are omitted.
export function findInvoiceNumberGaps(invoiceNumbers) {
  const byHouseYear = {};
  invoiceNumbers.forEach(inv => {
    const parts = String(inv || '').split('-');
    if (parts.length < 3) return;
    const key = `${parts[0]}-${parts[1]}`;
    const num = parseInt(parts[2]);
    if (isNaN(num)) return;
    if (!byHouseYear[key]) byHouseYear[key] = [];
    byHouseYear[key].push(num);
  });

  const gaps = {};
  Object.entries(byHouseYear).forEach(([key, nums]) => {
    const present = new Set(nums);
    const highest = Math.max(1000, ...nums);
    const missing = [];
    for (let i = 1000; i <= highest; i++) {
      if (!present.has(i)) missing.push(i);
    }
    if (missing.length) gaps[key] = missing;
  });
  return gaps;
}

// Maps a gap-group key like "15a-2026" to its house label, e.g. "Haus 1 (A)".
export function houseLabelForKey(key) {
  const prefix = String(key).split('-')[0];
  const house = HOUSES.find(h => h.house_number === prefix);
  return house ? `${house.name} (${house.short_name})` : prefix;
}

// Determines whether an invoice number was entered manually rather than
// auto-generated. `invoiceEntry` is an entry from `booking.invoices[]` (with a
// `manual` flag set by InvoicePreviewModal); if omitted, falls back to the
// `manual_overrides` mechanism for the legacy `booking.invoice_number` field.
export function isManualInvoiceNumber(booking, invoiceEntry) {
  if (invoiceEntry) return !!invoiceEntry.manual;
  return !!(booking?._has_manual_overrides && booking?._manual_fields?.includes('invoice_number'));
}

// Informative duplicate check across all invoice numbers (primary field + invoices[]).
// Unlike applyBookingNumberField, this does not reassign anything — it just warns.
// Returns true if the value can be used (no conflict, or user confirmed anyway).
export function checkInvoiceNumberDuplicate(value, excludeBookingId, excludeInvoiceId) {
  if (!value) return true;
  const conflict = getAllInvoiceNumbers(excludeBookingId, excludeInvoiceId)
    .find(entry => entry.invoice_number === value);
  if (!conflict) return true;
  return window.confirm(
    `Rechnungsnummer "${value}" ist bereits für ${conflict.guest_name || 'eine andere Buchung'} vergeben.\n\n` +
    `Trotzdem verwenden?`
  );
}

// Sets customer_number on customer `customerId`, same "last edit wins" mechanism.
export async function applyCustomerNumber(customerId, value) {
  const customers = getCustomers();
  const conflict = findConflict(customers, 'customer_number', value, customerId);
  if (conflict) {
    const ok = window.confirm(
      `Kundennummer "${value}" ist bereits für ${conflict.guest_name || conflict.company_name || 'einen anderen Kunden'} vergeben.\n\n` +
      `Trotzdem übernehmen? Die alte Zuweisung wird entfernt.`
    );
    if (!ok) return false;
    await api.put(`/customers/${conflict.id}`, { ...conflict, customer_number: '' });
  }
  const target = customers.find(c => c.id === customerId) || {};
  await api.put(`/customers/${customerId}`, { ...target, customer_number: value });
  emitDataChange({ type: 'customer' });
  return true;
}
