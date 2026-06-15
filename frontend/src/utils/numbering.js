// Shared "last edit wins + conflict warning" logic for invoice numbers (bookings)
// and customer numbers (customers). Both follow the identical pattern: if the new
// value is already assigned elsewhere, ask for confirmation, clear it from the old
// owner, set it on the target, and notify other pages via syncBus.
import api, { getCustomers } from './api';
import { BOOKINGS } from './mockData';
import { emitDataChange } from './syncBus';

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
  const invoices = [...(target.invoices || []), invoiceEntry];
  const updates = { ...target, invoices };
  if (invoiceEntry.type === 'normal') updates.invoice_number = invoiceEntry.invoice_number;
  await api.put(`/bookings/${bookingId}`, updates);
  emitDataChange({ type: 'invoice' });
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
