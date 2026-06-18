'use client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  navy:    [15,  23,  42]  as [number,number,number],
  blue:    [29,  78,  216] as [number,number,number],
  blue2:   [59,  130, 246] as [number,number,number],
  green:   [22,  163, 74]  as [number,number,number],
  amber:   [217, 119, 6]   as [number,number,number],
  red:     [220, 38,  38]  as [number,number,number],
  purple:  [124, 58,  237] as [number,number,number],
  violet:  [109, 40,  217] as [number,number,number],
  teal:    [13,  148, 136] as [number,number,number],
  gray7:   [55,  65,  81]  as [number,number,number],
  gray5:   [107, 114, 128] as [number,number,number],
  gray2:   [229, 231, 235] as [number,number,number],
  gray1:   [249, 250, 251] as [number,number,number],
  white:   [255, 255, 255] as [number,number,number],
}
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n??0)
}
function fmtPct(n: number, decimals = 1) { return `${(n??0).toFixed(decimals)} %` }
function fmtDate(s: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})
}
function today() { return new Date().toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ─── Low-level draw helpers ───────────────────────────────────────────────────

function fill(doc: jsPDF, color: [number,number,number]) { doc.setFillColor(...color) }
function stroke(doc: jsPDF, color: [number,number,number]) { doc.setDrawColor(...color) }
function textColor(doc: jsPDF, color: [number,number,number]) { doc.setTextColor(...color) }
function font(doc: jsPDF, style: 'normal'|'bold'='normal', size = 10) {
  doc.setFont('helvetica', style); doc.setFontSize(size)
}

function rect(doc: jsPDF, x: number, y: number, w: number, h: number, color: [number,number,number], filled = true) {
  if (filled) { fill(doc, color); doc.rect(x, y, w, h, 'F') }
  else        { stroke(doc, color); doc.rect(x, y, w, h, 'S') }
}

function txt(doc: jsPDF, text: string, x: number, y: number, opts?: { align?: 'left'|'center'|'right', maxWidth?: number }) {
  doc.text(text, x, y, opts as any)
}

function pageFooter(doc: jsPDF, pageNum: number, totalPages: number, subtitle: string) {
  const y = PAGE_H - 8
  rect(doc, 0, y - 4, PAGE_W, 12, C.gray1)
  font(doc, 'normal', 8); textColor(doc, C.gray5)
  txt(doc, subtitle, MARGIN, y)
  txt(doc, `Seite ${pageNum} / ${totalPages}`, PAGE_W - MARGIN, y, { align: 'right' })
  txt(doc, `Erstellt: ${today()}`, PAGE_W / 2, y, { align: 'center' })
}

// ─── Section / page header ───────────────────────────────────────────────────

function drawPageBanner(doc: jsPDF, title: string, subtitle: string, dateRange: string): number {
  // Deep navy gradient bar
  rect(doc, 0, 0, PAGE_W, 28, C.navy)
  // Accent stripe
  rect(doc, 0, 28, PAGE_W, 2, C.blue)

  font(doc, 'bold', 18); textColor(doc, C.white)
  txt(doc, title, MARGIN, 16)

  font(doc, 'normal', 9); textColor(doc, [180, 195, 220] as [number,number,number])
  txt(doc, subtitle, MARGIN, 23)
  txt(doc, dateRange, PAGE_W - MARGIN, 23, { align: 'right' })

  return 36
}

function drawSectionTitle(doc: jsPDF, y: number, title: string, accent = C.blue): number {
  // Left accent bar
  rect(doc, MARGIN, y, 3, 6, accent)
  font(doc, 'bold', 12); textColor(doc, C.navy)
  txt(doc, title, MARGIN + 6, y + 5)
  // Thin rule
  stroke(doc, C.gray2); doc.setLineWidth(0.3)
  doc.line(MARGIN + 6, y + 7, PAGE_W - MARGIN, y + 7)
  return y + 12
}

// ─── KPI grid ────────────────────────────────────────────────────────────────

interface KpiItem { label: string; value: string; sub?: string; color?: [number,number,number] }

function drawKpiGrid(doc: jsPDF, y: number, kpis: KpiItem[], cols = 4): number {
  const gap = 3
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols
  const cardH = 20

  kpis.forEach((k, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = MARGIN + col * (cardW + gap)
    const cy = y + row * (cardH + gap)
    const accent = k.color ?? C.blue

    // Card background
    rect(doc, x, cy, cardW, cardH, C.white)
    stroke(doc, C.gray2); doc.setLineWidth(0.2)
    doc.rect(x, cy, cardW, cardH, 'S')
    // Top accent line
    rect(doc, x, cy, cardW, 1.5, accent)

    font(doc, 'normal', 7.5); textColor(doc, C.gray5)
    txt(doc, k.label, x + 3, cy + 6)
    font(doc, 'bold', 12); textColor(doc, C.navy)
    txt(doc, k.value, x + 3, cy + 13)
    if (k.sub) { font(doc, 'normal', 7); textColor(doc, C.gray5); txt(doc, k.sub, x + 3, cy + 18) }
  })

  const rows = Math.ceil(kpis.length / cols)
  return y + rows * (cardH + gap) + 4
}

// ─── Insight box ─────────────────────────────────────────────────────────────

function drawInsight(doc: jsPDF, y: number, lines: string[]): number {
  const padding = 4, lineH = 5
  const h = padding * 2 + lines.length * lineH
  // Light blue background
  rect(doc, MARGIN, y, CONTENT_W, h, [239, 246, 255] as [number,number,number])
  rect(doc, MARGIN, y, 2, h, C.blue)
  stroke(doc, [191, 219, 254] as [number,number,number]); doc.setLineWidth(0.2)
  doc.rect(MARGIN, y, CONTENT_W, h, 'S')

  font(doc, 'bold', 8); textColor(doc, C.blue)
  txt(doc, 'Analyse', MARGIN + 5, y + padding + 3)
  font(doc, 'normal', 8); textColor(doc, C.gray7)
  lines.forEach((line, i) => {
    txt(doc, line, MARGIN + 5, y + padding + 3 + (i + 1) * lineH)
  })
  return y + h + 4
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

interface BarChartOpts {
  title?: string
  valueKey: string
  labelKey: string
  color?: [number,number,number]
  dynamicColor?: (v: number, max: number) => [number,number,number]
  yLabel?: (v: number) => string
  maxVal?: number
  barW?: number
}

function drawBarChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: any[], opts: BarChartOpts
): number {
  const { valueKey, labelKey, color = C.blue, dynamicColor, yLabel = (v)=>`${v}`, maxVal } = opts
  const vals = data.map(d => +d[valueKey] || 0)
  const maxV = maxVal ?? Math.max(...vals, 1)
  const n = data.length
  const gap = 1.5
  const barW = opts.barW ?? Math.min((w - gap * (n + 1)) / n, 12)
  const totalBarsW = n * barW + (n - 1) * gap
  const startX = x + (w - totalBarsW) / 2
  const chartH = h - 14 // leave room for labels

  // Axis
  stroke(doc, C.gray2); doc.setLineWidth(0.2)
  doc.line(x, y, x, y + chartH)
  doc.line(x, y + chartH, x + w, y + chartH)

  // Grid lines + Y labels
  const gridN = 4
  for (let g = 0; g <= gridN; g++) {
    const gy = y + chartH - (g / gridN) * chartH
    const gv = (g / gridN) * maxV
    if (g > 0) {
      stroke(doc, C.gray2); doc.setLineWidth(0.1)
      doc.line(x, gy, x + w, gy)
    }
    font(doc, 'normal', 6); textColor(doc, C.gray5)
    txt(doc, yLabel(gv), x - 1, gy + 1, { align: 'right' })
  }

  // Bars
  data.forEach((d, i) => {
    const v = +d[valueKey] || 0
    const bh = clamp((v / maxV) * chartH, 0.5, chartH)
    const bx = startX + i * (barW + gap)
    const by = y + chartH - bh
    const bc = dynamicColor ? dynamicColor(v, maxV) : color
    fill(doc, bc)
    doc.rect(bx, by, barW, bh, 'F')
    // Value label on top
    if (bh > 5) {
      font(doc, 'bold', 5.5); textColor(doc, C.white)
      const label = yLabel(v)
      if (label.length <= 6) txt(doc, label, bx + barW / 2, by + 4, { align: 'center' })
    }
    // X label
    font(doc, 'normal', 5.5); textColor(doc, C.gray5)
    const xl = d[labelKey] as string ?? ''
    txt(doc, xl.slice(0,3), bx + barW / 2, y + chartH + 4, { align: 'center' })
  })

  return y + h
}

// ─── Multi-bar chart ─────────────────────────────────────────────────────────

interface MultiBar { key: string; color: [number,number,number]; label: string }

function drawMultiBarChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: any[], bars: MultiBar[], opts: { labelKey: string; title?: string; yLabel?: (v:number)=>string; maxVal?: number }
): number {
  const vals = data.flatMap(d => bars.map(b => +d[b.key] || 0))
  const maxV = opts.maxVal ?? Math.max(...vals, 1)
  const n = data.length
  const barsPerGroup = bars.length
  const groupW = Math.min((w - 2) / n, 16)
  const barW = (groupW - 1) / barsPerGroup
  const chartH = h - 16
  const startX = x + 1

  stroke(doc, C.gray2); doc.setLineWidth(0.2)
  doc.line(x, y, x, y + chartH)
  doc.line(x, y + chartH, x + w, y + chartH)

  const gridN = 4
  for (let g = 0; g <= gridN; g++) {
    const gy = y + chartH - (g / gridN) * chartH
    const gv = (g / gridN) * maxV
    if (g > 0) { stroke(doc, C.gray2); doc.setLineWidth(0.1); doc.line(x, gy, x + w, gy) }
    font(doc, 'normal', 6); textColor(doc, C.gray5)
    txt(doc, (opts.yLabel ?? String)(gv), x - 1, gy + 1, { align: 'right' })
  }

  data.forEach((d, i) => {
    const gx = startX + i * groupW
    bars.forEach((b, bi) => {
      const v = +d[b.key] || 0
      const bh = clamp((v / maxV) * chartH, 0.3, chartH)
      const bx = gx + bi * barW
      fill(doc, b.color); doc.rect(bx, y + chartH - bh, barW - 0.3, bh, 'F')
    })
    const xl = (d[opts.labelKey] as string ?? '').slice(0, 3)
    font(doc, 'normal', 5.5); textColor(doc, C.gray5)
    txt(doc, xl, gx + groupW / 2, y + chartH + 4, { align: 'center' })
  })

  // Legend
  bars.forEach((b, i) => {
    const lx = x + i * 32
    const ly = y + chartH + 10
    fill(doc, b.color); doc.rect(lx, ly - 2.5, 5, 3, 'F')
    font(doc, 'normal', 6.5); textColor(doc, C.gray7)
    txt(doc, b.label, lx + 6, ly)
  })

  return y + h
}

// ─── Line chart ──────────────────────────────────────────────────────────────

function drawLineChart(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: any[], opts: { valueKey: string; labelKey: string; color?: [number,number,number]; yLabel?: (v:number)=>string; maxVal?: number }
): number {
  const { valueKey, labelKey, color = C.blue2, yLabel = String, maxVal } = opts
  const vals = data.map(d => +d[valueKey] || 0)
  const maxV = maxVal ?? Math.max(...vals, 1)
  const n = data.length
  const chartH = h - 14
  const stepX = w / Math.max(n - 1, 1)

  stroke(doc, C.gray2); doc.setLineWidth(0.2)
  doc.line(x, y, x, y + chartH)
  doc.line(x, y + chartH, x + w, y + chartH)

  const gridN = 4
  for (let g = 0; g <= gridN; g++) {
    const gy = y + chartH - (g / gridN) * chartH
    const gv = (g / gridN) * maxV
    if (g > 0) { stroke(doc, C.gray2); doc.setLineWidth(0.1); doc.line(x, gy, x + w, gy) }
    font(doc, 'normal', 6); textColor(doc, C.gray5)
    txt(doc, yLabel(gv), x - 1, gy + 1, { align: 'right' })
  }

  // Area fill
  if (n > 1) {
    const pts: [number, number][] = vals.map((v, i) => [x + i * stepX, y + chartH - clamp((v / maxV) * chartH, 0, chartH)])
    doc.setFillColor(color[0], color[1], color[2], 0.15 as any)
    const areaPath = [x, y + chartH, ...pts.flatMap(p => p), x + (n-1)*stepX, y + chartH]
    // simplified: just draw the line
  }

  // Line
  if (n > 1) {
    stroke(doc, color); doc.setLineWidth(0.8)
    for (let i = 1; i < n; i++) {
      const x1 = x + (i - 1) * stepX, y1 = y + chartH - clamp((vals[i-1] / maxV) * chartH, 0, chartH)
      const x2 = x + i * stepX,       y2 = y + chartH - clamp((vals[i]   / maxV) * chartH, 0, chartH)
      doc.line(x1, y1, x2, y2)
    }
  }

  // Dots
  vals.forEach((v, i) => {
    const px = x + i * stepX, py = y + chartH - clamp((v / maxV) * chartH, 0, chartH)
    fill(doc, color); doc.circle(px, py, 1, 'F')
    if (n <= 12) {
      font(doc, 'bold', 5.5); textColor(doc, color)
      txt(doc, yLabel(v), px, py - 2, { align: 'center' })
    }
  })

  // X labels
  data.forEach((d, i) => {
    const lx = x + i * stepX
    font(doc, 'normal', 5.5); textColor(doc, C.gray5)
    txt(doc, (d[labelKey] as string ?? '').slice(0,3), lx, y + chartH + 4, { align: 'center' })
  })

  return y + h
}

// ─── Compact data table ───────────────────────────────────────────────────────

function drawDataTable(
  doc: jsPDF, y: number, head: string[], rows: (string|number|null)[][],
  opts?: { headerColor?: [number,number,number]; colWidths?: number[] }
): number {
  const hColor = opts?.headerColor ?? C.navy

  autoTable(doc, {
    startY: y,
    head: [head],
    body: rows.map(r => r.map(c => c ?? '—')),
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, font: 'helvetica', overflow: 'linebreak' },
    headStyles: { fillColor: hColor, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: C.gray1 },
    columnStyles: opts?.colWidths
      ? Object.fromEntries(opts.colWidths.map((w, i) => [i, { cellWidth: w }]))
      : {},
    tableLineColor: C.gray2,
    tableLineWidth: 0.1,
    didDrawPage: () => {},
  })

  return (doc as any).lastAutoTable.finalY + 4
}

// ─── Insight generator ────────────────────────────────────────────────────────

function revenueInsights(monthly: any[]): string[] {
  if (!monthly.length) return ['Keine Daten im gewählten Zeitraum.']
  const lines: string[] = []
  const totalRev = monthly.reduce((s, m) => s + m.revenue, 0)
  const avgRev = totalRev / monthly.length
  const best = monthly.reduce((a, b) => b.revenue > a.revenue ? b : a)
  const worst = monthly.filter(m => !m.isFuture).reduce((a, b) => b.revenue < a.revenue ? b : a, monthly[0])
  const avgOcc = monthly.reduce((s, m) => s + m.occupancyRate, 0) / monthly.length

  lines.push(`Gesamtumsatz im Zeitraum: ${fmtEur(totalRev)} — Ø ${fmtEur(avgRev)} pro Monat.`)
  lines.push(`Stärkster Monat: ${best.monthLabel ?? best.name} mit ${fmtEur(best.revenue)} (Auslastung: ${best.occupancyRate ?? Math.round(best.occupancy ?? 0)} %).`)
  if (worst && worst !== best) {
    lines.push(`Schwächster Monat: ${worst.monthLabel ?? worst.name} mit ${fmtEur(worst.revenue)}.`)
  }
  const highOcc = monthly.filter(m => (m.occupancyRate ?? m.occupancy ?? 0) >= 70).length
  lines.push(`Durchschnittliche Auslastung: ${fmtPct(avgOcc)} — ${highOcc} von ${monthly.length} Monaten über 70 %.`)
  return lines
}

function weekdayInsights(byDow: any[]): string[] {
  if (!byDow.length) return []
  const lines: string[] = []
  const bestCI = byDow.reduce((a, b) => b.checkinPct > a.checkinPct ? b : a)
  const bestHR = byDow.reduce((a, b) => b.hitRate > a.hitRate ? b : a)
  const worstHR = byDow.filter(d => d.totalNights > 0).reduce((a, b) => b.hitRate < a.hitRate ? b : a, byDow[0])
  const bestADR = byDow.filter(d => d.adr > 0).reduce((a, b) => b.adr > a.adr ? b : a, byDow[0])
  const bestBook = byDow.reduce((a, b) => b.bookingPct > a.bookingPct ? b : a)

  lines.push(`Häufigster Check-in: ${bestCI.name} (${bestCI.checkinPct} % aller Anreisen) — ideal für Mindestaufenthaltspflichten.`)
  lines.push(`Höchste Auslastung: ${bestHR.name} mit Hit Rate ${bestHR.hitRate} %. Niedrigste: ${worstHR?.name} mit ${worstHR?.hitRate} %.`)
  if (bestADR) lines.push(`Höchster ADR: ${bestADR.name} mit ${fmtEur(bestADR.adr)} / Nacht — dieser Tag trägt überproportional zum Umsatz bei.`)
  if (byDow[0]?.bookingPct !== undefined) {
    lines.push(`Meist gebuchter Wochentag: ${bestBook.name} (${bestBook.bookingPct} % aller Buchungseingänge).`)
  }
  return lines
}

function bookingInsights(bookings: any[]): string[] {
  if (!bookings.length) return ['Keine Buchungen im gewählten Zeitraum.']
  const lines: string[] = []
  const total = bookings.reduce((s, b) => s + parseFloat(b.total_price ?? 0), 0)
  const nights = bookings.reduce((s, b) => s + (b.nights ?? 0), 0)
  const avgNights = bookings.length ? nights / bookings.length : 0
  const avgPrice = bookings.length ? total / bookings.length : 0
  const stornos = bookings.filter(b => b.status === 'storniert').length
  const stornoRate = bookings.length ? (stornos / bookings.length) * 100 : 0

  lines.push(`${bookings.length} Buchungen, ${nights} Nächte — Ø ${avgNights.toFixed(1)} Nächte pro Buchung.`)
  lines.push(`Umsatz gesamt: ${fmtEur(total)} — Ø ${fmtEur(avgPrice)} pro Buchung.`)
  if (stornos > 0) lines.push(`Stornierungen: ${stornos} (${fmtPct(stornoRate, 0)}) — ${stornoRate > 15 ? 'erhöhte Stornoquote, Ursache prüfen.' : 'Stornoquote im normalen Bereich.'}`)
  return lines
}

// ─── PDF exports ──────────────────────────────────────────────────────────────

export interface DashboardPDFData {
  companyName: string
  from: string
  to: string
  kpis: KpiItem[]
  monthly: any[]
  cashflow: any[]
  weekdayStats: { byDow: any[]; ltData: any[] }
  houseData: any[]
}

export function exportDashboardPDF(data: DashboardPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dateRange = `${fmtDate(data.from)} – ${fmtDate(data.to)}`
  let y = 0

  // ── Page 1: KPIs + Revenue chart ───────────────────────────────────────────
  y = drawPageBanner(doc, data.companyName || 'Dashboard', 'Übersicht & Kennzahlen', dateRange)

  y = drawSectionTitle(doc, y + 2, 'Wichtigste Kennzahlen')
  y = drawKpiGrid(doc, y, data.kpis.slice(0, 8), 4)

  if (data.kpis.length > 8) {
    y = drawKpiGrid(doc, y + 2, data.kpis.slice(8, 16), 4)
  }

  y += 4
  y = drawSectionTitle(doc, y, 'Umsatz & Auslastung pro Monat', C.green)

  if (data.monthly.length) {
    const chartY = y
    drawBarChart(doc, MARGIN, chartY, CONTENT_W * 0.52, 52, data.monthly, {
      valueKey: 'revenue', labelKey: 'monthLabel',
      dynamicColor: (v, mx) => v >= mx * 0.8 ? C.green : v >= mx * 0.5 ? C.blue : C.amber,
      yLabel: v => fmtEur(v).replace('.',','),
    })
    drawBarChart(doc, MARGIN + CONTENT_W * 0.55, chartY, CONTENT_W * 0.45, 52, data.monthly, {
      valueKey: 'occupancyRate', labelKey: 'monthLabel',
      dynamicColor: (v) => v >= 70 ? C.green : v >= 40 ? C.amber : C.red,
      yLabel: v => `${Math.round(v)}%`, maxVal: 100,
    })
    y = chartY + 56
  }

  y = drawInsight(doc, y, revenueInsights(data.monthly))

  // Monthly table
  y = drawSectionTitle(doc, y + 2, 'Monatliche Übersicht')
  y = drawDataTable(doc, y, ['Monat','Buchungen','Nächte','Auslastung','Umsatz','ADR','RevPAR'],
    data.monthly.map(m => {
      const [yr, mo] = (m.month ?? '2024-01').split('-').map(Number)
      const dim = new Date(yr, mo, 0).getDate()
      const hc = data.houseData.length || 1
      return [
        m.monthLabel ?? m.name,
        m.count ?? m.bookings,
        m.nights,
        fmtPct(m.occupancyRate ?? m.occupancy ?? 0),
        fmtEur(m.revenue),
        m.nights > 0 ? fmtEur(m.revenue / m.nights) : '—',
        fmtEur(m.revenue / (hc * dim)),
      ]
    }),
    { headerColor: C.navy }
  )

  // ── Page 2: Cashflow + Lead time + LOS ────────────────────────────────────
  doc.addPage()
  y = drawPageBanner(doc, data.companyName || 'Dashboard', 'Cashflow & Buchungsverhalten', dateRange)

  y = drawSectionTitle(doc, y + 2, 'Einnahme-Cashflow', C.teal)
  if (data.cashflow.length) {
    drawBarChart(doc, MARGIN, y, CONTENT_W, 48, data.cashflow, {
      valueKey: 'cashflow', labelKey: 'monthLabel',
      dynamicColor: (v) => v > 0 ? C.teal : C.red,
      yLabel: v => fmtEur(v),
    })
    y += 52
  }

  y = drawSectionTitle(doc, y, 'Ø Vorlaufzeit & Aufenthaltsdauer', C.purple)
  if (data.monthly.length) {
    drawLineChart(doc, MARGIN, y, CONTENT_W * 0.48, 44, data.monthly, {
      valueKey: 'avg_lead_time', labelKey: 'monthLabel', color: C.purple,
      yLabel: v => `${Math.round(v)}d`,
    })
    drawLineChart(doc, MARGIN + CONTENT_W * 0.52, y, CONTENT_W * 0.48, 44, data.monthly, {
      valueKey: 'avg_los', labelKey: 'monthLabel', color: C.amber,
      yLabel: v => `${Math.round(v)}N`,
    })
    y += 48
  }

  // Lead time table
  y = drawSectionTitle(doc, y + 2, 'Lead Time nach Vorlaufzeit-Bucket', C.purple)
  y = drawDataTable(doc, y, ['Vorlaufzeit','ADR','Buchungen'],
    data.weekdayStats.ltData.map(r => [r.name, fmtEur(r.adr), r.bookings]),
    { headerColor: C.purple }
  )

  // ── Page 3: Wochentag-Analyse ─────────────────────────────────────────────
  doc.addPage()
  y = drawPageBanner(doc, data.companyName || 'Dashboard', 'Wochentag-Analyse', dateRange)

  y = drawSectionTitle(doc, y + 2, 'Hit Rate, Check-in & Buchungstag je Wochentag', C.blue)
  if (data.weekdayStats.byDow.length) {
    drawMultiBarChart(doc, MARGIN, y, CONTENT_W, 56, data.weekdayStats.byDow,
      [
        { key: 'hitRate',    color: C.blue,   label: 'Hit Rate %' },
        { key: 'checkinPct', color: C.green,  label: 'Check-in %' },
        { key: 'bookingPct', color: C.violet, label: 'Buchung %' },
      ],
      { labelKey: 'name', yLabel: v => `${Math.round(v)}%`, maxVal: 100 }
    )
    y += 62

    drawMultiBarChart(doc, MARGIN, y, CONTENT_W * 0.5, 48, data.weekdayStats.byDow,
      [
        { key: 'adr',    color: C.purple, label: 'ADR' },
        { key: 'netAdr', color: C.amber,  label: 'Net ADR' },
      ],
      { labelKey: 'name', yLabel: v => `${Math.round(v)}` }
    )
    drawBarChart(doc, MARGIN + CONTENT_W * 0.52, y, CONTENT_W * 0.48, 48, data.weekdayStats.byDow, {
      valueKey: 'avgLos', labelKey: 'name',
      dynamicColor: (v) => v >= 5 ? C.green : v >= 3 ? C.blue : C.amber,
      yLabel: v => `${(+v).toFixed(1)}N`,
    })
    y += 52
  }

  y = drawInsight(doc, y, weekdayInsights(data.weekdayStats.byDow))
  y += 2

  y = drawSectionTitle(doc, y, 'Detailtabelle Wochentag-Kennzahlen', C.blue)
  y = drawDataTable(doc, y,
    ['Tag','Hit Rate','CI %','Buch. %','Buch.','Bel.N.','Verf.N.','ADR','Net ADR','Ø LOS'],
    data.weekdayStats.byDow.map(d => [
      d.name,
      fmtPct(d.hitRate),
      fmtPct(d.checkinPct),
      fmtPct(d.bookingPct ?? 0),
      d.bookingCount ?? 0,
      d.bookedNights,
      d.totalNights,
      d.adr > 0 ? fmtEur(d.adr) : '—',
      d.netAdr > 0 ? fmtEur(d.netAdr) : '—',
      d.avgLos > 0 ? `${d.avgLos} N` : '—',
    ]),
    { headerColor: C.blue }
  )

  // ── Page 4: Häuservergleich ───────────────────────────────────────────────
  if (data.houseData.length > 1) {
    doc.addPage()
    y = drawPageBanner(doc, data.companyName || 'Dashboard', 'Häuservergleich', dateRange)

    y = drawSectionTitle(doc, y + 2, 'Umsatz nach Haus', C.green)
    drawBarChart(doc, MARGIN, y, CONTENT_W, 48, data.houseData, {
      valueKey: 'revenue', labelKey: 'name',
      dynamicColor: (v, mx) => [C.blue, C.green, C.purple, C.amber, C.teal][data.houseData.indexOf(data.houseData.find(h => h.revenue === v)!) % 5] ?? C.blue,
      yLabel: v => fmtEur(v),
    })
    y += 52

    y = drawSectionTitle(doc, y, 'Kennzahlen je Haus')
    y = drawDataTable(doc, y,
      ['Haus','Buchungen','Nächte','Auslastung','Umsatz','ADR','RevPAR','Stornos'],
      data.houseData.map(h => [
        h.name,
        h.bookings,
        h.nights,
        fmtPct(h.occupancyRate),
        fmtEur(h.revenue),
        fmtEur(h.adr),
        fmtEur(h.revpar),
        h.cancellations ?? 0,
      ]),
      { headerColor: C.navy }
    )
  }

  // ── Footers ───────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    pageFooter(doc, p, totalPages, data.companyName)
  }

  doc.save(`dashboard_${data.from}_${data.to}.pdf`)
}

// ─── Reports PDF ─────────────────────────────────────────────────────────────

export interface ReportsPDFData {
  companyName: string
  from: string
  to: string
  tab: number
  tabName: string
  monthly: any[]
  occupancyByHouse: any[]
  byHouse: any[]
  byChannel: any[]
  weekdayStats: { byDow: any[]; ltData: any[] }
  rows: any[]  // booking rows for Buchungsübersicht tab
  houses: any[]
}

export function exportReportsPDF(data: ReportsPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dateRange = `${fmtDate(data.from)} – ${fmtDate(data.to)}`
  let y = 0

  if (data.tab === 0) {
    // ── Monatlich ─────────────────────────────────────────────────────────
    y = drawPageBanner(doc, data.companyName, 'Auswertung: Monatlich', dateRange)
    y = drawSectionTitle(doc, y + 2, 'Umsatz & Auslastung pro Monat', C.blue)

    drawBarChart(doc, MARGIN, y, CONTENT_W * 0.5, 50, data.monthly, {
      valueKey: 'revenue', labelKey: 'name',
      dynamicColor: (v, mx) => v >= mx * 0.8 ? C.green : v >= mx * 0.5 ? C.blue : C.red,
      yLabel: v => fmtEur(v),
    })
    drawMultiBarChart(doc, MARGIN + CONTENT_W * 0.52, y, CONTENT_W * 0.48, 50, data.monthly,
      [
        { key: 'occupancy', color: C.green, label: 'Auslastung %' },
      ],
      { labelKey: 'name', yLabel: v => `${Math.round(v)}%`, maxVal: 100 }
    )
    y += 55

    y = drawInsight(doc, y, revenueInsights(data.monthly))
    y = drawSectionTitle(doc, y + 2, 'Monatliche Kennzahlen')
    y = drawDataTable(doc, y,
      ['Monat','Buchungen','Nächte','Verf. N.','Auslastung','Umsatz','ADR'],
      data.monthly.map(m => [
        m.name, m.bookings, m.nights, m.availableNights,
        fmtPct(m.occupancy), fmtEur(m.revenue), fmtEur(m.adr),
      ]),
      { headerColor: C.navy }
    )

  } else if (data.tab === 1) {
    // ── Belegung ──────────────────────────────────────────────────────────
    y = drawPageBanner(doc, data.companyName, 'Auswertung: Belegung', dateRange)
    y = drawSectionTitle(doc, y + 2, 'Auslastung je Haus & Monat', C.green)

    // One line chart per house (if data available)
    y = drawSectionTitle(doc, y, 'Belegungstabelle Haus / Monat')
    const houseNames = data.houses.map(h => h.name)
    y = drawDataTable(doc, y,
      ['Monat', ...houseNames.flatMap(n => [`${n} %`, `${n} N`])],
      data.occupancyByHouse.map(r => [
        r.name,
        ...houseNames.flatMap(n => [
          r[n] != null ? `${r[n]} %` : '—',
          r[`${n}_nights`] ?? '—',
        ])
      ]),
      { headerColor: C.green }
    )

  } else if (data.tab === 2) {
    // ── Häuser ────────────────────────────────────────────────────────────
    y = drawPageBanner(doc, data.companyName, 'Auswertung: Häuservergleich', dateRange)
    y = drawSectionTitle(doc, y + 2, 'Umsatz nach Haus', C.blue)

    drawBarChart(doc, MARGIN, y, CONTENT_W, 48, data.byHouse, {
      valueKey: 'revenue', labelKey: 'name',
      dynamicColor: (_, __, i?: number) => [C.blue, C.green, C.purple, C.amber, C.teal][0],
      yLabel: v => fmtEur(v),
    })
    y += 52

    y = drawSectionTitle(doc, y, 'Kennzahlen je Haus')
    y = drawDataTable(doc, y,
      ['Haus','Buchungen','Nächte','Auslastung','Umsatz','ADR'],
      data.byHouse.map(h => [
        h.name, h.bookings, h.nights,
        fmtPct(h.occupancy), fmtEur(h.revenue), fmtEur(h.adr),
      ]),
      { headerColor: C.navy }
    )

  } else if (data.tab === 3) {
    // ── Kanäle ────────────────────────────────────────────────────────────
    y = drawPageBanner(doc, data.companyName, 'Auswertung: Buchungskanäle', dateRange)
    y = drawSectionTitle(doc, y + 2, 'Umsatz & Buchungen nach Kanal', C.teal)

    drawBarChart(doc, MARGIN, y, CONTENT_W, 48, data.byChannel, {
      valueKey: 'revenue', labelKey: 'channel',
      dynamicColor: (v, mx) => v >= mx * 0.5 ? C.teal : C.blue2,
      yLabel: v => fmtEur(v),
    })
    y += 52

    y = drawSectionTitle(doc, y, 'Kanalübersicht')
    y = drawDataTable(doc, y,
      ['Kanal','Buchungen','Nächte','Umsatz','ADR','Anteil'],
      data.byChannel.map(r => {
        const totalRev = data.byChannel.reduce((s, c) => s + (c.revenue ?? 0), 0)
        return [r.channel, r.count, r.nights, fmtEur(r.revenue), fmtEur(r.adr),
          totalRev > 0 ? fmtPct((r.revenue / totalRev) * 100) : '—']
      }),
      { headerColor: C.teal }
    )

  } else if (data.tab === 4) {
    // ── Wochentag ─────────────────────────────────────────────────────────
    y = drawPageBanner(doc, data.companyName, 'Auswertung: Wochentag-Analyse', dateRange)
    y = drawSectionTitle(doc, y + 2, 'Hit Rate, Check-in & Buchungstag', C.blue)

    drawMultiBarChart(doc, MARGIN, y, CONTENT_W, 52, data.weekdayStats.byDow,
      [
        { key: 'hitRate',    color: C.blue,   label: 'Hit Rate %' },
        { key: 'checkinPct', color: C.green,  label: 'Check-in %' },
        { key: 'bookingPct', color: C.violet, label: 'Buchung %' },
      ],
      { labelKey: 'name', yLabel: v => `${Math.round(v)}%`, maxVal: 100 }
    )
    y += 58

    y = drawInsight(doc, y, weekdayInsights(data.weekdayStats.byDow))
    y = drawSectionTitle(doc, y + 2, 'Detailtabelle Wochentag-Kennzahlen', C.blue)
    y = drawDataTable(doc, y,
      ['Wochentag','Hit Rate','Check-in %','Buchung %','Buchungen','Anreisen','Bel. N.','Verf. N.','ADR','Net ADR','Ø LOS'],
      data.weekdayStats.byDow.map(d => [
        d.name, fmtPct(d.hitRate), fmtPct(d.checkinPct), fmtPct(d.bookingPct ?? 0),
        d.bookingCount ?? 0, d.checkins ?? 0, d.bookedNights, d.totalNights,
        d.adr > 0 ? fmtEur(d.adr) : '—', d.netAdr > 0 ? fmtEur(d.netAdr) : '—',
        d.avgLos > 0 ? `${d.avgLos} N` : '—',
      ]),
      { headerColor: C.blue }
    )

    // Lead time table
    y = drawSectionTitle(doc, y + 2, 'ADR nach Buchungsvorlaufzeit', C.purple)
    y = drawDataTable(doc, y,
      ['Vorlaufzeit','ADR','Buchungen'],
      data.weekdayStats.ltData.map(r => [r.name, fmtEur(r.adr), r.bookings]),
      { headerColor: C.purple }
    )

  } else if (data.tab === 5) {
    // ── Buchungsübersicht ─────────────────────────────────────────────────
    y = drawPageBanner(doc, data.companyName, 'Auswertung: Buchungsübersicht', dateRange)
    y = drawInsight(doc, y + 2, bookingInsights(data.rows))
    y = drawSectionTitle(doc, y + 2, `Buchungsliste (${data.rows.length} Buchungen)`)
    y = drawDataTable(doc, y,
      ['Haus','Gast','Check-in','Check-out','Nächte','Umsatz','Status'],
      data.rows.map(b => [
        b.house_short ?? b.house_name ?? '—',
        b.guest_name ?? '—',
        fmtDate(b.checkin_date),
        fmtDate(b.checkout_date),
        b.nights ?? '—',
        fmtEur(parseFloat(b.total_price ?? 0)),
        b.status ?? '—',
      ]),
      { headerColor: C.navy }
    )
  }

  // Footers
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    pageFooter(doc, p, totalPages, data.companyName)
  }

  doc.save(`auswertung_${data.tabName.toLowerCase().replace(/\s+/g,'_')}_${data.from}_${data.to}.pdf`)
}

// ─── Bookings table PDF ───────────────────────────────────────────────────────

export function exportBookingsPDF(bookings: any[], title: string, companyName = '', dateRange = '') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PAGE_W_L = 297, CONTENT_W_L = PAGE_W_L - MARGIN * 2

  // Banner
  rect(doc, 0, 0, PAGE_W_L, 24, C.navy)
  rect(doc, 0, 24, PAGE_W_L, 2, C.blue)
  font(doc, 'bold', 16); textColor(doc, C.white)
  txt(doc, companyName || 'Buchungsliste', MARGIN, 13)
  font(doc, 'normal', 9); textColor(doc, [180,195,220] as [number,number,number])
  txt(doc, title, MARGIN, 20)
  txt(doc, dateRange || today(), PAGE_W_L - MARGIN, 20, { align: 'right' })

  let y = 30
  y = drawInsight(doc, y + 2, bookingInsights(bookings))
  y += 2

  autoTable(doc, {
    startY: y,
    head: [['Haus','Gast','Firma','Check-in','Check-out','Nächte','Pers.','Brutto','Kanal','Status','Rechnungs-Nr.']],
    body: bookings.map(b => [
      b.house_short ?? b.house_name ?? '—',
      b.guest_name ?? '—',
      b.company_name ?? '—',
      fmtDate(b.checkin_date),
      fmtDate(b.checkout_date),
      b.nights ?? '—',
      b.num_guests ?? '—',
      fmtEur(parseFloat(b.total_price ?? 0)),
      b.booking_channel ?? '—',
      b.status ?? '—',
      b.invoice_number ?? '—',
    ]),
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, font: 'helvetica', overflow: 'linebreak' },
    headStyles: { fillColor: C.navy, textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: C.gray1 },
    tableLineColor: C.gray2,
    tableLineWidth: 0.1,
    didDrawPage: (hookData) => {
      const pn = hookData.pageNumber
      const total = doc.getNumberOfPages()
      const fy = PAGE_H - 8
      rect(doc, 0, fy - 4, PAGE_W_L, 12, C.gray1)
      font(doc, 'normal', 7.5); textColor(doc, C.gray5)
      txt(doc, companyName, MARGIN, fy)
      txt(doc, `Seite ${pn} / ${total}`, PAGE_W_L - MARGIN, fy, { align: 'right' })
      txt(doc, `Erstellt: ${today()}`, PAGE_W_L / 2, fy, { align: 'center' })
    },
  })

  doc.save(`buchungen_${new Date().toISOString().slice(0,10)}.pdf`)
}
