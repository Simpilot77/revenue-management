'use client'
// Port of frontend/src/utils/pdfExport.js — adapted for Next.js (no localStorage, settings passed in)
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Invoice translations ────────────────────────────────────────────────────

const INVOICE_I18N: Record<string, any> = {
  de: {
    title: 'Rechnung',
    invoiceNumber: 'Rechnungs-Nr.',
    invoiceDate: 'Rechnungsdatum',
    servicePeriod: 'Leistungszeitraum',
    customerNumber: 'Ihre Kundennummer',
    contactPerson: 'Ihr Ansprechpartner',
    salutation: 'Sehr geehrter Gast,',
    introLine1: (co: string, street: string, city: string) => `Vielen Dank für Ihre Buchung bei ${co}, ${street}, ${city}.`,
    introLine2: 'Gerne stellen wir Ihnen folgende Leistungen in Rechnung:',
    colPos: 'Pos.',
    colDescription: 'Beschreibung',
    colQty: 'Menge',
    colUnitPrice: 'Einzelpreis',
    colTotal: 'Gesamtpreis',
    accommodation: 'Übernachtung',
    nights: (n: number) => `${n} Nächte`,
    persons: (n: number) => `${n} Personen`,
    lineCleaning: 'Endreinigung',
    lineDiscount: (pct: number) => `Rabatt ${pct} %`,
    qty: '1,00 Stk',
    netAmount: 'Gesamtbetrag netto',
    vat: (rate: number) => `Umsatzsteuer ${rate}%`,
    gross: 'Gesamtbetrag brutto',
    paymentBold: (date: string) => `Bitte überweisen Sie den Betrag bis spätestens zum ${date} auf unten genanntes Konto.`,
    agb1: 'Der Mietvertrag kommt erst mit dem vollständigen bzw. fristgerechten Eingang des Geldbetrages zustande.',
    agb2: (url: string) => `Es gelten die Hausordnung und unsere AGB's, welche unter ${url} einsehbar sind.`,
    closingText: 'Wir freuen uns, Sie als Gäste willkommen heißen zu dürfen, und wünschen einen angenehmen Aufenthalt.',
    closing: 'Mit freundlichen Grüßen,',
    footerManagement: (name: string) => `Geschäftsführung ${name}`,
    filename: (inv: string, name: string) => `rechnung_${inv}_${name}.pdf`,
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
    introLine1: (co: string, street: string, city: string) => `Thank you for your booking at ${co}, ${street}, ${city}.`,
    introLine2: 'We would like to invoice you for the following services:',
    colPos: 'No.',
    colDescription: 'Description',
    colQty: 'Qty',
    colUnitPrice: 'Unit Price',
    colTotal: 'Total',
    accommodation: 'Accommodation',
    nights: (n: number) => `${n} nights`,
    persons: (n: number) => `${n} persons`,
    lineCleaning: 'Final Cleaning',
    lineDiscount: (pct: number) => `Discount ${pct} %`,
    qty: '1.00 pcs',
    netAmount: 'Total net amount',
    vat: (rate: number) => `VAT ${rate}%`,
    gross: 'Total gross amount',
    paymentBold: (date: string) => `Please transfer the amount by ${date} to the account below.`,
    agb1: 'The rental agreement only comes into effect upon receipt of the full payment on time.',
    agb2: (url: string) => `Our house rules and terms & conditions apply, available at ${url}.`,
    closingText: 'We look forward to welcoming you and wish you a pleasant stay.',
    closing: 'Kind regards,',
    footerManagement: (name: string) => `Management ${name}`,
    filename: (inv: string, name: string) => `invoice_${inv}_${name}.pdf`,
    locale: 'en-GB',
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BLUE: [number, number, number] = [29, 78, 216]
const DARK: [number, number, number] = [30, 41, 59]
const GRAY: [number, number, number] = [100, 116, 139]
const LIGHT: [number, number, number] = [241, 245, 249]

const fmt = (v: any) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const fmtDate = (s: string) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function splitHouseAddress(addr: string) {
  const commaIdx = addr.lastIndexOf(',')
  if (commaIdx > -1) {
    return { street: addr.slice(0, commaIdx).trim(), zipCity: addr.slice(commaIdx + 1).trim() }
  }
  return { street: addr, zipCity: '' }
}

const DEFAULT_SETTINGS = {
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
}

let _logoCache: string | null = null
async function loadLogoBase64(url: string): Promise<string> {
  if (_logoCache !== null) return _logoCache
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    _logoCache = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (_) {
    _logoCache = ''
  }
  return _logoCache as string
}

async function getReportLogo(): Promise<string> {
  return loadLogoBase64('/logo.png')
}

function header(doc: any, title: string, subtitle = '', logoBase64: string | null = null) {
  const W = doc.internal.pageSize.getWidth()
  const LOGO_SIZE = 20
  const HEADER_H = 26
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, W, HEADER_H, 'F')

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', W - 14 - LOGO_SIZE, (HEADER_H - LOGO_SIZE) / 2, LOGO_SIZE, LOGO_SIZE)
    } catch (_) {}
  }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Workation Wolfsburg – Revenue Management', 14, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 19)
  if (subtitle) {
    doc.setFontSize(8)
    const subtitleX = logoBase64 ? W - 14 - LOGO_SIZE - 6 : W - 14
    doc.text(subtitle, subtitleX, 19, { align: 'right' })
  }
  doc.setTextColor(...DARK)
}

function footer(doc: any) {
  const pages = doc.internal.getNumberOfPages()
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(220, 220, 230)
    doc.line(14, H - 12, W - 14, H - 12)
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text(`Erstellt am ${new Date().toLocaleString('de-DE')}`, 14, H - 7)
    doc.text(`Seite ${i} / ${pages}`, W - 14, H - 7, { align: 'right' })
  }
}

function save(doc: any, filename: string) {
  footer(doc)
  doc.save(filename)
}

// ─── Build editable invoice data object ─────────────────────────────────────

export function buildInvoicePreviewData(booking: any, lang = 'de', settings?: any): any {
  const t = INVOICE_I18N[lang] || INVOICE_I18N.de
  const s = settings || DEFAULT_SETTINGS
  const vatRate = parseFloat(s.vat_rate ?? 7)
  const bruttoTotal = parseFloat(booking.total_price || 0)
  const cleaningFee = parseFloat(booking.cleaning_fee || 0)
  const discountPct = parseFloat(booking.discount_percent || 0)
  const nettoTotal = bruttoTotal / (1 + vatRate / 100)
  const vatAmount = bruttoTotal - nettoTotal

  const invoiceDate = new Date()
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + 14)
  const invoiceDateStr = invoiceDate.toLocaleDateString(t.locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const dueDateStr = dueDate.toLocaleDateString(t.locale, { day: '2-digit', month: '2-digit', year: 'numeric' })

  const ba = booking.billing_address || {}
  const safeName = (booking.guest_name || 'booking').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()

  const hasAddress = !!(ba.street || ba.zip || ba.city)
  let billingStreet = ba.street || ''
  let billingZip = ba.zip || ''
  let billingCity = ba.city || ''
  let billingCountry = ba.country || ''
  let coLine = ''

  if (!hasAddress && booking.house_id) {
    const houseSettings = s.houses?.[booking.house_id]
    const houseAddr = houseSettings?.address || ''
    if (houseAddr) {
      const { street, zipCity } = splitHouseAddress(houseAddr)
      billingStreet = street
      const spaceIdx = zipCity.indexOf(' ')
      if (spaceIdx > -1) {
        billingZip = zipCity.slice(0, spaceIdx).trim()
        billingCity = zipCity.slice(spaceIdx + 1).trim()
      } else {
        billingCity = zipCity
      }
      billingCountry = ba.country || s.country || 'Deutschland'
      coLine = 'c/o'
    }
  }

  return {
    lang,
    _booking_id: booking.id,
    _house_id: booking.house_id,
    company_name: booking.company_name || '',
    guest_name: booking.guest_name || '',
    co_line: coLine,
    billing_street: billingStreet,
    billing_zip: billingZip,
    billing_city: billingCity,
    billing_country: billingCountry,
    invoice_number: booking.invoice_number || '',
    invoice_date: invoiceDateStr,
    service_period: `${fmtDate(booking.checkin_date)} – ${fmtDate(booking.checkout_date)}`,
    customer_number: booking.customer_number || '—',
    contact_person: s.owner_name || 'Nils Flegel',
    salutation: t.salutation,
    intro_line1: (() => {
      const houseAddr = s.houses?.[booking.house_id]?.address || ''
      if (houseAddr) {
        const { street, zipCity } = splitHouseAddress(houseAddr)
        return t.introLine1(s.company_name, street, zipCity || `${s.zip} ${s.city}`)
      }
      return t.introLine1(s.company_name, s.street, `${s.zip} ${s.city}`)
    })(),
    intro_line2: t.introLine2,
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
    vat_rate: vatRate,
    brutto_total: bruttoTotal,
    netto_total: nettoTotal,
    vat_amount: vatAmount,
    net_label: t.netAmount,
    vat_label: t.vat(vatRate),
    gross_label: t.gross,
    col_pos: t.colPos,
    col_desc: t.colDescription,
    col_qty: t.colQty,
    col_unit: t.colUnitPrice,
    col_total: t.colTotal,
    qty_unit: t.qty,
    payment_text: (() => {
      const p = s.invoice_presets?.payments?.[0]
      return p?.text || t.paymentBold(dueDateStr)
    })(),
    agb1: s.invoice_presets?.agbs?.[0]?.agb1 || t.agb1,
    agb2: s.invoice_presets?.agbs?.[0]?.agb2 || t.agb2(s.website || 'www.workation-wolfsburg.com'),
    closing_text: t.closingText,
    closing: t.closing,
    owner_name: s.owner_name || 'Nils Flegel',
    website: s.website || 'www.workation-wolfsburg.com',
    external_reference: booking.external_reference || '',
    extra_items: [],
    _settings: s,
    _filename: t.filename(booking.invoice_number || booking.id, safeName),
    _title: t.title,
  }
}

// ─── Build a Stornorechnung ──────────────────────────────────────────────────

export function buildStornoPreviewData(originalEntry: any, newInvoiceNumber: string, lang?: string) {
  const data = JSON.parse(JSON.stringify(originalEntry.data))
  const t = INVOICE_I18N[lang || data.lang || 'de'] || INVOICE_I18N.de

  const vatRate = parseFloat(data.vat_rate || 7)
  const bruttoTotal = -parseFloat(data.brutto_total || 0)
  const nettoTotal = bruttoTotal / (1 + vatRate / 100)
  const vatAmount = bruttoTotal - nettoTotal

  const invoiceDate = new Date()
  const invoiceDateStr = invoiceDate.toLocaleDateString(t.locale, { day: '2-digit', month: '2-digit', year: 'numeric' })

  data.lang = lang || data.lang || 'de'
  data.brutto_total = bruttoTotal
  data.netto_total = nettoTotal
  data.vat_amount = vatAmount
  data.accommodation_unit_price = -parseFloat(data.accommodation_unit_price || 0)
  data.cleaning_fee = -parseFloat(data.cleaning_fee || 0)
  data.extra_items = (data.extra_items || []).map((item: any) => ({ ...item, unit_price: -parseFloat(item.unit_price || 0) }))

  data.invoice_number = newInvoiceNumber
  data.invoice_date = invoiceDateStr

  data._type = 'storno'
  data._reference_invoice_id = originalEntry.id
  data._reference_invoice_number = originalEntry.invoice_number
  data._title = lang === 'en' ? 'Cancellation Invoice' : 'Stornorechnung'
  data.reference_line = lang === 'en'
    ? `This cancellation invoice refers to invoice no. ${originalEntry.invoice_number} dated ${originalEntry.invoice_date}.`
    : `Diese Stornorechnung bezieht sich auf Rechnung Nr. ${originalEntry.invoice_number} vom ${originalEntry.invoice_date}.`

  const safeName = (data.guest_name || 'booking').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  data._filename = t.filename(newInvoiceNumber, safeName)

  return data
}

// ─── Build a Teilrechnung ────────────────────────────────────────────────────

export function buildPartialInvoicePreviewData(booking: any, fraction: number, lang: string, settings?: any) {
  const data = buildInvoicePreviewData(booking, lang, settings)
  const t = INVOICE_I18N[lang] || INVOICE_I18N.de

  data.accommodation_unit_price = (parseFloat(data.accommodation_unit_price) || 0) * fraction
  data.cleaning_fee = (parseFloat(data.cleaning_fee) || 0) * fraction
  data.extra_items = (data.extra_items || []).map((item: any) => ({ ...item, unit_price: (parseFloat(item.unit_price) || 0) * fraction }))

  const bruttoTotal = (parseFloat(data.brutto_total) || 0) * fraction
  const vatRate = parseFloat(data.vat_rate || 7)
  const nettoTotal = bruttoTotal / (1 + vatRate / 100)
  const vatAmount = bruttoTotal - nettoTotal
  data.brutto_total = bruttoTotal
  data.netto_total = nettoTotal
  data.vat_amount = vatAmount

  const fullTotal = parseFloat(booking.total_price || 0).toFixed(2)
  const pct = Math.round(fraction * 1000) / 10

  data._type = 'partial'
  data._title = lang === 'en' ? 'Partial Invoice' : 'Teilrechnung'
  data.reference_line = lang === 'en'
    ? `This is a partial invoice for ${pct}% of the total amount of ${fullTotal} €.`
    : `Dies ist eine Teilrechnung über ${pct}% des Gesamtbetrags von ${fullTotal} €.`

  const safeName = (data.guest_name || 'booking').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  data._filename = t.filename(data.invoice_number || booking.id, safeName)

  return data
}

// ─── Generate PDF from preview data ─────────────────────────────────────────

async function buildInvoiceDoc(data: any): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const H = 297
  const s = data._settings || DEFAULT_SETTINGS

  const logoBase64 = await loadLogoBase64('/logo.png')
  if (logoBase64) {
    const LOGO_SZ = 30
    const lx = W - 14 - LOGO_SZ
    const ly = 10
    doc.setFillColor(255, 255, 255)
    doc.circle(lx + LOGO_SZ / 2, ly + LOGO_SZ / 2, LOGO_SZ / 2 + 0.5, 'F')
    try {
      doc.addImage(logoBase64, 'JPEG', lx, ly, LOGO_SZ, LOGO_SZ)
    } catch (_) {}
  }

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text(`${s.company_name} · ${s.street} · ${s.zip} ${s.city}`, 25, 50)
  doc.setDrawColor(200, 200, 200)
  doc.line(25, 51.5, 115, 51.5)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  let ry = 58
  if (data.company_name && !data.co_line) { doc.text(data.company_name, 25, ry); ry += 6 }
  if (data.guest_name) { doc.text(data.guest_name, 25, ry); ry += 6 }
  if (data.co_line) { doc.text(data.co_line, 25, ry); ry += 6 }
  if (data.billing_address_freetext) {
    const lines = data.billing_address_freetext.split('\n').filter((l: string) => l.trim())
    lines.forEach((line: string) => { doc.text(line, 25, ry); ry += 6 })
  } else {
    if (data.billing_street) { doc.text(data.billing_street, 25, ry); ry += 6 }
    const zipCity = `${data.billing_zip || ''} ${data.billing_city || ''}`.trim()
    if (zipCity) { doc.text(zipCity, 25, ry); ry += 6 }
    if (data.billing_country) { doc.text(data.billing_country, 25, ry) }
  }

  const metaLX = 122
  const metaVX = W - 14
  const metaItems: any[] = [
    { label: 'Rechnungs-Nr.', value: data.invoice_number || '—', valueBold: true, valueLarge: true },
    { label: 'Rechnungsdatum', value: data.invoice_date },
    { label: 'Leistungszeitraum', value: data.service_period },
    ...(data.external_reference ? [{ label: 'Buchungs-Ref.', value: data.external_reference }] : []),
    { label: '', value: '' },
    { label: 'Kundennummer', value: data.customer_number },
    { label: 'Ansprechpartner', value: data.contact_person },
  ]
  let my = 50
  metaItems.forEach(({ label, value, valueBold, valueLarge }: any) => {
    if (!label && !value) { my += 4; return }
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.setFontSize(8.5)
    doc.text(label, metaLX, my)
    if (value) {
      doc.setFont('helvetica', valueBold ? 'bold' : 'normal')
      doc.setTextColor(...DARK)
      doc.setFontSize(valueLarge ? 10 : 8.5)
      doc.text(value, metaVX, my, { align: 'right' })
    }
    my += 5.5
  })

  const titleY = 97
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(`${data._title || 'Rechnung'} Nr. ${data.invoice_number || '—'}`, 25, titleY)

  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  doc.text(data.salutation, 25, titleY + 13)
  const intro1Lines = doc.splitTextToSize(data.intro_line1, W - 25 - 14)
  doc.text(intro1Lines, 25, titleY + 21)
  let introY = titleY + 21 + intro1Lines.length * 5.5
  if (data.reference_line) {
    doc.setFont('helvetica', 'bold')
    const refLines = doc.splitTextToSize(data.reference_line, W - 25 - 14)
    doc.text(refLines, 25, introY)
    introY += refLines.length * 5.5
    doc.setFont('helvetica', 'normal')
  }
  doc.text(data.intro_line2, 25, introY)
  const tableStartY = introY + 9

  const vatRate = parseFloat(data.vat_rate || 7)
  const bruttoTotal = parseFloat(data.brutto_total || 0)
  const cleaningFee = parseFloat(data.cleaning_fee || 0)
  const discountPct = parseFloat(data.discount_pct || 0)

  const accomQty = parseFloat(data.accommodation_qty) || 1
  const accomUnitPrice = parseFloat(data.accommodation_unit_price) || 0
  const accomLineTotal = accomQty * accomUnitPrice
  const accomBrutto = bruttoTotal - cleaningFee * (1 + vatRate / 100)
  const accomFallback = accomBrutto > 0 ? accomBrutto : bruttoTotal
  const accomDisplayTotal = accomLineTotal > 0 ? accomLineTotal : accomFallback
  const accomDisplayUnit = accomUnitPrice > 0 ? fmt(accomUnitPrice) : fmt(accomFallback)
  const langCode = data.lang || 'de'
  const accomQtyLabel = accomQty > 0 ? `${accomQty} ${langCode === 'en' ? 'nights' : 'Nächte'}` : data.qty_unit

  const tableBody: any[] = [
    { pos: '1.', desc: data.accommodation_desc, qty: accomQtyLabel, unit: accomDisplayUnit, total: fmt(accomDisplayTotal), isMainAccom: true },
    ...[data.accommodation_sub_house, data.accommodation_sub_dates, data.accommodation_sub_persons]
      .filter(Boolean)
      .map((line: string) => ({ pos: '', desc: line, qty: '', unit: '', total: '', isSub: true })),
  ]
  if (cleaningFee > 0) {
    const cleanBrutto = cleaningFee * (1 + vatRate / 100)
    tableBody.push({ pos: `${tableBody.filter(r => r.pos).length + 1}.`, desc: data.cleaning_fee_desc, qty: data.qty_unit, unit: fmt(cleanBrutto), total: fmt(cleanBrutto) })
  }
  if (discountPct > 0) {
    const discAmt = bruttoTotal * discountPct / 100
    tableBody.push({ pos: `${tableBody.filter(r => r.pos).length + 1}.`, desc: data.discount_desc, qty: '', unit: '', total: `- ${fmt(discAmt)}` })
  }
  const extraItems = Array.isArray(data.extra_items) ? data.extra_items : []
  extraItems.forEach((item: any) => {
    if (!item.description) return
    const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price) || 0)
    const pos = `${tableBody.filter(r => r.pos).length + 1}.`
    tableBody.push({ pos, desc: item.description, qty: `${(parseFloat(item.qty) || 0).toFixed(2).replace('.', ',')} Stk`, unit: fmt(item.unit_price), total: fmt(lineTotal), isExtra: true })
    if (item.note) {
      tableBody.push({ pos: '', desc: item.note, qty: '', unit: '', total: '', isSub: true })
    }
  })
  const bodyRows = tableBody.map(r => [r.pos, r.desc, r.qty, r.unit, r.total])

  autoTable(doc, {
    startY: tableStartY,
    head: [[data.col_pos, data.col_desc, data.col_qty, data.col_unit, data.col_total]],
    body: bodyRows,
    styles: { fontSize: 9, cellPadding: [2.5, 2, 2.5, 2], textColor: DARK, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], textColor: DARK, fontStyle: 'bold', lineWidth: 0, fontSize: 9 },
    bodyStyles: { fillColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 25, halign: 'right' }, 3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' } },
    margin: { left: 25, right: 14 },
    didParseCell: (cell: any) => {
      if (cell.section === 'head') { cell.cell.styles.lineWidth = { bottom: 0.4 }; cell.cell.styles.lineColor = DARK }
      if (cell.section === 'body') {
        const row = tableBody[cell.row.index]
        if (row?.isSub) { cell.cell.styles.fontSize = 8.5; cell.cell.styles.textColor = [80, 80, 80]; cell.cell.styles.cellPadding = [1, 2, 1, 2] }
        if ((row?.isMainAccom || row?.isExtra) && cell.column.index === 1) cell.cell.styles.fontStyle = 'bold'
        if (cell.row.index === bodyRows.length - 1) cell.cell.styles.lineWidth = { bottom: 0.1 }
      }
    },
  })

  const subLX = 25
  const subRX = W - 14
  let sy = (doc as any).lastAutoTable.finalY + 5
  doc.setDrawColor(220, 220, 220)
  doc.line(subLX, sy - 1, subRX, sy - 1)

  const nettoTotal = parseFloat(data.netto_total || 0)
  const vatAmount = parseFloat(data.vat_amount || 0)

  ;[
    { label: data.net_label, value: fmt(nettoTotal), bold: false },
    { label: data.vat_label, value: fmt(vatAmount), bold: false },
    { label: data.gross_label, value: fmt(bruttoTotal), bold: true },
  ].forEach(({ label, value, bold }: any) => {
    if (bold) { doc.setDrawColor(180, 180, 180); doc.line(subLX, sy - 1.5, subRX, sy - 1.5) }
    doc.setFontSize(bold ? 10 : 9)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...DARK)
    doc.text(label, subLX, sy + (bold ? 4 : 3))
    doc.text(value, subRX, sy + (bold ? 4 : 3), { align: 'right' })
    sy += bold ? 7 : 5.5
  })

  sy += 6
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  const payLines = doc.splitTextToSize(data.payment_text, W - 25 - 14)
  doc.text(payLines, 25, sy)
  sy += payLines.length * 5.5 + 4

  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  const agb1Lines = doc.splitTextToSize(data.agb1, W - 25 - 14)
  doc.text(agb1Lines, 25, sy)
  sy += agb1Lines.length * 5.5 + 1
  const agb2Lines = doc.splitTextToSize(data.agb2, W - 25 - 14)
  doc.text(agb2Lines, 25, sy)
  sy += agb2Lines.length * 5.5 + 10

  const closingLines = doc.splitTextToSize(data.closing_text, W - 25 - 14)
  doc.text(closingLines, 25, sy)
  sy += closingLines.length * 5.5 + 10
  doc.text(data.closing, 25, sy)
  sy += 6
  doc.text(data.owner_name, 25, sy)
  sy += 10
  doc.setTextColor(29, 78, 216)
  doc.text(data.website, 25, sy)

  const footerY = H - 26
  doc.setDrawColor(180, 180, 180)
  doc.line(14, footerY - 3, W - 14, footerY - 3)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('1/1', W - 14, footerY - 5, { align: 'right' })
  const colW = (W - 28) / 4
  const footerCols = [
    [s.company_name, s.street, `${s.zip} ${s.city}`, s.country || 'Deutschland'],
    [s.phone ? `Tel. ${s.phone}` : null, s.email ? `E-Mail ${s.email}` : null, s.website ? `Web ${s.website}` : null].filter(Boolean),
    [s.vat_id ? `USt-ID ${s.vat_id}` : null, s.tax_number ? `Steuer-Nr. ${s.tax_number}` : null, s.owner_name ? `Geschäftsführung ${s.owner_name}` : null].filter(Boolean),
    [s.bank_name ? `Bank ${s.bank_name}` : null, s.iban ? `IBAN ${s.iban}` : null, s.bic ? `BIC ${s.bic}` : null].filter(Boolean),
  ]
  footerCols.forEach((lines: any[], ci: number) => {
    lines.forEach((line: string, li: number) => {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY)
      doc.text(line, 14 + ci * colW, footerY + li * 4.5)
    })
  })

  return doc
}

export async function exportInvoiceFromData(data: any) {
  const doc = await buildInvoiceDoc(data)
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = data._filename || 'rechnung.pdf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function previewInvoiceFromData(data: any): Promise<string> {
  const doc = await buildInvoiceDoc(data)
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}

// Alias
export async function generateInvoicePdf(data: any, _settings?: any) {
  return exportInvoiceFromData(data)
}

// ─── 5. Arbeitsplan (offene Aufgaben) ───────────────────────────────────────

export async function exportWorkSchedule(items: any[]) {
  if (!items || items.length === 0) {
    alert('Keine offenen Aufgaben zum Exportieren vorhanden.')
    return
  }
  const logo = await getReportLogo()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  header(doc, 'Arbeitsplan', `Offene Aufgaben · Stand ${new Date().toLocaleDateString('de-DE')}`, logo)

  const sorted = [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const rows = sorted.map(i => [
    i.date ? fmtDate(i.date) : '—',
    i.house || '—',
    i.guest || '—',
    i.task || '—',
    i.details || '',
  ])

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
    didDrawPage: (data: any) => {
      if (data.pageNumber > 1) header(doc, 'Arbeitsplan', 'Offene Aufgaben', logo)
    },
  })

  save(doc, `arbeitsplan_${new Date().toISOString().slice(0, 10)}.pdf`)
}

const CLEANING_SCOPE_LABELS: Record<string, string> = {
  grund: 'Grundreinigung', reinigung: 'Zwischenreinigung', bettwaesche: 'Bettwäsche-Wechsel',
}
const CLEANING_STATUS_LABELS: Record<string, string> = {
  planned: 'Geplant', organized: 'Organisiert', done: 'Erledigt',
}

export async function exportCleaningSchedule(entries: any[]) {
  if (!entries || entries.length === 0) {
    alert('Keine Reinigungen im gewählten Zeitraum zum Exportieren vorhanden.')
    return
  }
  const logo = await getReportLogo()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  header(doc, 'Reinigungsplan', `Stand ${new Date().toLocaleDateString('de-DE')}`, logo)

  const rows = entries.map((e: any) => [
    fmtDate(e.date),
    e.houseName || '—',
    CLEANING_SCOPE_LABELS[e.scope] || e.scope || '—',
    e.scheduled_time || e.deadlineTime || '—',
    e.windows ? 'Ja' : '–',
    e.notes || '',
    e.cleaner_confirmed || e.cleanerConfirmed
      ? '✓ Bestätigt'
      : CLEANING_STATUS_LABELS[e.status] || e.status || '—',
  ])

  autoTable(doc, {
    startY: 30,
    head: [['Datum', 'Haus', 'Umfang', 'Uhrzeit', 'Fenster', 'Notizen', 'Status/Bestätigung']],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 30 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 28 },
    },
    margin: { left: 14, right: 14, top: 30 },
    didDrawPage: (data: any) => {
      if (data.pageNumber > 1) header(doc, 'Reinigungsplan', '', logo)
    },
  })

  save(doc, `reinigungsplan_${new Date().toISOString().slice(0, 10)}.pdf`)
}
