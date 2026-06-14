import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDateFull } from '../utils/format';
import { buildInvoicePreviewData, exportWorkSchedule } from '../utils/pdfExport';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import { applyInvoiceNumber } from '../utils/numbering';
import { onDataChange, emitDataChange } from '../utils/syncBus';

const SCOPE_LABELS = { grund: 'Grundreinigung', reinigung: 'Zwischenreinigung', bettwaesche: 'Bettwäsche-Wechsel' };

function loadCleaningDetailsMap() {
  try { return JSON.parse(localStorage.getItem('cleaning_details') || '{}'); } catch { return {}; }
}
function cleaningDetailString(booking) {
  const ds = booking.cleaning_date?.slice(0, 10) || booking.checkout_date?.slice(0, 10);
  if (!ds || !booking.house_id) return '';
  const d = loadCleaningDetailsMap()[`${booking.house_id}_${ds}`];
  if (!d) return '';
  const parts = [];
  if (d.scope) parts.push(SCOPE_LABELS[d.scope] || d.scope);
  if (d.windows) parts.push('Fenster putzen');
  if (d.deadlineTime) parts.push(`bis ${d.deadlineTime}`);
  if (d.durationMin) parts.push(`${d.durationMin} Min.`);
  if (d.cost) parts.push(formatCurrency(Number(d.cost)));
  if (d.notes) parts.push(d.notes);
  if (d.cleanerConfirmed) parts.push('✅ Reinigungskraft bestätigt');
  return parts.join(' · ');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function fmtDate(ds) {
  if (!ds) return '';
  return new Date(ds).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
// ─── Task definitions ────────────────────────────────────────────────────────

const TASK_DEFS = [
  { key: 'welcome',       icon: '✉️',  label: 'Willkommensnachricht' },
  { key: 'pin',           icon: '🔑',  label: 'PIN-Code übermittelt und aktiviert' },
  { key: 'guests',        icon: '👥',  label: 'Gästeregistrierung vollständig' },
  { key: 'invoice',       icon: '🧾',  label: 'Rechnung erstellt und verschickt' },
  { key: 'payment',       icon: '💰',  label: 'Geldeingang mit Konto abgeglichen' },
  { key: 'cleaning_org',  icon: '📋',  label: 'Reinigung organisiert' },
  { key: 'cleaning_done', icon: '🧹',  label: 'Reinigung abgeschlossen' },
];

/** Calculate the automatic due date for a task */
function getTaskDueAuto(key, booking) {
  const ci = booking.checkin_date?.slice(0, 10);
  const co = booking.checkout_date?.slice(0, 10);
  const bd = booking.booking_date?.slice(0, 10);
  if (!ci || !co) return null;
  switch (key) {
    case 'welcome':
    case 'guests':
      if (!bd || daysBetween(bd, ci) < 2) return bd || ci;
      return addDays(ci, -2);
    case 'pin':          return addDays(ci, -1);
    case 'invoice':      return addDays(ci, 2);
    case 'payment':      return ci;                // Geldeingang prüfen ab Check-in
    case 'cleaning_org': return addDays(co, -2);
    case 'cleaning_done': return booking.cleaning_date?.slice(0, 10) || co;
    default: return null;
  }
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const TASKS_KEY      = 'booking_tasks';
const DUES_KEY       = 'booking_task_dues';
const NOTES_KEY      = 'booking_task_notes';       // booking-level note
const TASK_NOTES_KEY = 'booking_task_item_notes';  // per-task notes

function loadAllNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch { return {}; }
}
function saveAllNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}
function getBookingNote(bookingId) {
  return loadAllNotes()[bookingId] || '';
}
function setBookingNote(bookingId, note) {
  const all = loadAllNotes();
  if (note) all[bookingId] = note;
  else delete all[bookingId];
  saveAllNotes(all);
}

function loadAllTaskNotes() {
  try { return JSON.parse(localStorage.getItem(TASK_NOTES_KEY) || '{}'); } catch { return {}; }
}
function getTaskNote(bookingId, taskKey) {
  return loadAllTaskNotes()[`${bookingId}__${taskKey}`] || '';
}
function setTaskNote(bookingId, taskKey, note) {
  const all = loadAllTaskNotes();
  const k = `${bookingId}__${taskKey}`;
  if (note) all[k] = note;
  else delete all[k];
  localStorage.setItem(TASK_NOTES_KEY, JSON.stringify(all));
}

export function loadAllTasks() {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY) || '{}'); } catch { return {}; }
}
export function saveAllTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}
export function getBookingTasks(bookingId) {
  return loadAllTasks()[bookingId] || {};
}

function loadAllDues() {
  try { return JSON.parse(localStorage.getItem(DUES_KEY) || '{}'); } catch { return {}; }
}
function saveAllDues(dues) {
  localStorage.setItem(DUES_KEY, JSON.stringify(dues));
}
function getTaskDueOverride(bookingId, key) {
  return loadAllDues()[bookingId]?.[key] || null;
}
function setTaskDueOverride(bookingId, key, date) {
  const all = loadAllDues();
  if (!all[bookingId]) all[bookingId] = {};
  if (date) all[bookingId][key] = date;
  else delete all[bookingId][key];
  saveAllDues(all);
}
function getEffectiveDue(key, booking) {
  return getTaskDueOverride(booking.id, key) || getTaskDueAuto(key, booking);
}

function allTasksDone(taskState) {
  return TASK_DEFS.every(t => taskState[t.key]);
}

/** Visual urgency for a due date */
function dueStatus(dueDate, isDone) {
  if (isDone) return { label: null, cls: '' };
  if (!dueDate) return { label: null, cls: '' };
  const today = new Date().toISOString().slice(0, 10);
  const diff = daysBetween(today, dueDate);
  if (diff < 0)  return { label: `Überfällig (${fmtDate(dueDate)})`, cls: 'text-red-600 font-semibold' };
  if (diff === 0) return { label: 'Heute fällig',                     cls: 'text-red-500 font-semibold' };
  if (diff === 1) return { label: `Morgen (${fmtDate(dueDate)})`,      cls: 'text-amber-600 font-medium' };
  return          { label: `Fällig ${fmtDate(dueDate)}`,              cls: 'text-gray-400' };
}

// ─── Booking Detail Modal (shown when clicking a HouseStatusCard) ─────────────

function BookingDetailModal({ booking, house, title, onClose }) {
  if (!booking) return null;
  const checkin  = booking.checkin_date?.slice(0, 10);
  const checkout = booking.checkout_date?.slice(0, 10);
  const today    = new Date().toISOString().slice(0, 10);
  const daysIn   = daysBetween(checkin, today);
  const daysOut  = daysBetween(today, checkout);

  const statusColors = {
    eingecheckt: 'bg-green-100 text-green-800',
    ausgecheckt: 'bg-gray-100 text-gray-700',
    bestaetigt:  'bg-blue-100 text-blue-800',
    angefragt:   'bg-amber-100 text-amber-800',
    gesperrt:    'bg-slate-100 text-slate-700',
  };
  const statusLabels = {
    eingecheckt: 'Eingecheckt', ausgecheckt: 'Ausgecheckt',
    bestaetigt: 'Bestätigt', angefragt: 'Angefragt', gesperrt: 'Gesperrt',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full mx-4"
        style={{ maxWidth: 480 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-t-2xl px-6 py-5 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-xl leading-none">✕</button>
          <div className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">{house.name} · {title}</div>
          <div className="text-xl font-bold">{booking.guest_name}</div>
          {booking.company_name && <div className="text-sm opacity-80 mt-0.5">{booking.company_name}</div>}
          <div className={`mt-3 inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full ${statusColors[booking.status] || 'bg-white/20 text-white'}`}>
            {statusLabels[booking.status] || booking.status}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-black" style={{ backgroundColor: '#22c55e', fontSize: '0.55rem' }}>→</span>
                Check-in
              </div>
              <div className="text-sm font-semibold text-gray-800">{formatDateFull(checkin)}</div>
              {daysIn >= 0 && daysIn < 30 && (
                <div className="text-xs text-green-600 mt-0.5">{daysIn === 0 ? 'Heute' : `Vor ${daysIn} Tag${daysIn !== 1 ? 'en' : ''}`}</div>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-black" style={{ backgroundColor: '#ef4444', fontSize: '0.5rem' }}>■</span>
                Check-out
              </div>
              <div className="text-sm font-semibold text-gray-800">{formatDateFull(checkout)}</div>
              {daysOut >= 0 && daysOut < 30 && (
                <div className={`text-xs mt-0.5 ${daysOut === 0 ? 'text-red-600' : daysOut === 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                  {daysOut === 0 ? 'Heute' : daysOut === 1 ? 'Morgen' : `in ${daysOut} Tagen`}
                </div>
              )}
            </div>
          </div>

          {/* Stay progress bar */}
          {booking.nights > 0 && (() => {
            const totalNights = booking.nights;
            const elapsed = daysBetween(checkin, today);
            const percent = Math.max(0, Math.min(100, (elapsed / totalNights) * 100));
            const isOngoing = today >= checkin && today < checkout;
            return (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span className="flex items-center gap-1">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-black" style={{ backgroundColor: '#22c55e', fontSize: '0.55rem' }}>→</span>
                    {fmtDate(checkin)}
                  </span>
                  <span className="font-medium text-gray-500">🌙 {totalNights} Nächte</span>
                  <span className="flex items-center gap-1">
                    {fmtDate(checkout)}
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-black" style={{ backgroundColor: '#ef4444', fontSize: '0.5rem' }}>■</span>
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${percent}%`, background: 'linear-gradient(to right, #22c55e, #2563eb)' }}
                  />
                  {isOngoing && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow"
                      style={{ left: `${percent}%`, border: '2px solid #a855f7' }}
                      title="Heute"
                    />
                  )}
                </div>
                {isOngoing && (
                  <div className="text-center text-xs text-violet-600 font-medium mt-1.5">
                    Tag {Math.max(1, elapsed)} von {totalNights} · noch {Math.max(0, totalNights - elapsed)} Nacht{totalNights - elapsed !== 1 ? 'en' : ''}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Key details */}
          <div className="space-y-2">
            {[
              ['Nächte',       booking.nights ? `${booking.nights} Nächte` : '—'],
              ['Personen',     booking.guest_count ? `${booking.guest_count} Person${booking.guest_count !== 1 ? 'en' : ''}` : '—'],
              ['Gesamtpreis',  formatCurrency(booking.total_price)],
              booking.invoice_number && ['Rechnungsnr.', booking.invoice_number],
              booking.channel && ['Kanal', booking.channel],
              booking.booking_date && ['Buchungsdatum', formatDateFull(booking.booking_date)],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>

          {/* Payment / deposit status */}
          {(booking.payment_status || booking.deposit_taken) && (
            <div className="border-t border-gray-100 pt-3 flex gap-2 flex-wrap">
              {booking.payment_status && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full
                  ${booking.payment_status === 'bezahlt' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  💶 {booking.payment_status}
                </span>
              )}
              {booking.deposit_taken && !booking.deposit_returned && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                  🔒 Kaution hinterlegt{booking.deposit_amount != null ? ` · ${formatCurrency(booking.deposit_amount)}` : ''}
                </span>
              )}
              {booking.deposit_returned && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  ✓ Kaution zurück{booking.deposit_amount != null ? ` · ${formatCurrency(booking.deposit_amount)}` : ''}
                </span>
              )}
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-900">
              <div className="text-xs font-semibold text-amber-600 mb-1">Notiz</div>
              {booking.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── House Status Card ────────────────────────────────────────────────────────

function HouseStatusCard({ house, bookings }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const activeStatuses = ['bestaetigt', 'eingecheckt', 'ausgecheckt'];

  const currentBooking = bookings.find(b =>
    b.house_id === house.id &&
    activeStatuses.includes(b.status) &&
    b.checkin_date?.slice(0, 10) <= today &&
    b.checkout_date?.slice(0, 10) >= today
  );

  // Upcoming inquiry (angefragt) overlapping today or in future
  const inquiryToday = !currentBooking && bookings.find(b =>
    b.house_id === house.id &&
    b.status === 'angefragt' &&
    b.checkin_date?.slice(0, 10) <= today &&
    b.checkout_date?.slice(0, 10) >= today
  );

  const nextBooking = bookings
    .filter(b =>
      b.house_id === house.id &&
      ['bestaetigt', 'eingecheckt'].includes(b.status) &&
      b.checkin_date?.slice(0, 10) > today
    )
    .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date))[0];

  const lastOut = bookings
    .filter(b =>
      b.house_id === house.id &&
      b.checkout_date?.slice(0, 10) < today &&
      activeStatuses.includes(b.status)
    )
    .sort((a, b) => b.checkout_date.localeCompare(a.checkout_date))[0];

  const lastOutTasks  = lastOut ? getBookingTasks(lastOut.id) : null;
  const cleaningDone  = lastOut ? !!(lastOutTasks?.cleaning_done) : true;
  const cleaningOrg   = lastOut ? !!(lastOutTasks?.cleaning_org) : false;
  const occupied    = !!currentBooking;
  const isInquiry   = !!inquiryToday;

  const daysUntilFree = currentBooking
    ? Math.max(0, Math.ceil((new Date(currentBooking.checkout_date) - new Date(today)) / 86400000))
    : 0;
  const daysUntilNext = nextBooking
    ? Math.max(0, Math.ceil((new Date(nextBooking.checkin_date) - new Date(today)) / 86400000))
    : null;

  // ── Progress bar calculation ──
  let progressPct = 0;
  let progressLabel = '';
  if (occupied && currentBooking) {
    const start = new Date(currentBooking.checkin_date);
    const end   = new Date(currentBooking.checkout_date);
    const now   = new Date(today);
    const total = Math.max(1, (end - start) / 86400000);
    const elapsed = Math.max(0, (now - start) / 86400000);
    progressPct = Math.min(100, Math.round((elapsed / total) * 100));
    progressLabel = `${progressPct}% Aufenthalt`;
  } else if (!occupied && nextBooking && lastOut) {
    const lastEnd  = new Date(lastOut.checkout_date);
    const nextStart = new Date(nextBooking.checkin_date);
    const now      = new Date(today);
    const total    = Math.max(1, (nextStart - lastEnd) / 86400000);
    const elapsed  = Math.max(0, (now - lastEnd) / 86400000);
    progressPct = Math.min(100, Math.round((elapsed / total) * 100));
    progressLabel = `Pause ${progressPct}%`;
  } else if (!occupied && nextBooking) {
    progressPct = 0;
    progressLabel = `in ${daysUntilNext} Tag${daysUntilNext !== 1 ? 'en' : ''}`;
  }

  // ── Visual status ──
  let statusLabel, statusIcon, buttonClass;
  if (occupied) {
    statusLabel   = 'Belegt';
    statusIcon    = '🏠';
    buttonClass   = 'bg-red-500 border-white/30 text-white';
  } else if (isInquiry) {
    statusLabel   = 'Angefragt';
    statusIcon    = '❓';
    buttonClass   = 'bg-violet-500 border-white/30 text-white';
  } else if (!cleaningDone && lastOut) {
    statusLabel   = 'Reinigung ausstehend';
    statusIcon    = '🧹';
    buttonClass   = 'bg-amber-400 border-white/30 text-white';
  } else {
    statusLabel   = daysUntilNext !== null
      ? `Frei – Ankunft in ${daysUntilNext === 0 ? 'heute' : daysUntilNext === 1 ? '1 Tag' : `${daysUntilNext} Tagen`}`
      : 'Frei';
    statusIcon    = '✅';
    buttonClass   = 'bg-emerald-500 border-white/30 text-white';
  }

  const activeBooking = currentBooking || inquiryToday;
  // The booking to show in the detail modal: current if occupied, otherwise next
  const detailBooking = activeBooking || nextBooking;
  const detailTitle   = activeBooking ? (occupied ? 'Aktuelle Buchung' : 'Angefragt') : 'Nächste Buchung';

  return (
    <>
    {detailOpen && detailBooking && (
      <BookingDetailModal
        booking={detailBooking}
        house={house}
        title={detailTitle}
        onClose={() => setDetailOpen(false)}
      />
    )}
    <div
      className="rounded-2xl overflow-hidden shadow-md ring-1 ring-gray-200 cursor-pointer hover:ring-blue-300 hover:shadow-lg transition-shadow"
      onClick={() => detailBooking && setDetailOpen(true)}
    >
      {/* Gradient header – always blue */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-5 text-white relative">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-bold tracking-tight">{house.name}</div>
            <div className="text-sm opacity-75 mt-0.5">{house.capacity} Betten</div>
          </div>
          <div className="text-4xl drop-shadow-sm">{statusIcon}</div>
        </div>

        {/* Colored status button */}
        <div className={`mt-3 inline-flex items-center gap-1.5 ${buttonClass} bg-opacity-80 border rounded-full px-4 py-1.5 text-sm font-bold shadow-sm`}>
          {statusLabel}
        </div>

        {/* Dates overlay */}
        {activeBooking ? (
          <div className="absolute bottom-3 right-4 text-xs opacity-80 text-right">
            <div>📅 {formatDateFull(activeBooking.checkin_date)}</div>
            <div>🏁 {formatDateFull(activeBooking.checkout_date)}</div>
          </div>
        ) : nextBooking && (
          <div className="absolute bottom-3 right-4 text-xs opacity-80 text-right">
            <div>📅 Ankunft: {formatDateFull(nextBooking.checkin_date)}</div>
          </div>
        )}
      </div>

      {/* Progress bar with percentage */}
      <div className="relative">
        <div className="h-2 bg-gray-200 w-full">
          <div
            className={`h-full transition-all duration-500
              ${occupied ? 'bg-red-400' : isInquiry ? 'bg-violet-400' : !cleaningDone ? 'bg-amber-400' : 'bg-emerald-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {progressPct > 0 && (
          <span className="absolute right-2 top-[-1px] text-[10px] font-semibold text-gray-400 leading-none" style={{lineHeight:'8px'}}>
            {progressPct}%
          </span>
        )}
      </div>

      {/* Body */}
      <div className="bg-white p-4 space-y-3">
        {occupied && currentBooking ? (
          <>
            <Row label="Gast">
              <span className="text-sm font-semibold text-gray-800 truncate">{currentBooking.guest_name}</span>
            </Row>
            <Row label="Abreise">
              <span className="text-sm font-medium text-red-700">{formatDateFull(currentBooking.checkout_date)}</span>
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
            {!cleaningDone && (
              <Row label="Reinigung">
                <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">⚠ Noch ausstehend</span>
              </Row>
            )}
            {nextBooking && (
              <Row label="Ankunft">
                <span className="text-sm font-medium text-blue-700">{formatDateFull(nextBooking.checkin_date)}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 ml-1 ${daysUntilNext === 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-500'}`}>
                  {daysUntilNext === 0 ? 'Heute' : daysUntilNext === 1 ? 'Morgen' : `in ${daysUntilNext} Tagen`}
                </span>
              </Row>
            )}
          </>
        )}

        {occupied && (
          <div className="border-t border-gray-100 pt-3">
            {nextBooking ? (
              <Row label="Ankunft">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate block">{nextBooking.guest_name}</span>
                  <span className="text-xs text-gray-500">
                    {formatDateFull(nextBooking.checkin_date)}
                    {daysUntilNext === 0 ? ' (Heute)' : daysUntilNext === 1 ? ' (Morgen)' : ` (in ${daysUntilNext} Tagen)`}
                  </span>
                </div>
              </Row>
            ) : (
              <div className="text-xs text-gray-400 italic">Keine weiteren Buchungen geplant</div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}

// ─── Due Date Editor (inline) ────────────────────────────────────────────────

function DueDateCell({ bookingId, taskKey, booking, isDone, onChanged }) {
  const [editing, setEditing] = useState(false);
  const auto    = getTaskDueAuto(taskKey, booking);
  const override = getTaskDueOverride(bookingId, taskKey);
  const effective = override || auto;
  const { label: dueLabel, cls: dueCls } = dueStatus(effective, isDone);

  const handleSave = (val) => {
    setTaskDueOverride(bookingId, taskKey, val || null);
    setEditing(false);
    onChanged?.();
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          type="date"
          defaultValue={effective || ''}
          className="text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          onBlur={e => handleSave(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(e.target.value); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
        />
        {override && (
          <button
            className="text-xs text-gray-400 hover:text-red-500 px-1"
            onClick={() => handleSave(null)}
            title="Zurücksetzen auf automatisch"
          >↺</button>
        )}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 group">
      {dueLabel ? (
        <span className={`text-xs ${dueCls}`}>{dueLabel}{override ? ' ✎' : ''}</span>
      ) : isDone ? null : (
        <span className="text-xs text-gray-300">Kein Datum</span>
      )}
      {!isDone && (
        <button
          className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
          onClick={e => { e.stopPropagation(); setEditing(true); }}
          title="Fälligkeitsdatum bearbeiten"
        >✏️</button>
      )}
    </span>
  );
}

// ─── Task Timeline ────────────────────────────────────────────────────────────

function TaskTimeline({ booking, tasks }) {
  const today = new Date().toISOString().slice(0, 10);

  // Collect task dates for timeline range
  const items = TASK_DEFS.map(t => ({
    ...t,
    isDone: !!tasks[t.key],
    due: getEffectiveDue(t.key, booking),
  }));

  const dates = items.map(i => i.due).filter(Boolean).sort();
  if (dates.length === 0) return null;

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const rangeMs = new Date(maxDate) - new Date(minDate) || 1;

  const getPct = (d) => {
    if (!d) return null;
    const ms = new Date(d) - new Date(minDate);
    return Math.max(0, Math.min(100, (ms / rangeMs) * 100));
  };

  const todayPct = getPct(today);

  return (
    <div className="mt-1">
      <div className="text-xs font-medium text-gray-500 mb-2">📅 Aufgaben-Zeitstrahl</div>
      <div className="relative" style={{ paddingBottom: '36px' }}>
        {/* Base line */}
        <div className="absolute left-0 right-0" style={{ top: '10px', height: '3px', backgroundColor: '#e5e7eb', borderRadius: '2px' }} />

        {/* Today marker */}
        {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
          <div
            className="absolute"
            style={{ left: `${todayPct}%`, top: '2px', width: '2px', height: '18px', backgroundColor: '#3b82f6', transform: 'translateX(-50%)' }}
          >
            <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.55rem', color: '#3b82f6', fontWeight: 700, whiteSpace: 'nowrap' }}>Heute</div>
          </div>
        )}

        {/* Task dots */}
        {items.map((item, idx) => {
          if (!item.due) return null;
          const pct = getPct(item.due);
          const isOverdue = !item.isDone && item.due < today;
          const dotColor = item.isDone ? '#10b981' : isOverdue ? '#ef4444' : item.due === today ? '#f59e0b' : '#94a3b8';
          // Stagger label rows to avoid overlap
          const row = idx % 2;
          return (
            <div key={item.key} className="absolute" style={{ left: `${pct}%`, top: '4px', transform: 'translateX(-50%)' }}>
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%',
                backgroundColor: dotColor,
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '7px',
              }}>
                {item.isDone ? '✓' : ''}
              </div>
              <div style={{
                position: 'absolute',
                top: row === 0 ? '18px' : '30px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.55rem',
                color: dotColor,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                maxWidth: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textAlign: 'center',
              }}>
                {item.icon}
              </div>
            </div>
          );
        })}

        {/* Progress fill */}
        {todayPct !== null && (
          <div
            className="absolute left-0"
            style={{
              top: '10px',
              width: `${Math.min(100, Math.max(0, todayPct))}%`,
              height: '3px',
              backgroundColor: '#3b82f6',
              borderRadius: '2px',
            }}
          />
        )}
      </div>

      {/* Compact legend */}
      <div className="flex gap-3 text-xs text-gray-400 mt-1 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{background:'#10b981'}}></span>Erledigt</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{background:'#ef4444'}}></span>Überfällig</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{background:'#94a3b8'}}></span>Geplant</span>
      </div>
    </div>
  );
}

// ─── Invoice prefix helper ────────────────────────────────────────────────────

function invoicePrefix(booking) {
  const letter = (booking.house_short || '').toLowerCase() || String(booking.house_id || '');
  const year   = new Date().getFullYear();
  return `15${letter}-${year}-`;
}

function parseInvoiceSuffix(fullNum, prefix) {
  if (!fullNum) return '';
  if (fullNum.startsWith(prefix)) return fullNum.slice(prefix.length);
  // fallback: last segment after last dash
  const parts = fullNum.split('-');
  return parts[parts.length - 1] || '';
}

// ─── Single task row (with per-task note) ─────────────────────────────────────

function TaskRow({ task, booking, tasks, today, invoiceNum, setInvoiceNum, onToggle, onRerender, onOpenInvoice }) {
  const isDone    = !!tasks[task.key];
  const dueDate   = getEffectiveDue(task.key, booking);
  const isOverdue = !isDone && dueDate && dueDate < today;

  const [noteOpen, setNoteOpen] = useState(false);
  const [taskNote, setTaskNoteState] = useState(() => getTaskNote(booking.id, task.key));

  const prefix = invoicePrefix(booking);
  const suffix = parseInvoiceSuffix(invoiceNum, prefix);

  const handleSuffixChange = (val) => {
    // Only digits, max 4 chars
    const digits = val.replace(/\D/g, '').slice(0, 4);
    const full = digits ? `${prefix}${digits.padStart(4, '0')}` : '';
    setInvoiceNum(full);
  };

  const handleInvoiceBlur = () => {
    const val = invoiceNum.trim();
    applyInvoiceNumber(booking.id, val).catch(() => {});
  };

  return (
    <div
      className={`rounded-xl ${isDone ? 'bg-emerald-50' : isOverdue ? 'bg-red-50' : 'bg-gray-50'}`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-2.5">
        <input
          type="checkbox"
          checked={isDone}
          onChange={e => onToggle(e, task.key)}
          className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0 mt-0.5"
        />
        <span className="text-base shrink-0 mt-0.5">{task.icon}</span>
        <div className="flex-1 min-w-0">
          <span className={`text-sm block ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
            {task.label}
          </span>

          {/* Invoice number: static prefix + 4-digit input + create button */}
          {task.key === 'invoice' && (
            <div className="space-y-1.5 mt-1" onClick={e => e.stopPropagation()}>
              {/* Number input row */}
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-gray-500 select-none bg-gray-100 border border-gray-200 rounded-l px-1.5 py-0.5 border-r-0 whitespace-nowrap">
                  {prefix}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={suffix}
                  placeholder="0001"
                  className="text-xs border border-gray-200 rounded-r px-1.5 py-0.5 w-14 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono bg-white"
                  onChange={e => handleSuffixChange(e.target.value)}
                  onBlur={handleInvoiceBlur}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {/* Create invoice button */}
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm"
                onClick={e => { e.stopPropagation(); onOpenInvoice?.(); }}
              >
                🧾 Rechnung erstellen
              </button>
            </div>
          )}

          <DueDateCell
            bookingId={booking.id}
            taskKey={task.key}
            booking={booking}
            isDone={isDone}
            onChanged={onRerender}
          />
        </div>

        {/* Note toggle + status indicator */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              noteOpen || taskNote
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
            }`}
            title={noteOpen ? 'Notiz schließen' : 'Notiz hinzufügen'}
            onClick={e => { e.stopPropagation(); setNoteOpen(o => !o); }}
          >
            {taskNote && !noteOpen ? '📝' : '✏️'}
          </button>
          {isDone && <span className="text-xs text-emerald-500 font-bold">✓</span>}
          {isOverdue && <span className="text-xs text-red-500 font-bold">!</span>}
        </div>
      </div>

      {/* Inline note area */}
      {(noteOpen || taskNote) && (
        <div className="px-2.5 pb-2.5" onClick={e => e.stopPropagation()}>
          <textarea
            value={taskNote}
            placeholder="Notiz zu dieser Aufgabe…"
            rows={2}
            autoFocus={noteOpen && !taskNote}
            className={`w-full text-xs border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300
              ${isDone ? 'bg-emerald-50/60 border-emerald-100' : isOverdue ? 'bg-red-50/60 border-red-100' : 'bg-white border-gray-200'}`}
            onChange={e => {
              const v = e.target.value;
              setTaskNoteState(v);
              setTaskNote(booking.id, task.key, v);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Single Booking Task Card ─────────────────────────────────────────────────

function BookingTaskCard({ booking, onTaskChange }) {
  const [tasks, setTasks] = useState(() => getBookingTasks(booking.id));
  const [expanded, setExpanded] = useState(false);
  const [, rerender] = useState(0);
  const [note, setNote] = useState(() => getBookingNote(booking.id));
  const [invoiceNum, setInvoiceNum] = useState(booking.invoice_number || '');
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [invoiceLang, setInvoiceLang] = useState('de');

  const done      = allTasksDone(tasks);
  const doneCount = TASK_DEFS.filter(t => tasks[t.key]).length;
  const pct       = Math.round((doneCount / TASK_DEFS.length) * 100);

  const today    = new Date().toISOString().slice(0, 10);
  const isActive = booking.checkin_date?.slice(0, 10) <= today && booking.checkout_date?.slice(0, 10) >= today;
  const isFuture = booking.checkin_date?.slice(0, 10) > today;

  const overdueCount = TASK_DEFS.filter(t => {
    if (tasks[t.key]) return false;
    const due = getEffectiveDue(t.key, booking);
    return due && due < today;
  }).length;

  const statusLabel = isActive ? 'Aktuell' : isFuture ? 'Bevorstehend' : 'Abgereist';
  const statusColor = isActive
    ? 'bg-blue-100 text-blue-700'
    : isFuture ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-500';

  const borderColor = done
    ? 'border-l-4 border-l-emerald-500'
    : overdueCount > 0 ? 'border-l-4 border-l-red-500'
    : isActive ? 'border-l-4 border-l-blue-500'
    : isFuture ? 'border-l-4 border-l-amber-400'
    : '';

  const toggle = (e, key) => {
    e.stopPropagation();
    const all = loadAllTasks();
    const current = all[booking.id] || {};
    const updated = { ...current, [key]: !current[key] };
    all[booking.id] = updated;
    saveAllTasks(all);
    setTasks(updated);
    onTaskChange?.(booking, key, updated[key], updated);
  };

  return (
    <div className={`card transition-all ${borderColor}`}>
      {/* Header row */}
      <div
        className="flex items-center gap-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* SVG progress circle */}
        <div className="relative w-11 h-11 shrink-0">
          <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={done ? '#10b981' : overdueCount > 0 ? '#ef4444' : isActive ? '#3b82f6' : '#f59e0b'}
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-600">
            {doneCount}/{TASK_DEFS.length}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{booking.guest_name}</span>
            {booking.company_name && (
              <span className="text-xs text-gray-400 truncate">{booking.company_name}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor}`}>
              {statusLabel}
            </span>
            {overdueCount > 0 && !done && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 shrink-0">
                ⚠ {overdueCount} überfällig
              </span>
            )}
            {done && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 shrink-0">
                ✅ Erledigt
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1 font-medium text-gray-600 bg-gray-100 rounded-md px-1.5 py-0.5">
              🏠 {booking.house_name || booking.house_short || `Haus ${booking.house_id}`}
            </span>
            <span className="text-gray-400">
              {new Date(booking.checkin_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
              {' – '}
              {new Date(booking.checkout_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span className="inline-flex items-center gap-1 text-gray-500">
              🌙 {booking.nights} {booking.nights === 1 ? 'Nacht' : 'Nächte'}
            </span>
            <span className="inline-flex items-center gap-1 text-gray-500">
              👤 {booking.guest_count} {booking.guest_count === 1 ? 'Gast' : 'Gäste'}
            </span>
            {booking.channel_name && (
              <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                🌐 {booking.channel_name}
              </span>
            )}
            {booking.total_price > 0 && (
              <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                💶 {formatCurrency(booking.total_price)}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar + expand arrow */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block w-28">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300
                  ${done ? 'bg-emerald-500' : overdueCount > 0 ? 'bg-red-500' : isActive ? 'bg-blue-500' : 'bg-amber-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1 text-right">{pct}%</div>
          </div>
          <span className="text-gray-400 text-xs font-medium">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded task list */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          {/* Task grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TASK_DEFS.map(task => (
              <TaskRow
                key={task.key}
                task={task}
                booking={booking}
                tasks={tasks}
                today={today}
                invoiceNum={invoiceNum}
                setInvoiceNum={setInvoiceNum}
                onToggle={toggle}
                onRerender={() => rerender(n => n + 1)}
                onOpenInvoice={() => {
                  const b = { ...booking, invoice_number: invoiceNum || booking.invoice_number };
                  setInvoicePreview({ ...buildInvoicePreviewData(b, invoiceLang), extra_items: [] });
                }}
              />
            ))}
          </div>

          {/* Notes field */}
          <div className="space-y-1" onClick={e => e.stopPropagation()}>
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1">📝 Notiz zur Buchung</label>
            <textarea
              value={note}
              placeholder="Interne Notizen, besondere Wünsche, Hinweise…"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
              onChange={e => { setNote(e.target.value); setBookingNote(booking.id, e.target.value); }}
            />
          </div>

          {/* Task timeline */}
          <TaskTimeline booking={booking} tasks={tasks} />

          <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
            <span className="text-red-600 font-semibold">● Überfällig</span>
            <span className="text-amber-600 font-medium">● Bald fällig</span>
            <span className="text-gray-400">● Geplant</span>
            <span className="text-gray-300 italic">✏️ = Datum manuell anpassen</span>
          </div>

          {done && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-600 text-lg">🎉</span>
              <span className="text-sm font-semibold text-emerald-700">
                Alle Aufgaben erledigt – Buchung vollständig abgeschlossen!
              </span>
            </div>
          )}
        </div>
      )}

      {/* Invoice preview modal — rendered outside the expanded block so it's always accessible */}
      {invoicePreview && (
        <InvoicePreviewModal
          data={invoicePreview}
          onClose={() => setInvoicePreview(null)}
          onLangChange={(lang) => {
            const b = { ...booking, invoice_number: invoiceNum || booking.invoice_number };
            const fresh = buildInvoicePreviewData(b, lang);
            setInvoiceLang(lang);
            setInvoicePreview(prev => ({
              ...fresh,
              // Keep user edits to address / amounts / extras
              company_name:    prev.company_name,
              guest_name:      prev.guest_name,
              billing_street:  prev.billing_street,
              billing_zip:     prev.billing_zip,
              billing_city:    prev.billing_city,
              billing_country: prev.billing_country,
              invoice_number:  prev.invoice_number,
              invoice_date:    prev.invoice_date,
              brutto_total:    prev.brutto_total,
              netto_total:     prev.netto_total,
              vat_amount:      prev.vat_amount,
              cleaning_fee:    prev.cleaning_fee,
              discount_pct:    prev.discount_pct,
              extra_items:     prev.extra_items,
            }));
          }}
          onChange={(field, value) => setInvoicePreview(prev => ({ ...prev, [field]: value }))}
        />
      )}
    </div>
  );
}

// ─── "Zu Erledigen" Panel ─────────────────────────────────────────────────────

function ZuErledigenpanel({ bookings }) {
  const today = new Date().toISOString().slice(0, 10);
  const [, rerender] = useState(0);

  // Build flat list of all pending tasks with their due dates
  const pendingItems = [];
  bookings.forEach(booking => {
    const tasks = getBookingTasks(booking.id);
    const isActive = booking.checkin_date?.slice(0, 10) <= today && booking.checkout_date?.slice(0, 10) >= today;
    const isFuture = booking.checkin_date?.slice(0, 10) > today;
    const context = isActive ? 'Aktuell' : isFuture ? 'Bevorstehend' : 'Abgereist';

    TASK_DEFS.forEach(td => {
      if (tasks[td.key]) return; // already done
      const due = getEffectiveDue(td.key, booking);
      pendingItems.push({
        bookingId: booking.id,
        booking,
        taskKey: td.key,
        taskIcon: td.icon,
        taskLabel: td.label,
        dueDate: due,
        isOverdue: due && due < today,
        context,
      });
    });

    // Synthetic task: repay deposit once taken but not yet returned
    if (booking.deposit_taken && !booking.deposit_returned) {
      const due = booking.checkout_date?.slice(0, 10);
      pendingItems.push({
        bookingId: booking.id,
        booking,
        taskKey: 'deposit_return',
        taskIcon: '💰',
        taskLabel: `Kaution zurückzahlen${booking.deposit_amount != null ? ` (${formatCurrency(booking.deposit_amount)})` : ''}`,
        dueDate: due,
        isOverdue: due && due < today,
        context,
      });
    }
  });

  // Sort chronologically by due date (null dates at end)
  pendingItems.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  // Group by booking
  const grouped = [];
  const seen = new Set();
  pendingItems.forEach(item => {
    if (!seen.has(item.bookingId)) {
      seen.add(item.bookingId);
      grouped.push({ booking: item.booking, items: [] });
    }
    grouped[grouped.length - 1].items.push(item);
  });
  // Actually re-group: group by booking_id across the sorted list
  const byBooking = {};
  pendingItems.forEach(item => {
    if (!byBooking[item.bookingId]) byBooking[item.bookingId] = { booking: item.booking, items: [] };
    byBooking[item.bookingId].items.push(item);
  });

  if (pendingItems.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">🎉</div>
        <div className="text-lg font-semibold text-emerald-700">Alles erledigt!</div>
        <div className="text-sm text-gray-400 mt-1">Keine offenen Aufgaben in diesem Zeitraum.</div>
      </div>
    );
  }

  // For each item, allow toggling
  const toggle = (booking, key) => {
    if (key === 'deposit_return') {
      api.put(`/bookings/${booking.id}`, { ...booking, deposit_returned: true })
        .then(() => emitDataChange({ type: 'invoice' }));
      return;
    }
    const all = loadAllTasks();
    const current = all[booking.id] || {};
    const updated = { ...current, [key]: !current[key] };
    all[booking.id] = updated;
    saveAllTasks(all);
    // Sync cleaning_done → calendar markers
    if (key === 'cleaning_done' && booking.house_id) {
      const cleanDate = booking.cleaning_date?.slice(0, 10) || booking.checkout_date?.slice(0, 10);
      if (cleanDate) {
        try {
          const markers = JSON.parse(localStorage.getItem('cleaning_markers') || '{}');
          const mk = `${booking.house_id}_${cleanDate}`;
          if (updated[key]) markers[mk] = true; else delete markers[mk];
          localStorage.setItem('cleaning_markers', JSON.stringify(markers));
        } catch (_) {}
      }
    }
    rerender(n => n + 1);
  };

  const overdueCount  = pendingItems.filter(i => i.isOverdue).length;
  const todayCount    = pendingItems.filter(i => i.dueDate === today).length;
  const upcomingCount = pendingItems.filter(i => i.dueDate && i.dueDate > today).length;

  const handleExport = () => {
    const rows = pendingItems.map(item => {
      let details = '';
      if (item.taskKey === 'invoice') {
        details = `Rechnungsnr.: ${item.booking.invoice_number || '—'}`;
      } else if (item.taskKey === 'cleaning_org' || item.taskKey === 'cleaning_done') {
        details = cleaningDetailString(item.booking);
      } else if (item.taskKey === 'deposit_return') {
        details = item.booking.deposit_amount != null ? `Kaution: ${formatCurrency(item.booking.deposit_amount)}` : '';
      }
      const note = getTaskNote(item.bookingId, item.taskKey);
      if (note) details = details ? `${details} · ${note}` : note;
      return {
        date: item.dueDate,
        house: item.booking.house_name || item.booking.house_short,
        guest: item.booking.guest_name,
        task: `${item.taskIcon} ${item.taskLabel}`,
        details,
      };
    });
    exportWorkSchedule(rows);
  };

  return (
    <div className="space-y-4">
      {/* Summary row */}
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
        <button className="btn-secondary text-sm ml-auto" onClick={handleExport}>📄 Arbeitsplan exportieren</button>
      </div>

      {/* Chronological list, grouped by booking */}
      {Object.values(byBooking).map(({ booking, items }) => {
        const isActive = booking.checkin_date?.slice(0, 10) <= today && booking.checkout_date?.slice(0, 10) >= today;
        const isFuture = booking.checkin_date?.slice(0, 10) > today;
        const statusCls = isActive ? 'bg-blue-100 text-blue-700' : isFuture ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500';
        const statusTxt = isActive ? 'Aktuell' : isFuture ? 'Bevorstehend' : 'Abgereist';

        return (
          <div key={booking.id} className="card">
            {/* Booking header */}
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 flex-wrap">
              <div>
                <span className="font-semibold text-gray-800">{booking.guest_name}</span>
                {booking.company_name && <span className="text-xs text-gray-400 ml-2">{booking.company_name}</span>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls}`}>{statusTxt}</span>
              <span className="text-xs text-gray-500 ml-auto">
                {booking.house_short || booking.house_id} ·{' '}
                {fmtDate(booking.checkin_date)} – {fmtDate(booking.checkout_date)}
              </span>
            </div>

            {/* Task items sorted by due date */}
            <div className="space-y-2">
              {items.sort((a, b) => {
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
              }).map(item => {
                const { label: dueLabel, cls: dueCls } = dueStatus(item.dueDate, false);
                return (
                  <div
                    key={item.taskKey}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl
                      ${item.isOverdue ? 'bg-red-50 border border-red-100' : item.dueDate === today ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => toggle(booking, item.taskKey)}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                    />
                    <span className="text-base">{item.taskIcon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-800">{item.taskLabel}</span>
                    </div>
                    <div className="text-right shrink-0">
                      {dueLabel && <div className={`text-xs ${dueCls}`}>{dueLabel}</div>}
                    </div>
                    {item.taskKey !== 'deposit_return' && (
                      <DueDateCell
                        bookingId={booking.id}
                        taskKey={item.taskKey}
                        booking={booking}
                        isDone={false}
                        onChanged={() => rerender(n => n + 1)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TasksPage() {
  const [houses, setHouses]       = useState([]);
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('current');
  const [houseFilter, setHouseFilter] = useState(''); // '' = all houses
  const [tab, setTab]             = useState('tasks'); // 'tasks' | 'todo'
  const [, rerender]              = useState(0);
  const now = useLiveClock();

  const today  = new Date().toISOString().slice(0, 10);
  const past30  = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const next365 = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

  const loadBookings = useCallback(() => {
    Promise.all([
      api.get('/meta/houses'),
      api.get('/bookings', { params: { limit: 500, from: past30, to: next365 } }),
    ]).then(([hRes, bRes]) => {
      setHouses(hRes.data || []);
      const all = (bRes.data?.data || []).filter(b =>
        ['bestaetigt', 'eingecheckt', 'ausgecheckt'].includes(b.status)
      );
      setBookings(all);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    return onDataChange((e) => {
      if (e.detail?.type === 'invoice' || e.detail?.type === 'customer') loadBookings();
    });
  }, [loadBookings]);

  const handleTaskChange = useCallback((booking, key, value) => {
    if (key === 'cleaning_done' && booking.house_id) {
      const cleanDate = booking.cleaning_date?.slice(0, 10) || booking.checkout_date?.slice(0, 10);
      if (cleanDate) {
        try {
          const markers = JSON.parse(localStorage.getItem('cleaning_markers') || '{}');
          const mk = `${booking.house_id}_${cleanDate}`;
          if (value) markers[mk] = true; else delete markers[mk];
          localStorage.setItem('cleaning_markers', JSON.stringify(markers));
        } catch (_) {}
      }
    }
    rerender(n => n + 1);
  }, []);

  const FILTERS = [
    { key: 'current',    label: 'Aktuell',        fn: b => b.checkin_date?.slice(0,10) <= today && b.checkout_date?.slice(0,10) >= today },
    { key: 'upcoming',   label: 'Bevorstehend',    fn: b => b.checkin_date?.slice(0,10) > today },
    { key: 'recent',     label: 'Abgereist',       fn: b => b.checkout_date?.slice(0,10) < today },
    { key: 'overdue',    label: 'Überfällig',      fn: b => {
      const t = getBookingTasks(b.id);
      return TASK_DEFS.some(td => {
        if (t[td.key]) return false;
        const due = getEffectiveDue(td.key, b);
        return due && due < today;
      });
    }},
    { key: 'incomplete', label: 'Offen',           fn: b => !allTasksDone(getBookingTasks(b.id)) },
    { key: 'all',        label: 'Alle (±60 Tage)', fn: () => true },
  ];

  const activeFilter = FILTERS.find(f => f.key === filter);
  const filteredBookings = bookings
    .filter(activeFilter?.fn || (() => true))
    .filter(b => !houseFilter || b.house_id === parseInt(houseFilter))
    .sort((a, b) => {
      const aA = a.checkin_date?.slice(0,10) <= today && a.checkout_date?.slice(0,10) >= today;
      const bA = b.checkin_date?.slice(0,10) <= today && b.checkout_date?.slice(0,10) >= today;
      if (aA !== bA) return aA ? -1 : 1;
      return a.checkin_date?.localeCompare(b.checkin_date) || 0;
    });

  const totalTasks  = bookings.length * TASK_DEFS.length;
  const doneTasks   = bookings.reduce((s, b) => {
    const t = getBookingTasks(b.id);
    return s + TASK_DEFS.filter(td => t[td.key]).length;
  }, 0);
  const completedBookings = bookings.filter(b => allTasksDone(getBookingTasks(b.id))).length;
  const overdueTotal = bookings.reduce((s, b) => {
    const t = getBookingTasks(b.id);
    return s + TASK_DEFS.filter(td => {
      if (t[td.key]) return false;
      const due = getEffectiveDue(td.key, b);
      return due && due < today;
    }).length;
  }, 0);
  const pendingTotal = bookings.reduce((s, b) => {
    const t = getBookingTasks(b.id);
    return s + TASK_DEFS.filter(td => !t[td.key]).length;
  }, 0);

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


      {/* ── House Status ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span>🏠</span> Hausstatus
        </h2>
        {loading ? (
          <div className="text-center text-gray-400 py-8">Wird geladen…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {houses.map(house => (
              <HouseStatusCard key={house.id} house={house} bookings={bookings} />
            ))}
          </div>
        )}
      </section>

      {/* ── Tab navigation ── */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('tasks')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
            ${tab === 'tasks' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          ☑️ Aufgaben je Buchung
        </button>
        <button
          onClick={() => setTab('todo')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5
            ${tab === 'todo' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          📋 Zu Erledigen
          {pendingTotal > 0 && (
            <span className={`text-xs rounded-full px-1.5 font-bold ${tab === 'todo' ? 'bg-blue-600 text-white' : overdueTotal > 0 ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
              {pendingTotal}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab content ── */}
      {tab === 'tasks' && (
        <section>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex gap-1.5 flex-wrap items-center">
              {houses.length > 1 && (
                <select
                  className="form-select text-xs py-1 h-7 border-gray-200 rounded-full"
                  value={houseFilter}
                  onChange={e => setHouseFilter(e.target.value)}
                >
                  <option value="">🏠 Alle Häuser</option>
                  {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              )}
              {FILTERS.map(({ key, label }) => {
                const count = key === 'overdue'
                  ? overdueTotal
                  : key === 'incomplete'
                  ? bookings.filter(b => !allTasksDone(getBookingTasks(b.id))).length
                  : null;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                      ${filter === key
                        ? key === 'overdue' ? 'bg-red-600 text-white shadow-sm' : 'bg-blue-700 text-white shadow-sm'
                        : key === 'overdue' && overdueTotal > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {label}
                    {count !== null && count > 0 && (
                      <span className={`ml-1.5 rounded-full px-1.5 text-xs font-bold
                        ${filter === key ? 'bg-white text-gray-700'
                          : key === 'overdue' ? 'bg-red-500 text-white'
                          : 'bg-amber-400 text-white'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-12">Wird geladen…</div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="text-3xl mb-2">🎉</div>
              <div className="font-medium">Keine Einträge in diesem Bereich</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map(b => (
                <BookingTaskCard
                  key={b.id}
                  booking={b}
                  onTaskChange={handleTaskChange}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'todo' && (
        <section>
          {loading ? (
            <div className="text-center text-gray-400 py-12">Wird geladen…</div>
          ) : (
            <ZuErledigenpanel bookings={bookings} />
          )}
        </section>
      )}
    </div>
  );
}
