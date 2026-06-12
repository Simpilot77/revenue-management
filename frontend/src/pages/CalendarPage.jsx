import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAY_NAMES = ['So','Mo','Di','Mi','Do','Fr','Sa'];

const STATUS_COLOR = {
  eingecheckt: '#16a34a',
  ausgecheckt: '#9ca3af',
  angefragt:   '#f59e0b',
  bestaetigt:  '#1d4ed8',
  gesperrt:    '#475569', // dark slate – owner block
};
const STATUS_COLOR_DARK = {
  eingecheckt: '#15803d',
  ausgecheckt: '#6b7280',
  angefragt:   '#d97706',
  bestaetigt:  '#1e40af',
  gesperrt:    '#334155',
};
const getColor = (status) => STATUS_COLOR[status] || '#1d4ed8';
const getDarkColor = (status) => STATUS_COLOR_DARK[status] || '#1e40af';

// Row height and bar padding
const ROW_H = 120;  // px — tall enough for all info lines
const BAR_TOP = 5;
const BAR_BOT = 5;

// Detect duplicate bookings: same house overlap OR same guest overlap
function findDuplicates(bookings) {
  const dupeIds = new Set();
  const active = bookings.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      const overlap = a.checkin_date < b.checkout_date && b.checkin_date < a.checkout_date;
      if (!overlap) continue;
      const sameHouse = a.house_id === b.house_id;
      const sameGuest = (a.guest_name || '').toLowerCase().trim() === (b.guest_name || '').toLowerCase().trim() && a.guest_name;
      if (sameHouse || sameGuest) {
        dupeIds.add(a.id);
        dupeIds.add(b.id);
      }
    }
  }
  return dupeIds;
}

// ── Cleaning marker helpers ────────────────────────────────────────────────────
function loadCleaningMarkers() {
  try { return JSON.parse(localStorage.getItem('cleaning_markers') || '{}'); } catch { return {}; }
}
function saveCleaningMarkersToStorage(markers) {
  localStorage.setItem('cleaning_markers', JSON.stringify(markers));
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [houses, setHouses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [cleaningMarkers, setCleaningMarkers] = useState(loadCleaningMarkers);
  const [cleaningModal, setCleaningModal] = useState(null); // { houseId, houseName, date }

  const daysInMonth = getDaysInMonth(year, month);

  useEffect(() => {
    api.get('/meta/houses').then(r => setHouses(r.data));
  }, []);

  useEffect(() => {
    const monthFrom = dateStr(year, month, 1);
    const monthTo = dateStr(year, month, daysInMonth);
    api.get('/bookings', { params: { from: monthFrom, to: monthTo, limit: 300 } })
      .then(r => setBookings(r.data.data));
  }, [year, month]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const isToday = (d) => year === now.getFullYear() && month === now.getMonth() && d === now.getDate();
  const dupeIds = findDuplicates(bookings);

  // Returns cleaning status for a house+date:
  // null       = no cleaning
  // 'done'     = cleaning_done checked (green)
  // 'organized'= cleaning_org checked, not done (yellow)
  // 'planned'  = cleaning date set but neither org nor done (red)
  const getCleaningStatus = useCallback((houseId, ds) => {
    try {
      const tasks = JSON.parse(localStorage.getItem('booking_tasks') || '{}');
      for (const b of bookings) {
        if (b.house_id !== houseId) continue;
        if (b.cleaning_required === false) continue;
        const cd = b.cleaning_date?.slice(0, 10) || b.checkout_date?.slice(0, 10);
        if (cd !== ds) continue;
        const bt = tasks[b.id] || {};
        if (bt.cleaning_done) return 'done';
        if (bt.cleaning_org)  return 'organized';
        return 'planned';
      }
      // Manual marker without task data → treat as planned
      if (cleaningMarkers[`${houseId}_${ds}`]) return 'planned';
      return null;
    } catch {
      if (cleaningMarkers[`${houseId}_${ds}`]) return 'planned';
      return null;
    }
  }, [bookings, cleaningMarkers]);

  // Legacy helper (bool) used for click tooltip and modal
  const isCleaningDay = useCallback((houseId, ds) => {
    return getCleaningStatus(houseId, ds) !== null;
  }, [getCleaningStatus]);

  const toggleCleaning = (houseId, ds) => {
    const key = `${houseId}_${ds}`;
    const updated = { ...cleaningMarkers };
    if (updated[key]) {
      delete updated[key];
    } else {
      updated[key] = true;
    }
    setCleaningMarkers(updated);
    saveCleaningMarkersToStorage(updated);
  };

  const VISIBLE_STATUSES = ['bestaetigt','eingecheckt','ausgecheckt','angefragt','gesperrt'];

  const getCellInfo = (houseId, day) => {
    const d = dateStr(year, month, day);
    const active = bookings.filter(b =>
      b.house_id === houseId &&
      VISIBLE_STATUSES.includes(b.status)
    );
    // Owner blocks take lowest priority – regular bookings shown first
    const checkin  = active.find(b => b.checkin_date?.slice(0,10) === d);
    const checkout = active.find(b => b.checkout_date?.slice(0,10) === d);
    const staying  = active.find(b =>
      b.checkin_date?.slice(0,10) < d && b.checkout_date?.slice(0,10) > d
    );
    return { checkin, checkout, staying };
  };

  const isLabelDay = (booking, day) => {
    const checkinDay = booking.checkin_date?.slice(0,10);
    const monthStart = dateStr(year, month, 1);
    const firstBlue = new Date(checkinDay);
    firstBlue.setDate(firstBlue.getDate() + 1);
    const firstBlueStr = firstBlue.toISOString().slice(0,10);
    if (firstBlueStr >= monthStart) return firstBlueStr === dateStr(year, month, day);
    return day === 1;
  };

  // Multi-line label rendered inside the booking bar — width = actual booking span in pixels
  const BookingLabel = ({ booking, isDupe, spanWidth }) => {
    const isBlock = booking.status === 'gesperrt';
    return (
      <div style={{
        position: 'absolute',
        left: '6px',
        top: '4px',
        width: spanWidth ? `${spanWidth}px` : '280px',
        overflow: 'visible',
        color: 'white',
        zIndex: 10,
        pointerEvents: 'none',
        lineHeight: 1.4,
      }}>
        {isBlock ? (
          <>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
              🔒 Gesperrt
            </div>
            {booking.block_reason && (
              <div style={{ fontSize: '0.6rem', opacity: 0.9, textShadow: '0 1px 2px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
                {booking.block_reason}
              </div>
            )}
            <div style={{ fontSize: '0.58rem', opacity: 0.8, textShadow: '0 1px 2px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
              {booking.nights} {booking.nights === 1 ? 'Nacht' : 'Nächte'}
            </div>
          </>
        ) : (
          <>
            {/* Guest name */}
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.55)', wordBreak: 'break-word' }}>
              {isDupe && <span style={{ backgroundColor: '#f97316', borderRadius: '2px', padding: '0 2px', marginRight: '3px', fontSize: '0.58rem' }}>⚠ Doppelt</span>}
              {booking.guest_name}
            </div>
            {/* Persons + deposit */}
            <div style={{ fontSize: '0.6rem', opacity: 0.92, textShadow: '0 1px 2px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
              👥 {booking.guest_count} {booking.guest_count === 1 ? 'Person' : 'Personen'}
              {booking.deposit_taken && !booking.deposit_returned ? '  🔒 Kaution' : ''}
            </div>
            {/* Total price */}
            <div style={{ fontSize: '0.6rem', opacity: 0.92, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
              💶 {formatCurrency(booking.total_price)}
            </div>
            {/* ADR */}
            {booking.daily_rate > 0 && (
              <div style={{ fontSize: '0.6rem', opacity: 0.9, textShadow: '0 1px 2px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
                ADR {formatCurrency(booking.daily_rate)}
              </div>
            )}
            {/* Invoice number */}
            {booking.invoice_number && (
              <div style={{ fontSize: '0.58rem', opacity: 0.88, fontFamily: 'monospace', textShadow: '0 1px 2px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
                🧾 {booking.invoice_number}
              </div>
            )}
            {/* Guest registration */}
            <div style={{ fontSize: '0.58rem', opacity: 0.88, textShadow: '0 1px 2px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
              {booking.guests_registered ? '✅ Gäste registriert' : '☐ Gäste nicht registriert'}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Belegungs-Kalender</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="btn-secondary py-1 px-3 text-lg">‹</button>
          <span className="font-semibold text-gray-700 w-44 text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="btn-secondary py-1 px-3 text-lg">›</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '96px' }} />
              {days.map(d => <col key={d} style={{ width: '40px' }} />)}
            </colgroup>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-3 font-semibold text-gray-600 sticky left-0 bg-gray-50 z-20">Haus</th>
                {days.map(d => {
                  const dow = new Date(year, month, d).getDay();
                  const weekend = dow === 0 || dow === 6;
                  return (
                    <th
                      key={d}
                      style={{ padding: 0 }}
                      className={`py-2 text-center font-medium ${isToday(d) ? 'text-blue-900' : weekend ? 'bg-gray-100 text-gray-400' : 'text-gray-500'}`}
                    style={isToday(d) ? { backgroundColor: '#bfdbfe', boxShadow: 'inset 0 -2px 0 #3b82f6' } : undefined}
                    >
                      <div className="text-xs font-semibold">{d}</div>
                      <div className="text-gray-300 font-normal" style={{ fontSize: '0.55rem' }}>{DAY_NAMES[dow]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {houses.map((house, hi) => (
                <tr key={house.id} className={hi % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} style={{ height: `${ROW_H}px` }}>
                  <td
                    className="px-3 font-semibold text-gray-700 sticky left-0 bg-inherit z-10 border-r border-gray-100"
                    style={{ verticalAlign: 'middle' }}
                  >
                    <div>{house.name}</div>
                    <div className="text-gray-400 font-normal text-xs">{house.capacity} Betten</div>
                  </td>
                  {days.map(d => {
                    const ds = dateStr(year, month, d);
                    const { checkin, checkout, staying } = getCellInfo(house.id, d);
                    const dow = new Date(year, month, d).getDay();
                    const weekend = dow === 0 || dow === 6;
                    const todayBg = isToday(d) ? 'rgba(96,165,250,0.18)' : weekend ? 'rgba(243,244,246,0.5)' : 'transparent';
                    const todayBorder = isToday(d) ? '2px solid #3b82f6' : undefined;
                    const cleaningStatus = getCleaningStatus(house.id, ds);
                    const cleaning = cleaningStatus !== null;

                    return (
                      <td
                        key={d}
                        style={{
                          padding: 0,
                          position: 'relative',
                          verticalAlign: 'middle',
                          background: todayBg,
                          borderLeft: todayBorder || '1px solid #f3f4f6',
                          borderRight: todayBorder,
                          overflow: 'visible',
                          cursor: 'pointer',
                        }}
                        title={cleaning ? `🧹 Reinigung am ${ds} – klicken zum Entfernen` : `${ds} – klicken zum Markieren als Reinigungstag`}
                        onClick={() => setCleaningModal({ houseId: house.id, houseName: house.name, date: ds, alreadySet: cleaning })}
                      >
                        <div style={{ position: 'relative', height: `${ROW_H}px`, overflow: 'visible' }}>

                          {/* Cleaning day background overlay — color by status */}
                          {cleaning && (() => {
                            const bgMap = { planned: 'rgba(239,68,68,0.15)', organized: 'rgba(251,191,36,0.22)', done: 'rgba(34,197,94,0.18)' };
                            const bdMap = { planned: '#ef4444', organized: '#f59e0b', done: '#22c55e' };
                            return (
                              <div style={{
                                position: 'absolute',
                                top: 0, bottom: 0, left: 0, right: 0,
                                backgroundColor: bgMap[cleaningStatus],
                                borderTop: `2px solid ${bdMap[cleaningStatus]}`,
                                zIndex: 1,
                                pointerEvents: 'none',
                              }} />
                            );
                          })()}

                          {/* MID-STAY — full-width bar */}
                          {staying && (() => {
                            const isLabel = isLabelDay(staying, d);
                            const coDay = parseInt(staying.checkout_date?.slice(8, 10)) || days[days.length - 1];
                            const spanEnd = Math.min(days[days.length - 1], coDay - 1);
                            const spanDays = Math.max(1, spanEnd - (isLabel ? d : 0) + 1);
                            const labelWidth = spanDays * 40 - 6;
                            return (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: BAR_TOP, bottom: BAR_BOT,
                                  left: -1, right: 0,
                                  backgroundColor: getColor(staying.status),
                                  cursor: 'pointer',
                                  zIndex: isLabel ? 5 : 2,
                                  overflow: 'visible',
                                }}
                                title={`${staying.guest_name} · ${staying.guest_count}P · ${formatCurrency(staying.total_price)}`}
                                onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${staying.id}/edit`); }}
                              >
                                {isLabel && (
                                  <BookingLabel booking={staying} isDupe={dupeIds.has(staying.id)} spanWidth={labelWidth} />
                                )}
                              </div>
                            );
                          })()}

                          {/* CHECKOUT — \ diagonal: red upper-left, transparent lower-right */}
                          {checkout && (
                            <div
                              style={{
                                position: 'absolute',
                                top: BAR_TOP, bottom: BAR_BOT,
                                left: -1, right: 0,
                                background: 'linear-gradient(to bottom right, #ef4444 50%, transparent 50%)',
                                cursor: 'pointer',
                                zIndex: 3,
                              }}
                              title={`Abreise: ${checkout.guest_name}`}
                              onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${checkout.id}/edit`); }}
                            >
                              {dupeIds.has(checkout.id) && (
                                <div style={{ position: 'absolute', top: 2, right: 2, fontSize: '0.5rem', background: '#f97316', color: 'white', borderRadius: '2px', padding: '0 2px', zIndex: 15 }}>⚠</div>
                              )}
                            </div>
                          )}

                          {/* CHECKIN — green lower-right triangle */}
                          {checkin && (
                            <div
                              style={{
                                position: 'absolute',
                                top: BAR_TOP, bottom: BAR_BOT,
                                left: 0, right: 0,
                                background: 'linear-gradient(to top left, #22c55e 50%, transparent 50%)',
                                cursor: 'pointer',
                                zIndex: 3,
                              }}
                              title={`${checkin.guest_name} · ${checkin.guest_count}P · ${formatCurrency(checkin.total_price)}`}
                              onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${checkin.id}/edit`); }}
                            />
                          )}

                          {/* Cleaning badge — color by status */}
                          {cleaning && (() => {
                            const styles = {
                              planned:    { bg: '#fee2e2', border: '#ef4444', color: '#7f1d1d', label: '🧹 Geplant' },
                              organized:  { bg: '#fef3c7', border: '#f59e0b', color: '#78350f', label: '🧹 Organisiert' },
                              done:       { bg: '#dcfce7', border: '#22c55e', color: '#14532d', label: '🧹 Erledigt' },
                            };
                            const s = styles[cleaningStatus] || styles.planned;
                            return (
                              <div style={{
                                position: 'absolute',
                                top: 4, left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 15,
                                pointerEvents: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                backgroundColor: s.bg,
                                border: `1.5px solid ${s.border}`,
                                borderRadius: '10px',
                                padding: '2px 7px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: s.color,
                                whiteSpace: 'nowrap',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                              }}>
                                {s.label}
                              </div>
                            );
                          })()}

                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 text-xs text-gray-500 flex-wrap items-center">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#1d4ed8' }}></span> Bestätigt</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#16a34a' }}></span> Eingecheckt</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#9ca3af' }}></span> Ausgecheckt</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#f59e0b' }}></span> Angefragt</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#475569' }}></span> 🔒 Eigentümer gesperrt</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: 'rgba(239,68,68,0.3)', border: '1px solid #ef4444' }}></span> 🧹 Geplant</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: 'rgba(251,191,36,0.4)', border: '1px solid #f59e0b' }}></span> 🧹 Organisiert</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: 'rgba(34,197,94,0.3)', border: '1px solid #22c55e' }}></span> 🧹 Erledigt</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#bfdbfe', border: '1px solid #3b82f6' }}></span> Heute</span>
        <span className="text-gray-400 ml-3">◁ = Abreise &nbsp;|&nbsp; ▷ = Anreise &nbsp;|&nbsp; Leere Zelle klicken = Reinigung markieren</span>
      </div>

      {/* ── Mini overview calendars, one per house ── */}
      <MiniOverview houses={houses} navigate={navigate} cleaningMarkers={cleaningMarkers} />

      {/* ── Cleaning Modal ── */}
      {cleaningModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setCleaningModal(null)}
        >
          <div
            className="card"
            style={{ minWidth: '320px', maxWidth: '400px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              🧹 Reinigung – {cleaningModal.houseName}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {cleaningModal.date}
            </p>
            {cleaningModal.alreadySet ? (
              <>
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                  Dieser Tag ist bereits als Reinigungstag markiert.
                </p>
                <div className="flex gap-3 justify-end">
                  <button className="btn-secondary text-sm" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                  <button
                    className="btn-primary text-sm bg-red-600 hover:bg-red-700"
                    onClick={() => { toggleCleaning(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null); }}
                  >
                    🗑 Markierung entfernen
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Soll dieser Tag als Reinigungstag markiert werden? Er wird dann orange im Kalender hervorgehoben.
                </p>
                <div className="flex gap-3 justify-end">
                  <button className="btn-secondary text-sm" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                  <button
                    className="btn-primary text-sm"
                    style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
                    onClick={() => { toggleCleaning(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null); }}
                  >
                    🧹 Als Reinigungstag markieren
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini multi-month grid calendar per house ──────────────────────────────────

const MINI_DAY_NAMES_SHORT = ['M','D','M','D','F','S','S']; // Mon-Sun

function toMonthValue(y, m) {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
function fromMonthValue(val) {
  const [y, m] = val.split('-');
  return { y: parseInt(y), m: parseInt(m) - 1 };
}

function MiniOverview({ houses, navigate, cleaningMarkers }) {
  const now = new Date();
  const [fromVal, setFromVal] = useState(toMonthValue(now.getFullYear(), now.getMonth()));
  const [toVal, setToVal]   = useState(toMonthValue(now.getFullYear(), Math.min(now.getMonth() + 5, 11)));
  const [allBookings, setAllBookings] = useState([]);

  const fromParsed = fromMonthValue(fromVal);
  const toParsed   = fromMonthValue(toVal);

  // Build list of months between from and to
  const months = [];
  let cy = fromParsed.y, cm = fromParsed.m;
  while (cy < toParsed.y || (cy === toParsed.y && cm <= toParsed.m)) {
    months.push({ y: cy, m: cm });
    cm++;
    if (cm > 11) { cm = 0; cy++; }
    if (months.length > 24) break;
  }

  useEffect(() => {
    if (!months.length) return;
    const first = months[0];
    const last  = months[months.length - 1];
    const from = dateStr(first.y, first.m, 1);
    const to   = dateStr(last.y,  last.m,  getDaysInMonth(last.y, last.m));
    api.get('/bookings', { params: { from, to, limit: 500 } })
      .then(r => setAllBookings(r.data.data || []));
  }, [fromVal, toVal]);

  return (
    <div className="space-y-3" id="mini-overview-print">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-gray-700">Belegungsübersicht je Haus</h2>
        <div className="flex items-center gap-2 text-sm">
          <button
            className="no-print btn btn-secondary text-xs py-1 px-3"
            onClick={() => window.print()}
          >PDF exportieren</button>
          <label className="text-gray-500 text-xs">Von</label>
          <input
            type="month"
            className="form-select text-sm py-1 px-2"
            value={fromVal}
            onChange={e => setFromVal(e.target.value)}
          />
          <label className="text-gray-500 text-xs">Bis</label>
          <input
            type="month"
            className="form-select text-sm py-1 px-2"
            value={toVal}
            onChange={e => setToVal(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {houses.map(house => (
          <HouseMiniCal
            key={house.id}
            house={house}
            months={months}
            bookings={allBookings.filter(b => b.house_id === house.id && ['bestaetigt','eingecheckt','ausgecheckt','angefragt','gesperrt'].includes(b.status))}
            navigate={navigate}
            cleaningMarkers={cleaningMarkers}
          />
        ))}
      </div>
    </div>
  );
}

function HouseMiniCal({ house, months, bookings, navigate, cleaningMarkers }) {
  return (
    <div className="card p-4 space-y-4">
      <div className="font-semibold text-gray-800 text-sm">{house.name} <span className="text-gray-400 font-normal text-xs">· {house.capacity} Betten</span></div>
      <div className="space-y-4">
        {months.map(({ y, m }) => (
          <MiniMonth key={`${y}-${m}`} year={y} month={m} bookings={bookings} navigate={navigate} houseId={house.id} cleaningMarkers={cleaningMarkers} />
        ))}
      </div>
    </div>
  );
}

function MiniMonth({ year, month, bookings, navigate, houseId, cleaningMarkers }) {
  const dim = getDaysInMonth(year, month);
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;

  const occ = {};
  bookings.forEach(b => {
    const ci = b.checkin_date?.slice(0, 10);
    const co = b.checkout_date?.slice(0, 10);
    if (!ci || !co) return;
    let cur = new Date(ci);
    const end = new Date(co);
    while (cur < end) {
      occ[cur.toISOString().slice(0, 10)] = b;
      cur.setDate(cur.getDate() + 1);
    }
    occ[co] = occ[co] || { _checkoutOnly: true, ...b };
  });

  // Build cleaning set for this house+month
  // Sources: booking.cleaning_date (if cleaning_required), cleaning_markers, booking_tasks.cleaning_done
  const cleaningDays = new Set();
  let taskStore = {};
  try { taskStore = JSON.parse(localStorage.getItem('booking_tasks') || '{}'); } catch {}
  bookings.forEach(b => {
    if (b.cleaning_required === false) return;
    const cd = b.cleaning_date?.slice(0, 10);
    if (!cd) return;
    // Show if planned OR if done via task
    const bt = taskStore[b.id] || {};
    if (cd || bt.cleaning_done) cleaningDays.add(cd);
  });
  Object.keys(cleaningMarkers).forEach(key => {
    if (key.startsWith(`${houseId}_`)) {
      cleaningDays.add(key.slice(`${houseId}_`.length));
    }
  });

  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 mb-1">
        {MONTH_NAMES[month]} {year}
      </div>
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {MINI_DAY_NAMES_SHORT.map((d, i) => (
              <th key={i} className="text-center font-normal text-gray-300 pb-0.5" style={{ fontSize: '0.55rem', width: '14.28%' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (!day) return <td key={di} />;
                const d = dateStr(year, month, day);
                const booking = occ[d];
                const isCheckin  = booking && booking.checkin_date?.slice(0,10) === d;
                const isCheckout = booking && booking.checkout_date?.slice(0,10) === d;
                const isMid      = booking && !isCheckin && !isCheckout;
                const isToday    = d === today;
                const isCleaning = cleaningDays.has(d);
                const color = booking ? getColor(booking.status) : null;

                return (
                  <td
                    key={di}
                    style={{
                      padding: '1px',
                      height: '18px',
                      position: 'relative',
                      cursor: booking ? 'pointer' : 'default',
                      backgroundColor: isCleaning ? '#fef9c3' : undefined,
                    }}
                    title={
                      isCleaning
                        ? `🧹 Reinigung · ${d}`
                        : booking
                          ? `${booking.guest_name} · ${booking.checkin_date?.slice(0,10)} → ${booking.checkout_date?.slice(0,10)}`
                          : undefined
                    }
                    onClick={() => booking && navigate(`/bookings/${booking.id}/edit`)}
                  >
                    {/* Day number */}
                    <div style={{
                      position: 'relative',
                      height: '16px',
                      borderRadius: isMid ? 0 : isCheckin ? '0 3px 3px 0' : '3px 0 0 3px',
                      overflow: 'hidden',
                      outline: isToday ? '2px solid #3b82f6' : isCleaning ? '1.5px solid #f59e0b' : 'none',
                      backgroundColor: isToday && !isMid ? '#bfdbfe' : undefined,
                      outlineOffset: '-1px',
                    }}>
                      {isMid && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: color }} />
                      )}
                      {isCheckin && (
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top left, #22c55e 50%, transparent 50%)' }} />
                      )}
                      {isCheckout && (
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, #ef4444 50%, transparent 50%)' }} />
                      )}
                      <div style={{
                        position: 'relative',
                        zIndex: 1,
                        textAlign: 'center',
                        fontSize: '0.6rem',
                        lineHeight: '16px',
                        fontWeight: isToday ? 700 : 400,
                        color: isMid ? 'rgba(255,255,255,0.9)' : isToday ? '#1d4ed8' : isCleaning ? '#b45309' : '#6b7280',
                      }}>
                        {isCleaning && !isMid ? '🧹' : isMid && booking?.daily_rate > 0 ? Math.round(booking.daily_rate) : day}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
