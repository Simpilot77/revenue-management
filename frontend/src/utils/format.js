export const formatCurrency = (value, currency = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value ?? 0);

export const formatPercent = (value) =>
  `${parseFloat(value ?? 0).toFixed(1)} %`;

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateFull = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateInput = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
};

export const nightsBetween = (checkin, checkout) => {
  if (!checkin || !checkout) return 0;
  return Math.max(0, Math.ceil((new Date(checkout) - new Date(checkin)) / 86400000));
};

export const STATUS_LABELS = {
  angefragt: 'Angefragt',
  bestaetigt: 'Bestätigt',
  eingecheckt: 'Eingecheckt',
  ausgecheckt: 'Ausgecheckt',
  storniert: 'Storniert',
  no_show: 'No-Show',
  gesperrt: 'Gesperrt (Eigentümer)',
};

export const STATUS_COLORS = {
  angefragt: 'bg-yellow-100 text-yellow-800',
  bestaetigt: 'bg-blue-100 text-blue-800',
  eingecheckt: 'bg-green-100 text-green-800',
  ausgecheckt: 'bg-gray-100 text-gray-700',
  storniert: 'bg-red-100 text-red-800',
  no_show: 'bg-orange-100 text-orange-800',
  gesperrt: 'bg-slate-200 text-slate-600',
};

export const PAYMENT_STATUS_LABELS = {
  offen: 'Offen',
  anzahlung: 'Anzahlung',
  bezahlt: 'Bezahlt',
  erstattet: 'Erstattet',
};

export const PAYMENT_STATUS_COLORS = {
  offen: 'bg-red-100 text-red-700',
  anzahlung: 'bg-yellow-100 text-yellow-700',
  bezahlt: 'bg-green-100 text-green-700',
  erstattet: 'bg-purple-100 text-purple-700',
};

export const PAYMENT_METHOD_LABELS = {
  bar: 'Bar',
  ueberweisung: 'Überweisung',
  kreditkarte: 'Kreditkarte',
  paypal: 'PayPal',
  sonstige: 'Sonstige',
};

export const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
