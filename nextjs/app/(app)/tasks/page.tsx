'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
export const dynamic = 'force-dynamic'

function fmtDate(d: string) { if(!d)return''; return new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}) }
function fmtDateFull(d: string) { if(!d)return''; return new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) }
function fmtEur(n: number) { return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n??0) }
function daysBetween(a: string, b: string) { return Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000) }
function addDays(d: string, n: number) { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10) }

const TASK_DEFS = [
  { key:'welcome',        icon:'✉️',  label:'Willkommensnachricht' },
  { key:'pin',            icon:'🔑',  label:'PIN-Code übermittelt' },
  { key:'guests_reg_done',icon:'👥',  label:'Gästeregistrierung' },
  { key:'invoice_done',   icon:'🧾',  label:'Rechnung verschickt' },
  { key:'deposit_done',   icon:'💰',  label:'Geldeingang geprüft' },
  { key:'cleaning_org',   icon:'📋',  label:'Reinigung organisiert' },
  { key:'cleaning_done',  icon:'🧹',  label:'Reinigung abgeschlossen' },
  { key:'kaution_rueck',  icon:'🔓',  label:'Kaution zurückgegeben' },
]

function getDue(key: string, b: any) {
  const ci = b.checkin_date?.slice(0,10), co = b.checkout_date?.slice(0,10), bd = b.booking_date?.slice(0,10)
  if (!ci||!co) return null
  if (key==='welcome'||key==='guests_reg_done') return (!bd||daysBetween(bd,ci)<2) ? bd||ci : addDays(ci,-2)
  if (key==='pin') return addDays(ci,-1)
  if (key==='invoice_done') return addDays(ci,2)
  if (key==='deposit_done') return ci
  if (key==='cleaning_org') return addDays(co,-2)
  if (key==='cleaning_done') return b.cleaning_date?.slice(0,10)||co
  if (key==='kaution_rueck') return addDays(co,3)
  return null
}

function dueLabel(due: string|null, done: boolean) {
  if (done||!due) return null
  const today = new Date().toISOString().slice(0,10)
  const d = daysBetween(today,due)
  if (d<0) return {text:`Überfällig (${fmtDate(due)})`, cls:'text-red-600 font-semibold'}
  if (d===0) return {text:'Heute fällig', cls:'text-red-500 font-semibold'}
  if (d===1) return {text:`Morgen (${fmtDate(due)})`, cls:'text-amber-600'}
  return {text:`Fällig ${fmtDate(due)}`, cls:'text-gray-400'}
}

const STATUS_LABEL: Record<string,string> = { bestaetigt:'Bestätigt', eingecheckt:'Eingecheckt', ausgecheckt:'Ausgecheckt', angefragt:'Angefragt', storniert:'Storniert', no_show:'No-Show' }
const STATUS_COLOR: Record<string,string> = { bestaetigt:'bg-blue-100 text-blue-700', eingecheckt:'bg-green-100 text-green-700', ausgecheckt:'bg-gray-100 text-gray-600', angefragt:'bg-amber-100 text-amber-700', storniert:'bg-gray-100 text-gray-400', no_show:'bg-orange-100 text-orange-700' }

function allDone(t: any) { return TASK_DEFS.every(d => t[d.key]) }

// ── BookingCard ────────────────────────────────────────────────────────────
function BookingCard({ booking, tasks, onToggle, highlight }: any) {
  const [open, setOpen] = useState(highlight)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (highlight && ref.current) { ref.current.scrollIntoView({behavior:'smooth',block:'center'}); setOpen(true) } }, [highlight])

  const t = tasks||{}
  const done = allDone(t)
  const today = new Date().toISOString().slice(0,10)
  const ci = booking.checkin_date?.slice(0,10)||''
  const co = booking.checkout_date?.slice(0,10)||''
  const upcoming = ci > today
  const past = co < today
  const active = !upcoming && !past

  const pendingCount = TASK_DEFS.filter(d => !t[d.key]).length

  return (
    <div ref={ref} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${highlight?'ring-2 ring-blue-400':''} ${done?'border-green-200':'border-gray-200'}`}>
      <div className={`px-4 py-3 flex items-center gap-3 cursor-pointer ${done?'bg-green-50':active?'bg-blue-50':upcoming?'bg-gray-50':'bg-gray-50'}`} onClick={()=>setOpen((o:boolean)=>!o)}>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${done?'bg-green-500':active?'bg-blue-500':upcoming?'bg-gray-300':'bg-gray-200'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{booking.guest_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[booking.status]||'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[booking.status]||booking.status}</span>
            {!done && <span className="text-xs text-gray-400">{pendingCount} offen</span>}
            {done && <span className="text-xs text-green-600 font-medium">✅ Alle erledigt</span>}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {booking.house_name} · {fmtDateFull(ci)} → {fmtDateFull(co)} · {booking.nights} N. · {fmtEur(parseFloat(booking.total_price||0))}
          </div>
        </div>
        <span className="text-gray-300 text-sm ml-auto flex-shrink-0">{open?'▲':'▼'}</span>
      </div>

      {open && (
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {TASK_DEFS.map(def => {
              const checked = !!t[def.key]
              const due = getDue(def.key, booking)
              const dl = dueLabel(due, checked)
              return (
                <label key={def.key} className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${checked?'opacity-60':''}`}>
                  <input type="checkbox" checked={checked} onChange={e=>onToggle(booking.id,def.key,e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-800 flex items-center gap-1.5">
                      <span>{def.icon}</span>
                      <span className={checked?'line-through text-gray-400':''}>{def.label}</span>
                    </div>
                    {dl && <div className={`text-xs mt-0.5 ${dl.cls}`}>{dl.text}</div>}
                  </div>
                </label>
              )
            })}
          </div>
          {booking.notes && (
            <div className="mt-3 bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-800">
              <span className="font-medium text-amber-600 mr-1">Notiz:</span>{booking.notes}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2">
            <a href={`/bookings/${booking.id}/edit`} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-700">✏️ Buchung bearbeiten</a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
function TasksInner() {
  const searchParams = useSearchParams()
  const targetBookingId = searchParams.get('booking') ? parseInt(searchParams.get('booking')!) : null
  const [bookings, setBookings] = useState<any[]>([])
  const [tasks, setTasks] = useState<Record<number,any>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'open'|'done'>('open')
  const [houses, setHouses] = useState<any[]>([])
  const [houseFilter, setHouseFilter] = useState('')

  const load = useCallback(async () => {
    const [bRes, hRes] = await Promise.all([
      fetch('/api/bookings?limit=500').then(r=>r.json()),
      fetch('/api/houses').then(r=>r.json()),
    ])
    const bData: any[] = bRes.data??[]
    setBookings(bData.filter((b:any)=>['bestaetigt','eingecheckt','ausgecheckt','angefragt'].includes(b.status)))
    setHouses(hRes.data??hRes)
    if (bData.length>0) {
      const ids = bData.map((b:any)=>b.id).join(',')
      const tRes = await fetch(`/api/booking-tasks?ids=${ids}`).then(r=>r.json())
      const tm: Record<number,any>={}
      ;(Array.isArray(tRes)?tRes:[]).forEach((t:any)=>{tm[t.booking_id]=t})
      setTasks(tm)
    }
    setLoading(false)
  }, [])
  useEffect(()=>{load()},[load])

  const onToggle = async (bookingId: number, key: string, value: boolean) => {
    setTasks(prev=>({...prev,[bookingId]:{...(prev[bookingId]||{}),[key]:value}}))
    await fetch(`/api/booking-tasks/${bookingId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({[key]:value})})
  }

  const today = new Date().toISOString().slice(0,10)
  const sorted = [...bookings].sort((a,b) => {
    const aActive = a.checkin_date?.slice(0,10)<=today && a.checkout_date?.slice(0,10)>today
    const bActive = b.checkin_date?.slice(0,10)<=today && b.checkout_date?.slice(0,10)>today
    if (aActive&&!bActive) return -1
    if (!aActive&&bActive) return 1
    return a.checkin_date?.localeCompare(b.checkin_date)||0
  })

  const filtered = sorted.filter(b => {
    if (houseFilter && String(b.house_id)!==houseFilter) return false
    const q = search.toLowerCase()
    if (q && !(b.guest_name||'').toLowerCase().includes(q) && !(b.company_name||'').toLowerCase().includes(q)) return false
    if (filter==='open' && allDone(tasks[b.id]||{})) return false
    if (filter==='done' && !allDone(tasks[b.id]||{})) return false
    return true
  })

  const openCount = sorted.filter(b=>!allDone(tasks[b.id]||{})).length
  const doneCount = sorted.filter(b=>allDone(tasks[b.id]||{})).length

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Laden…</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">✅ Aufgaben</h1>
          <p className="text-xs text-gray-400 mt-0.5">{openCount} offen · {doneCount} erledigt</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64" placeholder="Gast suchen…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={houseFilter} onChange={e=>setHouseFilter(e.target.value)}>
          <option value="">Alle Häuser</option>
          {houses.map((h:any)=><option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <div className="flex gap-1">
          {(['all','open','done'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-2 text-sm rounded-lg border transition-colors ${filter===f?'bg-blue-600 text-white border-blue-600':'border-gray-200 hover:bg-gray-50'}`}>
              {f==='all'?'Alle':f==='open'?'Offen':'Erledigt'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length===0 ? (
        <div className="text-center py-12 text-gray-400">Keine Buchungen gefunden.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b=>(
            <BookingCard key={b.id} booking={b} tasks={tasks[b.id]} onToggle={onToggle} highlight={b.id===targetBookingId} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TasksPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Laden…</div>}><TasksInner /></Suspense>
}
