import { useState } from 'react';
import { formatCurrency, formatDateFull } from '../utils/format';

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function fmtDate(ds) {
  if (!ds) return '';
  return new Date(ds).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
function getBookingTasksDirect(bookingId) {
  try { return (JSON.parse(localStorage.getItem('booking_tasks') || '{}'))[bookingId] || {}; } catch { return {}; }
}
function loadCleaningDetails() {
  try { return JSON.parse(localStorage.getItem('cleaning_details') || '{}'); } catch { return {}; }
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────
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
      <div className="bg-white rounded-2xl shadow-2xl w-full mx-4" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-t-2xl px-6 py-5 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-xl leading-none">✕</button>
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
              <div className="text-sm font-semibold text-gray-800">{formatDateFull(checkin)}</div>
              {daysIn >= 0 && daysIn < 30 && (
                <div className="text-xs text-green-600 mt-0.5">{daysIn === 0 ? 'Heute' : `Vor ${daysIn} Tag${daysIn !== 1 ? 'en' : ''}`}</div>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Check-out</div>
              <div className="text-sm font-semibold text-gray-800">{formatDateFull(checkout)}</div>
              {daysOut >= 0 && daysOut < 30 && (
                <div className={`text-xs mt-0.5 ${daysOut === 0 ? 'text-red-600' : daysOut === 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                  {daysOut === 0 ? 'Heute' : daysOut === 1 ? 'Morgen' : `in ${daysOut} Tagen`}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {[
              ['Nächte',      booking.nights ? `${booking.nights} Nächte` : '—'],
              ['Personen',    booking.guest_count ? `${booking.guest_count} Person${booking.guest_count !== 1 ? 'en' : ''}` : '—'],
              ['Gesamtpreis', formatCurrency(booking.total_price)],
              booking.channel && ['Kanal', booking.channel],
            ].filter(Boolean).map(([label, value]) => (
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

  const lastOutTasks = lastOut ? getBookingTasksDirect(lastOut.id) : null;
  const cleaningDone = lastOut ? !!(lastOutTasks?.cleaning_done) : true;
  const cleaningOrg  = lastOut ? !!(lastOutTasks?.cleaning_org)  : false;
  const occupied     = !!currentBooking;
  const isInquiry    = !!inquiryToday;

  const daysUntilFree = currentBooking
    ? Math.max(0, Math.ceil((new Date(currentBooking.checkout_date) - new Date(today)) / 86400000))
    : 0;
  const daysUntilNext = nextBooking
    ? Math.max(0, Math.ceil((new Date(nextBooking.checkin_date) - new Date(today)) / 86400000))
    : null;

  let progressPct = 0;
  if (occupied && currentBooking) {
    const start = new Date(currentBooking.checkin_date);
    const end   = new Date(currentBooking.checkout_date);
    const now   = new Date(today);
    const total = Math.max(1, (end - start) / 86400000);
    progressPct = Math.min(100, Math.round(((now - start) / total / 86400000) * 100));
  }

  let statusLabel, statusIcon, buttonClass;
  if (occupied) {
    statusLabel = 'Belegt'; statusIcon = '🏠'; buttonClass = 'bg-red-500 border-white/30 text-white';
  } else if (isInquiry) {
    statusLabel = 'Angefragt'; statusIcon = '❓'; buttonClass = 'bg-violet-500 border-white/30 text-white';
  } else if (!cleaningDone && lastOut) {
    statusLabel = 'Reinigung ausstehend'; statusIcon = '🧹'; buttonClass = 'bg-amber-400 border-white/30 text-white';
  } else {
    statusLabel = daysUntilNext !== null
      ? `Frei – in ${daysUntilNext === 0 ? 'heute' : daysUntilNext === 1 ? '1 Tag' : `${daysUntilNext} Tagen`}`
      : 'Frei';
    statusIcon = '✅'; buttonClass = 'bg-emerald-500 border-white/30 text-white';
  }

  const activeBooking  = currentBooking || inquiryToday;
  const detailBooking  = activeBooking || nextBooking;
  const detailTitle    = activeBooking ? (occupied ? 'Aktuelle Buchung' : 'Angefragt') : 'Nächste Buchung';

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
              <div>📅 {formatDateFull(activeBooking.checkin_date)}</div>
              <div>🏁 {formatDateFull(activeBooking.checkout_date)}</div>
            </div>
          ) : nextBooking && (
            <div className="absolute bottom-3 right-4 text-xs opacity-80 text-right">
              <div>📅 Ankunft: {formatDateFull(nextBooking.checkin_date)}</div>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="h-2 bg-gray-200 w-full">
            <div
              className={`h-full transition-all duration-500 ${occupied ? 'bg-red-400' : isInquiry ? 'bg-violet-400' : !cleaningDone ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-4 space-y-3">
          {occupied && currentBooking ? (
            <>
              <Row label="Gast"><span className="text-sm font-semibold text-gray-800 truncate">{currentBooking.guest_name}</span></Row>
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
              {nextBooking && (
                <Row label="Folgebuchung">
                  <span className="text-xs text-blue-700 font-medium">{nextBooking.guest_name}</span>
                  <span className="text-xs text-gray-400 ml-1">· {fmtDate(nextBooking.checkin_date)}</span>
                  {daysUntilNext !== null && (
                    <span className="text-xs text-blue-400 ml-1">(in {daysUntilNext}d)</span>
                  )}
                </Row>
              )}
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
                  <span className="text-sm font-medium text-blue-700">{formatDateFull(nextBooking.checkin_date)}</span>
                  {daysUntilNext !== null && (
                    <span className={`text-xs rounded-full px-2 py-0.5 ml-1 ${daysUntilNext === 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-500'}`}>
                      {daysUntilNext === 0 ? 'Heute' : daysUntilNext === 1 ? 'Morgen' : `in ${daysUntilNext} Tagen`}
                    </span>
                  )}
                </Row>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function HouseStatusSection({ houses, bookings }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 pt-4 pb-2">
      {houses.map(h => (
        <HouseStatusCard key={h.id} house={h} bookings={bookings} />
      ))}
    </div>
  );
}
