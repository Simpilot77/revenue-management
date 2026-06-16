// Real booking data imported from Lodgify (account 834414)
// Last sync: 2026-06-07

export const HOUSES = [
  { id: 1, name: 'Haus 1', short_name: 'A', house_number: '15a', capacity: 6, description: 'Einfamilienhaus 15a, 6 Personen', active: true },
  { id: 2, name: 'Haus 2', short_name: 'B', house_number: '15b', capacity: 7, description: 'Einfamilienhaus 15b, 7 Personen', active: true },
  { id: 3, name: 'Haus 3', short_name: 'C', house_number: '15c', capacity: 7, description: 'Einfamilienhaus 15c, 7 Personen', active: true },
];

export const CHANNELS = [
  { id: 1, name: 'Direkt', short_name: 'DIREKT', color: '#10b981', commission_rate: 0, active: true },
  { id: 2, name: 'Booking.com', short_name: 'BDC', color: '#003580', commission_rate: 15, active: true },
  { id: 3, name: 'Airbnb', short_name: 'AIRBNB', color: '#ff5a5f', commission_rate: 15.5, active: true },
  { id: 4, name: 'HRS', short_name: 'HRS', color: '#e65100', commission_rate: 15, active: true },
  { id: 5, name: 'Expedia', short_name: 'EXPEDIA', color: '#ffc107', commission_rate: 12, active: true },
  { id: 6, name: 'Firma / Direktvertrag', short_name: 'FIRMA', color: '#8b5cf6', commission_rate: 0, active: true },
  { id: 7, name: 'Sonstige', short_name: 'SONST', color: '#6b7280', commission_rate: 5, active: true },
];

export const BOOKINGS = [
  { id: 18703841, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-02-17", checkin_date: "2026-02-02", checkout_date: "2026-02-09", nights: 7,
    guest_name: "Sero GmbH", company_name: "Sero GmbH", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 3, adults: 3, children: 0,
    daily_rate: 160.71, cleaning_fee: 0, discount_percent: 0, total_price: 1125.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15a-2026-0001",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18589316, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-02-11", checkin_date: "2026-02-08", checkout_date: "2026-02-15", nights: 7,
    guest_name: "Kerstin Wittborn", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 140.89, cleaning_fee: 0, discount_percent: 0, total_price: 986.22, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15b-2026-0001",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18588939, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-02-11", checkin_date: "2026-02-13", checkout_date: "2026-02-17", nights: 4,
    guest_name: "Sero GmbH", company_name: "Sero GmbH", guest_email: "nils.flegel@gmx.de", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 6, adults: 6, children: 0,
    daily_rate: 192.5, cleaning_fee: 0, discount_percent: 0, total_price: 770.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15c-2026-0001",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18603949, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-02-12", checkin_date: "2026-02-15", checkout_date: "2026-02-26", nights: 11,
    guest_name: "Kerstin Wittborn", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 140.82, cleaning_fee: 0, discount_percent: 0, total_price: 1549.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15b-2026-0002",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18903316, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-02-27", checkin_date: "2026-02-17", checkout_date: "2026-03-07", nights: 18,
    guest_name: "A Seppala", company_name: "A Seppala", guest_email: null, guest_phone: null, nationality: "FI", is_returning_guest: false,
    guest_count: 3, adults: 3, children: 0,
    daily_rate: 171.72, cleaning_fee: 0, discount_percent: 0, total_price: 3091.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15a-2026-0002",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18897680, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 2, channel_name: "Booking.com", channel_short: "BDC", channel_color: "#003580",
    external_reference: null, booking_date: "2026-02-27", checkin_date: "2026-03-02", checkout_date: "2026-03-05", nights: 3,
    guest_name: "Ingo Betke", company_name: null, guest_email: "ingo.betke@isk-kabelverlegung.de", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 156.36, cleaning_fee: 0, discount_percent: 0, total_price: 469.09, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15c-2026-0002",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18996639, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-03-04", checkin_date: "2026-03-05", checkout_date: "2026-03-13", nights: 8,
    guest_name: "Net Und Main Bau GmbH Gnjatovic", company_name: "Net Und Main Bau GmbH Gnjatovic", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 143.5, cleaning_fee: 0, discount_percent: 0, total_price: 1148.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0003",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18998408, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-03-04", checkin_date: "2026-03-05", checkout_date: "2026-03-07", nights: 2,
    guest_name: "A Seppala", company_name: "A Seppala", guest_email: null, guest_phone: null, nationality: "FI", is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 0.0, cleaning_fee: 0, discount_percent: 0, total_price: 0.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "angefragt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19016565, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-03-05", checkin_date: "2026-03-05", checkout_date: "2026-03-07", nights: 2,
    guest_name: "A Seppala", company_name: "A Seppala", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 3, adults: 3, children: 0,
    daily_rate: 0.0, cleaning_fee: 0, discount_percent: 0, total_price: 0.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "storniert", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18717718, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-02-18", checkin_date: "2026-03-06", checkout_date: "2026-03-11", nights: 5,
    guest_name: "Monika Joanna Pach", company_name: null, guest_email: "mpa@white.horse", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 1, adults: 1, children: 0,
    daily_rate: 126.0, cleaning_fee: 0, discount_percent: 0, total_price: 630.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15c-2026-0003",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19018547, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-03-05", checkin_date: "2026-03-08", checkout_date: "2026-03-15", nights: 7,
    guest_name: "Wittenberger Brandschutz", company_name: "Wittenberger Brandschutz", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 0.0, cleaning_fee: 0, discount_percent: 0, total_price: 0.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "storniert", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19190953, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-03-13", checkin_date: "2026-03-13", checkout_date: "2026-03-15", nights: 2,
    guest_name: "Nils Flegel", company_name: null, guest_email: "nils.flegel@gmx.de", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 1, adults: 1, children: 0,
    daily_rate: 0.0, cleaning_fee: 0, discount_percent: 0, total_price: 0.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "storniert", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19342011, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-03-20", checkin_date: "2026-03-15", checkout_date: "2026-03-21", nights: 6,
    guest_name: "Tilmann Auch", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 151.33, cleaning_fee: 0, discount_percent: 0, total_price: 908.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15a-2026-0003",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19151655, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 2, channel_name: "Booking.com", channel_short: "BDC", channel_color: "#003580",
    external_reference: null, booking_date: "2026-03-11", checkin_date: "2026-03-16", checkout_date: "2026-03-20", nights: 4,
    guest_name: "Sabine Fischer", company_name: null, guest_email: "sfisch.388262@guest.booking.com", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 180.74, cleaning_fee: 0, discount_percent: 0, total_price: 722.95, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15b-2026-0004",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 18590207, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-02-11", checkin_date: "2026-03-22", checkout_date: "2026-04-26", nights: 35,
    guest_name: "Tjark Gräber", company_name: null, guest_email: "tjarkgr@gmail.com", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 6, adults: 6, children: 0,
    daily_rate: 165.71, cleaning_fee: 0, discount_percent: 0, total_price: 5799.92, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15b-2026-0005",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19342023, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-03-20", checkin_date: "2026-03-23", checkout_date: "2026-04-29", nights: 37,
    guest_name: "家阳 王", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 111.91, cleaning_fee: 0, discount_percent: 0, total_price: 4140.5, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "angefragt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19342152, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-03-20", checkin_date: "2026-03-23", checkout_date: "2026-04-29", nights: 37,
    guest_name: "家阳 王", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 132.43, cleaning_fee: 0, discount_percent: 0, total_price: 4900.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15a-2026-0004",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19472395, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-03-26", checkin_date: "2026-03-26", checkout_date: "2026-03-28", nights: 2,
    guest_name: "Ярослав Верещак", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 104.0, cleaning_fee: 0, discount_percent: 0, total_price: 208.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15c-2026-0004",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19108465, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 2, channel_name: "Booking.com", channel_short: "BDC", channel_color: "#003580",
    external_reference: null, booking_date: "2026-03-09", checkin_date: "2026-04-02", checkout_date: "2026-04-06", nights: 4,
    guest_name: "Florian Missy", company_name: null, guest_email: "fmissy.404602@guest.booking.com", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 164.41, cleaning_fee: 0, discount_percent: 0, total_price: 657.64, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15c-2026-0005",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19595903, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-04-01", checkin_date: "2026-04-09", checkout_date: "2026-04-26", nights: 17,
    guest_name: "Yan Zhang", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 122.45, cleaning_fee: 0, discount_percent: 0, total_price: 2081.6, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15c-2026-0006",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19786820, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-04-10", checkin_date: "2026-04-27", checkout_date: "2026-04-30", nights: 3,
    guest_name: "Monika Pach", company_name: null, guest_email: "mpa@white.horse", guest_phone: null, nationality: "DE", is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 143.0, cleaning_fee: 0, discount_percent: 0, total_price: 429.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15c-2026-0007",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19765438, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-04-09", checkin_date: "2026-04-28", checkout_date: "2026-04-30", nights: 2,
    guest_name: "Monika Pach", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 143.0, cleaning_fee: 0, discount_percent: 0, total_price: 286.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "storniert", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20131546, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-04-27", checkin_date: "2026-04-29", checkout_date: "2026-05-02", nights: 3,
    guest_name: "Net Und Main Bau GmbH Gnjatovic", company_name: "Net Und Main Bau GmbH Gnjatovic", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 145.0, cleaning_fee: 0, discount_percent: 0, total_price: 435.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "storniert", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20132497, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-04-27", checkin_date: "2026-04-29", checkout_date: "2026-05-02", nights: 3,
    guest_name: "Jessica Gnjatovic", company_name: null, guest_email: "jessica.gnjatovic@net-main.de", guest_phone: null, nationality: "DE", is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 133.33, cleaning_fee: 0, discount_percent: 0, total_price: 400.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15a-2026-0005",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 19991499, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-04-20", checkin_date: "2026-05-01", checkout_date: "2026-05-03", nights: 2,
    guest_name: "Christina Adamski", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 3, adults: 3, children: 1,
    daily_rate: 136.5, cleaning_fee: 0, discount_percent: 0, total_price: 273.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0006",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20196252, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-04-30", checkin_date: "2026-05-04", checkout_date: "2026-05-07", nights: 3,
    guest_name: "Sylke Hohenberger", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 160.0, cleaning_fee: 0, discount_percent: 0, total_price: 480.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15c-2026-0008",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20201349, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 5, channel_name: "Expedia", channel_short: "EXPEDIA", channel_color: "#ffc107",
    external_reference: null, booking_date: "2026-04-30", checkin_date: "2026-05-05", checkout_date: "2026-05-14", nights: 9,
    guest_name: "Margareta Schilling", company_name: null, guest_email: "info@ahlersundlambrecht.de", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 193.56, cleaning_fee: 0, discount_percent: 0, total_price: 1742.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "angefragt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20201548, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 5, channel_name: "Expedia", channel_short: "EXPEDIA", channel_color: "#ffc107",
    external_reference: null, booking_date: "2026-04-30", checkin_date: "2026-05-05", checkout_date: "2026-05-14", nights: 9,
    guest_name: "Margareta Schilling", company_name: null, guest_email: "info@ahlersundlambrecht.de", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 193.56, cleaning_fee: 0, discount_percent: 0, total_price: 1742.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "angefragt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20865222, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 5, channel_name: "Expedia", channel_short: "EXPEDIA", channel_color: "#ffc107",
    external_reference: null, booking_date: "2026-06-01", checkin_date: "2026-05-05", checkout_date: "2026-05-14", nights: 9,
    guest_name: "Fewo Direkt Buchung VRBO A", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 166.89, cleaning_fee: 0, discount_percent: 0, total_price: 1502.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15a-2026-0006",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20295129, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-05-05", checkin_date: "2026-05-06", checkout_date: "2026-05-11", nights: 5,
    guest_name: "Lucyna Noack", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 183.6, cleaning_fee: 0, discount_percent: 0, total_price: 918.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0007",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20322388, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-05-06", checkin_date: "2026-05-11", checkout_date: "2026-05-14", nights: 3,
    guest_name: "Sylke Hohenberger", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 183.67, cleaning_fee: 0, discount_percent: 0, total_price: 551.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0008",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20508780, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-05-15", checkin_date: "2026-05-15", checkout_date: "2026-06-15", nights: 31,
    guest_name: "Ion Neacsu", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 202.77, cleaning_fee: 0, discount_percent: 0, total_price: 6286.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15a-2026-0007",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20464866, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-05-13", checkin_date: "2026-05-18", checkout_date: "2026-05-22", nights: 4,
    guest_name: "Sylke Hohenberger", company_name: null, guest_email: "s.hohenberger@demmelhuber.de", guest_phone: null, nationality: "DE", is_returning_guest: false,
    guest_count: 4, adults: 4, children: 0,
    daily_rate: 155.0, cleaning_fee: 0, discount_percent: 0, total_price: 620.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15c-2026-0009",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20592473, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-05-19", checkin_date: "2026-05-26", checkout_date: "2026-05-30", nights: 4,
    guest_name: "Sylke Hohenberger", company_name: null, guest_email: "s.hohenberger@demmelhuber.de", guest_phone: null, nationality: "DE", is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 150.0, cleaning_fee: 0, discount_percent: 0, total_price: 600.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15c-2026-0010",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20729413, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 2, channel_name: "Booking.com", channel_short: "BDC", channel_color: "#003580",
    external_reference: null, booking_date: "2026-05-26", checkin_date: "2026-05-27", checkout_date: "2026-06-03", nights: 7,
    guest_name: "Adam Drzewosz", company_name: null, guest_email: "adrzew.904668@guest.booking.com", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 6, adults: 6, children: 0,
    daily_rate: 174.22, cleaning_fee: 0, discount_percent: 0, total_price: 1219.52, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0009",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20231564, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-05-01", checkin_date: "2026-05-31", checkout_date: "2026-06-06", nights: 6,
    guest_name: "艳 刘", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 3, adults: 3, children: 0,
    daily_rate: 135.0, cleaning_fee: 0, discount_percent: 0, total_price: 810.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15c-2026-0011",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20754262, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-05-27", checkin_date: "2026-06-08", checkout_date: "2026-06-12", nights: 4,
    guest_name: "Sylke Hohenberger", company_name: null, guest_email: "s.hohenberger@demmelhuber.de", guest_phone: null, nationality: "DE", is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 170.0, cleaning_fee: 0, discount_percent: 0, total_price: 680.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "bezahlt", invoice_number: "15b-2026-0010",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20904728, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-06-03", checkin_date: "2026-06-08", checkout_date: "2026-06-12", nights: 4,
    guest_name: "Dominika Kohrmann", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 201.75, cleaning_fee: 0, discount_percent: 0, total_price: 807.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15c-2026-0012",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20631348, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 2, channel_name: "Booking.com", channel_short: "BDC", channel_color: "#003580",
    external_reference: null, booking_date: "2026-05-21", checkin_date: "2026-06-15", checkout_date: "2026-07-05", nights: 20,
    guest_name: "Julien Santangelo", company_name: null, guest_email: "jsanta.481087@guest.booking.com", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 160.02, cleaning_fee: 0, discount_percent: 0, total_price: 3200.35, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0011",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20864798, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-06-01", checkin_date: "2026-06-15", checkout_date: "2026-07-05", nights: 20,
    guest_name: "WTC Wärmetechnik Hohenberger", company_name: "WTC Wärmetechnik Hohenberger", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 133.0, cleaning_fee: 0, discount_percent: 0, total_price: 2660.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15c-2026-0013",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20865117, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-06-01", checkin_date: "2026-07-05", checkout_date: "2026-07-31", nights: 26,
    guest_name: "WTC Wärmetechnik Hohenberger", company_name: "WTC Wärmetechnik Hohenberger", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 138.12, cleaning_fee: 0, discount_percent: 0, total_price: 3591.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0012",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20865175, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-06-01", checkin_date: "2026-07-31", checkout_date: "2026-08-31", nights: 31,
    guest_name: "WTC Wärmetechnik Hohenberger", company_name: "WTC Wärmetechnik Hohenberger", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 128.71, cleaning_fee: 0, discount_percent: 0, total_price: 3990.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0013",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20746953, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 3, channel_name: "Airbnb", channel_short: "AIRBNB", channel_color: "#ff5a5f",
    external_reference: null, booking_date: "2026-05-26", checkin_date: "2026-08-09", checkout_date: "2026-08-17", nights: 8,
    guest_name: "Sofie", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 2, adults: 2, children: 1,
    daily_rate: 146.71, cleaning_fee: 0, discount_percent: 0, total_price: 1173.7, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: null,
    status: "angefragt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20223285, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: 2, channel_name: "Booking.com", channel_short: "BDC", channel_color: "#003580",
    external_reference: null, booking_date: "2026-05-01", checkin_date: "2026-08-28", checkout_date: "2026-09-06", nights: 9,
    guest_name: "Mattias Hultheimer", company_name: null, guest_email: "mhulth.223549@guest.booking.com", guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 2, adults: 2, children: 0,
    daily_rate: 156.17, cleaning_fee: 0, discount_percent: 0, total_price: 1405.53, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15c-2026-0014",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20865258, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-06-01", checkin_date: "2026-08-31", checkout_date: "2026-09-30", nights: 30,
    guest_name: "WTC Wärmetechnik Hohenberger", company_name: "WTC Wärmetechnik Hohenberger", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 133.0, cleaning_fee: 0, discount_percent: 0, total_price: 3990.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0014",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },
  { id: 20865289, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: 1, channel_name: "Direkt", channel_short: "DIREKT", channel_color: "#10b981",
    external_reference: null, booking_date: "2026-06-01", checkin_date: "2026-09-30", checkout_date: "2026-10-04", nights: 4,
    guest_name: "WTC Wärmetechnik Hohenberger", company_name: "WTC Wärmetechnik Hohenberger", guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 5, adults: 5, children: 0,
    daily_rate: 133.0, cleaning_fee: 0, discount_percent: 0, total_price: 532.0, currency: "EUR",
    payment_method: "ueberweisung", payment_status: "offen", invoice_number: "15b-2026-0015",
    status: "bestaetigt", cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: true,
    guest_notes: null, internal_notes: null, created_by: 1 },

  // ── Eigentümer-Sperren (Owner Blocks) – aus Lodgify importiert ──────────────
  { id: 90000001, house_id: 1, house_name: "Haus 1", house_short: "A", house_capacity: 6,
    channel_id: null, channel_name: "Eigentümer", channel_short: "OWNER", channel_color: "#64748b",
    external_reference: "BLOCK-15a-1", booking_date: "2026-01-01", checkin_date: "2026-07-14", checkout_date: "2026-07-20", nights: 6,
    guest_name: "Eigentümer (gesperrt)", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 0, adults: 0, children: 0,
    daily_rate: 0, cleaning_fee: 0, discount_percent: 0, total_price: 0, currency: "EUR",
    payment_method: null, payment_status: null, invoice_number: null,
    status: "gesperrt", is_owner_block: true, block_reason: "Eigennutzung",
    cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: false,
    guest_notes: null, internal_notes: "Eigennutzung Familie", created_by: 1 },
  { id: 90000002, house_id: 2, house_name: "Haus 2", house_short: "B", house_capacity: 7,
    channel_id: null, channel_name: "Eigentümer", channel_short: "OWNER", channel_color: "#64748b",
    external_reference: "BLOCK-15b-1", booking_date: "2026-01-01", checkin_date: "2026-08-01", checkout_date: "2026-08-10", nights: 9,
    guest_name: "Eigentümer (gesperrt)", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 0, adults: 0, children: 0,
    daily_rate: 0, cleaning_fee: 0, discount_percent: 0, total_price: 0, currency: "EUR",
    payment_method: null, payment_status: null, invoice_number: null,
    status: "gesperrt", is_owner_block: true, block_reason: "Renovierung",
    cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: false,
    guest_notes: null, internal_notes: "Renovierung Badezimmer", created_by: 1 },
  { id: 90000003, house_id: 3, house_name: "Haus 3", house_short: "C", house_capacity: 7,
    channel_id: null, channel_name: "Eigentümer", channel_short: "OWNER", channel_color: "#64748b",
    external_reference: "BLOCK-15c-1", booking_date: "2026-01-01", checkin_date: "2026-12-23", checkout_date: "2026-12-27", nights: 4,
    guest_name: "Eigentümer (gesperrt)", company_name: null, guest_email: null, guest_phone: null, nationality: null, is_returning_guest: false,
    guest_count: 0, adults: 0, children: 0,
    daily_rate: 0, cleaning_fee: 0, discount_percent: 0, total_price: 0, currency: "EUR",
    payment_method: null, payment_status: null, invoice_number: null,
    status: "gesperrt", is_owner_block: true, block_reason: "Eigennutzung",
    cancellation_date: null, cancellation_reason: null,
    breakfast_included: false, pets_allowed: false, parking: false,
    guest_notes: null, internal_notes: "Weihnachten", created_by: 1 },
];

// ─── Customers (derived from BOOKINGS) ──────────────────────────────────────

const _customerMap = {};
BOOKINGS.forEach(b => {
  const key = (b.guest_name || '').toLowerCase().trim();
  if (!key) return;
  if (!_customerMap[key]) {
    _customerMap[key] = {
      guest_name: b.guest_name,
      company_name: b.company_name || null,
      guest_email: b.guest_email || null,
      guest_phone: b.guest_phone || null,
      nationality: b.nationality || null,
      is_returning_guest: b.is_returning_guest || false,
      bookings_count: 0,
      total_revenue: 0,
    };
  }
  _customerMap[key].bookings_count++;
  _customerMap[key].total_revenue += parseFloat(b.total_price || 0);
  // prefer non-null email/phone
  if (b.guest_email && !_customerMap[key].guest_email) _customerMap[key].guest_email = b.guest_email;
  if (b.guest_phone && !_customerMap[key].guest_phone) _customerMap[key].guest_phone = b.guest_phone;
});

export const CUSTOMERS = Object.values(_customerMap).map((c, i) => ({
  id: i + 1,
  customer_number: String(i + 1).padStart(4, '0'),
  guest_name: c.guest_name,
  company_name: c.company_name,
  contact_person: null,
  email: c.guest_email,
  phone: c.guest_phone,
  billing_address: { street: '', zip: '', city: '', country: c.nationality || 'DE' },
  tax_id: null,
  vat_id: null,
  notes: null,
  is_returning_guest: c.is_returning_guest,
  nationality: c.nationality,
  bookings_count: c.bookings_count,
  total_revenue: parseFloat(c.total_revenue.toFixed(2)),
  created_at: new Date().toISOString().slice(0, 10),
}));

// Mark portal-collected bookings as bezahlt (Airbnb, Booking.com, HRS, Expedia, Sonstige)
const PORTAL_CHANNEL_IDS = new Set([2, 3, 4, 5, 7]);
BOOKINGS.forEach(b => {
  if (PORTAL_CHANNEL_IDS.has(b.channel_id)) b.payment_status = 'bezahlt';
  // Commission auto-calculation
  const ch = CHANNELS.find(c => c.id === b.channel_id);
  const rate = ch?.commission_rate ?? 0;
  b.commission_rate  = b.commission_rate  ?? rate;
  b.commission_amount = b.commission_amount ?? parseFloat((parseFloat(b.total_price) * rate / 100).toFixed(2));
  b.commission_overridden = b.commission_overridden ?? false;
  // New status fields
  b.deposit_taken     = b.deposit_taken     ?? false;
  b.deposit_returned  = b.deposit_returned  ?? false;
  b.invoice_sent      = b.invoice_sent      ?? false;
  b.guests_registered = b.guests_registered ?? false;
  b.included_in_stats = b.included_in_stats ?? true;
});

// ─── Auto-detect returning guests ────────────────────────────────────────────
const _guestActiveCounts = {};
BOOKINGS.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status)).forEach(b => {
  const k = (b.guest_name || '').toLowerCase().trim();
  if (k) _guestActiveCounts[k] = (_guestActiveCounts[k] || 0) + 1;
});
BOOKINGS.forEach(b => {
  const k = (b.guest_name || '').toLowerCase().trim();
  if (_guestActiveCounts[k] > 1) b.is_returning_guest = true;
});
CUSTOMERS.forEach(c => {
  const k = (c.guest_name || '').toLowerCase().trim();
  if (_guestActiveCounts[k] > 1) c.is_returning_guest = true;
});

// ─── Report Calculations ────────────────────────────────────────────────────

function filterBookings(bookings, from, to, houseId) {
  return bookings.filter(b => {
    const checkin = b.checkin_date;
    if (from && checkin < from) return false;
    if (to && checkin > to) return false;
    if (houseId && b.house_id !== parseInt(houseId)) return false;
    return true;
  });
}

const active = (b) => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status) && b.included_in_stats !== false;

export function calcKpis(from, to, houseId) {
  const filtered = filterBookings(BOOKINGS, from, to, houseId);
  const activeB = filtered.filter(active);
  const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000));
  const houses = houseId ? HOUSES.filter(h => h.id === parseInt(houseId)) : HOUSES;
  const totalCap = houses.reduce((s, h) => s + h.capacity, 0);
  const availableBedNights = totalCap * days;
  // House-based occupancy: available house-nights = number of houses × days
  const availableHouseNights = houses.length * days;
  const totalRevenue = activeB.reduce((s, b) => s + parseFloat(b.total_price), 0);
  const totalNights = activeB.reduce((s, b) => s + b.nights, 0);  // house-nights booked
  const bedNights = activeB.reduce((s, b) => s + b.guest_count * b.nights, 0);
  const adrVals = activeB.filter(b => b.daily_rate > 0).map(b => b.daily_rate);
  const adr = adrVals.length ? adrVals.reduce((s, v) => s + v, 0) / adrVals.length : 0;
  const losVals = activeB.map(b => b.nights);
  const avgLos = losVals.length ? losVals.reduce((s, v) => s + v, 0) / losVals.length : 0;
  const leadTimes = activeB.map(b => Math.max(0, Math.ceil((new Date(b.checkin_date) - new Date(b.booking_date)) / 86400000)));
  const avgLeadTime = leadTimes.length ? leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length : 0;
  const cancellations = filtered.filter(b => b.status === 'storniert').length;
  const noShows = filtered.filter(b => b.status === 'no_show').length;
  const returning = activeB.filter(b => b.is_returning_guest).length;
  return {
    total_bookings: filtered.length, confirmed_bookings: activeB.length,
    total_revenue: totalRevenue, total_nights: totalNights,
    occupied_bed_nights: bedNights, available_bed_nights: availableBedNights,
    // Occupancy = house-nights booked / house-nights available (a booked house = 100% occupied that night)
    occupancy_rate: availableHouseNights > 0 ? parseFloat(((totalNights / availableHouseNights) * 100).toFixed(1)) : 0,
    revpar: availableBedNights > 0 ? parseFloat((totalRevenue / availableBedNights).toFixed(2)) : 0,
    revpar_house: days > 0 ? parseFloat((totalRevenue / (houses.length * days)).toFixed(2)) : 0,
    adr: parseFloat(adr.toFixed(2)), avg_los: parseFloat(avgLos.toFixed(1)),
    avg_lead_time: Math.round(avgLeadTime), cancellations, no_shows: noShows,
    returning_guests: returning,
    cancellation_rate: filtered.length > 0 ? parseFloat(((cancellations / filtered.length) * 100).toFixed(1)) : 0,
  };
}

// Verteilt eine Buchung anteilig auf die Monate, die der Aufenthalt umfasst.
// Gibt { 'YYYY-MM': { nights, revenue, bed_nights } } zurück.
// Arbeitet ausschließlich mit UTC-Datumsteilen, um Timezone-Probleme zu vermeiden.
function distributeBookingByMonth(b) {
  const result = {};
  if (!b.checkin_date || !b.checkout_date) return result;

  // Parse als UTC-Datumskomponenten (YYYY-MM-DD)
  const parseUTC = (s) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const checkinMs  = parseUTC(b.checkin_date);
  const checkoutMs = parseUTC(b.checkout_date);
  const totalNights = b.nights > 0 ? b.nights
    : Math.max(1, Math.round((checkoutMs - checkinMs) / 86400000));
  const dailyRate = b.daily_rate > 0 ? b.daily_rate
    : (totalNights > 0 ? parseFloat(b.total_price || 0) / totalNights : 0);

  // Segmente über Monatsgrenzen hinweg sammeln – alles UTC
  const segments = [];
  let cursorMs = checkinMs;
  while (cursorMs < checkoutMs) {
    const d = new Date(cursorMs);
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    const monthKey  = `${y}-${String(m + 1).padStart(2, '0')}`;
    const nextMonMs = Date.UTC(y, m + 1, 1);          // Erster Tag des nächsten Monats (UTC)
    const segEndMs  = nextMonMs < checkoutMs ? nextMonMs : checkoutMs;
    const nights    = Math.round((segEndMs - cursorMs) / 86400000);
    if (nights > 0) segments.push({ month: monthKey, nights });
    cursorMs = nextMonMs;
  }

  // Umsatz proportional verteilen; letztes Segment bekommt Rundungsdifferenz
  let assignedRevenue = 0, assignedNights = 0;
  segments.forEach((seg, i) => {
    const isLast = i === segments.length - 1;
    const rev = isLast
      ? parseFloat((parseFloat(b.total_price || 0) - assignedRevenue).toFixed(2))
      : parseFloat((seg.nights * dailyRate).toFixed(2));
    const n = isLast ? totalNights - assignedNights : seg.nights;
    if (!result[seg.month]) result[seg.month] = { nights: 0, revenue: 0, bed_nights: 0 };
    result[seg.month].nights    += n;
    result[seg.month].revenue   += rev;
    result[seg.month].bed_nights += seg.nights * (b.guest_count || 0);
    assignedRevenue += rev;
    assignedNights  += n;
  });
  return result;
}

export function calcMonthly(from, to, houseId) {
  // Für die monatliche Verteilung verwenden wir ALLE Buchungen, deren Aufenthalt
  // den angefragten Zeitraum berührt (nicht nur Checkin innerhalb des Zeitraums).
  const hid = houseId ? parseInt(houseId) : null;
  const houses = hid ? HOUSES.filter(h => h.id === hid) : HOUSES;
  const totalCap = houses.reduce((s, h) => s + h.capacity, 0);
  const byMonth = {};

  const ensureMonth = (m) => {
    if (!byMonth[m]) byMonth[m] = {
      month: m, bookings: 0, booked_nights: 0, bed_nights: 0, revenue: 0,
      adr_vals: [], booking_ids: [], house_booked_nights: {},
      revenue_per_house: {}, bed_nights_per_house: {}, lead_times: [], los_vals: [],
    };
  };

  BOOKINGS.filter(b => {
    if (!active(b)) return false;
    if (hid && b.house_id !== hid) return false;
    // Buchung berührt den Zeitraum wenn Checkout > from UND Checkin < to
    if (from && b.checkout_date <= from) return false;
    if (to   && b.checkin_date  >  to)   return false;
    return true;
  }).forEach(b => {
    const checkinMonth = b.checkin_date.slice(0, 7);
    ensureMonth(checkinMonth);
    // Buchungs-Ereignis-Metriken nur im Anreise-Monat zählen
    byMonth[checkinMonth].bookings++;
    byMonth[checkinMonth].booking_ids.push(b.id);
    if (b.daily_rate > 0) byMonth[checkinMonth].adr_vals.push(b.daily_rate);
    const lt = Math.max(0, Math.ceil((new Date(b.checkin_date) - new Date(b.booking_date)) / 86400000));
    byMonth[checkinMonth].lead_times.push(lt);
    byMonth[checkinMonth].los_vals.push(b.nights);

    // Umsatz, Nächte und Belegung auf die tatsächlichen Aufenthaltsmonate verteilen
    const dist = distributeBookingByMonth(b);
    Object.entries(dist).forEach(([m, seg]) => {
      // Nur Monate innerhalb des angefragten Zeitraums ausgeben
      if (from && m < from.slice(0, 7)) return;
      if (to   && m > to.slice(0, 7))   return;
      ensureMonth(m);
      byMonth[m].revenue      += seg.revenue;
      byMonth[m].booked_nights += seg.nights;
      byMonth[m].bed_nights   += seg.bed_nights;
      byMonth[m].house_booked_nights[b.house_id] = (byMonth[m].house_booked_nights[b.house_id] || 0) + seg.nights;
      byMonth[m].revenue_per_house[b.house_id]   = (byMonth[m].revenue_per_house[b.house_id]   || 0) + seg.revenue;
      byMonth[m].bed_nights_per_house[b.house_id] = (byMonth[m].bed_nights_per_house[b.house_id] || 0) + seg.bed_nights;
    });
  });
  return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).map(r => {
    const daysInMonth = new Date(r.month.slice(0,4), parseInt(r.month.slice(5,7)), 0).getDate();
    const avail = totalCap * daysInMonth;
    const availHouseNights = houses.length * daysInMonth;
    const adr = r.adr_vals.length ? r.adr_vals.reduce((s,v)=>s+v,0)/r.adr_vals.length : 0;
    // Per-house free nights: daysInMonth minus booked nights for that house
    const house_free_nights = {};
    houses.forEach(h => {
      const booked = r.house_booked_nights[h.id] || 0;
      house_free_nights[h.id] = { name: h.name, short: h.short_name, free: Math.max(0, daysInMonth - booked), booked };
    });
    const avgLeadTime = r.lead_times.length ? r.lead_times.reduce((s,v)=>s+v,0)/r.lead_times.length : 0;
    const avgLos = r.los_vals.length ? r.los_vals.reduce((s,v)=>s+v,0)/r.los_vals.length : 0;
    // Per-house occupancy rate: booked house-nights / total house-nights in month
    const occupancy_per_house = {};
    houses.forEach(h => {
      const hn = r.house_booked_nights[h.id] || 0;
      occupancy_per_house[h.id] = daysInMonth > 0 ? parseFloat(((hn / daysInMonth) * 100).toFixed(1)) : 0;
    });
    return {
      ...r,
      adr: parseFloat(adr.toFixed(2)),
      avg_lead_time: Math.round(avgLeadTime),
      avg_los: parseFloat(avgLos.toFixed(1)),
      available_bed_nights: avail, available_house_nights: availHouseNights,
      free_nights: Math.max(0, availHouseNights - r.booked_nights),
      house_free_nights, occupancy_per_house,
      // Occupancy = house-nights booked / house-nights available (not bed-nights!)
      occupancy_rate: availHouseNights > 0 ? parseFloat(((r.booked_nights / availHouseNights) * 100).toFixed(1)) : 0,
      // RevPAR per whole house (standard: revenue / available house-nights)
      revpar_house: availHouseNights > 0 ? parseFloat((r.revenue / availHouseNights).toFixed(2)) : 0,
      // RevPAR per bed (legacy / additional info)
      revpar: avail > 0 ? parseFloat((r.revenue / avail).toFixed(2)) : 0,
      // Per-house RevPAR (revenue per house per available night)
      revpar_per_house: Object.fromEntries(
        houses.map(h => {
          const rev = r.revenue_per_house[h.id] || 0;
          return [h.id, parseFloat((rev / daysInMonth).toFixed(2))];
        })
      ),
    };
  });
}

export function calcChannels(from, to, houseId) {
  const filtered = filterBookings(BOOKINGS, from, to, houseId).filter(active);
  const byChannel = {};
  filtered.forEach(b => {
    const key = b.channel_id || 0;
    if (!byChannel[key]) byChannel[key] = { channel: b.channel_name || 'Unbekannt', color: b.channel_color || '#999', bookings: 0, nights: 0, revenue: 0, adr_vals: [], booking_ids: [] };
    byChannel[key].bookings++;
    byChannel[key].nights += b.nights;
    byChannel[key].revenue += parseFloat(b.total_price);
    if (b.daily_rate > 0) byChannel[key].adr_vals.push(b.daily_rate);
    byChannel[key].booking_ids.push(b.id);
  });
  return Object.values(byChannel).sort((a,b)=>b.revenue-a.revenue).map(r => {
    const adr = r.adr_vals.length ? r.adr_vals.reduce((s,v)=>s+v,0)/r.adr_vals.length : 0;
    return { ...r, adr: parseFloat(adr.toFixed(2)) };
  });
}

export function calcPickup(from, to, houseId) {
  const filtered = BOOKINGS.filter(b => {
    if (b.booking_date < from || b.booking_date > to) return false;
    if (houseId && b.house_id !== parseInt(houseId)) return false;
    return active(b);
  });
  const byDay = {};
  filtered.forEach(b => {
    const d = b.booking_date;
    if (!byDay[d]) byDay[d] = { pickup_date: d, new_bookings: 0, revenue: 0, nights: 0 };
    byDay[d].new_bookings++;
    byDay[d].revenue += parseFloat(b.total_price);
    byDay[d].nights += b.nights;
  });
  return Object.values(byDay).sort((a,b)=>a.pickup_date.localeCompare(b.pickup_date));
}

export function calcLeadTime(from, to, houseId) {
  const filtered = filterBookings(BOOKINGS, from, to, houseId).filter(active);
  const buckets = {'Same Day':[],'1-3 Tage':[],'4-7 Tage':[],'1-2 Wochen':[],'2-4 Wochen':[],'1-2 Monate':[],'> 2 Monate':[]};
  filtered.forEach(b => {
    const lt = Math.max(0, Math.ceil((new Date(b.checkin_date)-new Date(b.booking_date))/86400000));
    const bucket = lt===0?'Same Day':lt<=3?'1-3 Tage':lt<=7?'4-7 Tage':lt<=14?'1-2 Wochen':lt<=30?'2-4 Wochen':lt<=60?'1-2 Monate':'> 2 Monate';
    buckets[bucket].push({ price: parseFloat(b.total_price), id: b.id });
  });
  return Object.entries(buckets).filter(([,v])=>v.length>0).map(([k,v])=>({ lead_time_bucket:k, bookings:v.length, avg_revenue: parseFloat((v.reduce((s,x)=>s+x.price,0)/v.length).toFixed(2)), booking_ids: v.map(x=>x.id) }));
}

export function calcYoY(houseId) {
  const curYear = new Date().getFullYear();
  const prevYear = curYear - 1;
  const houses = houseId ? HOUSES.filter(h=>h.id===parseInt(houseId)) : HOUSES;
  const cap = houses.reduce((s,h)=>s+h.capacity,0);
  const yearMonths = (year) => {
    const months = {};
    BOOKINGS.filter(b => b.checkin_date.startsWith(year) && active(b) && (!houseId || b.house_id===parseInt(houseId))).forEach(b => {
      const m = b.checkin_date.slice(5,7);
      if (!months[m]) months[m] = { month: m, bookings:0, revenue:0, nights:0, bed_nights:0 };
      months[m].bookings++; months[m].revenue += parseFloat(b.total_price);
      months[m].nights += b.nights; months[m].bed_nights += b.guest_count*b.nights;
    });
    return Object.values(months);
  };
  return { current: { year: curYear, capacity: cap, months: yearMonths(String(curYear)) }, previous: { year: prevYear, capacity: cap, months: yearMonths(String(prevYear)) } };
}

export function calcForecast(houseId) {
  const today = new Date().toISOString().slice(0,10);
  const end90 = new Date(Date.now()+90*86400000).toISOString().slice(0,10);
  const filtered = BOOKINGS.filter(b => b.checkin_date >= today && b.checkin_date <= end90 && active(b) && (!houseId || b.house_id===parseInt(houseId)));
  const houses = houseId ? HOUSES.filter(h=>h.id===parseInt(houseId)) : HOUSES;
  const cap = houses.reduce((s,h)=>s+h.capacity,0);
  const byMonth = {};
  filtered.forEach(b => {
    const m = b.checkin_date.slice(0,7);
    if (!byMonth[m]) byMonth[m] = { month: m, bookings:0, bed_nights_booked:0, house_nights_booked:0, revenue:0 };
    byMonth[m].bookings++;
    byMonth[m].bed_nights_booked += b.guest_count * b.nights;
    byMonth[m].house_nights_booked += b.nights;
    byMonth[m].revenue += parseFloat(b.total_price);
  });
  return Object.values(byMonth).map(r => {
    const dim = new Date(r.month.slice(0,4), parseInt(r.month.slice(5,7)), 0).getDate();
    const availBed   = cap * dim;
    const availHouse = houses.length * dim;
    return {
      ...r,
      available_bed_nights: availBed,
      // House-based occupancy (consistent with dashboard and monthly reports)
      occupancy_rate: availHouse > 0 ? parseFloat(((r.house_nights_booked / availHouse) * 100).toFixed(1)) : 0,
    };
  });
}

export function calcGuestDistribution(from, to, houseId) {
  const filtered = filterBookings(BOOKINGS, from, to, houseId).filter(active);
  const dist = {};
  filtered.forEach(b => {
    const k = parseInt(b.guest_count) || 1;
    if (!dist[k]) dist[k] = { guest_count: k, bookings: 0, total_nights: 0, total_revenue: 0 };
    dist[k].bookings++;
    dist[k].total_nights += b.nights;
    dist[k].total_revenue += parseFloat(b.total_price);
  });
  return Object.values(dist).sort((a, b) => a.guest_count - b.guest_count);
}

// Cashflow: tatsächliche Zahlungseingänge gruppiert nach Rechnungsdatum.
// Berücksichtigt aufgeteilte Rechnungen (Teilrechnungen) und Stornos: jede
// Rechnung in `booking.invoices[]` fließt mit ihrem eigenen Rechnungsdatum
// und Betrag (Storno-Beträge sind negativ) in den Monat ihres Datums ein.
// Buchungen ohne `invoices[]` (Legacy) zählen mit ihrem Gesamtbetrag im
// Check-in-Monat, da kein Rechnungsdatum bekannt ist.
export function calcCashflow(from, to, houseId) {
  const hid = houseId ? parseInt(houseId) : null;
  const fromMonth = from ? from.slice(0, 7) : null;
  const toMonth = to ? to.slice(0, 7) : null;
  const byMonth = {};
  const ensureMonth = (m) => {
    if (!byMonth[m]) byMonth[m] = { month: m, cashflow: 0, payments: 0 };
  };
  BOOKINGS.filter(b => {
    if (!active(b)) return false;
    if (hid && b.house_id !== hid) return false;
    return true;
  }).forEach(b => {
    // Cash arrives on manually recorded payment_date, or on check-in day if not set
    const m = (b.payment_date || b.checkin_date || '').slice(0, 7);
    if (!m) return;
    if (fromMonth && m < fromMonth) return;
    if (toMonth   && m > toMonth)   return;
    ensureMonth(m);
    byMonth[m].cashflow += parseFloat(b.total_price) || 0;
    byMonth[m].payments++;
  });
  return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).map(r => ({
    ...r,
    cashflow: parseFloat(r.cashflow.toFixed(2)),
  }));
}

export function calcHouses(from, to) {
  const days = Math.max(1, Math.ceil((new Date(to)-new Date(from))/86400000));
  return HOUSES.map(h => {
    const bks = filterBookings(BOOKINGS, from, to, h.id).filter(active);
    const revenue = bks.reduce((s,b)=>s+parseFloat(b.total_price),0);
    const nights = bks.reduce((s,b)=>s+b.nights,0);
    const cancellations = filterBookings(BOOKINGS, from, to, h.id).filter(b=>b.status==='storniert').length;
    const adrVals = bks.filter(b=>b.daily_rate>0).map(b=>b.daily_rate);
    const adr = adrVals.length ? adrVals.reduce((s,v)=>s+v,0)/adrVals.length : 0;
    const availBed   = h.capacity * days;
    const availHouse = days; // one house: available nights = days in period
    const bedNights = bks.reduce((s,b)=>s+b.guest_count*b.nights,0);
    return { id:h.id, name:h.name, short_name:h.short_name, capacity:h.capacity, bookings:bks.length, revenue, nights, adr:parseFloat(adr.toFixed(2)), cancellations, available_bed_nights:availBed, occupancy_rate:availHouse>0?parseFloat(((nights/availHouse)*100).toFixed(1)):0, revpar:availBed>0?parseFloat((revenue/availBed).toFixed(2)):0 };
  });
}
