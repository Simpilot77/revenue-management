'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { buildInvoicePreviewData, exportWorkSchedule } from './pdfExport'
import InvoicePreviewModal from './InvoicePreviewModal'
import InvoiceListSection from './InvoiceListSection'

export const dynamic = 'force-dynamic'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}
function fmtDate(ds: string) {
  if (!ds) return ''
  return new Date(ds).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}
function fmtDateFull(ds: string) {
  if (!ds) return ''
  return new Date(ds).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtCurrency(v: any) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
}

// ─── Task definitions (using DB keys) ────────────────────────────────────────

const TASK_DEFS = [
  { key: 'welcome',         icon: '✉️',  label: 'Willkommensnachricht' },
  { key: 'pin',             icon: '🔑',  label: 'PIN-Code übermittelt und aktiviert' },
  { key: 'guests_reg_done', icon: '👥',  label: 'Gästeregistrierung vollständig' },
  { key: 'invoice_done',    icon: '🧾',  label: 'Rechnung erstellt und verschickt' },
  { key: 'deposit_done',    icon: '💰',  label: 'Geldeingang mit Konto abgeglichen' },
  { key: 'cleaning_org',    icon: '📋',  label: 'Reinigung organisiert' },
  { key: 'cleaning_done',   icon: '🧹',  label: 'Reinigung abgeschlossen' },
  { key: 'kaution_rueck',   icon: '🔓',  label: 'Kaution zurückgegeben' },
]

function getTaskDueAuto(key: string, booking: any): string | null {
  const ci = booking.checkin_date?.slice(0, 10)
  const co = booking.checkout_date?.slice(0, 10)
  const bd = booking.booking_date?.slice(0, 10)
  if (!ci || !co) return null
  switch (key) {
    case 'welcome':
    case 'guests_reg_done':
      if (!bd || daysBetween(bd, ci) < 2) return bd || ci
      return addDays(ci, -2)
    case 'pin':          return addDays(ci, -1)
    case 'invoice_done': return addDays(ci, 2)
    case 'deposit_done': return ci
    case 'cleaning_org': return addDays(co, -2)
    case 'cleaning_done': return booking.cleaning_date?.slice(0, 10) || co
    case 'kaution_rueck': return addDays(co, 3)
    default: return null
  }
}

function allTasksDone(taskState: any) {
  return TASK_DEFS.every(t => taskState?.[t.key])
}

function dueStatus(dueDate: string | null, isDone: boolean) {
  if (isDone || !dueDate) return { label: null, cls: '' }
  const today = new Date().toISOString().slice(0, 10)
  const diff = daysBetween(today, dueDate)
  if (diff < 0)   return { label: `Überfällig (${fmtDate(dueDate)})`, cls: 'text-red-600 font-semibold' }
  if (diff === 0)  return { label: 'Heute fällig',                     cls: 'text-red-500 font-semibold' }
  if (diff === 1)  return { label: `Morgen (${fmtDate(dueDate)})`,     cls: 'text-amber-600 font-medium' }
  return            { label: `Fällig ${fmtDate(dueDate)}`,             cls: 'text-gray-400' }
}

// ─── House Status Card ────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      {children}
    </div>
  )
}

function BookingDetailModal({ booking, house, title, onClose }: any) {
  if (!booking) return null
  const checkin  = booking.checkin_date?.slice(0, 10)
  const checkout = booking.checkout_date?.slice(0, 10)
  const today    = new Date().toISOString().slice(0, 10)
  const daysIn   = daysBetween(checkin, today)
  const daysOut  = daysBetween(today, checkout)

  const statusColors: Record<string, string> = {
    eingecheckt: 'bg-green-100 text-green-800',
    ausgecheckt: 'bg-gray-100 text-gray-700',
    bestaetigt:  'bg-blue-100 text-blue-800',
    angefragt:   'bg-amber-100 text-amber-800',
  }
  const statusLabels: Record<string, string> = {
    eingecheckt: 'Eingecheckt', ausgecheckt: 'Ausgecheckt',
    bestaetigt: 'Bestätigt', angefragt: 'Angefragt',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full mx-4" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-t-2xl px-6 py-5 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-xl">✕</button>
          <div className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">{house.name} · {title}</div>
          <div className="text-xl font-bold">{booking.guest_name}</div>
          {booking.company_name && <div className="text-sm opacity-80 mt-0.5">{booking.company_name}</div>}
          <div className={`mt-3 inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full ${statusColors[booking.status] || 'bg-white/20 text-white'}`}>
            {statusLabels[booking.status] || booking.status}
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Check-in</div>
              <div className="text-sm font-semibold text-gray-800">{fmtDateFull(checkin)}</div>
              {daysIn >= 0 && daysIn < 30 && <div className="text-xs text-green-600 mt-0.5">{daysIn === 0 ? 'Heute' : `Vor ${daysIn} Tag${daysIn !== 1 ? 'en' : ''}`}</div>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Check-out</div>
              <div className="text-sm font-semibold text-gray-800">{fmtDateFull(checkout)}</div>
              {daysOut >= 0 && daysOut < 30 && <div className={`text-xs mt-0.5 ${daysOut === 0 ? 'text-red-600' : daysOut === 1 ? 'text-amber-600' : 'text-gray-500'}`}>{daysOut === 0 ? 'Heute' : daysOut === 1 ? 'Morgen' : `in ${daysOut} Tagen`}</div>}
            </div>
          </div>
          <div className="space-y-2">
            {([
              ['Nächte', booking.nights ? `${booking.nights} Nächte` : '—'],
              ['Personen', booking.guest_count ? `${booking.guest_count} Person${booking.guest_count !== 1 ? 'en' : ''}` : '—'],
              ['Gesamtpreis', fmtCurrency(booking.total_price)],
              booking.invoice_number && ['Rechnungsnr.', booking.invoice_number],
            ] as any[]).filter(Boolean).map(([label, value]: any) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>
          {booking.notes && (
            <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-900">
              <div className="text-xs font-semibold text-amber-600 mb-1">Notiz</div>
              {booking.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HouseStatusCard({ house, bookings, tasksMap }: { house: any; bookings: any[]; tasksMap: Record<number, any> }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const activeStatuses = ['bestaetigt', 'eingecheckt', 'ausgecheckt']

  const currentBooking = bookings.find(b =>
    b.house_id === house.id &&
    activeStatuses.includes(b.status) &&
    b.checkin_date?.slice(0, 10) <= today &&
    b.checkout_date?.slice(0, 10) >= today
  )
  const inquiryToday = !currentBooking && bookings.find(b =>
    b.house_id === house.id && b.status === 'angefragt' &&
    b.checkin_date?.slice(0, 10) <= today && b.checkout_date?.slice(0, 10) >= today
  )
  const nextBooking = bookings
    .filter(b => b.house_id === house.id && ['bestaetigt', 'eingecheckt'].includes(b.status) && b.checkin_date?.slice(0, 10) > today)
    .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date))[0]
  const lastOut = bookings
    .filter(b => b.house_id === house.id && b.checkout_date?.slice(0, 10) < today && activeStatuses.includes(b.status))
    .sort((a, b) => b.checkout_date.localeCompare(a.checkout_date))[0]

  const lastOutTasks = lastOut ? (tasksMap[lastOut.id] || {}) : null
  const cleaningDone = lastOut ? !!(lastOutTasks?.cleaning_done) : true
  const cleaningOrg  = lastOut ? !!(lastOutTasks?.cleaning_org) : false
  const occupied   = !!currentBooking
  const isInquiry  = !!inquiryToday

  const daysUntilFree = currentBooking
    ? Math.max(0, Math.ceil((new Date(currentBooking.checkout_date).getTime() - new Date(today).getTime()) / 86400000))
    : 0
  const daysUntilNext = nextBooking
    ? Math.max(0, Math.ceil((new Date(nextBooking.checkin_date).getTime() - new Date(today).getTime()) / 86400000))
    : null

  let progressPct = 0
  if (occupied && currentBooking) {
    const start = new Date(currentBooking.checkin_date).getTime()
    const end   = new Date(currentBooking.checkout_date).getTime()
    const now   = new Date(today).getTime()
    const total = Math.max(1, (end - start) / 86400000)
    const elapsed = Math.max(0, (now - start) / 86400000)
    progressPct = Math.min(100, Math.round((elapsed / total) * 100))
  } else if (!occupied && nextBooking && lastOut) {
    const lastEnd   = new Date(lastOut.checkout_date).getTime()
    const nextStart = new Date(nextBooking.checkin_date).getTime()
    const now       = new Date(today).getTime()
    const total     = Math.max(1, (nextStart - lastEnd) / 86400000)
    const elapsed   = Math.max(0, (now - lastEnd) / 86400000)
    progressPct = Math.min(100, Math.round((elapsed / total) * 100))
  }

  let statusLabel, statusIcon, buttonClass
  if (occupied) {
    statusLabel = 'Belegt'; statusIcon = '🏠'; buttonClass = 'bg-red-500 border-white/30 text-white'
  } else if (isInquiry) {
    statusLabel = 'Angefragt'; statusIcon = '❓'; buttonClass = 'bg-violet-500 border-white/30 text-white'
  } else if (!cleaningDone && lastOut) {
    statusLabel = 'Reinigung ausstehend'; statusIcon = '🧹'; buttonClass = 'bg-amber-400 border-white/30 text-white'
  } else {
    statusLabel = daysUntilNext !== null
      ? `Frei – Ankunft in ${daysUntilNext === 0 ? 'heute' : daysUntilNext === 1 ? '1 Tag' : `${daysUntilNext} Tagen`}`
      : 'Frei'
    statusIcon = '✅'; buttonClass = 'bg-emerald-500 border-white/30 text-white'
  }

  const activeBooking = currentBooking || inquiryToday
  const detailBooking = activeBooking || nextBooking
  const detailTitle = activeBooking ? (occupied ? 'Aktuelle Buchung' : 'Angefragt') : 'Nächste Buchung'

  return (
    <>
      {detailOpen && detailBooking && (
        <BookingDetailModal booking={detailBooking} house={house} title={detailTitle} onClose={() => setDetailOpen(false)} />
      )}
      <div className="rounded-2xl overflow-hidden shadow-md ring-1 ring-gray-200 cursor-pointer hover:ring-blue-300 hover:shadow-lg transition-shadow"
        onClick={() => detailBooking && setDetailOpen(true)}>
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-5 text-white relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl font-bold tracking-tight">{house.name}</div>
              <div className="text-sm opacity-75 mt-0.5">{house.capacity} Betten</div>
            </div>
            <div className="text-4xl drop-shadow-sm">{statusIcon}</div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1.5 ${buttonClass} bg-opacity-80 border rounded-full px-4 py-1.5 text-sm font-bold shadow-sm`}>
            {statusLabel}
          </div>
          {activeBooking ? (
            <div className="absolute bottom-3 right-4 text-xs opacity-80 text-right">
              <div>📅 {fmtDateFull(activeBooking.checkin_date)}</div>
              <div>🏁 {fmtDateFull(activeBooking.checkout_date)}</div>
            </div>
          ) : nextBooking && (
            <div className="absolute bottom-3 right-4 text-xs opacity-80 text-right">
              <div>📅 Ankunft: {fmtDateFull(nextBooking.checkin_date)}</div>
            </div>
          )}
        </div>
        <div className="relative">
          <div className="h-2 bg-gray-200 w-full">
            <div className={`h-full transition-all duration-500 ${occupied ? 'bg-red-400' : isInquiry ? 'bg-violet-400' : !cleaningDone ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="bg-white p-4 space-y-3">
          {occupied && currentBooking ? (
            <>
              <Row label="Gast"><span className="text-sm font-semibold text-gray-800 truncate">{currentBooking.guest_name}</span></Row>
              <Row label="Abreise">
                <span className="text-sm font-medium text-red-700">{fmtDateFull(currentBooking.checkout_date)}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 ml-1 ${daysUntilFree === 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-50 text-red-500'}`}>
                  {daysUntilFree === 0 ? 'Heute' : daysUntilFree === 1 ? 'Morgen' : `in ${daysUntilFree} Tagen`}
                </span>
              </Row>
              <Row label="Reinigung">
                {cleaningDone
                  ? <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700">✅ Bestätigt</span>
                  : cleaningOrg
                    ? <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-yellow-100 text-yellow-700">🗓 Organisiert</span>
                    : <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-red-100 text-red-600">⚠ Noch organisieren</span>
                }
              </Row>
            </>
          ) : (
            <>
              <Row label="Status">
                <span className={`text-sm font-semibold ${cleaningDone ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {cleaningDone ? '🏡 Frei' : 'Reinigung erforderlich'}
                </span>
              </Row>
              {nextBooking && (
                <Row label="Ankunft">
                  <span className="text-sm font-medium text-blue-700">{fmtDateFull(nextBooking.checkin_date)}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ml-1 ${daysUntilNext === 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-500'}`}>
                    {daysUntilNext === 0 ? 'Heute' : daysUntilNext === 1 ? 'Morgen' : `in ${daysUntilNext} Tagen`}
                  </span>
                </Row>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Single task row ──────────────────────────────────────────────────────────

function invoicePrefix(booking: any) {
  const letter = (booking.house_short || '').toLowerCase() || String(booking.house_id || '')
  const year = new Date().getFullYear()
  return `${letter}-${year}-`
}

function parseInvoiceSuffix(fullNum: string, prefix: string) {
  if (!fullNum) return ''
  if (fullNum.startsWith(prefix)) return fullNum.slice(prefix.length)
  const parts = fullNum.split('-')
  return parts[parts.length - 1] || ''
}

function TaskRow({ task, booking, tasks, today, invoiceNum, setInvoiceNum, onToggle, onOpenInvoice }: any) {
  const isDone    = !!tasks[task.key]
  const dueDate   = getTaskDueAuto(task.key, booking)
  const isOverdue = !isDone && dueDate && dueDate < today
  const [noteOpen, setNoteOpen] = useState(false)
  const [taskNote, setTaskNote] = useState('')

  const prefix = invoicePrefix(booking)
  const suffix = parseInvoiceSuffix(invoiceNum, prefix)

  const handleSuffixChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    const full = digits ? `${prefix}${digits.padStart(4, '0')}` : ''
    setInvoiceNum(full)
  }

  const handleInvoiceBlur = async () => {
    const val = invoiceNum.trim()
    if (!val || !booking.id) return
    await fetch(`/api/bookings/${booking.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_number: val }),
    })
  }

  const { label: dueLabel, cls: dueCls } = dueStatus(dueDate, isDone)

  return (
    <div className={`rounded-xl ${isDone ? 'bg-emerald-50' : isOverdue ? 'bg-red-50' : 'bg-gray-50'}`}>
      <div className="flex items-start gap-3 p-2.5">
        <input type="checkbox" checked={isDone} onChange={e => onToggle(e, task.key)}
          className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0 mt-0.5" />
        <span className="text-base shrink-0 mt-0.5">{task.icon}</span>
        <div className="flex-1 min-w-0">
          <span className={`text-sm block ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.label}</span>
          {task.key === 'invoice_done' && (
            <div className="space-y-1.5 mt-1" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-gray-500 bg-gray-100 border border-gray-200 rounded-l px-1.5 py-0.5 border-r-0 whitespace-nowrap">
                  {prefix}
                </span>
                <input type="text" inputMode="numeric" maxLength={4} value={suffix} placeholder="1001"
                  className="text-xs border border-gray-200 rounded-r px-1.5 py-0.5 w-14 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono bg-white"
                  onChange={e => handleSuffixChange(e.target.value)}
                  onBlur={handleInvoiceBlur}
                  onClick={e => e.stopPropagation()} />
              </div>
              <button type="button"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm"
                onClick={e => { e.stopPropagation(); onOpenInvoice?.() }}>
                🧾 Rechnung erstellen
              </button>
            </div>
          )}
          {dueLabel && <div className={`text-xs mt-0.5 ${dueCls}`}>{dueLabel}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button className={`text-xs px-1.5 py-0.5 rounded transition-colors ${noteOpen || taskNote ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
            onClick={e => { e.stopPropagation(); setNoteOpen(o => !o) }}>
            {taskNote && !noteOpen ? '📝' : '✏️'}
          </button>
          {isDone && <span className="text-xs text-emerald-500 font-bold">✓</span>}
          {isOverdue && <span className="text-xs text-red-500 font-bold">!</span>}
        </div>
      </div>
      {(noteOpen || taskNote) && (
        <div className="px-2.5 pb-2.5" onClick={e => e.stopPropagation()}>
          <textarea value={taskNote} placeholder="Notiz zu dieser Aufgabe…" rows={2} autoFocus={noteOpen && !taskNote}
            className={`w-full text-xs border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 ${isDone ? 'bg-emerald-50/60 border-emerald-100' : isOverdue ? 'bg-red-50/60 border-red-100' : 'bg-white border-gray-200'}`}
            onChange={e => setTaskNote(e.target.value)} />
        </div>
      )}
    </div>
  )
}

// ─── Booking Task Card ────────────────────────────────────────────────────────

function BookingTaskCard({ booking, tasks, onToggle, onUpdate, highlight, settings }: any) {
  const [expanded, setExpanded] = useState(!!highlight)
  const [highlighted, setHighlighted] = useState(!!highlight)
  const cardRef = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState('')
  const [invoiceNum, setInvoiceNum] = useState(booking.invoice_number || '')
  const [invoicePreview, setInvoicePreview] = useState<any>(null)
  const [invoiceLang, setInvoiceLang] = useState('de')

  useEffect(() => {
    if (!highlight) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHighlighted(false), 2000)
    return () => clearTimeout(t)
  }, [highlight])

  const t = tasks || {}
  const done = allTasksDone(t)
  const doneCount = TASK_DEFS.filter(d => t[d.key]).length
  const pct = Math.round((doneCount / TASK_DEFS.length) * 100)
  const today = new Date().toISOString().slice(0, 10)
  const isActive = booking.checkin_date?.slice(0, 10) <= today && booking.checkout_date?.slice(0, 10) >= today
  const isFuture = booking.checkin_date?.slice(0, 10) > today

  const overdueCount = TASK_DEFS.filter(td => {
    if (t[td.key]) return false
    const due = getTaskDueAuto(td.key, booking)
    return due && due < today
  }).length

  const statusLabel = isActive ? 'Aktuell' : isFuture ? 'Bevorstehend' : 'Abgereist'
  const statusColor = isActive ? 'bg-blue-100 text-blue-700' : isFuture ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
  const borderColor = done ? 'border-l-4 border-l-emerald-500' : overdueCount > 0 ? 'border-l-4 border-l-red-500' : isActive ? 'border-l-4 border-l-blue-500' : isFuture ? 'border-l-4 border-l-amber-400' : ''

  const toggle = (e: React.ChangeEvent, key: string) => {
    e.stopPropagation()
    const newVal = !t[key]
    onToggle(booking.id, key, newVal)
  }

  return (
    <div ref={cardRef} className={`card transition-all ${borderColor} ${highlighted ? 'ring-2 ring-blue-400' : ''}`}>
      <div className="flex items-center gap-4 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="relative w-11 h-11 shrink-0">
          <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none"
              stroke={done ? '#10b981' : overdueCount > 0 ? '#ef4444' : isActive ? '#3b82f6' : '#f59e0b'}
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-600">
            {doneCount}/{TASK_DEFS.length}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{booking.guest_name}</span>
            {booking.company_name && <span className="text-xs text-gray-400 truncate">{booking.company_name}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor}`}>{statusLabel}</span>
            {overdueCount > 0 && !done && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 shrink-0">⚠ {overdueCount} überfällig</span>
            )}
            {done && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 shrink-0">✅ Erledigt</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1 font-medium text-gray-600 bg-gray-100 rounded-md px-1.5 py-0.5">
              🏠 {booking.house_name || booking.house_short || `Haus ${booking.house_id}`}
            </span>
            <span className="text-gray-400">
              {fmtDate(booking.checkin_date)} – {fmtDateFull(booking.checkout_date)}
            </span>
            <span>🌙 {booking.nights} {booking.nights === 1 ? 'Nacht' : 'Nächte'}</span>
            {booking.total_price > 0 && <span>💶 {fmtCurrency(booking.total_price)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block w-28">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-emerald-500' : overdueCount > 0 ? 'bg-red-500' : isActive ? 'bg-blue-500' : 'bg-amber-400'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-gray-400 mt-1 text-right">{pct}%</div>
          </div>
          <span className="text-gray-400 text-xs font-medium">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TASK_DEFS.map(task => (
              <TaskRow
                key={task.key}
                task={task}
                booking={booking}
                tasks={t}
                today={today}
                invoiceNum={invoiceNum}
                setInvoiceNum={setInvoiceNum}
                onToggle={toggle}
                onOpenInvoice={() => {
                  const b = { ...booking, invoice_number: invoiceNum || booking.invoice_number }
                  setInvoicePreview({ ...buildInvoicePreviewData(b, invoiceLang, settings), extra_items: [], _house_short: booking.house_short })
                }}
              />
            ))}
          </div>

          <div className="space-y-1" onClick={e => e.stopPropagation()}>
            <label className="text-xs font-medium text-gray-500">📝 Notiz zur Buchung</label>
            <textarea value={note} placeholder="Interne Notizen, besondere Wünsche, Hinweise…" rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
              onChange={e => setNote(e.target.value)} />
          </div>

          <div onClick={e => e.stopPropagation()}>
            <InvoiceListSection booking={booking} settings={settings} onUpdate={onUpdate} invoiceLang={invoiceLang} />
          </div>

          {done && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-600 text-lg">🎉</span>
              <span className="text-sm font-semibold text-emerald-700">Alle Aufgaben erledigt – Buchung vollständig abgeschlossen!</span>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2">
            <a href={`/bookings/${booking.id}/edit`} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-700">✏️ Buchung bearbeiten</a>
          </div>
        </div>
      )}

      {invoicePreview && (
        <InvoicePreviewModal
          data={invoicePreview}
          settings={settings}
          onClose={() => { setInvoicePreview(null); onUpdate?.() }}
          onLangChange={(lang: string) => {
            const b = { ...booking, invoice_number: invoiceNum || booking.invoice_number }
            const fresh = buildInvoicePreviewData(b, lang, settings)
            setInvoiceLang(lang)
            setInvoicePreview((prev: any) => ({
              ...fresh,
              company_name: prev.company_name, guest_name: prev.guest_name,
              billing_street: prev.billing_street, billing_zip: prev.billing_zip,
              billing_city: prev.billing_city, billing_country: prev.billing_country,
              invoice_number: prev.invoice_number, invoice_date: prev.invoice_date,
              brutto_total: prev.brutto_total, netto_total: prev.netto_total,
              vat_amount: prev.vat_amount, cleaning_fee: prev.cleaning_fee,
              discount_pct: prev.discount_pct, extra_items: prev.extra_items,
            }))
          }}
          onChange={(field: string, value: any) => setInvoicePreview((prev: any) => ({ ...prev, [field]: value }))}
        />
      )}
    </div>
  )
}

// ─── Zu Erledigen Panel ───────────────────────────────────────────────────────

function ZuErledigenpanel({ bookings, tasksMap, onToggle }: any) {
  const today = new Date().toISOString().slice(0, 10)
  const [sortOrder, setSortOrder] = useState('due')

  const pendingItems: any[] = []
  bookings.forEach((booking: any) => {
    const tasks = tasksMap[booking.id] || {}
    const isActive = booking.checkin_date?.slice(0, 10) <= today && booking.checkout_date?.slice(0, 10) >= today
    const isFuture = booking.checkin_date?.slice(0, 10) > today
    const context = isActive ? 'Aktuell' : isFuture ? 'Bevorstehend' : 'Abgereist'

    TASK_DEFS.forEach(td => {
      if (tasks[td.key]) return
      const due = getTaskDueAuto(td.key, booking)
      pendingItems.push({
        bookingId: booking.id, booking, taskKey: td.key, taskIcon: td.icon, taskLabel: td.label,
        dueDate: due, isOverdue: due && due < today, context,
      })
    })
  })

  pendingItems.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate)
  })

  const byBooking: Record<string, { booking: any; items: any[] }> = {}
  pendingItems.forEach(item => {
    if (!byBooking[item.bookingId]) byBooking[item.bookingId] = { booking: item.booking, items: [] }
    byBooking[item.bookingId].items.push(item)
  })

  const overdueCount  = pendingItems.filter(i => i.isOverdue).length
  const todayCount    = pendingItems.filter(i => i.dueDate === today).length

  const handleExport = () => {
    const rows = pendingItems.map(item => ({
      date: item.dueDate,
      house: item.booking.house_name || item.booking.house_short,
      guest: item.booking.guest_name,
      task: `${item.taskIcon} ${item.taskLabel}`,
      details: item.taskKey === 'invoice_done' ? `Rechnungsnr.: ${item.booking.invoice_number || '—'}` : '',
    }))
    exportWorkSchedule(rows)
  }

  if (pendingItems.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">🎉</div>
        <div className="text-lg font-semibold text-emerald-700">Alles erledigt!</div>
        <div className="text-sm text-gray-400 mt-1">Keine offenen Aufgaben.</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        {overdueCount > 0 && (
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-sm">
            <span className="font-bold text-red-600">⚠ {overdueCount}</span>
            <span className="text-red-500">überfällig</span>
          </div>
        )}
        {todayCount > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-sm">
            <span className="font-bold text-amber-600">{todayCount}</span>
            <span className="text-amber-500">heute fällig</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-sm">
          <span className="font-bold text-blue-600">{pendingItems.length}</span>
          <span className="text-blue-500">Aufgaben gesamt offen</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {([['due', 'Nach Fälligkeit'], ['checkin', 'Nach Check-in']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setSortOrder(v)}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${sortOrder === v ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>{l}</button>
          ))}
        </div>
        <button className="btn-secondary text-sm" onClick={handleExport}>📄 Arbeitsplan exportieren</button>
      </div>

      {Object.values(byBooking).sort((a: any, b: any) => {
        if (sortOrder === 'checkin') return (a.booking.checkin_date || '').localeCompare(b.booking.checkin_date || '')
        const aMin = a.items.map((i: any) => i.dueDate).filter(Boolean).sort()[0] || ''
        const bMin = b.items.map((i: any) => i.dueDate).filter(Boolean).sort()[0] || ''
        return aMin.localeCompare(bMin)
      }).map(({ booking, items }: any) => {
        const isActive = booking.checkin_date?.slice(0, 10) <= today && booking.checkout_date?.slice(0, 10) >= today
        const isFuture = booking.checkin_date?.slice(0, 10) > today
        const statusCls = isActive ? 'bg-blue-100 text-blue-700' : isFuture ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
        const statusTxt = isActive ? 'Aktuell' : isFuture ? 'Bevorstehend' : 'Abgereist'
        return (
          <div key={booking.id} className="card">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 flex-wrap">
              <span className="font-semibold text-gray-800">{booking.guest_name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls}`}>{statusTxt}</span>
              <span className="text-xs text-gray-500 ml-auto">{booking.house_short || booking.house_id} · {fmtDate(booking.checkin_date)} – {fmtDate(booking.checkout_date)}</span>
            </div>
            <div className="space-y-2">
              {items.sort((a: any, b: any) => (a.dueDate || '').localeCompare(b.dueDate || '')).map((item: any) => {
                const { label: dl, cls: dc } = dueStatus(item.dueDate, false)
                return (
                  <div key={item.taskKey} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${item.isOverdue ? 'bg-red-50 border border-red-100' : item.dueDate === today ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
                    <input type="checkbox" checked={false} onChange={() => onToggle(booking.id, item.taskKey, true)}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0" />
                    <span className="text-base">{item.taskIcon}</span>
                    <div className="flex-1 min-w-0"><span className="text-sm text-gray-800">{item.taskLabel}</span></div>
                    <div className="text-right shrink-0">{dl && <div className={`text-xs ${dc}`}>{dl}</div>}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function useLiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ─── Main Inner ───────────────────────────────────────────────────────────────

function TasksInner() {
  const searchParams = useSearchParams()
  const highlightBookingId = searchParams.get('booking')
  const [houses, setHouses] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [tasksMap, setTasksMap] = useState<Record<number, any>>({})
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(() => highlightBookingId ? 'all' : 'current')
  const [houseFilter, setHouseFilter] = useState('')
  const [tab, setTab] = useState('tasks')
  const now = useLiveClock()
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const [hRes, bRes, sRes] = await Promise.all([
      fetch('/api/houses').then(r => r.json()),
      fetch('/api/bookings?limit=500').then(r => r.json()),
      fetch('/api/company-settings').then(r => r.json()),
    ])
    const bData: any[] = bRes.data ?? []
    const filtered = bData.filter((b: any) => ['bestaetigt', 'eingecheckt', 'ausgecheckt', 'angefragt'].includes(b.status))
    setBookings(filtered)
    setHouses(hRes.data ?? hRes)
    setSettings(sRes)
    if (filtered.length > 0) {
      const ids = filtered.map((b: any) => b.id).join(',')
      const tRes = await fetch(`/api/booking-tasks?ids=${ids}`).then(r => r.json())
      const tm: Record<number, any> = {}
      ;(Array.isArray(tRes) ? tRes : []).forEach((t: any) => { tm[t.booking_id] = t })
      setTasksMap(tm)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onToggle = async (bookingId: number, key: string, value: boolean) => {
    setTasksMap(prev => ({ ...prev, [bookingId]: { ...(prev[bookingId] || {}), [key]: value } }))
    await fetch(`/api/booking-tasks/${bookingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
  }

  const FILTERS = [
    { key: 'current',   label: 'Aktuell',        fn: (b: any) => b.checkin_date?.slice(0,10) <= today && b.checkout_date?.slice(0,10) >= today },
    { key: 'upcoming',  label: 'Bevorstehend',    fn: (b: any) => b.checkin_date?.slice(0,10) > today },
    { key: 'recent',    label: 'Abgereist',       fn: (b: any) => b.checkout_date?.slice(0,10) < today },
    { key: 'overdue',   label: 'Überfällig',      fn: (b: any) => {
      const t = tasksMap[b.id] || {}
      return TASK_DEFS.some(td => {
        if (t[td.key]) return false
        const due = getTaskDueAuto(td.key, b)
        return due && due < today
      })
    }},
    { key: 'incomplete', label: 'Offen',          fn: (b: any) => !allTasksDone(tasksMap[b.id] || {}) },
    { key: 'all',        label: 'Alle',           fn: () => true },
  ]

  const activeFilter = FILTERS.find(f => f.key === filter)
  const filteredBookings = bookings
    .filter((b: any) => activeFilter?.fn(b) ?? true)
    .filter((b: any) => !houseFilter || String(b.house_id) === houseFilter)
    .sort((a: any, b: any) => {
      const aA = a.checkin_date?.slice(0,10) <= today && a.checkout_date?.slice(0,10) >= today
      const bA = b.checkin_date?.slice(0,10) <= today && b.checkout_date?.slice(0,10) >= today
      if (aA !== bA) return aA ? -1 : 1
      return (a.checkin_date || '').localeCompare(b.checkin_date || '')
    })

  const totalTasks  = bookings.length * TASK_DEFS.length
  const doneTasks   = bookings.reduce((s: number, b: any) => s + TASK_DEFS.filter(td => (tasksMap[b.id] || {})[td.key]).length, 0)
  const completedBookings = bookings.filter((b: any) => allTasksDone(tasksMap[b.id] || {})).length
  const overdueTotal = bookings.reduce((s: number, b: any) => {
    const t = tasksMap[b.id] || {}
    return s + TASK_DEFS.filter(td => {
      if (t[td.key]) return false
      const due = getTaskDueAuto(td.key, b)
      return due && due < today
    }).length
  }, 0)
  const pendingTotal = bookings.reduce((s: number, b: any) => s + TASK_DEFS.filter(td => !(tasksMap[b.id] || {})[td.key]).length, 0)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Laden…</div>

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aufgaben</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-medium text-gray-600">
              {now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-sm font-mono font-semibold text-blue-700 tabular-nums">
              {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          {overdueTotal > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="text-red-600 font-bold">⚠ {overdueTotal}</span>
              <span className="text-red-500 text-sm">überfällig</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-1.5">
            <span className="text-blue-600 font-bold">{doneTasks}</span>
            <span className="text-blue-500 text-sm">/ {totalTasks} Aufgaben</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-3 py-1.5">
            <span className="text-emerald-600 font-bold">{completedBookings}</span>
            <span className="text-emerald-500 text-sm">Buchungen erledigt</span>
          </div>
        </div>
      </div>

      {/* House Status */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span>🏠</span> Hausstatus
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {houses.map((house: any) => (
            <HouseStatusCard key={house.id} house={house} bookings={bookings} tasksMap={tasksMap} />
          ))}
        </div>
      </section>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setTab('tasks')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'tasks' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          ☑️ Aufgaben je Buchung
        </button>
        <button onClick={() => setTab('todo')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === 'todo' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          📋 Zu Erledigen
          {pendingTotal > 0 && (
            <span className={`text-xs rounded-full px-1.5 font-bold ${tab === 'todo' ? 'bg-blue-600 text-white' : overdueTotal > 0 ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
              {pendingTotal}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'tasks' && (
        <section>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex gap-1.5 flex-wrap items-center">
              {houses.length > 1 && (
                <select className="form-select text-xs py-1 h-7 border-gray-200 rounded-full" value={houseFilter} onChange={e => setHouseFilter(e.target.value)}>
                  <option value="">🏠 Alle Häuser</option>
                  {houses.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              )}
              {FILTERS.map(({ key, label }) => {
                const count = key === 'overdue' ? overdueTotal : key === 'incomplete' ? bookings.filter((b: any) => !allTasksDone(tasksMap[b.id] || {})).length : null
                return (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === key ? (key === 'overdue' ? 'bg-red-600 text-white shadow-sm' : 'bg-blue-700 text-white shadow-sm') : key === 'overdue' && overdueTotal > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                    {count !== null && count > 0 && (
                      <span className={`ml-1.5 rounded-full px-1.5 text-xs font-bold ${filter === key ? 'bg-white text-gray-700' : key === 'overdue' ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="text-3xl mb-2">🎉</div>
              <div className="font-medium">Keine Einträge in diesem Bereich</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((b: any) => (
                <BookingTaskCard key={b.id} booking={b} tasks={tasksMap[b.id]} onToggle={onToggle} onUpdate={load} settings={settings}
                  highlight={highlightBookingId != null && String(b.id) === highlightBookingId} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'todo' && (
        <section>
          <ZuErledigenpanel bookings={bookings} tasksMap={tasksMap} onToggle={onToggle} />
        </section>
      )}
    </div>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Laden…</div>}>
      <TasksInner />
    </Suspense>
  )
}
