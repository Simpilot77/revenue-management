import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDateFull } from '../utils/format';
import { emitDataChange, onDataChange } from '../utils/syncBus';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function fmtDateShort(ds) {
  if (!ds) return '';
  return new Date(ds).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAY_NAMES_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];

const STATUS_META = {
  eingecheckt: { bg: '#16a34a', light: '#dcfce7', text: '#14532d', label: 'Eingecheckt' },
  ausgecheckt: { bg: '#6b7280', light: '#f3f4f6', text: '#374151', label: 'Ausgecheckt' },
  angefragt:   { bg: '#d97706', light: '#fef3c7', text: '#78350f', label: 'Angefragt'   },
  bestaetigt:  { bg: '#2563eb', light: '#dbeafe', text: '#1e3a8a', label: 'Bestätigt'   },
  gesperrt:    { bg: '#475569', light: '#f1f5f9', text: '#1e293b', label: 'Gesperrt'    },
};
const getColor = (status) => (STATUS_META[status] || STATUS_META.bestaetigt).bg;

function findDuplicates(bookings) {
  const dupeIds = new Set();
  const active = bookings.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      const overlap = a.checkin_date < b.checkout_date && b.checkin_date < a.checkout_date;
      if (!overlap) continue;
      if (a.house_id === b.house_id || ((a.guest_name||'').toLowerCase().trim() === (b.guest_name||'').toLowerCase().trim() && a.guest_name)) {
        dupeIds.add(a.id); dupeIds.add(b.id);
      }
    }
  }
  return dupeIds;
}

function loadCleaningMarkers() {
  try { return JSON.parse(localStorage.getItem('cleaning_markers') || '{}'); } catch { return {}; }
}
function saveCleaningMarkersToStorage(m) { localStorage.setItem('cleaning_markers', JSON.stringify(m)); }

function loadCleaningExclusions() {
  try { return JSON.parse(localStorage.getItem('cleaning_exclusions') || '{}'); } catch { return {}; }
}
function saveCleaningExclusionsToStorage(m) { localStorage.setItem('cleaning_exclusions', JSON.stringify(m)); }

function loadCleaningDetails() {
  try { return JSON.parse(localStorage.getItem('cleaning_details') || '{}'); } catch { return {}; }
}
function saveCleaningDetailsToStorage(m) { localStorage.setItem('cleaning_details', JSON.stringify(m)); }

const DEFAULT_CLEANING_DETAILS = { scope: 'reinigung', windows: false, deadlineTime: '', durationMin: '', cost: '', notes: '', cleanerConfirmed: false };
const CLEANING_SCOPE_LABELS = { grund: 'Grundreinigung', reinigung: 'Zwischenreinigung', bettwaesche: 'Bettwäsche-Wechsel' };

// ── DAY_COL_W: pixel width of each day column
const DAY_COL_W = 38;
const ROW_H = 56; // px, height of each house row
const HOUSE_COL_W = 130; // sticky left column

// ─────────────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [houses, setHouses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [cleaningMarkers, setCleaningMarkers] = useState(loadCleaningMarkers);
  const [cleaningModal, setCleaningModal] = useState(null);
  const [cleaningExclusions, setCleaningExclusions] = useState(loadCleaningExclusions);
  const [cleaningDetailsMap, setCleaningDetailsMap] = useState(loadCleaningDetails);
  const [cleaningForm, setCleaningForm] = useState(DEFAULT_CLEANING_DETAILS);
  const [tasksVersion, setTasksVersion] = useState(0);
  const [tooltip, setTooltip] = useState(null); // { booking, x, y }
  const [readinessPopup, setReadinessPopup] = useState(null); // { booking, items, rect }
  const containerRef = useRef(null);

  const daysInMonth = getDaysInMonth(year, month);

  useEffect(() => { api.get('/meta/houses').then(r => setHouses(r.data)); }, []);

  useEffect(() => {
    const from = dateStr(year, month, 1);
    const to   = dateStr(year, month, daysInMonth);
    api.get('/bookings', { params: { from, to, limit: 300 } }).then(r => setBookings(r.data.data));
  }, [year, month]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };
  const goToday   = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const isToday = (d) => year === now.getFullYear() && month === now.getMonth() && d === now.getDate();
  const dupeIds = findDuplicates(bookings);

  const getCleaningStatus = useCallback((houseId, ds) => {
    const key = `${houseId}_${ds}`;
    try {
      if (!cleaningExclusions[key]) {
        const tasks = JSON.parse(localStorage.getItem('booking_tasks') || '{}');
        for (const b of bookings) {
          if (b.house_id !== houseId) continue;
          if (b.cleaning_required === false) continue;
          const cd = b.cleaning_date?.slice(0,10) || b.checkout_date?.slice(0,10);
          if (cd !== ds) continue;
          const bt = tasks[b.id] || {};
          if (bt.cleaning_done) return { status: 'done', bookingId: b.id };
          if (bt.cleaning_org)  return { status: 'organized', bookingId: b.id };
          return { status: 'planned', bookingId: b.id };
        }
      }
    } catch {}
    if (cleaningMarkers[key]) return { status: 'planned', bookingId: null };
    return null;
  }, [bookings, cleaningMarkers, cleaningExclusions, tasksVersion]);

  // Open pre-check-in items for a booking: communication tasks (own checklist) plus the
  // cleaning that takes place before this booking's check-in (same house, date = check-in date).
  const getPreCheckinOpenItems = useCallback((b) => {
    const open = [];
    let tasks = {};
    try { tasks = JSON.parse(localStorage.getItem('booking_tasks') || '{}')[b.id] || {}; } catch {}
    if (!tasks.welcome) open.push('✉️ Willkommensnachricht');
    if (!tasks.pin)     open.push('🔑 PIN-Code übermittelt und aktiviert');
    if (!tasks.guests)  open.push('👥 Gästeregistrierung vollständig');

    const ci = b.checkin_date?.slice(0, 10);
    const cs = getCleaningStatus(b.house_id, ci);
    if (cs) {
      if (cs.status !== 'done') {
        open.push('🧹 Reinigung abgeschlossen');
      } else {
        const details = cleaningDetailsMap[`${b.house_id}_${ci}`];
        if (!details?.cleanerConfirmed) open.push('✅ Reinigungskraft bestätigt');
      }
    }
    return open;
  }, [getCleaningStatus, cleaningDetailsMap]);

  // Returns the booking id whose checkout/cleaning cleaning indicator was completely
  // removed (excluded) for this cell, so the modal can offer to restore it
  const getExcludedBookingCleaning = useCallback((houseId, ds) => {
    const key = `${houseId}_${ds}`;
    if (!cleaningExclusions[key]) return null;
    const b = bookings.find(b =>
      b.house_id === houseId && b.cleaning_required !== false &&
      (b.cleaning_date?.slice(0,10) || b.checkout_date?.slice(0,10)) === ds
    );
    return b ? b.id : null;
  }, [bookings, cleaningExclusions]);

  const toggleCleaning = (houseId, ds) => {
    const key = `${houseId}_${ds}`;
    const updated = { ...cleaningMarkers };
    if (updated[key]) delete updated[key]; else updated[key] = true;
    setCleaningMarkers(updated);
    saveCleaningMarkersToStorage(updated);
    setTasksVersion(v => v + 1);
    emitDataChange({ type: 'cleaning' });
  };

  const excludeBookingCleaning = (houseId, ds) => {
    const key = `${houseId}_${ds}`;
    const updated = { ...cleaningExclusions, [key]: true };
    setCleaningExclusions(updated);
    saveCleaningExclusionsToStorage(updated);
    setTasksVersion(v => v + 1);
    emitDataChange({ type: 'cleaning' });
  };

  const restoreBookingCleaning = (houseId, ds) => {
    const key = `${houseId}_${ds}`;
    const updated = { ...cleaningExclusions };
    delete updated[key];
    setCleaningExclusions(updated);
    saveCleaningExclusionsToStorage(updated);
    setTasksVersion(v => v + 1);
    emitDataChange({ type: 'cleaning' });
  };

  // Sets the cleaning_org/cleaning_done flags on a booking's task entry
  // (used when the cleaning indicator is driven by a booking rather than a manual marker)
  const setBookingCleaningFlags = (bookingId, { org, done }) => {
    try {
      const tasks = JSON.parse(localStorage.getItem('booking_tasks') || '{}');
      tasks[bookingId] = { ...(tasks[bookingId] || {}), cleaning_org: org, cleaning_done: done };
      localStorage.setItem('booking_tasks', JSON.stringify(tasks));
    } catch {}
    setTasksVersion(v => v + 1);
    emitDataChange({ type: 'cleaning' });
  };

  // Re-evaluate cleaning state when other pages (e.g. Reinigungsmanagement, Aufgaben) change it
  useEffect(() => {
    return onDataChange((e) => {
      if (e.detail?.type === 'cleaning') {
        setCleaningMarkers(loadCleaningMarkers());
        setCleaningExclusions(loadCleaningExclusions());
        setCleaningDetailsMap(loadCleaningDetails());
        setTasksVersion(v => v + 1);
      }
    });
  }, []);

  const saveCleaningDetails = (houseId, ds, details) => {
    const key = `${houseId}_${ds}`;
    const updated = { ...cleaningDetailsMap, [key]: details };
    setCleaningDetailsMap(updated);
    saveCleaningDetailsToStorage(updated);
    emitDataChange({ type: 'cleaning' });
  };

  // Opens the cleaning modal and pre-fills the detail form from any saved cleaning_details
  const openCleaningModal = (args) => {
    const key = `${args.houseId}_${args.date}`;
    setCleaningForm({ ...DEFAULT_CLEANING_DETAILS, ...(cleaningDetailsMap[key] || {}) });
    setCleaningModal(args);
  };

  const VISIBLE = ['bestaetigt','eingecheckt','ausgecheckt','angefragt','gesperrt'];

  // Build booking segments: one segment per booking visible this month
  const buildSegments = (houseId) => {
    const monthStart = dateStr(year, month, 1);
    const monthEnd   = dateStr(year, month, daysInMonth);
    return bookings
      .filter(b => b.house_id === houseId && VISIBLE.includes(b.status))
      .filter(b => b.checkin_date?.slice(0,10) <= monthEnd && b.checkout_date?.slice(0,10) > monthStart)
      .map(b => {
        const ciDay = b.checkin_date?.slice(0,10) >= monthStart
          ? parseInt(b.checkin_date.slice(8,10))
          : 1;
        const coDay = b.checkout_date?.slice(0,10) <= monthEnd
          ? parseInt(b.checkout_date.slice(8,10))
          : daysInMonth + 1;
        const clippedLeft  = b.checkin_date?.slice(0,10) < monthStart;
        const clippedRight = b.checkout_date?.slice(0,10) > monthEnd;
        const spanDays = coDay - ciDay; // checkout day is exclusive (half-cell)
        return { booking: b, ciDay, coDay, clippedLeft, clippedRight, spanDays };
      });
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* ── Top bar ── */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Belegungskalender</h1>
          <p className="text-xs text-gray-400 mt-0.5">Übersicht aller Häuser · Klick auf Buchung öffnet Details</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="btn-secondary text-sm py-1.5 px-4">Heute</button>
          <button onClick={prevMonth} className="btn-secondary py-1.5 px-3 text-base">‹</button>
          <span className="font-semibold text-gray-800 w-44 text-center text-sm">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="btn-secondary py-1.5 px-3 text-base">›</button>
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="flex-1 overflow-auto px-6 py-4" ref={containerRef}>
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
          <div style={{ overflowX: 'auto' }}>
            {/* min-width prevents shrinking below needed width */}
            <div style={{ minWidth: `${HOUSE_COL_W + DAY_COL_W * daysInMonth}px` }}>

              {/* ── Header row ── */}
              <div
                className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20"
                style={{ height: 52 }}
              >
                {/* House label */}
                <div
                  className="shrink-0 flex items-end px-4 pb-2 border-r border-gray-200 bg-gray-50 sticky left-0 z-30"
                  style={{ width: HOUSE_COL_W, minWidth: HOUSE_COL_W }}
                >
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Haus</span>
                </div>
                {/* Day columns */}
                {days.map(d => {
                  const dow = new Date(year, month, d).getDay();
                  const isWe = dow === 0 || dow === 6;
                  const today = isToday(d);
                  return (
                    <div
                      key={d}
                      style={{
                        width: DAY_COL_W, minWidth: DAY_COL_W,
                        ...(today ? { backgroundColor: '#a855f7', boxShadow: '0 0 14px 2px rgba(168,85,247,0.6)' } : {}),
                      }}
                      className={`shrink-0 flex flex-col items-center justify-end pb-1.5 relative
                        ${today ? '' : isWe ? 'bg-gray-100/60' : ''}`}
                    >
                      <span className={`relative z-1 text-xs font-bold leading-none
                        ${today ? 'text-white' : isWe ? 'text-gray-400' : 'text-gray-500'}`}>
                        {d}
                      </span>
                      <span className={`relative z-1 mt-0.5 leading-none
                        ${today ? 'text-violet-100' : 'text-gray-300'}`}
                        style={{ fontSize: '0.6rem' }}>
                        {DAY_NAMES_SHORT[dow]}
                      </span>
                      {today && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-700" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── House rows ── */}
              {houses.map((house, hi) => {
                const segments = buildSegments(house.id);
                return (
                  <div
                    key={house.id}
                    className={`flex border-b border-gray-100 relative ${hi % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                    style={{ height: ROW_H }}
                  >
                    {/* Sticky house label */}
                    <div
                      className={`shrink-0 flex flex-col justify-center px-4 border-r border-gray-200 sticky left-0 z-10 ${hi % 2 === 0 ? 'bg-white' : 'bg-gray-50/90'}`}
                      style={{ width: HOUSE_COL_W, minWidth: HOUSE_COL_W }}
                    >
                      <span className="text-sm font-semibold text-gray-800 leading-tight">{house.name}</span>
                      <span className="text-xs text-gray-400 mt-0.5">{house.capacity} Betten</span>
                    </div>

                    {/* Day cells — background only (grid lines + today highlight + cleaning) */}
                    <div className="relative flex flex-1" style={{ height: ROW_H }}>
                      {days.map(d => {
                        const ds = dateStr(year, month, d);
                        const dow = new Date(year, month, d).getDay();
                        const isWe = dow === 0 || dow === 6;
                        const today = isToday(d);
                        const cs = getCleaningStatus(house.id, ds);
                        const excludedBookingId = !cs ? getExcludedBookingCleaning(house.id, ds) : null;
                        return (
                          <div
                            key={d}
                            style={{
                              width: DAY_COL_W, minWidth: DAY_COL_W, position: 'relative', flexShrink: 0,
                              ...(today ? { backgroundColor: 'rgba(168,85,247,0.16)', boxShadow: 'inset 0 0 0 1px rgba(168,85,247,0.5)' } : {}),
                            }}
                            className={`border-r border-gray-100 cursor-pointer
                              ${today ? '' : isWe ? 'bg-gray-100/30' : ''}`}
                            title={cs ? `🧹 Reinigung (${cs.status}) – klicken` : excludedBookingId ? 'Reinigung entfernt – klicken zum Wiederherstellen' : 'Klicken = Reinigungstag markieren'}
                            onClick={() => openCleaningModal({ houseId: house.id, houseName: house.name, date: ds, alreadySet: cs !== null, status: cs?.status, bookingId: cs?.bookingId ?? null, excludedBookingId })}
                          >
                            {today && <div className="absolute top-0 bottom-0 left-0 w-1 bg-violet-500" />}
                            {cs && (
                              <div
                                style={{
                                  position: 'absolute', top: 2, right: 2,
                                  width: 14, height: 14, borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.6rem', zIndex: 6, cursor: 'pointer', pointerEvents: 'auto',
                                  backgroundColor: cs.status === 'done' ? '#dcfce7' : cs.status === 'organized' ? '#fef3c7' : '#fee2e2',
                                  border: `1.5px solid ${cs.status === 'done' ? '#22c55e' : cs.status === 'organized' ? '#f59e0b' : '#ef4444'}`,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                                }}
                                title={`🧹 Reinigung (${cs.status}) – klicken`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCleaningModal({ houseId: house.id, houseName: house.name, date: ds, alreadySet: true, status: cs.status, bookingId: cs.bookingId, excludedBookingId: null });
                                }}
                              >
                                🧹
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Booking bars — absolutely positioned over the day cells */}
                      {segments.map(({ booking: b, ciDay, coDay, clippedLeft, clippedRight, spanDays }) => {
                        const meta = STATUS_META[b.status] || STATUS_META.bestaetigt;
                        const isDupe = dupeIds.has(b.id);
                        const barLeft  = (ciDay - 1) * DAY_COL_W + (clippedLeft ? 0 : DAY_COL_W * 0.25);
                        // checkout is exclusive; bar ends at left edge of checkout day
                        const barRight = (coDay - 1) * DAY_COL_W - (clippedRight ? 0 : DAY_COL_W * 0.25);
                        const barWidth = Math.max(8, barRight - barLeft);
                        const barTop    = ROW_H * 0.16;
                        const barHeight = ROW_H * 0.68;

                        // Checkin/checkout diagonal triangles
                        const checkinTriangle  = !clippedLeft;
                        const checkoutTriangle = !clippedRight;

                        const isBlock = b.status === 'gesperrt';

                        return (
                          <div
                            key={b.id}
                            style={{
                              position: 'absolute',
                              left: barLeft,
                              top: barTop,
                              width: barWidth,
                              height: barHeight,
                              backgroundColor: meta.bg,
                              borderRadius: `${checkinTriangle ? 6 : 0}px ${checkoutTriangle ? 6 : 0}px ${checkoutTriangle ? 6 : 0}px ${checkinTriangle ? 6 : 0}px`,
                              cursor: 'pointer',
                              zIndex: 5,
                              overflow: 'hidden',
                              boxShadow: isDupe ? `0 0 0 2px #f97316, 0 1px 3px rgba(0,0,0,0.18)` : '0 1px 2px rgba(0,0,0,0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: checkinTriangle ? 14 : 8,
                              paddingRight: checkoutTriangle ? 14 : 8,
                              transition: 'filter 0.1s, box-shadow 0.1s',
                            }}
                            className="hover:brightness-110"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltip({ booking: b, rect });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${b.id}/edit`); }}
                          >
                            {/* Check-in marker — traffic-light arrow: green = bereit, gelb = offene Punkte */}
                            {checkinTriangle && !isBlock && (() => {
                              const openItems = getPreCheckinOpenItems(b);
                              const ready = openItems.length === 0;
                              return (
                                <div
                                  style={{
                                    position: 'absolute', left: -7, top: '50%', transform: 'translateY(-50%)',
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: ready ? '#22c55e' : '#f59e0b', border: '2px solid white',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.6rem', color: 'white', fontWeight: 900,
                                    zIndex: 7, pointerEvents: 'auto', cursor: 'pointer',
                                  }}
                                  title={ready ? '✅ Check-in bereit' : `⚠️ Offene Punkte:\n${openItems.join('\n')}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setReadinessPopup({ booking: b, items: openItems, rect });
                                  }}
                                >→</div>
                              );
                            })()}
                            {checkinTriangle && isBlock && (
                              <div
                                style={{
                                  position: 'absolute', left: -7, top: '50%', transform: 'translateY(-50%)',
                                  width: 16, height: 16, borderRadius: '50%',
                                  background: '#22c55e', border: '2px solid white',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.6rem', color: 'white', fontWeight: 900,
                                  zIndex: 7, pointerEvents: 'none',
                                }}
                              >→</div>
                            )}
                            {/* Check-out marker — small red dot on the bar's right edge */}
                            {checkoutTriangle && (
                              <div
                                style={{
                                  position: 'absolute', right: -7, top: '50%', transform: 'translateY(-50%)',
                                  width: 16, height: 16, borderRadius: '50%',
                                  background: '#ef4444', border: '2px solid white',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.55rem', color: 'white', fontWeight: 900,
                                  zIndex: 7, pointerEvents: 'none',
                                }}
                              >■</div>
                            )}

                            {/* Text content — guest name only, details on hover */}
                            <div style={{
                              overflow: 'hidden',
                              color: 'white',
                              flex: 1,
                              minWidth: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}>
                              {isDupe && (
                                <span style={{ fontSize: '0.65rem', flexShrink: 0 }}>⚠️</span>
                              )}
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 600,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                                lineHeight: 1.2,
                              }}>
                                {isBlock ? '🔒 Gesperrt' : b.guest_name}
                              </span>
                              {!isBlock && barWidth > 70 && (
                                <span style={{
                                  fontSize: '0.65rem', opacity: 0.85, flexShrink: 0,
                                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                }}>
                                  👥{b.guest_count}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
          {Object.entries(STATUS_META).map(([k, m]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: m.bg }} />
              {m.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block bg-red-200 border border-red-400" />
            🧹 Reinigung geplant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block bg-amber-200 border border-amber-400" />
            🧹 Organisiert
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block bg-green-200 border border-green-400" />
            🧹 Erledigt
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#a855f7', boxShadow: '0 0 6px 1px rgba(168,85,247,0.7)' }} />
            Heute
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-black" style={{ backgroundColor: '#22c55e', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.35)', fontSize: '0.5rem' }}>→</span>
            Check-in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-black" style={{ backgroundColor: '#ef4444', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.35)', fontSize: '0.5rem' }}>■</span>
            Check-out
          </span>
          <span className="text-gray-400 ml-2">· Leere Zelle klicken = Reinigung markieren</span>
        </div>

        {/* ── Mini overview section ── */}
        <MiniOverview houses={houses} navigate={navigate} cleaningMarkers={cleaningMarkers} />
      </div>

      {/* ── Booking hover tooltip ── */}
      {tooltip && (() => {
        const b = tooltip.booking;
        const meta = STATUS_META[b.status] || STATUS_META.bestaetigt;
        const rect = tooltip.rect;
        const width = 250;
        let left = rect.left;
        if (left + width > window.innerWidth - 16) left = Math.max(8, window.innerWidth - width - 16);
        let top = rect.bottom + 8;
        const estHeight = 200;
        if (top + estHeight > window.innerHeight) top = Math.max(8, rect.top - estHeight - 8);
        const isBlock = b.status === 'gesperrt';
        return (
          <div
            style={{ position: 'fixed', left, top, width, zIndex: 2000, pointerEvents: 'none' }}
            className="rounded-xl bg-white shadow-2xl border border-gray-200 p-3.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-semibold text-sm text-gray-900 truncate">
                {isBlock ? '🔒 Gesperrt' : (b.guest_name || '—')}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                style={{ backgroundColor: meta.light, color: meta.text }}
              >
                {meta.label}
              </span>
            </div>
            {b.company_name && (
              <div className="text-gray-400 mb-1.5 truncate">{b.company_name}</div>
            )}
            {isBlock ? (
              b.block_reason && <div className="text-gray-600">{b.block_reason}</div>
            ) : (
              <>
                <div className="flex items-center justify-between text-gray-600 mb-1.5">
                  <span>📅 {formatDateFull(b.checkin_date)} → {formatDateFull(b.checkout_date)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg py-1.5 mb-1.5">
                  <div>
                    <div className="font-semibold text-gray-800">🌙 {b.nights}</div>
                    <div className="text-[10px] text-gray-400">Nächte</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">👥 {b.guest_count}</div>
                    <div className="text-[10px] text-gray-400">Gäste</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">💶 {formatCurrency(b.total_price)}</div>
                    <div className="text-[10px] text-gray-400">Gesamt</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-gray-400 text-[11px]">
                  <span>{b.channel || '—'}</span>
                  {b.invoice_number && <span>#{b.invoice_number}</span>}
                </div>
              </>
            )}
            <div className="text-center text-[10px] text-gray-300 mt-2 pt-1.5 border-t border-gray-100">Klicken zum Bearbeiten</div>
          </div>
        );
      })()}

      {/* ── Check-in-Ampel: offene Punkte ── */}
      {readinessPopup && (() => {
        const rect = readinessPopup.rect;
        const width = 260;
        let left = rect.left;
        if (left + width > window.innerWidth - 16) left = Math.max(8, window.innerWidth - width - 16);
        let top = rect.bottom + 8;
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 2100 }}
            onClick={() => setReadinessPopup(null)}
          >
            <div
              style={{ position: 'fixed', left, top, width, zIndex: 2101 }}
              className="rounded-xl bg-white shadow-2xl border border-gray-200 p-3.5 text-xs"
              onClick={e => e.stopPropagation()}
            >
              <div className="font-semibold text-sm text-gray-900 mb-2">
                {readinessPopup.items.length === 0 ? '✅ Check-in bereit' : '⚠️ Offene Punkte vor Check-in'}
              </div>
              <div className="text-gray-500 mb-2 truncate">{readinessPopup.booking.guest_name}</div>
              {readinessPopup.items.length > 0 ? (
                <ul className="space-y-1 mb-2 list-disc list-inside text-gray-700">
                  {readinessPopup.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              ) : (
                <div className="text-gray-500 mb-2">Alle Vor-Check-in-Aufgaben sind erledigt.</div>
              )}
              <button
                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                onClick={() => { navigate(`/bookings/${readinessPopup.booking.id}/edit`); setReadinessPopup(null); }}
              >
                Zur Buchung →
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Cleaning Modal ── */}
      {cleaningModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setCleaningModal(null)}
        >
          <div className="card" style={{ minWidth: 340, maxWidth: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">🧹 Reinigung – {cleaningModal.houseName}</h3>
            <p className="text-sm text-gray-500 mb-4">{cleaningModal.date}</p>

            {cleaningModal.alreadySet && cleaningModal.bookingId && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                Reinigung zum Checkout dieser Buchung – Status: {{ planned: 'Geplant', organized: 'Organisiert', done: 'Erledigt' }[cleaningModal.status] || cleaningModal.status}
              </p>
            )}
            {cleaningModal.alreadySet && !cleaningModal.bookingId && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">Bereits als Reinigungstag markiert.</p>
            )}
            {!cleaningModal.alreadySet && cleaningModal.excludedBookingId && (
              <p className="text-sm text-gray-600 mb-4">Die Reinigung zum Checkout dieser Buchung wurde entfernt.</p>
            )}
            {!cleaningModal.alreadySet && !cleaningModal.excludedBookingId && (
              <p className="text-sm text-gray-600 mb-4">Soll dieser Tag als Reinigungstag markiert werden?</p>
            )}

            {/* ── Detail-Formular ── */}
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Uhrzeit (Deadline)</label>
                  <input type="time" className="form-input w-full text-sm"
                    value={cleaningForm.deadlineTime}
                    onChange={e => setCleaningForm(f => ({ ...f, deadlineTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Umfang</label>
                  <select className="form-input w-full text-sm"
                    value={cleaningForm.scope}
                    onChange={e => setCleaningForm(f => ({ ...f, scope: e.target.value }))}>
                    <option value="grund">Grundreinigung</option>
                    <option value="reinigung">Zwischenreinigung</option>
                    <option value="bettwaesche">Bettwäsche-Wechsel</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dauer (Minuten)</label>
                  <input type="number" min="0" className="form-input w-full text-sm"
                    value={cleaningForm.durationMin}
                    onChange={e => setCleaningForm(f => ({ ...f, durationMin: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kosten (€)</label>
                  <input type="number" min="0" step="0.01" className="form-input w-full text-sm"
                    value={cleaningForm.cost}
                    onChange={e => setCleaningForm(f => ({ ...f, cost: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={cleaningForm.windows}
                  onChange={e => setCleaningForm(f => ({ ...f, windows: e.target.checked }))} />
                🪟 Fenster putzen
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!cleaningForm.cleanerConfirmed}
                  onChange={e => setCleaningForm(f => ({ ...f, cleanerConfirmed: e.target.checked }))} />
                ✅ Reinigungskraft bestätigt
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notizen</label>
                <textarea className="form-input w-full text-sm" rows={2}
                  value={cleaningForm.notes}
                  onChange={e => setCleaningForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {cleaningModal.alreadySet && cleaningModal.bookingId ? (
              <div className="flex flex-wrap gap-2 justify-end">
                <button className="btn-secondary text-sm" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                <button className="btn-secondary text-sm" onClick={() => { saveCleaningDetails(cleaningModal.houseId, cleaningModal.date, cleaningForm); setCleaningModal(null); }}>💾 Speichern</button>
                {cleaningModal.status !== 'planned' && (
                  <button className="btn-secondary text-sm" onClick={() => { saveCleaningDetails(cleaningModal.houseId, cleaningModal.date, cleaningForm); setBookingCleaningFlags(cleaningModal.bookingId, { org: false, done: false }); setCleaningModal(null); }}>↺ Zurücksetzen</button>
                )}
                {cleaningModal.status === 'planned' && (
                  <button className="btn-primary text-sm" style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }} onClick={() => { saveCleaningDetails(cleaningModal.houseId, cleaningModal.date, cleaningForm); setBookingCleaningFlags(cleaningModal.bookingId, { org: true, done: false }); setCleaningModal(null); }}>📋 Als organisiert markieren</button>
                )}
                {cleaningModal.status !== 'done' && (
                  <button className="btn-primary text-sm bg-green-600 hover:bg-green-700" onClick={() => { saveCleaningDetails(cleaningModal.houseId, cleaningModal.date, cleaningForm); setBookingCleaningFlags(cleaningModal.bookingId, { org: true, done: true }); setCleaningModal(null); }}>✅ Als erledigt markieren</button>
                )}
                <button className="btn-primary text-sm bg-red-600 hover:bg-red-700" onClick={() => { excludeBookingCleaning(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null); }}>🗑 Komplett löschen</button>
              </div>
            ) : cleaningModal.alreadySet ? (
              <div className="flex flex-wrap gap-2 justify-end">
                <button className="btn-secondary text-sm" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                <button className="btn-secondary text-sm" onClick={() => { saveCleaningDetails(cleaningModal.houseId, cleaningModal.date, cleaningForm); setCleaningModal(null); }}>💾 Speichern</button>
                <button className="btn-primary text-sm bg-red-600 hover:bg-red-700" onClick={() => { toggleCleaning(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null); }}>🗑 Komplett löschen</button>
              </div>
            ) : cleaningModal.excludedBookingId ? (
              <div className="flex flex-wrap gap-2 justify-end">
                <button className="btn-secondary text-sm" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                <button className="btn-primary text-sm" style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }} onClick={() => { saveCleaningDetails(cleaningModal.houseId, cleaningModal.date, cleaningForm); restoreBookingCleaning(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null); }}>🔁 Wiederherstellen</button>
                <button className="btn-primary text-sm bg-green-600 hover:bg-green-700" onClick={() => { saveCleaningDetails(cleaningModal.houseId, cleaningModal.date, cleaningForm); toggleCleaning(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null); }}>🧹 Neu anlegen</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-end">
                <button className="btn-secondary text-sm" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                <button className="btn-primary text-sm" style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }} onClick={() => { saveCleaningDetails(cleaningModal.houseId, cleaningModal.date, cleaningForm); toggleCleaning(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null); }}>🧹 Reinigungstag markieren</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini overview ─────────────────────────────────────────────────────────────
const MINI_DAY_NAMES_SHORT = ['M','D','M','D','F','S','S'];

function toMonthValue(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }
function fromMonthValue(val) { const [y, m] = val.split('-'); return { y: parseInt(y), m: parseInt(m) - 1 }; }

function MiniOverview({ houses, navigate, cleaningMarkers }) {
  const now = new Date();
  const [fromVal, setFromVal] = useState(toMonthValue(now.getFullYear(), now.getMonth()));
  const [toVal,   setToVal]   = useState(toMonthValue(now.getFullYear(), Math.min(now.getMonth() + 5, 11)));
  const [allBookings, setAllBookings] = useState([]);

  const fromParsed = fromMonthValue(fromVal);
  const toParsed   = fromMonthValue(toVal);

  const months = [];
  let cy = fromParsed.y, cm = fromParsed.m;
  while (cy < toParsed.y || (cy === toParsed.y && cm <= toParsed.m)) {
    months.push({ y: cy, m: cm });
    cm++; if (cm > 11) { cm = 0; cy++; }
    if (months.length > 24) break;
  }

  useEffect(() => {
    if (!months.length) return;
    const first = months[0], last = months[months.length - 1];
    const from = dateStr(first.y, first.m, 1);
    const to   = dateStr(last.y, last.m, getDaysInMonth(last.y, last.m));
    api.get('/bookings', { params: { from, to, limit: 500 } }).then(r => setAllBookings(r.data.data || []));
  }, [fromVal, toVal]);

  return (
    <div className="mt-6 space-y-4" id="mini-overview-print">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Monatsübersicht je Haus</h2>
        <div className="flex items-center gap-2 text-sm">
          <button className="no-print btn btn-secondary text-xs py-1 px-3" onClick={() => window.print()}>PDF exportieren</button>
          <label className="text-gray-400 text-xs">Von</label>
          <input type="month" className="form-select text-sm py-1 px-2" value={fromVal} onChange={e => setFromVal(e.target.value)} />
          <label className="text-gray-400 text-xs">Bis</label>
          <input type="month" className="form-select text-sm py-1 px-2" value={toVal} onChange={e => setToVal(e.target.value)} />
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
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4 shadow-sm">
      <div className="font-semibold text-gray-800 text-sm">{house.name}
        <span className="text-gray-400 font-normal text-xs ml-1">· {house.capacity} Betten</span>
      </div>
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
    const ci = b.checkin_date?.slice(0,10), co = b.checkout_date?.slice(0,10);
    if (!ci || !co) return;
    let cur = new Date(ci), end = new Date(co);
    while (cur < end) { occ[cur.toISOString().slice(0,10)] = b; cur.setDate(cur.getDate() + 1); }
    occ[co] = occ[co] || { _checkoutOnly: true, ...b };
  });

  const cleaningDays = new Set();
  let taskStore = {};
  try { taskStore = JSON.parse(localStorage.getItem('booking_tasks') || '{}'); } catch {}
  bookings.forEach(b => {
    if (b.cleaning_required === false) return;
    const cd = b.cleaning_date?.slice(0,10);
    if (cd) cleaningDays.add(cd);
  });
  Object.keys(cleaningMarkers).forEach(key => {
    if (key.startsWith(`${houseId}_`)) cleaningDays.add(key.slice(`${houseId}_`.length));
  });

  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const today = new Date().toISOString().slice(0,10);

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 mb-1">{MONTH_NAMES[month]} {year}</div>
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
                const isCurrentDay = d === today;
                const isCleaning = cleaningDays.has(d);
                const color = booking ? getColor(booking.status) : null;
                return (
                  <td key={di} style={{ padding: '1px', height: 18, position: 'relative', cursor: booking ? 'pointer' : 'default', backgroundColor: isCleaning ? '#fef9c3' : undefined }}
                    title={isCleaning ? `🧹 Reinigung · ${d}` : booking ? `${booking.guest_name} · ${booking.checkin_date?.slice(0,10)} → ${booking.checkout_date?.slice(0,10)}` : undefined}
                    onClick={() => booking && navigate(`/bookings/${booking.id}/edit`)}
                  >
                    <div style={{
                      position: 'relative', height: 16,
                      borderRadius: isMid ? 0 : isCheckin ? '0 3px 3px 0' : '3px 0 0 3px',
                      overflow: 'hidden',
                      outline: isCurrentDay ? '2px solid #a855f7' : isCleaning ? '1.5px solid #f59e0b' : 'none',
                      outlineOffset: '-1px',
                      boxShadow: isCurrentDay ? '0 0 8px 1px rgba(168,85,247,0.7)' : 'none',
                    }}>
                      {isMid && <div style={{ position: 'absolute', inset: 0, backgroundColor: color }} />}
                      {isCheckin && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top left, #22c55e 50%, transparent 50%)' }} />}
                      {isCheckout && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, #ef4444 50%, transparent 50%)' }} />}
                      {isCurrentDay && !isMid && <div style={{ position: 'absolute', inset: 0, backgroundColor: '#a855f7', opacity: 0.25 }} />}
                      <div style={{
                        position: 'relative', zIndex: 1, textAlign: 'center',
                        fontSize: '0.6rem', lineHeight: '16px',
                        fontWeight: isCurrentDay ? 700 : 400,
                        color: isMid ? 'rgba(255,255,255,0.9)' : isCurrentDay ? '#7e22ce' : isCleaning ? '#b45309' : '#6b7280',
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
