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
