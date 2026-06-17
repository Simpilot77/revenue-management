'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

// ── helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function dateStr(y: number, m: number, d: number) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` }
function fmtDateShort(ds: string) { if (!ds) return ''; return new Date(ds).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' }) }
function fmtCurrency(n: number) { return new Intl.NumberFormat('de-DE',{ style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(n??0) }

const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const DAY_NAMES_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa']
const STATUS_META: Record<string,{bg:string,light:string,text:string,label:string}> = {
  eingecheckt: { bg:'#16a34a', light:'#dcfce7', text:'#14532d', label:'Eingecheckt' },
  ausgecheckt:  { bg:'#6b7280', light:'#f3f4f6', text:'#374151', label:'Ausgecheckt' },
  angefragt:    { bg:'#d97706', light:'#fef3c7', text:'#78350f', label:'Angefragt'   },
  bestaetigt:   { bg:'#2563eb', light:'#dbeafe', text:'#1e3a8a', label:'Bestätigt'   },
  gesperrt:     { bg:'#475569', light:'#f1f5f9', text:'#1e293b', label:'Gesperrt'    },
  no_show:      { bg:'#ea580c', light:'#fff7ed', text:'#7c2d12', label:'No-Show'     },
  storniert:    { bg:'#d1d5db', light:'#f9fafb', text:'#9ca3af', label:'Storniert'   },
}
const getColor = (status: string) => (STATUS_META[status] || STATUS_META.bestaetigt).bg

const DAY_COL_W = 38
const ROW_H = 56
const HOUSE_COL_W = 130
const VISIBLE_STATUSES = ['bestaetigt','eingecheckt','ausgecheckt','angefragt','gesperrt']

const DEFAULT_CLEANING_FORM = { scope:'reinigung', windows:false, deadlineTime:'', durationMin:'', cost:'', notes:'', cleanerConfirmed:false }

function findDuplicates(bookings: any[]) {
  const dupeIds = new Set<number>()
  const active = bookings.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status))
  for (let i = 0; i < active.length; i++) {
    for (let j = i+1; j < active.length; j++) {
      const a = active[i], b = active[j]
      const overlap = a.checkin_date < b.checkout_date && b.checkin_date < a.checkout_date
      if (!overlap) continue
      if (a.house_id === b.house_id || ((a.guest_name||'').toLowerCase().trim() === (b.guest_name||'').toLowerCase().trim() && a.guest_name)) {
        dupeIds.add(a.id); dupeIds.add(b.id)
      }
    }
  }
  return dupeIds
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [houses, setHouses]     = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  // cleaning state
  const [markers, setMarkers]     = useState<any[]>([])   // cleaning_markers rows
  const [exclusions, setExclusions] = useState<Set<number>>(new Set()) // excluded booking_ids
  const [details, setDetails]     = useState<Record<number,any>>({}) // bookingId → detail row
  const [tasks, setTasks]         = useState<Record<number,any>>({}) // bookingId → booking_tasks row
  const [extraTasks, setExtraTasks] = useState<Record<string,any>>({}) // date → task row
  const [extraTaskTemplates, setExtraTaskTemplates] = useState<string[]>([])

  // UI state
  const [tooltip, setTooltip]               = useState<any>(null)
  const [readinessPopup, setReadinessPopup] = useState<any>(null)
  const [bookingActionPopup, setBookingActionPopup] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm]   = useState<any>(null)
  const [cleaningModal, setCleaningModal]   = useState<any>(null)
  const [cleaningForm, setCleaningForm]     = useState<any>(DEFAULT_CLEANING_FORM)
  const [extraTaskModal, setExtraTaskModal] = useState<any>(null)
  const [extraTaskInput, setExtraTaskInput] = useState('')
  const [extraTaskAssignee, setExtraTaskAssignee] = useState('')
  const [extraTaskDone, setExtraTaskDone]   = useState(false)

  const daysInMonth = getDaysInMonth(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const isToday = (d: number) => year === now.getFullYear() && month === now.getMonth() && d === now.getDate()

  const prevMonth = () => { if (month===0){setYear(y=>y-1);setMonth(11)} else setMonth(m=>m-1) }
  const nextMonth = () => { if (month===11){setYear(y=>y+1);setMonth(0)} else setMonth(m=>m+1) }
  const goToday   = () => { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  // load all data for current month
  useEffect(() => {
    setLoading(true)
    const from = dateStr(year, month, 1)
    const to   = dateStr(year, month, daysInMonth)

    Promise.all([
      fetch('/api/houses').then(r => r.json()),
      fetch(`/api/bookings?from=${from}&to=${to}&limit=300`).then(r => r.json()),
      fetch(`/api/cleaning-markers?from=${from}&to=${to}`).then(r => r.json()),
      fetch('/api/cleaning-exclusions').then(r => r.json()),
      fetch(`/api/calendar-extra-tasks?from=${from}&to=${to}`).then(r => r.json()),
      fetch('/api/extra-task-templates').then(r => r.json()),
    ]).then(([h, b, m, ex, et, tpl]) => {
      const housesData = h.data ?? h
      const bookingsData = b.data ?? []
      setHouses(housesData)
      setBookings(bookingsData)
      setMarkers(Array.isArray(m) ? m : [])
      const excSet = new Set<number>((Array.isArray(ex) ? ex : []).map((e:any) => e.booking_id).filter(Boolean))
      setExclusions(excSet)
      const etMap: Record<string,any> = {}
      ;(Array.isArray(et) ? et : []).forEach((t:any) => { etMap[t.task_date] = t })
      setExtraTasks(etMap)
      setExtraTaskTemplates((Array.isArray(tpl) ? tpl : []).map((t:any) => t.title).filter(Boolean))

      // load booking tasks for visible bookings
      if (bookingsData.length > 0) {
        const ids = bookingsData.map((b:any) => b.id).join(',')
        fetch(`/api/booking-tasks?ids=${ids}`).then(r => r.json()).then(bt => {
          const taskMap: Record<number,any> = {}
          ;(Array.isArray(bt) ? bt : []).forEach((t:any) => { taskMap[t.booking_id] = t })
          setTasks(taskMap)
        })
        // load cleaning details for bookings
        fetch(`/api/cleaning-details`).then(r => r.json()).then(cd => {
          const detailMap: Record<number,any> = {}
          ;(Array.isArray(cd) ? cd : []).forEach((d:any) => { detailMap[d.booking_id] = d })
          setDetails(detailMap)
        })
      }
      setLoading(false)
    })
  }, [year, month])

  // Build lookup: house_id + marker_date → marker row (for manual markers without booking)
  const markersByKey = useCallback(() => {
    const map: Record<string,any> = {}
    markers.forEach(m => {
      if (m.house_id && m.marker_date) map[`${m.house_id}_${m.marker_date}`] = m
    })
    return map
  }, [markers])

  const getCleaningStatus = useCallback((houseId: number, ds: string): { status: string; bookingId: number|null; markerId?: number } | null => {
    for (const b of bookings) {
      if (b.house_id !== houseId) continue
      if (b.cleaning_required === false) continue
      const cd = (b.cleaning_date || b.checkout_date)?.slice(0, 10)
      if (cd !== ds) continue
      if (exclusions.has(b.id)) continue
      const t = tasks[b.id] || {}
      if (t.cleaning_done) return { status:'done', bookingId:b.id }
      if (t.cleaning_org)  return { status:'organized', bookingId:b.id }
      return { status:'planned', bookingId:b.id }
    }
    const mkey = `${houseId}_${ds}`
    const mm = markersByKey()[mkey]
    if (mm) return { status: mm.done ? 'done' : 'planned', bookingId: null, markerId: mm.id }
    return null
  }, [bookings, exclusions, tasks, markersByKey])

  const getPreCheckinOpenItems = useCallback((b: any) => {
    const open: string[] = []
    const t = tasks[b.id] || {}
    if (!t.welcome) open.push('✉️ Willkommensnachricht')
    if (!t.pin)     open.push('🔑 PIN-Code übermittelt')
    if (!t.guests_reg_done) open.push('👥 Gästeregistrierung')
    const ci = b.checkin_date?.slice(0, 10)
    const cs = getCleaningStatus(b.house_id, ci)
    if (cs && cs.status !== 'done') open.push('🧹 Reinigung abgeschlossen')
    return open
  }, [tasks, getCleaningStatus])

  const getExcludedBookingForDate = useCallback((houseId: number, ds: string) => {
    return bookings.find(b => b.house_id === houseId && exclusions.has(b.id) && (b.cleaning_date || b.checkout_date)?.slice(0,10) === ds)
  }, [bookings, exclusions])

  // ── Mutations ──
  const updateTask = async (bookingId: number, patch: Record<string, boolean>) => {
    await fetch(`/api/booking-tasks/${bookingId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch) })
    setTasks(prev => ({ ...prev, [bookingId]: { ...(prev[bookingId]||{}), ...patch } }))
  }

  const addCleaningMarker = async (houseId: number, ds: string) => {
    const res = await fetch('/api/cleaning-markers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ house_id:houseId, marker_date:ds }) })
    const row = await res.json()
    setMarkers(prev => [...prev.filter(m => !(m.house_id===houseId && m.marker_date===ds)), row])
  }

  const removeCleaningMarker = async (houseId: number, ds: string) => {
    const existing = markersByKey()[`${houseId}_${ds}`]
    if (!existing) return
    await fetch(`/api/cleaning-markers?id=${existing.id}`, { method:'DELETE' })
    setMarkers(prev => prev.filter(m => m.id !== existing.id))
  }

  const excludeBooking = async (bookingId: number) => {
    await fetch('/api/cleaning-exclusions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ booking_id:bookingId }) })
    setExclusions(prev => new Set([...prev, bookingId]))
  }

  const restoreBooking = async (bookingId: number) => {
    await fetch(`/api/cleaning-exclusions?booking_id=${bookingId}`, { method:'DELETE' })
    setExclusions(prev => { const s = new Set(prev); s.delete(bookingId); return s })
  }

  const saveCleaningDetails = async (bookingId: number, form: any) => {
    if (!bookingId) return
    const body = { booking_id:bookingId, scope:form.scope, windows:!!form.windows, scheduled_time:form.deadlineTime||null, duration_minutes:form.durationMin?parseInt(form.durationMin):null, cost:form.cost?parseFloat(form.cost):null, notes:form.notes||null, cleaner_confirmed:!!form.cleanerConfirmed }
    const res = await fetch('/api/cleaning-details', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    const row = await res.json()
    setDetails(prev => ({ ...prev, [bookingId]: row }))
  }

  const openCleaningModal = (args: any) => {
    const d = details[args.bookingId] || {}
    setCleaningForm({
      scope: d.scope || 'reinigung',
      windows: !!d.windows,
      deadlineTime: d.scheduled_time || '',
      durationMin: d.duration_minutes || '',
      cost: d.cost || '',
      notes: d.notes || '',
      cleanerConfirmed: !!d.cleaner_confirmed,
    })
    setCleaningModal(args)
  }

  const openExtraTaskModal = (ds: string) => {
    const existing = extraTasks[ds]
    setExtraTaskInput(existing?.title || '')
    setExtraTaskAssignee(existing?.assignee || '')
    setExtraTaskDone(existing?.done || false)
    setExtraTaskModal({ date: ds })
  }

  const saveExtraTask = async (text: string) => {
    const ds = extraTaskModal.date
    const existing = extraTasks[ds]
    if (!text.trim()) {
      if (existing) {
        await fetch(`/api/calendar-extra-tasks?id=${existing.id}`, { method:'DELETE' })
        setExtraTasks(prev => { const m = {...prev}; delete m[ds]; return m })
      }
    } else if (existing) {
      const res = await fetch('/api/calendar-extra-tasks', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:existing.id, title:text.trim(), assignee:extraTaskAssignee.trim(), done:extraTaskDone }) })
      const row = await res.json()
      setExtraTasks(prev => ({ ...prev, [ds]: row }))
    } else {
      const res = await fetch('/api/calendar-extra-tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ task_date:ds, title:text.trim(), assignee:extraTaskAssignee.trim(), done:extraTaskDone }) })
      const row = await res.json()
      setExtraTasks(prev => ({ ...prev, [ds]: row }))
    }
    setExtraTaskModal(null); setExtraTaskInput(''); setExtraTaskAssignee(''); setExtraTaskDone(false)
  }

  const deleteBookingAction = async (booking: any) => {
    await fetch(`/api/bookings/${booking.id}`, { method:'DELETE' })
    setBookings(prev => prev.filter(b => b.id !== booking.id))
    setDeleteConfirm(null); setBookingActionPopup(null)
  }

  const buildSegments = (houseId: number) => {
    const monthStart = dateStr(year, month, 1)
    const monthEnd   = dateStr(year, month, daysInMonth)
    return bookings
      .filter(b => b.house_id === houseId && VISIBLE_STATUSES.includes(b.status))
      .filter(b => b.checkin_date?.slice(0,10) <= monthEnd && b.checkout_date?.slice(0,10) > monthStart)
      .map(b => {
        const ciDay = b.checkin_date?.slice(0,10) >= monthStart ? parseInt(b.checkin_date.slice(8,10)) : 1
        const coDay = b.checkout_date?.slice(0,10) <= monthEnd  ? parseInt(b.checkout_date.slice(8,10)) : daysInMonth + 1
        const clippedLeft  = b.checkin_date?.slice(0,10) < monthStart
        const clippedRight = b.checkout_date?.slice(0,10) > monthEnd
        return { booking:b, ciDay, coDay, clippedLeft, clippedRight, spanDays: coDay-ciDay }
      })
  }

  const dupeIds = findDuplicates(bookings)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ minHeight:0 }}>
      {/* Top bar */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Belegungskalender</h1>
          <p className="text-xs text-gray-400 mt-0.5">Klick auf Buchung öffnet Details</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="text-sm border border-gray-200 rounded-lg px-4 py-1.5 hover:bg-gray-50">Heute</button>
          <button onClick={prevMonth} className="border border-gray-200 rounded-lg py-1.5 px-3 text-base hover:bg-gray-50">‹</button>
          <span className="font-semibold text-gray-800 w-44 text-center text-sm">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="border border-gray-200 rounded-lg py-1.5 px-3 text-base hover:bg-gray-50">›</button>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center h-32 text-gray-400">Laden…</div>}

      {!loading && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
            <div style={{ overflowX:'auto' }}>
              <div style={{ minWidth:`${HOUSE_COL_W + DAY_COL_W*daysInMonth}px` }}>

                {/* Header row */}
                <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20" style={{ height:52 }}>
                  <div className="shrink-0 flex items-end px-4 pb-2 border-r border-gray-200 bg-gray-50 sticky left-0 z-30" style={{ width:HOUSE_COL_W, minWidth:HOUSE_COL_W }}>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Haus</span>
                  </div>
                  {days.map(d => {
                    const dow = new Date(year, month, d).getDay()
                    const isWe = dow===0||dow===6
                    const today = isToday(d)
                    return (
                      <div key={d} style={{ width:DAY_COL_W, minWidth:DAY_COL_W, ...(today?{backgroundColor:'#a855f7',boxShadow:'0 0 14px 2px rgba(168,85,247,0.6)'}:{}) }}
                        className={`shrink-0 flex flex-col items-center justify-end pb-1.5 relative ${today?'':isWe?'bg-gray-100/60':''}`}>
                        <span className={`relative z-1 text-xs font-bold leading-none ${today?'text-white':isWe?'text-gray-400':'text-gray-500'}`}>{d}</span>
                        <span className={`relative z-1 mt-0.5 leading-none ${today?'text-violet-100':'text-gray-300'}`} style={{ fontSize:'0.6rem' }}>{DAY_NAMES_SHORT[dow]}</span>
                        {today && <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-700" />}
                      </div>
                    )
                  })}
                </div>

                {/* House rows */}
                {houses.map((house, hi) => {
                  const segments = buildSegments(house.id)
                  return (
                    <div key={house.id} className={`flex border-b border-gray-100 relative ${hi%2===0?'bg-white':'bg-gray-50/40'}`} style={{ height:ROW_H }}>
                      <div className={`shrink-0 flex flex-col justify-center px-4 border-r border-gray-200 sticky left-0 z-10 ${hi%2===0?'bg-white':'bg-gray-50/90'}`} style={{ width:HOUSE_COL_W, minWidth:HOUSE_COL_W }}>
                        <span className="text-sm font-semibold text-gray-800 leading-tight">{house.name}</span>
                        {house.capacity && <span className="text-xs text-gray-400 mt-0.5">{house.capacity} Betten</span>}
                      </div>
                      <div className="relative flex flex-1" style={{ height:ROW_H }}>
                        {days.map(d => {
                          const ds = dateStr(year, month, d)
                          const dow = new Date(year, month, d).getDay()
                          const isWe = dow===0||dow===6
                          const today = isToday(d)
                          const cs = getCleaningStatus(house.id, ds)
                          const excludedBooking = !cs ? getExcludedBookingForDate(house.id, ds) : null
                          return (
                            <div key={d} style={{ width:DAY_COL_W, minWidth:DAY_COL_W, position:'relative', flexShrink:0, ...(today?{backgroundColor:'rgba(168,85,247,0.16)',boxShadow:'inset 0 0 0 1px rgba(168,85,247,0.5)'}:{}) }}
                              className={`border-r border-gray-100 cursor-pointer ${today?'':isWe?'bg-gray-100/30':''}`}
                              onClick={() => openCleaningModal({ houseId:house.id, houseName:house.name, date:ds, alreadySet:cs!==null, status:cs?.status, bookingId:cs?.bookingId??null, excludedBooking })}>
                              {today && <div className="absolute top-0 bottom-0 left-0 w-1 bg-violet-500" />}
                              {cs && (
                                <div style={{ position:'absolute', top:2, right:2, width:14, height:14, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', zIndex:6, cursor:'pointer', backgroundColor: cs.status==='done'?'#dcfce7':cs.status==='organized'?'#fef3c7':'#fee2e2', border:`1.5px solid ${cs.status==='done'?'#22c55e':cs.status==='organized'?'#f59e0b':'#ef4444'}`, boxShadow:'0 1px 2px rgba(0,0,0,0.12)' }}
                                  onClick={e => { e.stopPropagation(); openCleaningModal({ houseId:house.id, houseName:house.name, date:ds, alreadySet:true, status:cs.status, bookingId:cs.bookingId, excludedBooking:null }) }}>
                                  🧹
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Booking bars */}
                        {segments.map(({ booking:b, ciDay, coDay, clippedLeft, clippedRight }) => {
                          const meta = STATUS_META[b.status] || STATUS_META.bestaetigt
                          const isDupe = dupeIds.has(b.id)
                          const barLeft   = (ciDay-1)*DAY_COL_W + (clippedLeft ?0:DAY_COL_W*0.25)
                          const barRight  = (coDay-1)*DAY_COL_W - (clippedRight?0:DAY_COL_W*0.25)
                          const barWidth  = Math.max(8, barRight-barLeft)
                          const barTop    = ROW_H*0.16
                          const barHeight = ROW_H*0.68
                          const isBlock   = b.status==='gesperrt'
                          const today     = new Date().toISOString().slice(0,10)
                          const isPast    = b.checkout_date?.slice(0,10) < today

                          return (
                            <div key={b.id} style={{ position:'absolute', left:barLeft, top:barTop, width:barWidth, height:barHeight, backgroundColor:meta.bg, borderRadius:`${clippedLeft?0:6}px ${clippedRight?0:6}px ${clippedRight?0:6}px ${clippedLeft?0:6}px`, cursor:'pointer', zIndex:5, overflow:'hidden', opacity:isPast?0.55:1, boxShadow:isDupe?'0 0 0 2px #f97316,0 1px 3px rgba(0,0,0,0.18)':'0 1px 2px rgba(0,0,0,0.15)', display:'flex', alignItems:'center', paddingLeft:!clippedLeft?14:8, paddingRight:!clippedRight?14:8 }}
                              className="hover:brightness-110"
                              onMouseEnter={e => { const rect=e.currentTarget.getBoundingClientRect(); setTooltip({booking:b,rect}) }}
                              onMouseLeave={() => setTooltip(null)}
                              onClick={e => { e.stopPropagation(); const rect=e.currentTarget.getBoundingClientRect(); setBookingActionPopup({booking:b,rect}) }}>
                              {/* Check-in circle */}
                              {!clippedLeft && !isBlock && (() => {
                                const openItems = getPreCheckinOpenItems(b)
                                const ready = openItems.length===0
                                return (
                                  <div style={{ position:'absolute', left:-7, top:'50%', transform:'translateY(-50%)', width:16, height:16, borderRadius:'50%', background:ready?'#22c55e':'#f59e0b', border:'2px solid white', boxShadow:'0 1px 3px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', color:'white', fontWeight:900, zIndex:7, cursor:'pointer' }}
                                    onClick={e => { e.stopPropagation(); const rect=e.currentTarget.getBoundingClientRect(); setReadinessPopup({booking:b,items:openItems,rect}) }}>
                                    →
                                  </div>
                                )
                              })()}
                              {/* Check-out circle */}
                              {!clippedRight && (
                                <div style={{ position:'absolute', right:-7, top:'50%', transform:'translateY(-50%)', width:16, height:16, borderRadius:'50%', background:'#ef4444', border:'2px solid white', boxShadow:'0 1px 3px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem', color:'white', fontWeight:900, zIndex:7, pointerEvents:'none' }}>■</div>
                              )}
                              <div style={{ overflow:'hidden', color:'white', flex:1, minWidth:0, display:'flex', alignItems:'center', gap:4 }}>
                                {isDupe && <span style={{ fontSize:'0.65rem', flexShrink:0 }}>⚠️</span>}
                                <span style={{ fontSize:'0.72rem', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textShadow:'0 1px 2px rgba(0,0,0,0.35)' }}>
                                  {isBlock?'🔒 Gesperrt':b.guest_name}
                                </span>
                                {!isBlock && barWidth>70 && <span style={{ fontSize:'0.65rem', opacity:0.85, flexShrink:0 }}>👥{b.guest_count}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Extra tasks row */}
                <div className="flex border-t-2 border-gray-200 bg-amber-50/40 relative" style={{ height:ROW_H }}>
                  <div className="shrink-0 flex flex-col justify-center px-4 border-r border-gray-200 sticky left-0 z-10 bg-amber-50/80" style={{ width:HOUSE_COL_W, minWidth:HOUSE_COL_W }}>
                    <span className="text-sm font-semibold text-gray-800 leading-tight">🗑️ Zusatzaufgaben</span>
                    <span className="text-xs text-gray-400 mt-0.5">z. B. Müllabfuhr</span>
                  </div>
                  <div className="relative flex flex-1" style={{ height:ROW_H }}>
                    {days.map(d => {
                      const ds = dateStr(year, month, d)
                      const dow = new Date(year, month, d).getDay()
                      const isWe = dow===0||dow===6
                      const today = isToday(d)
                      const task = extraTasks[ds]
                      return (
                        <div key={d} style={{ width:DAY_COL_W, minWidth:DAY_COL_W, position:'relative', flexShrink:0, ...(today?{backgroundColor:'rgba(168,85,247,0.16)',boxShadow:'inset 0 0 0 1px rgba(168,85,247,0.5)'}:{}) }}
                          className={`border-r border-gray-100 cursor-pointer flex flex-col items-center justify-center gap-0.5 ${today?'':isWe?'bg-gray-100/30':''}`}
                          onClick={() => openExtraTaskModal(ds)}>
                          {today && <div className="absolute top-0 bottom-0 left-0 w-1 bg-violet-500" />}
                          {task && (
                            <>
                              <span style={{ fontSize:'0.85rem' }}>{task.done?'✅':'🗑️'}</span>
                              {task.assignee && <span style={{ fontSize:'0.5rem', color:'#92400e', fontWeight:600, lineHeight:1.1, textAlign:'center', maxWidth:DAY_COL_W-4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.assignee}</span>}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
            {Object.entries(STATUS_META).map(([k,m]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor:m.bg }} />{m.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-red-200 border border-red-400" />🧹 Geplant</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-amber-200 border border-amber-400" />🧹 Organisiert</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block bg-green-200 border border-green-400" />🧹 Erledigt</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor:'#a855f7' }} />Heute</span>
          </div>
        </div>
      )}

      {/* ── Tooltip ── */}
      {tooltip && (() => {
        const b = tooltip.booking
        const meta = STATUS_META[b.status]||STATUS_META.bestaetigt
        const rect = tooltip.rect
        const width = 250
        let left = rect.left; if (left+width>window.innerWidth-16) left=Math.max(8,window.innerWidth-width-16)
        let top = rect.bottom+8; if (top+200>window.innerHeight) top=Math.max(8,rect.top-200-8)
        return (
          <div style={{ position:'fixed', left, top, width, zIndex:2000, pointerEvents:'none' }} className="rounded-xl bg-white shadow-2xl border border-gray-200 p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-semibold text-sm text-gray-900 truncate">{b.status==='gesperrt'?'🔒 Gesperrt':b.guest_name||'—'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ backgroundColor:meta.light, color:meta.text }}>{meta.label}</span>
            </div>
            {b.company_name && <div className="text-gray-400 mb-1.5 truncate">{b.company_name}</div>}
            <div className="flex items-center text-gray-600 mb-1.5">📅 {fmtDateShort(b.checkin_date)} → {fmtDateShort(b.checkout_date)}</div>
            <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg py-1.5 mb-1.5">
              <div><div className="font-semibold text-gray-800">🌙 {b.nights}</div><div className="text-[10px] text-gray-400">Nächte</div></div>
              <div><div className="font-semibold text-gray-800">👥 {b.guest_count}</div><div className="text-[10px] text-gray-400">Gäste</div></div>
              <div><div className="font-semibold text-gray-800">{fmtCurrency(parseFloat(b.total_price||0))}</div><div className="text-[10px] text-gray-400">Gesamt</div></div>
            </div>
            <div className="text-center text-[10px] text-gray-300 mt-2 pt-1.5 border-t border-gray-100">Klicken zum Bearbeiten</div>
          </div>
        )
      })()}

      {/* ── Readiness popup ── */}
      {readinessPopup && (() => {
        const rect = readinessPopup.rect
        const width = 260
        let left = rect.left; if (left+width>window.innerWidth-16) left=Math.max(8,window.innerWidth-width-16)
        const top = Math.min(rect.bottom+8, window.innerHeight-200)
        return (
          <div style={{ position:'fixed', inset:0, zIndex:2100 }} onClick={() => setReadinessPopup(null)}>
            <div style={{ position:'fixed', left, top, width, zIndex:2101 }} className="rounded-xl bg-white shadow-2xl border border-gray-200 p-3.5 text-xs" onClick={e => e.stopPropagation()}>
              <div className="font-semibold text-sm text-gray-900 mb-2">{readinessPopup.items.length===0?'✅ Check-in bereit':'⚠️ Offene Punkte vor Check-in'}</div>
              <div className="text-gray-500 mb-2 truncate">{readinessPopup.booking.guest_name}</div>
              {readinessPopup.items.length>0 ? (
                <ul className="space-y-1 mb-3 list-disc list-inside text-gray-700">{readinessPopup.items.map((it:string,i:number) => <li key={i}>{it}</li>)}</ul>
              ) : <div className="text-gray-500 mb-3">Alle Aufgaben erledigt.</div>}
              <div className="flex gap-3">
                <button className="text-blue-600 hover:text-blue-800 text-xs font-medium" onClick={() => { router.push(`/tasks?booking=${readinessPopup.booking.id}`); setReadinessPopup(null) }}>📋 Zu den Aufgaben</button>
                <button className="text-blue-600 hover:text-blue-800 text-xs font-medium" onClick={() => { router.push(`/bookings/${readinessPopup.booking.id}/edit`); setReadinessPopup(null) }}>📝 Zur Buchung →</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Booking action popup ── */}
      {bookingActionPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:999 }} onClick={() => setBookingActionPopup(null)}>
          <div style={{ position:'fixed', top:Math.min(bookingActionPopup.rect.bottom+6,window.innerHeight-140), left:Math.min(bookingActionPopup.rect.left,window.innerWidth-200), zIndex:1000 }}
            className="bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[180px]" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-700 truncate">{bookingActionPopup.booking.guest_name}</p>
              <p className="text-xs text-gray-400">{bookingActionPopup.booking.house_name}</p>
            </div>
            <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2" onClick={() => { router.push(`/bookings/${bookingActionPopup.booking.id}/edit`); setBookingActionPopup(null) }}>✏️ Buchung bearbeiten</button>
            <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2" onClick={() => { setDeleteConfirm(bookingActionPopup.booking); setBookingActionPopup(null) }}>🗑️ Buchung löschen</button>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)' }} onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">🗑️ Buchung löschen?</h3>
            <p className="text-sm text-gray-600 mb-1"><strong>{deleteConfirm.guest_name}</strong></p>
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-5">⚠️ Nicht rückgängig zu machen.</p>
            <div className="flex justify-end gap-2">
              <button className="border border-gray-200 rounded-lg px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setDeleteConfirm(null)}>Abbrechen</button>
              <button className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-red-700" onClick={() => deleteBookingAction(deleteConfirm)}>Ja, löschen</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Zusatzaufgaben Modal ── */}
      {extraTaskModal && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)' }} onClick={() => setExtraTaskModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">🗑️ Zusatzaufgabe – {fmtDateShort(extraTaskModal.date)}</h3>
            {extraTaskTemplates.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Vorlagen</p>
                <div className="flex flex-wrap gap-2">
                  {extraTaskTemplates.map((tpl,i) => (
                    <button key={i} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${extraTaskInput===tpl?'bg-amber-500 text-white border-amber-500':'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'}`} onClick={() => setExtraTaskInput(tpl)}>{tpl}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-3">
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="z. B. Müllabfuhr …" value={extraTaskInput} onChange={e => setExtraTaskInput(e.target.value)} autoFocus />
            </div>
            <div className="mb-3">
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Zuständig …" value={extraTaskAssignee} onChange={e => setExtraTaskAssignee(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-5">
              <input type="checkbox" checked={extraTaskDone} onChange={e => setExtraTaskDone(e.target.checked)} />
              <span className="text-sm text-gray-700">Erledigt</span>
            </label>
            <div className="flex justify-between items-center gap-2">
              {extraTasks[extraTaskModal.date] && <button className="text-xs text-red-500 hover:text-red-700 underline" onClick={() => saveExtraTask('')}>Entfernen</button>}
              <div className="flex gap-2 ml-auto">
                <button className="border border-gray-200 rounded-lg px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setExtraTaskModal(null)}>Abbrechen</button>
                <button className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50" disabled={!extraTaskInput.trim()} onClick={() => saveExtraTask(extraTaskInput)}>Speichern</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cleaning Modal ── */}
      {cleaningModal && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)' }} onClick={() => setCleaningModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">🧹 Reinigung – {cleaningModal.houseName}</h3>
            <p className="text-sm text-gray-500 mb-4">{cleaningModal.date}</p>
            {cleaningModal.alreadySet && cleaningModal.bookingId && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                Zum Checkout dieser Buchung · Status: {{ planned:'Geplant', organized:'Organisiert', done:'Erledigt' }[cleaningModal.status as string] || cleaningModal.status}
              </p>
            )}
            {!cleaningModal.alreadySet && cleaningModal.excludedBooking && (
              <p className="text-sm text-gray-600 mb-4">Reinigung wurde für diese Buchung entfernt.</p>
            )}
            {!cleaningModal.alreadySet && !cleaningModal.excludedBooking && (
              <p className="text-sm text-gray-600 mb-4">Diesen Tag als Reinigungstag markieren?</p>
            )}

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Uhrzeit</label>
                  <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={cleaningForm.deadlineTime} onChange={e => setCleaningForm((f:any) => ({...f,deadlineTime:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Umfang</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={cleaningForm.scope} onChange={e => setCleaningForm((f:any) => ({...f,scope:e.target.value}))}>
                    <option value="grund">Grundreinigung</option>
                    <option value="reinigung">Zwischenreinigung</option>
                    <option value="bettwaesche">Bettwäsche-Wechsel</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dauer (Minuten)</label>
                  <input type="number" min="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={cleaningForm.durationMin} onChange={e => setCleaningForm((f:any) => ({...f,durationMin:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kosten (€)</label>
                  <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={cleaningForm.cost} onChange={e => setCleaningForm((f:any) => ({...f,cost:e.target.value}))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={cleaningForm.windows} onChange={e => setCleaningForm((f:any) => ({...f,windows:e.target.checked}))} />🪟 Fenster putzen</label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={!!cleaningForm.cleanerConfirmed} onChange={e => setCleaningForm((f:any) => ({...f,cleanerConfirmed:e.target.checked}))} />✅ Reinigungskraft bestätigt</label>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notizen</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={cleaningForm.notes} onChange={e => setCleaningForm((f:any) => ({...f,notes:e.target.value}))} />
              </div>
            </div>

            {cleaningModal.alreadySet && cleaningModal.bookingId ? (
              <div className="flex flex-wrap gap-2 justify-end">
                <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50" onClick={async () => { await saveCleaningDetails(cleaningModal.bookingId, cleaningForm); setCleaningModal(null) }}>💾 Speichern</button>
                {cleaningModal.status!=='planned' && <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50" onClick={async () => { await updateTask(cleaningModal.bookingId,{cleaning_org:false,cleaning_done:false}); setCleaningModal(null) }}>↺ Zurücksetzen</button>}
                {cleaningModal.status==='planned' && <button className="bg-amber-500 text-white rounded-lg px-3 py-2 text-sm hover:bg-amber-600" onClick={async () => { await saveCleaningDetails(cleaningModal.bookingId,cleaningForm); await updateTask(cleaningModal.bookingId,{cleaning_org:true,cleaning_done:false}); setCleaningModal(null) }}>📋 Organisiert</button>}
                {cleaningModal.status!=='done' && <button className="bg-green-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-green-700" onClick={async () => { await saveCleaningDetails(cleaningModal.bookingId,cleaningForm); await updateTask(cleaningModal.bookingId,{cleaning_org:true,cleaning_done:true}); setCleaningModal(null) }}>✅ Erledigt</button>}
                <button className="bg-red-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-red-700" onClick={async () => { await excludeBooking(cleaningModal.bookingId); setCleaningModal(null) }}>🗑 Löschen</button>
              </div>
            ) : cleaningModal.alreadySet ? (
              <div className="flex flex-wrap gap-2 justify-end">
                <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                <button className="bg-red-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-red-700" onClick={async () => { await removeCleaningMarker(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null) }}>🗑 Löschen</button>
              </div>
            ) : cleaningModal.excludedBooking ? (
              <div className="flex flex-wrap gap-2 justify-end">
                <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                <button className="bg-amber-500 text-white rounded-lg px-3 py-2 text-sm hover:bg-amber-600" onClick={async () => { await restoreBooking(cleaningModal.excludedBooking.id); setCleaningModal(null) }}>🔁 Wiederherstellen</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-end">
                <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setCleaningModal(null)}>Abbrechen</button>
                <button className="bg-amber-500 text-white rounded-lg px-3 py-2 text-sm hover:bg-amber-600" onClick={async () => { await addCleaningMarker(cleaningModal.houseId, cleaningModal.date); setCleaningModal(null) }}>🧹 Reinigung markieren</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
