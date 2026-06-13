import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Invoice translations ────────────────────────────────────────────────────

const INVOICE_I18N = {
  de: {
    title: 'Rechnung',
    invoiceNumber: 'Rechnungs-Nr.',
    invoiceDate: 'Rechnungsdatum',
    servicePeriod: 'Leistungszeitraum',
    customerNumber: 'Ihre Kundennummer',
    contactPerson: 'Ihr Ansprechpartner',
    salutation: 'Sehr geehrter Gast,',
    introLine1: (co, street, city) => `Vielen Dank für Ihre Buchung bei ${co}, ${street}, ${city}.`,
    introLine2: 'Gerne stellen wir Ihnen folgende Leistungen in Rechnung:',
    colPos: 'Pos.',
    colDescription: 'Beschreibung',
    colQty: 'Menge',
    colUnitPrice: 'Einzelpreis',
    colTotal: 'Gesamtpreis',
    accommodation: 'Übernachtung',
    nights: (n) => `${n} Nächte`,
    persons: (n) => `${n} Personen`,
    lineCleaning: 'Endreinigung',
    lineDiscount: (pct) => `Rabatt ${pct} %`,
    qty: '1,00 Stk',
    netAmount: 'Gesamtbetrag netto',
    vat: (rate) => `Umsatzsteuer ${rate}%`,
    gross: 'Gesamtbetrag brutto',
    paymentBold: (date) => `Bitte überweisen Sie den Betrag bis spätestens zum ${date} auf unten genanntes Konto.`,
    agb1: 'Der Mietvertrag kommt erst mit dem vollständigen bzw. fristgerechten Eingang des Geldbetrages zustande.',
    agb2: (url) => `Es gelten die Hausordnung und unsere AGB's, welche unter ${url} einsehbar sind.`,
    closingText: 'Wir freuen uns, Sie als Gäste willkommen heißen zu dürfen, und wünschen einen angenehmen Aufenthalt.',
    closing: 'Mit freundlichen Grüßen,',
    footerManagement: (name) => `Geschäftsführung ${name}`,
    filename: (inv, name) => `rechnung_${inv}_${name}.pdf`,
    locale: 'de-DE',
  },
  en: {
    title: 'Invoice',
    invoiceNumber: 'Invoice No.',
    invoiceDate: 'Invoice Date',
    servicePeriod: 'Service Period',
    customerNumber: 'Your Customer No.',
    contactPerson: 'Your Contact',
    salutation: 'Dear Guest,',
    introLine1: (co, street, city) => `Thank you for your booking at ${co}, ${street}, ${city}.`,
    introLine2: 'We would like to invoice you for the following services:',
    colPos: 'No.',
    colDescription: 'Description',
    colQty: 'Qty',
    colUnitPrice: 'Unit Price',
    colTotal: 'Total',
    accommodation: 'Accommodation',
    nights: (n) => `${n} nights`,
    persons: (n) => `${n} persons`,
    lineCleaning: 'Final Cleaning',
    lineDiscount: (pct) => `Discount ${pct} %`,
    qty: '1.00 pcs',
    netAmount: 'Total net amount',
    vat: (rate) => `VAT ${rate}%`,
    gross: 'Total gross amount',
    paymentBold: (date) => `Please transfer the amount by ${date} to the account below.`,
    agb1: 'The rental agreement only comes into effect upon receipt of the full payment on time.',
    agb2: (url) => `Our house rules and terms & conditions apply, available at ${url}.`,
    closingText: 'We look forward to welcoming you and wish you a pleasant stay.',
    closing: 'Kind regards,',
    footerManagement: (name) => `Management ${name}`,
    filename: (inv, name) => `invoice_${inv}_${name}.pdf`,
    locale: 'en-GB',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const BLUE = [29, 78, 216];
const DARK = [30, 41, 59];
const GRAY = [100, 116, 139];
const LIGHT = [241, 245, 249];

const fmt = (v) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0);
const fmtPct = (v) => `${parseFloat(v ?? 0).toFixed(1)} %`;
const fmtDate = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function header(doc, title, subtitle = '', logoBase64 = null) {
  const W = doc.internal.pageSize.getWidth();
  const LOGO_SIZE = 20; // mm — nearly square logo (721×731)
  const HEADER_H = 26;
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, HEADER_H, 'F');

  // Logo on the right side: white circle background + logo image
  if (logoBase64) {
    try {
      const cx = W - 14 - LOGO_SIZE / 2;
      const cy = HEADER_H / 2;
      // White circle behind logo
      doc.setFillColor(255, 255, 255);
      doc.circle(cx, cy, LOGO_SIZE / 2 + 1, 'F');
      doc.addImage(logoBase64, 'JPEG', W - 14 - LOGO_SIZE, (HEADER_H - LOGO_SIZE) / 2, LOGO_SIZE, LOGO_SIZE);
    } catch (_) {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Workation Wolfsburg – Revenue Management', 14, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 19);
  if (subtitle) {
    doc.setFontSize(8);
    // Keep subtitle text away from logo
    const subtitleX = logoBase64 ? W - 14 - LOGO_SIZE - 6 : W - 14;
    doc.text(subtitle, subtitleX, 19, { align: 'right' });
  }
  doc.setTextColor(...DARK);
}

// Embed a chart screenshot image into the PDF, fitting within available width
function addChartImage(doc, chartImg, startY, marginL = 14, marginR = 14) {
  if (!chartImg) return startY;
  const W = doc.internal.pageSize.getWidth();
  const maxW = W - marginL - marginR;
  // Create a temporary image to get natural dimensions
  try {
    const imgProps = doc.getImageProperties(chartImg);
    const ratio = imgProps.height / imgProps.width;
    const imgW = Math.min(maxW, maxW);
    const imgH = Math.round(imgW * ratio);
    const maxH = 110; // max 110mm height for chart section
    const finalH = Math.min(imgH, maxH);
    const finalW = Math.round(finalH / ratio);
    doc.addImage(chartImg, 'JPEG', marginL, startY, finalW, finalH);
    return startY + finalH + 6;
  } catch (e) {
    return startY;
  }
}

function footer(doc) {
  const pages = doc.internal.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 230);
    doc.line(14, H - 12, W - 14, H - 12);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Erstellt am ${new Date().toLocaleString('de-DE')}`, 14, H - 7);
    doc.text(`Seite ${i} / ${pages}`, W - 14, H - 7, { align: 'right' });
  }
}

function save(doc, filename) {
  footer(doc);
  doc.save(filename);
}

const STATUS_DE = {
  angefragt: 'Angefragt', bestaetigt: 'Bestätigt', eingecheckt: 'Eingecheckt',
  ausgecheckt: 'Ausgecheckt', storniert: 'Storniert', no_show: 'No-Show',
};
const PAYMENT_DE = { offen: 'Offen', anzahlung: 'Anzahlung', bezahlt: 'Bezahlt', erstattet: 'Erstattet' };
const METHOD_DE = { bar: 'Bar', ueberweisung: 'Überweisung', kreditkarte: 'Kreditkarte', paypal: 'PayPal', sonstige: 'Sonstige' };
const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

// ─── 1. Buchungsliste ────────────────────────────────────────────────────────

export async function exportBookingsList(bookings, filters = {}) {
  if (!bookings || bookings.length === 0) {
    alert('Keine Buchungen zum Exportieren vorhanden.');
    return;
  }
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const subtitle = filters.from && filters.to
    ? `${fmtDate(filters.from)} – ${fmtDate(filters.to)}`
    : `Alle Buchungen · Stand ${new Date().toLocaleDateString('de-DE')}`;
  header(doc, 'Buchungsliste', subtitle, logo);

  const todayStr = new Date().toISOString().slice(0, 10);
  const rows = bookings.map(b => [
    b.house_short ?? '—',
    b.invoice_number ?? '—',
    b.guest_name + (b.company_name ? `\n${b.company_name}` : ''),
    fmtDate(b.booking_date),
    fmtDate(b.checkin_date),
    fmtDate(b.checkout_date),
    String(b.nights ?? '—'),
    String(b.guest_count ?? '—'),
    b.channel_short ?? '—',
    fmt(b.total_price),
    STATUS_DE[b.status] ?? b.status,
    PAYMENT_DE[b.payment_status] ?? b.payment_status,
  ]);
  // Store per-row past/future flags (aligned with rows array)
  const rowFlags = bookings.map(b => ({
    isPast:   (b.checkout_date?.slice(0,10) ?? '') < todayStr,
    isFuture: (b.checkin_date?.slice(0,10) ?? '') > todayStr,
  }));

  autoTable(doc, {
    startY: 30,
    head: [['Haus','Rechnung','Gast / Firma','Buchungs­datum','Anreise','Abreise','N','G.','Kanal','Gesamt','Status','Zahlung']],
    body: rows,
    styles: { fontSize: 7.5, cellPadding: [2, 2, 2, 2], textColor: DARK, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.5, cellPadding: [3,2,3,2] },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: 24 },
      2: { cellWidth: 42 },
      3: { cellWidth: 20 },
      4: { cellWidth: 19 },
      5: { cellWidth: 19 },
      6: { cellWidth: 8,  halign: 'center' },
      7: { cellWidth: 8,  halign: 'center' },
      8: { cellWidth: 18 },
      9: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      10: { cellWidth: 22 },
      11: { cellWidth: 22 },
    },
    margin: { left: 14, right: 14, top: 30 },
    // Repeat header on each new page
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        header(doc, 'Buchungsliste', subtitle, logo);
      }
    },
    // Color code: past=light gray bg, future=light blue bg, payment/status colors
    didParseCell: (cell) => {
      if (cell.section === 'body') {
        const flag = rowFlags[cell.row.index];
        if (flag?.isPast) {
          cell.cell.styles.fillColor = [245, 245, 245]; // light gray
          if (cell.column.index !== 9) cell.cell.styles.textColor = [160, 160, 160];
        } else if (flag?.isFuture) {
          cell.cell.styles.fillColor = [239, 246, 255]; // light blue
        }
        // Payment status colors (override text color)
        if (cell.column.index === 11) {
          const val = cell.cell.raw;
          if (val === 'Bezahlt') { cell.cell.styles.textColor = [22, 163, 74]; cell.cell.styles.fontStyle = 'bold'; }
          else if (val === 'Offen') { cell.cell.styles.textColor = [220, 38, 38]; }
        }
        if (cell.column.index === 10) {
          const val = cell.cell.raw;
          if (val === 'Storniert') cell.cell.styles.textColor = [156, 163, 175];
        }
      }
    },
  });

  // Summary bar
  const total  = bookings.reduce((s, b) => s + (parseFloat(b.total_price) || 0), 0);
  const nights = bookings.reduce((s, b) => s + (parseInt(b.nights) || 0), 0);
  const paid   = bookings.filter(b => b.payment_status === 'bezahlt').length;
  const finalY = (doc.lastAutoTable?.finalY || 30) + 6;
  const H = doc.internal.pageSize.getHeight();

  // If summary would overflow, add new page
  if (finalY + 14 > H - 14) {
    doc.addPage();
    header(doc, 'Buchungsliste', subtitle, logo);
  }
  const sy = finalY + 14 > H - 14 ? 34 : finalY;

  doc.setFillColor(...LIGHT);
  doc.roundedRect(14, sy - 4, W - 28, 12, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(`${bookings.length} Buchungen  ·  ${nights} Nächte  ·  ${paid} bezahlt  ·  Gesamtumsatz: ${fmt(total)}`, 19, sy + 3);

  save(doc, `buchungsliste_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ─── 2. Einzelrechnung / Buchungsbeleg ──────────────────────────────────────

function getCompanySettings() {
  try {
    const raw = localStorage.getItem('company_settings');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    company_name: 'Workation Wolfsburg',
    owner_name: 'Nils Flegel',
    phone: '',
    email: 'info@workation-wolfsburg.com',
    website: 'www.workation-wolfsburg.com',
    street: 'Laagbergstraße 15',
    zip: '38440',
    city: 'Wolfsburg',
    country: 'Deutschland',
    tax_number: '',
    vat_id: '',
    vat_rate: 7,
    bank_name: '',
    iban: '',
    bic: '',
    invoice_intro: 'wir berechnen Ihnen folgende Leistungen:',
    invoice_footer: 'Zahlbar innerhalb von 14 Tagen ohne Abzug. Vielen Dank für Ihren Aufenthalt!',
  };
}

let _logoCache = null;
async function loadLogoBase64(url) {
  if (_logoCache !== null) return _logoCache;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    _logoCache = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    _logoCache = '';
  }
  return _logoCache;
}

async function getReportLogo() {
  // Use import.meta.env.BASE_URL so the path works on both dev and GitHub Pages
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  return loadLogoBase64(`${base}logo.png`);
}

// ─── Build editable invoice data object ─────────────────────────────────────

export function buildInvoicePreviewData(booking, lang = 'de') {
  const t = INVOICE_I18N[lang] || INVOICE_I18N.de;
  const s = getCompanySettings();
  const vatRate = parseFloat(s.vat_rate ?? 7);
  const bruttoTotal = parseFloat(booking.total_price || 0);
  const cleaningFee = parseFloat(booking.cleaning_fee || 0);
  const discountPct = parseFloat(booking.discount_percent || 0);
  const nettoTotal = bruttoTotal / (1 + vatRate / 100);
  const vatAmount = bruttoTotal - nettoTotal;

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 14);
  const invoiceDateStr = invoiceDate.toLocaleDateString(t.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const dueDateStr = dueDate.toLocaleDateString(t.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  const ba = booking.billing_address || {};
  const safeName = (booking.guest_name || 'booking').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  // ── Fallback address: use booked house address with c/o line ──
  const hasAddress = !!(ba.street || ba.zip || ba.city);
  let billingStreet = ba.street || '';
  let billingZip    = ba.zip    || '';
  let billingCity   = ba.city   || '';
  let billingCountry = ba.country || '';
  let coLine = '';   // "c/o …" line shown between name and street

  if (!hasAddress && booking.house_id) {
    // Try to get house address from settings
    const houseSettings = s.houses?.[booking.house_id];
    const houseAddr = houseSettings?.address || '';
    if (houseAddr) {
      // Format: "Laagbergstraße 15b, 38440 Wolfsburg"
      const commaIdx = houseAddr.lastIndexOf(',');
      if (commaIdx > -1) {
        billingStreet = houseAddr.slice(0, commaIdx).trim();
        const rest = houseAddr.slice(commaIdx + 1).trim(); // "38440 Wolfsburg"
        const spaceIdx = rest.indexOf(' ');
        if (spaceIdx > -1) {
          billingZip  = rest.slice(0, spaceIdx).trim();
          billingCity = rest.slice(spaceIdx + 1).trim();
        } else {
          billingCity = rest;
        }
      } else {
        billingStreet = houseAddr;
      }
      billingCountry = ba.country || s.country || 'Deutschland';
      // c/o line: the guest is reachable via the company at the house address
      coLine = 'c/o';
    }
  }

  return {
    lang,
    // Internal references (for invoice/customer number sync, not printed)
    _booking_id: booking.id,
    _house_id: booking.house_id,
    // Recipient
    company_name: booking.company_name || '',
    guest_name: booking.guest_name || '',
    co_line: coLine,              // "c/o …" — empty when guest has own address
    billing_street: billingStreet,
    billing_zip: billingZip,
    billing_city: billingCity,
    billing_country: billingCountry,
    // Invoice meta
    invoice_number: booking.invoice_number || '',
    invoice_date: invoiceDateStr,
    service_period: `${fmtDate(booking.checkin_date)} – ${fmtDate(booking.checkout_date)}`,
    customer_number: booking.customer_number || '—',
    contact_person: s.owner_name || 'Nils Flegel',
    // Text
    salutation: t.salutation,
    intro_line1: t.introLine1(s.company_name, s.street, `${s.zip} ${s.city}`),
    intro_line2: t.introLine2,
    // Line items
    accommodation_desc: t.accommodation,
    accommodation_sub_house: booking.house_name ? `Haus „${booking.house_name}"` : '',
    accommodation_sub_dates: `${fmtDate(booking.checkin_date)} – ${fmtDate(booking.checkout_date)} (${booking.nights} ${lang === 'de' ? 'Nächte' : 'nights'})`,
    accommodation_sub_persons: booking.guest_count ? (lang === 'de' ? `${booking.guest_count} Personen` : `${booking.guest_count} persons`) : '',
    accommodation_qty: booking.nights || 1,
    accommodation_unit_price: parseFloat(booking.daily_rate) || 0,
    cleaning_fee_desc: t.lineCleaning,
    cleaning_fee: cleaningFee,
    discount_desc: t.lineDiscount(discountPct),
    discount_pct: discountPct,
    // Totals (auto-calculated)
    vat_rate: vatRate,
    brutto_total: bruttoTotal,
    netto_total: nettoTotal,
    vat_amount: vatAmount,
    // Labels
    net_label: t.netAmount,
    vat_label: t.vat(vatRate),
    gross_label: t.gross,
    col_pos: t.colPos,
    col_desc: t.colDescription,
    col_qty: t.colQty,
    col_unit: t.colUnitPrice,
    col_total: t.colTotal,
    qty_unit: t.qty,
    // Payment — use first preset from settings if available
    payment_text: (() => {
      const p = s.invoice_presets?.payments?.[0];
      return p?.text || t.paymentBold(dueDateStr);
    })(),
    // AGB — use first preset from settings if available
    agb1: s.invoice_presets?.agbs?.[0]?.agb1 || t.agb1,
    agb2: s.invoice_presets?.agbs?.[0]?.agb2 || t.agb2(s.website || 'www.workation-wolfsburg.com'),
    // Closing
    closing_text: t.closingText,
    closing: t.closing,
    owner_name: s.owner_name || 'Nils Flegel',
    website: s.website || 'www.workation-wolfsburg.com',
    // External reference (e.g. Logifi / Lodgify booking number)
    external_reference: booking.external_reference || '',
    // Additional line items (populated by InvoicePreviewModal)
    extra_items: [],
    // Internal
    _settings: s,
    _filename: t.filename(booking.invoice_number || booking.id, safeName),
    _title: t.title,
  };
}

// ─── Generate PDF from preview data ─────────────────────────────────────────

export async function exportInvoiceFromData(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const s = data._settings || getCompanySettings();

  // ── Logo (square, nearly 1:1 — 721×731) ──
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const logoBase64 = await loadLogoBase64(`${base}logo.png`);
  if (logoBase64) {
    const LOGO_SZ = 30; // mm — square logo
    const lx = W - 14 - LOGO_SZ;
    const ly = 10;
    // White background circle so logo looks clean on white page
    doc.setFillColor(255, 255, 255);
    doc.circle(lx + LOGO_SZ / 2, ly + LOGO_SZ / 2, LOGO_SZ / 2 + 0.5, 'F');
    try {
      doc.addImage(logoBase64, 'JPEG', lx, ly, LOGO_SZ, LOGO_SZ);
    } catch (_) {}
  }

  // ── Sender line ──
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`${s.company_name} · ${s.street} · ${s.zip} ${s.city}`, 25, 50);
  doc.setDrawColor(200, 200, 200);
  doc.line(25, 51.5, 115, 51.5);

  // ── Recipient ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  let ry = 58;
  // When using c/o (house address fallback), skip the guest's company name
  if (data.company_name && !data.co_line) { doc.text(data.company_name, 25, ry); ry += 6; }
  if (data.guest_name)      { doc.text(data.guest_name,   25, ry); ry += 6; }
  if (data.co_line)         { doc.text(data.co_line,      25, ry); ry += 6; }
  if (data.billing_address_freetext) {
    const lines = data.billing_address_freetext.split('\n').filter(l => l.trim());
    lines.forEach(line => { doc.text(line, 25, ry); ry += 6; });
  } else {
    if (data.billing_street)  { doc.text(data.billing_street, 25, ry); ry += 6; }
    const zipCity = `${data.billing_zip || ''} ${data.billing_city || ''}`.trim();
    if (zipCity) { doc.text(zipCity, 25, ry); ry += 6; }
    if (data.billing_country) { doc.text(data.billing_country, 25, ry); }
  }

  // ── Meta block ──
  const metaLX = 122;
  const metaVX = W - 14;
  const metaItems = [
    { label: 'Rechnungs-Nr.', value: data.invoice_number || '—', valueBold: true, valueLarge: true },
    { label: 'Rechnungsdatum', value: data.invoice_date },
    { label: 'Leistungszeitraum', value: data.service_period },
    ...(data.external_reference ? [{ label: 'Buchungs-Ref.', value: data.external_reference }] : []),
    { label: '', value: '' },
    { label: 'Kundennummer', value: data.customer_number },
    { label: 'Ansprechpartner', value: data.contact_person },
  ];
  let my = 50;
  metaItems.forEach(({ label, value, valueBold, valueLarge }) => {
    if (!label && !value) { my += 4; return; }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.setFontSize(8.5);
    doc.text(label, metaLX, my);
    if (value) {
      doc.setFont('helvetica', valueBold ? 'bold' : 'normal');
      doc.setTextColor(...DARK);
      doc.setFontSize(valueLarge ? 10 : 8.5);
      doc.text(value, metaVX, my, { align: 'right' });
    }
    my += 5.5;
  });

  // ── Title ──
  const titleY = 97;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(`${data._title || 'Rechnung'} Nr. ${data.invoice_number || '—'}`, 25, titleY);

  // ── Salutation + intro ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(data.salutation, 25, titleY + 13);
  const intro1Lines = doc.splitTextToSize(data.intro_line1, W - 25 - 14);
  doc.text(intro1Lines, 25, titleY + 21);
  doc.text(data.intro_line2, 25, titleY + 21 + intro1Lines.length * 5.5);
  const tableStartY = titleY + 21 + intro1Lines.length * 5.5 + 9;

  // ── Table rows ──
  const vatRate = parseFloat(data.vat_rate || 7);
  const bruttoTotal = parseFloat(data.brutto_total || 0);
  const cleaningFee = parseFloat(data.cleaning_fee || 0);
  const discountPct = parseFloat(data.discount_pct || 0);
  const accomBrutto = bruttoTotal - cleaningFee * (1 + vatRate / 100);

  const accomQty = parseFloat(data.accommodation_qty) || 1;
  const accomUnitPrice = parseFloat(data.accommodation_unit_price) || 0;
  const accomLineTotal = accomQty * accomUnitPrice;
  const accomFallback = accomBrutto > 0 ? accomBrutto : bruttoTotal;
  const accomDisplayTotal = accomLineTotal > 0 ? accomLineTotal : accomFallback;
  const accomDisplayUnit = accomUnitPrice > 0 ? fmt(accomUnitPrice) : fmt(accomFallback);
  const langCode = data.lang || 'de';
  const accomQtyLabel = accomQty > 0
    ? `${accomQty} ${langCode === 'en' ? 'nights' : 'Nächte'}`
    : data.qty_unit;

  const tableBody = [
    { pos: '1.', desc: data.accommodation_desc, qty: accomQtyLabel, unit: accomDisplayUnit, total: fmt(accomDisplayTotal), isMainAccom: true },
    ...[data.accommodation_sub_house, data.accommodation_sub_dates, data.accommodation_sub_persons]
      .filter(Boolean)
      .map(line => ({ pos: '', desc: line, qty: '', unit: '', total: '', isSub: true })),
  ];
  if (cleaningFee > 0) {
    const cleanBrutto = cleaningFee * (1 + vatRate / 100);
    tableBody.push({ pos: `${tableBody.filter(r => r.pos).length + 1}.`, desc: data.cleaning_fee_desc, qty: data.qty_unit, unit: fmt(cleanBrutto), total: fmt(cleanBrutto) });
  }
  if (discountPct > 0) {
    const discAmt = bruttoTotal * discountPct / 100;
    tableBody.push({ pos: `${tableBody.filter(r => r.pos).length + 1}.`, desc: data.discount_desc, qty: '', unit: '', total: `- ${fmt(discAmt)}` });
  }
  // Extra line items
  const extraItems = Array.isArray(data.extra_items) ? data.extra_items : [];
  extraItems.forEach(item => {
    if (!item.description) return;
    const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price) || 0);
    const pos = `${tableBody.filter(r => r.pos).length + 1}.`;
    tableBody.push({
      pos,
      desc: item.description,
      qty: `${(parseFloat(item.qty) || 0).toFixed(2).replace('.', ',')} Stk`,
      unit: fmt(item.unit_price),
      total: fmt(lineTotal),
      isExtra: true,
    });
    if (item.note) {
      tableBody.push({ pos: '', desc: item.note, qty: '', unit: '', total: '', isSub: true });
    }
  });
  const bodyRows = tableBody.map(r => [r.pos, r.desc, r.qty, r.unit, r.total]);

  autoTable(doc, {
    startY: tableStartY,
    head: [[data.col_pos, data.col_desc, data.col_qty, data.col_unit, data.col_total]],
    body: bodyRows,
    styles: { fontSize: 9, cellPadding: [2.5, 2, 2.5, 2], textColor: DARK, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], textColor: DARK, fontStyle: 'bold', lineWidth: 0, fontSize: 9 },
    bodyStyles: { fillColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 25, halign: 'right' }, 3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } },
    margin: { left: 25, right: 14 },
    didParseCell: (cell) => {
      if (cell.section === 'head') { cell.cell.styles.lineWidth = { bottom: 0.4 }; cell.cell.styles.lineColor = DARK; }
      if (cell.section === 'body') {
        const row = tableBody[cell.row.index];
        if (row?.isSub) { cell.cell.styles.fontSize = 8.5; cell.cell.styles.textColor = [80, 80, 80]; cell.cell.styles.cellPadding = [1, 2, 1, 2]; }
        if ((row?.isMainAccom || row?.isExtra) && cell.column.index === 1) cell.cell.styles.fontStyle = 'bold';
        if (cell.row.index === bodyRows.length - 1) cell.cell.styles.lineWidth = { bottom: 0.1 };
      }
    },
  });

  // ── Subtotals ──
  const subLX = 25;
  const subRX = W - 14;
  let sy = doc.lastAutoTable.finalY + 5;
  doc.setDrawColor(220, 220, 220);
  doc.line(subLX, sy - 1, subRX, sy - 1);

  const nettoTotal = parseFloat(data.netto_total || 0);
  const vatAmount = parseFloat(data.vat_amount || 0);

  [
    { label: data.net_label, value: fmt(nettoTotal), bold: false },
    { label: data.vat_label, value: fmt(vatAmount), bold: false },
    { label: data.gross_label, value: fmt(bruttoTotal), bold: true },
  ].forEach(({ label, value, bold }) => {
    if (bold) { doc.setDrawColor(180, 180, 180); doc.line(subLX, sy - 1.5, subRX, sy - 1.5); }
    doc.setFontSize(bold ? 10 : 9);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...DARK);
    doc.text(label, subLX, sy + (bold ? 4 : 3));
    doc.text(value, subRX, sy + (bold ? 4 : 3), { align: 'right' });
    sy += bold ? 7 : 5.5;
  });

  // ── Payment ──
  sy += 6;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  const payLines = doc.splitTextToSize(data.payment_text, W - 25 - 14);
  doc.text(payLines, 25, sy);
  sy += payLines.length * 5.5 + 4;

  // ── AGB ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  const agb1Lines = doc.splitTextToSize(data.agb1, W - 25 - 14);
  doc.text(agb1Lines, 25, sy);
  sy += agb1Lines.length * 5.5 + 1;
  const agb2Lines = doc.splitTextToSize(data.agb2, W - 25 - 14);
  doc.text(agb2Lines, 25, sy);
  sy += agb2Lines.length * 5.5 + 10;

  // ── Closing ──
  const closingLines = doc.splitTextToSize(data.closing_text, W - 25 - 14);
  doc.text(closingLines, 25, sy);
  sy += closingLines.length * 5.5 + 10;
  doc.text(data.closing, 25, sy);
  sy += 6;
  doc.text(data.owner_name, 25, sy);
  sy += 10;
  doc.setTextColor(29, 78, 216);
  doc.text(data.website, 25, sy);

  // ── Footer ──
  const footerY = H - 26;
  doc.setDrawColor(180, 180, 180);
  doc.line(14, footerY - 3, W - 14, footerY - 3);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('1/1', W - 14, footerY - 5, { align: 'right' });
  const colW = (W - 28) / 4;
  const footerCols = [
    [s.company_name, s.street, `${s.zip} ${s.city}`, s.country || 'Deutschland'],
    [s.phone ? `Tel. ${s.phone}` : null, s.email ? `E-Mail ${s.email}` : null, s.website ? `Web ${s.website}` : null].filter(Boolean),
    [s.vat_id ? `USt-ID ${s.vat_id}` : null, s.tax_number ? `Steuer-Nr. ${s.tax_number}` : null, s.owner_name ? `Geschäftsführung ${s.owner_name}` : null].filter(Boolean),
    [s.bank_name ? `Bank ${s.bank_name}` : null, s.iban ? `IBAN ${s.iban}` : null, s.bic ? `BIC ${s.bic}` : null].filter(Boolean),
  ];
  footerCols.forEach((lines, ci) => {
    lines.forEach((line, li) => {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
      doc.text(line, 14 + ci * colW, footerY + li * 4.5);
    });
  });

  doc.save(data._filename || 'rechnung.pdf');
}

// ─── Convenience wrapper (backward compat) ───────────────────────────────────
export async function exportInvoice(booking, lang = 'de') {
  const data = buildInvoicePreviewData(booking, lang);
  await exportInvoiceFromData(data);
}

// ─── 2b. Kundenliste PDF ─────────────────────────────────────────────────────

export async function exportCustomers(customers) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  header(doc, 'Kundendatenbank', `Erstellt: ${new Date().toLocaleDateString('de-DE')}`, logo);

  const rows = customers.map(c => [
    c.customer_number || '—',
    c.guest_name || '—',
    c.company_name || '—',
    c.email || '—',
    c.phone || '—',
    c.bookings_count ?? 0,
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(c.total_revenue ?? 0),
  ]);

  autoTable(doc, {
    startY: 26,
    head: [['Kundennr.', 'Name', 'Firma', 'E-Mail', 'Telefon', 'Buchungen', 'Umsatz']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 40 },
      2: { cellWidth: 50 },
      3: { cellWidth: 55 },
      4: { cellWidth: 30 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  const fy = doc.lastAutoTable.finalY + 6;
  const totalRevenue = customers.reduce((s, c) => s + (parseFloat(c.total_revenue) || 0), 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(
    `${customers.length} Kunden · Gesamtumsatz: ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalRevenue)}`,
    14, fy
  );

  save(doc, `kundenliste_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── 3. Dashboard KPI-Report ─────────────────────────────────────────────────

export async function exportDashboard(kpis, monthly, houseData, year) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  header(doc, `KPI-Jahresbericht ${year}`, `Erstellt: ${new Date().toLocaleDateString('de-DE')}`, logo);

  // KPI summary boxes
  const kpiItems = [
    { label: 'Auslastung', value: fmtPct(kpis.occupancy_rate) },
    { label: 'Gesamtumsatz', value: fmt(kpis.total_revenue) },
    { label: 'ADR', value: fmt(kpis.adr) },
    { label: 'RevPAR', value: fmt(kpis.revpar) },
    { label: 'Bestät. Buchungen', value: kpis.confirmed_bookings },
    { label: 'Gebuchte Nächte', value: kpis.total_nights },
    { label: 'Ø Aufenthalt', value: `${kpis.avg_los} N.` },
    { label: 'Ø Vorlaufzeit', value: `${kpis.avg_lead_time} Tage` },
    { label: 'Stornoquote', value: fmtPct(kpis.cancellation_rate) },
    { label: 'No-Shows', value: kpis.no_shows },
    { label: 'Stammgäste', value: kpis.returning_guests },
    { label: 'Verf. Bett-Nächte', value: kpis.available_bed_nights },
  ];

  const cols = 4, bW = (W - 28 - (cols - 1) * 4) / cols, bH = 14;
  kpiItems.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 14 + col * (bW + 4);
    const y = 28 + row * (bH + 3);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, bW, bH, 2, 2, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x + bW / 2, y + 4.5, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text(String(item.value), x + bW / 2, y + 10.5, { align: 'center' });
  });

  // Monthly table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Monatliche Übersicht', 14, 95);

  autoTable(doc, {
    startY: 98,
    head: [['Monat','Buchungen','Nächte','Auslastung','Umsatz','ADR','RevPAR']],
    body: monthly.map(r => [
      MONTH_NAMES[parseInt(r.month.slice(5,7)) - 1] + ' ' + year,
      r.bookings,
      r.booked_nights,
      fmtPct(r.occupancy_rate),
      fmt(r.revenue),
      fmt(r.adr),
      fmt(r.revpar),
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 24 },
      3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // House comparison
  const ty = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Häuservergleich', 14, ty);

  autoTable(doc, {
    startY: ty + 4,
    head: [['Haus','Kapazität','Buchungen','Nächte','Auslastung','Umsatz','ADR','RevPAR','Stornos']],
    body: houseData.map(h => [
      h.name, `${h.capacity} Betten`, h.bookings, h.nights,
      fmtPct(h.occupancy_rate), fmt(h.revenue), fmt(h.adr), fmt(h.revpar), h.cancellations,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  });

  save(doc, `kpi_bericht_${year}.pdf`);
}

// ─── 4. Auswertungsberichte ──────────────────────────────────────────────────

export async function exportMonthlyReport(monthly, year, chartImg = null) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  header(doc, `Monatsbericht ${year}`, `Stand: ${new Date().toLocaleDateString('de-DE')}`, logo);
  autoTable(doc, {
    startY: 30,
    head: [['Monat','Buchungen','Nächte','Bett-Nächte','Auslastung','Umsatz','ADR','RevPAR']],
    body: monthly.map(r => [
      MONTH_NAMES[parseInt(r.month.slice(5,7)) - 1] + ' ' + year,
      r.bookings, r.booked_nights, r.bed_nights,
      fmtPct(r.occupancy_rate), fmt(r.revenue), fmt(r.adr), fmt(r.revpar),
    ]),
    styles: { fontSize: 9, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'}, 7:{halign:'right'} },
    margin: { left: 14, right: 14 },
  });
  const chartY = doc.lastAutoTable.finalY + 8;
  addChartImage(doc, chartImg, chartY);
  save(doc, `monatsbericht_${year}.pdf`);
}

export async function exportChannelReport(channels, from, to, chartImg = null) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  header(doc, 'Channel-Mix Auswertung', `${fmtDate(from)} – ${fmtDate(to)}`, logo);
  const totalRev = channels.reduce((s, c) => s + parseFloat(c.revenue || 0), 0);
  autoTable(doc, {
    startY: 30,
    head: [['Kanal','Buchungen','Nächte','Umsatz','Umsatz-Anteil','ADR']],
    body: channels.map(c => [
      c.channel, c.bookings, c.nights, fmt(c.revenue),
      totalRev > 0 ? fmtPct((c.revenue / totalRev) * 100) : '—',
      fmt(c.adr),
    ]),
    styles: { fontSize: 9, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'} },
    margin: { left: 14, right: 14 },
  });
  const fy = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(`Gesamt: ${channels.reduce((s,c)=>s+c.bookings,0)} Buchungen · ${fmt(totalRev)} Umsatz`, 14, fy);
  addChartImage(doc, chartImg, fy + 8);
  save(doc, `channel_mix_${from}_${to}.pdf`);
}

export async function exportLeadTimeReport(data, from, to, chartImg = null) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  header(doc, 'Vorlaufzeiten (Lead Time)', `${fmtDate(from)} – ${fmtDate(to)}`, logo);
  autoTable(doc, {
    startY: 30,
    head: [['Vorlaufzeit','Buchungen','Ø Umsatz']],
    body: data.map(r => [r.lead_time_bucket, r.bookings, fmt(r.avg_revenue)]),
    styles: { fontSize: 9, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 1:{halign:'center'}, 2:{halign:'right'} },
    margin: { left: 14, right: 14 },
  });
  addChartImage(doc, chartImg, doc.lastAutoTable.finalY + 8);
  save(doc, `vorlaufzeiten_${from}_${to}.pdf`);
}

export async function exportPickupReport(data, from, to, chartImg = null) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  header(doc, 'Pickup-Report', `Buchungseingänge ${fmtDate(from)} – ${fmtDate(to)}`, logo);
  autoTable(doc, {
    startY: 30,
    head: [['Datum','Neue Buchungen','Umsatz','Nächte']],
    body: data.map(r => [fmtDate(r.pickup_date), r.new_bookings, fmt(r.revenue), r.nights]),
    styles: { fontSize: 9, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 1:{halign:'center'}, 2:{halign:'right'}, 3:{halign:'center'} },
    margin: { left: 14, right: 14 },
  });
  const fy = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(`Gesamt: ${data.reduce((s,r)=>s+r.new_bookings,0)} Buchungen · ${fmt(data.reduce((s,r)=>s+parseFloat(r.revenue||0),0))} Umsatz`, 14, fy);
  addChartImage(doc, chartImg, fy + 8);
  save(doc, `pickup_${from}_${to}.pdf`);
}

export async function exportYoYReport(current, previous, chartImg = null) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  header(doc, `Jahresvergleich ${previous.year} vs. ${current.year}`, '', logo);
  const merged = MONTH_NAMES.map((label, i) => {
    const m = String(i + 1).padStart(2, '0');
    const c = current.months.find(r => r.month === m);
    const p = previous.months.find(r => r.month === m);
    const diff = (c?.revenue || 0) - (p?.revenue || 0);
    const diffPct = p?.revenue > 0 ? ((diff / p.revenue) * 100).toFixed(1) : '—';
    return [
      label,
      fmt(p?.revenue || 0), fmtPct(p ? (p.bed_nights / (previous.capacity * 30)) * 100 : 0),
      fmt(c?.revenue || 0), fmtPct(c ? (c.bed_nights / (current.capacity * 30)) * 100 : 0),
      diff >= 0 ? `+${fmt(diff)}` : fmt(diff),
      diffPct !== '—' ? `${diffPct >= 0 ? '+' : ''}${diffPct} %` : '—',
    ];
  });
  autoTable(doc, {
    startY: 30,
    head: [[
      'Monat',
      `Umsatz ${previous.year}`, `Ausl. ${previous.year}`,
      `Umsatz ${current.year}`, `Ausl. ${current.year}`,
      'Differenz', 'Δ %',
    ]],
    body: merged,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      1:{halign:'right'}, 2:{halign:'right'}, 3:{halign:'right'},
      4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'},
    },
    margin: { left: 14, right: 14 },
  });
  addChartImage(doc, chartImg, doc.lastAutoTable.finalY + 8);
  save(doc, `jahresvergleich_${previous.year}_${current.year}.pdf`);
}

export async function exportForecast(data, chartImg = null) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  header(doc, 'Auslastungsvorschau – nächste 90 Tage', `Stand: ${new Date().toLocaleDateString('de-DE')}`, logo);
  autoTable(doc, {
    startY: 30,
    head: [['Monat','Buchungen','Belegte Bett-N.','Verf. Bett-N.','Auslastung','Umsatz']],
    body: data.map(r => [r.month, r.bookings, r.bed_nights_booked, r.available_bed_nights, fmtPct(r.occupancy_rate), fmt(r.revenue)]),
    styles: { fontSize: 9, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 4:{halign:'right'}, 5:{halign:'right'} },
    margin: { left: 14, right: 14 },
  });
  addChartImage(doc, chartImg, doc.lastAutoTable.finalY + 8);
  save(doc, `forecast_${new Date().toISOString().slice(0,10)}.pdf`);
}

export async function exportBookingsOverview(bookings, channels, year) {
  if (!bookings || bookings.length === 0) {
    alert('Keine Buchungen zum Exportieren vorhanden.');
    return;
  }
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  header(doc, 'Buchungsübersicht', `Jahr ${year} · Stand ${new Date().toLocaleDateString('de-DE')}`, logo);

  const mapped = bookings.map(b => {
    const ch = (channels || []).find(c => c.id === b.channel_id);
    const commRate = b.commission_rate ?? ch?.commission_rate ?? 0;
    const gross = parseFloat(b.total_price) || 0;
    const commAmt = gross * commRate / 100;
    const net = gross - commAmt;
    return { ...b, commRate, commAmt, net, gross };
  });

  const totalGross = mapped.reduce((s, r) => s + r.gross, 0);
  const totalComm  = mapped.reduce((s, r) => s + r.commAmt, 0);
  const totalNet   = mapped.reduce((s, r) => s + r.net, 0);

  const rows = mapped.map(r => [
    r.invoice_number || '—',
    r.house_short || '—',
    r.guest_name + (r.company_name ? `\n${r.company_name}` : ''),
    r.channel_short || '—',
    r.booking_date?.slice(0,10) || '—',
    r.checkin_date?.slice(0,10) || '—',
    r.checkout_date?.slice(0,10) || '—',
    String(r.nights ?? '—'),
    STATUS_DE[r.status] ?? r.status,
    fmt(r.gross),
    r.commRate > 0 ? `${r.commRate}%` : '—',
    r.commAmt > 0 ? fmt(r.commAmt) : '—',
    fmt(r.net),
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Rechnungsnr.','Haus','Gast','Kanal','Buchungsdatum','Check-in','Check-out','N','Status','Brutto','Komm %','Komm €','Netto']],
    body: rows,
    foot: [['', '', `Gesamt (${mapped.length} Buchungen)`, '', '', '', '', '', '', fmt(totalGross), '', fmt(totalComm), fmt(totalNet)]],
    styles: { fontSize: 7.5, cellPadding: [2,2,2,2], textColor: DARK, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: [240,240,240], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 10 },
      2: { cellWidth: 36 },
      3: { cellWidth: 16 },
      4: { cellWidth: 20 },
      5: { cellWidth: 18 },
      6: { cellWidth: 18 },
      7: { cellWidth: 8, halign: 'center' },
      8: { cellWidth: 20 },
      9: { cellWidth: 20, halign: 'right' },
      10: { cellWidth: 13, halign: 'right' },
      11: { cellWidth: 18, halign: 'right' },
      12: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 10, right: 10, top: 30 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) header(doc, 'Buchungsübersicht', `Jahr ${year}`, logo);
    },
    didParseCell: (cell) => {
      if (cell.section === 'body') {
        const r = mapped[cell.row.index];
        if (cell.column.index === 12) {
          cell.cell.styles.textColor = [0, 100, 0];
        }
        if (cell.column.index === 11 && r?.commAmt > 0) {
          cell.cell.styles.textColor = [180, 0, 0];
        }
      }
    },
  });

  save(doc, `buchungsuebersicht_${year}.pdf`);
}

// ─── 5. Arbeitsplan (offene Aufgaben) ───────────────────────────────────────

export async function exportWorkSchedule(items) {
  if (!items || items.length === 0) {
    alert('Keine offenen Aufgaben zum Exportieren vorhanden.');
    return;
  }
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  header(doc, 'Arbeitsplan', `Offene Aufgaben · Stand ${new Date().toLocaleDateString('de-DE')}`, logo);

  const sorted = [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rows = sorted.map(i => [
    i.date ? fmtDate(i.date) : '—',
    i.house || '—',
    i.guest || '—',
    i.task || '—',
    i.details || '',
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Datum', 'Haus', 'Gast', 'Aufgabe', 'Details / Notizen']],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 42 },
      3: { cellWidth: 48 },
      4: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14, top: 30 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) header(doc, 'Arbeitsplan', 'Offene Aufgaben', logo);
    },
  });

  save(doc, `arbeitsplan_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportHouseComparison(houses, from, to, chartImg = null) {
  const logo = await getReportLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  header(doc, 'Häuservergleich', `${fmtDate(from)} – ${fmtDate(to)}`, logo);
  autoTable(doc, {
    startY: 30,
    head: [['Haus','Kapazität','Buchungen','Nächte','Auslastung','Umsatz','ADR','RevPAR','Stornos']],
    body: houses.map(h => [h.name, `${h.capacity} Betten`, h.bookings, h.nights, fmtPct(h.occupancy_rate), fmt(h.revenue), fmt(h.adr), fmt(h.revpar), h.cancellations]),
    styles: { fontSize: 9, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'}, 7:{halign:'right'}, 8:{halign:'center'} },
    margin: { left: 14, right: 14 },
  });
  addChartImage(doc, chartImg, doc.lastAutoTable.finalY + 8);
  save(doc, `haeuser_vergleich_${from}_${to}.pdf`);
}
