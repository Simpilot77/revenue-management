'use client'
import { useState, useEffect, useMemo } from 'react'
export const dynamic = 'force-dynamic'

const SCOPE_LABELS: Record<string,string> = { grund:'Grundreinigung', reinigung:'Zwischenreinigung', bettwaesche:'Bettwäsche-Wechsel' }
const STATUS_LABELS: Record<string,string> = { planned:'Geplant', organized:'Organisiert', done:'Erledigt' }
const STATUS_STYLES: Record<string,string> = { planned:'bg-red-100 text-red-700', organized:'bg-amber-100 text-amber-700', done:'bg-green-100 text-green-700' }

function fmtDate(ds: string) { if (!ds) return ''; return new Date(ds).toLocaleDateString('de-DE', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' }) }
function fmtEur(n: number) { return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n??0) }

function buildMsg(template: string, entry: any) {
  return (template||'')
    .replace(/{haus}/g, entry.houseName||'')
    .replace(/{datum}/g, fmtDate(entry.date))
    .replace(/{uhrzeit}/g, entry.scheduled_time||'–')
    .replace(/{umfang}/g, SCOPE_LABELS[entry.scope]||entry.scope||'–')
    .replace(/{fenster}/g, entry.windows?' · Fenster putzen':'')
    .replace(/{notizen}/g, entry.notes||'–')
}

export default function CleaningPage() {
  const [houses, setHouses] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [markers, setMarkers] = useState<any[]>([])
  const [exclusionIds, setExclusionIds] = useState<Set<number>>(new Set())
  const [details, setDetails] = useState<Record<number,any>>({})
  const [tasks, setTasks] = useState<Record<number,any>>({})
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0,10)
  const plus60 = new Date(Date.now()+60*86400000).toISOString().slice(0,10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(plus60)
  const [houseFilter, setHouseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editEntry, setEditEntry] = useState<any>(null)
  const [form, setForm] = useState<any>({ scope:'reinigung', windows:false, scheduled_time:'', duration_minutes:'', cost:'', notes:'', cleaner_confirmed:false })
  const [savingEdit, setSavingEdit] = useState(false)

  const load = () => {
    const past = new Date(Date.now()-30*86400000).toISOString().slice(0,10)
    const next = new Date(Date.now()+365*86400000).toISOString().slice(0,10)
    Promise.all([
      fetch('/api/houses').then(r=>r.json()),
      fetch(`/api/bookings?from=${past}&to=${next}&limit=500`).then(r=>r.json()),
      fetch('/api/cleaning-markers').then(r=>r.json()),
      fetch('/api/cleaning-exclusions').then(r=>r.json()),
      fetch('/api/cleaning-details').then(r=>r.json()),
      fetch('/api/company-settings').then(r=>r.json()),
    ]).then(([h,b,m,ex,cd,s]) => {
      const housesData = h.data??h
      const bData = (b.data??[]).filter((x:any)=>['bestaetigt','eingecheckt','ausgecheckt'].includes(x.status))
      setHouses(housesData)
      setBookings(bData)
      setMarkers(Array.isArray(m)?m:[])
      setExclusionIds(new Set((Array.isArray(ex)?ex:[]).map((e:any)=>e.booking_id).filter(Boolean)))
      const dm:Record<number,any>={}; (Array.isArray(cd)?cd:[]).forEach((d:any)=>{dm[d.booking_id]=d}); setDetails(dm)
      setSettings(s??{})

      if (bData.length>0) {
        fetch(`/api/booking-tasks?ids=${bData.map((x:any)=>x.id).join(',')}`).then(r=>r.json()).then(bt=>{
          const tm:Record<number,any>={}; (Array.isArray(bt)?bt:[]).forEach((t:any)=>{tm[t.booking_id]=t}); setTasks(tm)
        })
      }
      setLoading(false)
    })
  }
  useEffect(()=>{ load() },[])

  const entries = useMemo(() => {
    const result: any[] = []
    const seenBookingIds = new Set<number>()
    for (const b of bookings) {
      if (b.cleaning_required===false) continue
      if (exclusionIds.has(b.id)) continue
      const ds = (b.cleaning_date||b.checkout_date)?.slice(0,10)
      if (!ds) continue
      const house = houses.find((h:any)=>h.id===b.house_id)
      if (!house) continue
      const t = tasks[b.id]||{}
      const d = details[b.id]||{}
      const status = t.cleaning_done?'done':t.cleaning_org?'organized':'planned'
      result.push({ bookingId:b.id, houseId:b.house_id, houseName:house.name, date:ds, status, guestName:b.guest_name, ...d, notified_sms:d.notified_sms, notified_whatsapp:d.notified_whatsapp, notified_email:d.notified_email })
      seenBookingIds.add(b.id)
    }
    // manual markers
    for (const m of markers) {
      if (m.booking_id && seenBookingIds.has(m.booking_id)) continue
      const house = houses.find((h:any)=>h.id===m.house_id)
      if (!house) continue
      result.push({ bookingId:null, markerId:m.id, houseId:m.house_id, houseName:house.name, date:m.marker_date, status:m.done?'done':'planned', guestName:null })
    }
    return result.sort((a:any,b:any)=>a.date.localeCompare(b.date)||a.houseId-b.houseId)
  }, [bookings, houses, markers, exclusionIds, details, tasks])

  const filtered = entries.filter((e:any) => {
    if (houseFilter && String(e.houseId)!==houseFilter) return false
    if (statusFilter && e.status!==statusFilter) return false
    if (dateFrom && e.date<dateFrom) return false
    if (dateTo && e.date>dateTo) return false
    return true
  })

  const openEdit = (entry: any) => {
    setEditEntry(entry)
    const d = details[entry.bookingId]||{}
    setForm({ scope:d.scope||'reinigung', windows:!!d.windows, scheduled_time:d.scheduled_time||'', duration_minutes:d.duration_minutes||'', cost:d.cost||'', notes:d.notes||'', cleaner_confirmed:!!d.cleaner_confirmed })
  }

  const saveEdit = async (flags?: { cleaning_org?: boolean; cleaning_done?: boolean }) => {
    setSavingEdit(true)
    if (editEntry.bookingId) {
      await fetch('/api/cleaning-details', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ booking_id:editEntry.bookingId, ...form, duration_minutes:form.duration_minutes?parseInt(form.duration_minutes):null, cost:form.cost?parseFloat(form.cost):null }) })
      if (flags) await fetch(`/api/booking-tasks/${editEntry.bookingId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(flags) })
    }
    await load()
    setSavingEdit(false); setEditEntry(null)
  }

  const markNotified = async (entry: any, channel: 'sms'|'whatsapp'|'email') => {
    if (entry.bookingId) {
      await fetch('/api/cleaning-details', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ booking_id:entry.bookingId, [`notified_${channel}`]:true }) })
      setDetails(prev => ({ ...prev, [entry.bookingId]: { ...(prev[entry.bookingId]||{}), [`notified_${channel}`]:true } }))
    }
  }

  const send = async (entry: any, channel: 'sms'|'whatsapp'|'email') => {
    const ph = settings.cleaning_phone||settings.cleaning_whatsapp||''
    const em = settings.cleaning_email||''
    const tpl = settings.cleaning_template||'Reinigung {haus} am {datum}'
    const msg = buildMsg(tpl, { ...entry, ...details[entry.bookingId]||{} })
    if (channel==='sms') { if (!ph){alert('Telefonnummer in Einstellungen eintragen.');return}; window.location.href=`sms:${ph}?body=${encodeURIComponent(msg)}` }
    if (channel==='whatsapp') { if (!ph){alert('Telefonnummer in Einstellungen eintragen.');return}; window.open(`https://wa.me/${ph.replace(/[^\d]/g,'')}?text=${encodeURIComponent(msg)}`) }
    if (channel==='email') { if (!em){alert('E-Mail in Einstellungen eintragen.');return}; window.location.href=`mailto:${em}?subject=${encodeURIComponent(`Reinigung ${entry.houseName} – ${fmtDate(entry.date)}`)}&body=${encodeURIComponent(msg)}` }
    await markNotified(entry, channel)
  }

  const Btn = ({children,className='',onClick}:any) => (
    <button onClick={onClick} className={`text-xs px-2 py-1 rounded border ${className}`}>{children}</button>
  )

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Laden…</div>

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">🧹 Reinigungsmanagement</h1>
        <p className="text-xs text-gray-400 mt-0.5">Alle Reinigungen · SMS/WhatsApp/E-Mail Benachrichtigung</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Haus</label>
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={houseFilter} onChange={e=>setHouseFilter(e.target.value)}>
            <option value="">Alle Häuser</option>
            {houses.map((h:any)=><option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">Alle</option>
            <option value="planned">Geplant</option>
            <option value="organized">Organisiert</option>
            <option value="done">Erledigt</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Von</label>
          <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bis</label>
          <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </div>
        <div className="text-sm text-gray-400 pb-1">{filtered.length} Reinigung{filtered.length!==1?'en':''}</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {['Datum','Haus / Gast','Status','Bestätigt','Umfang','Zeit','Dauer','Kosten','Notizen','Aktionen'].map(h=>(
                  <th key={h} className="px-4 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e:any,i:number)=>(
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap font-medium">{fmtDate(e.date)}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-800">{e.houseName}</div>
                    {e.guestName && <div className="text-xs text-gray-400">{e.guestName}</div>}
                  </td>
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[e.status]}`}>{STATUS_LABELS[e.status]}</span></td>
                  <td className="px-4 py-2">{details[e.bookingId]?.cleaner_confirmed?'✅':'–'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{SCOPE_LABELS[details[e.bookingId]?.scope]||'–'}</td>
                  <td className="px-4 py-2">{details[e.bookingId]?.scheduled_time||'–'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{details[e.bookingId]?.duration_minutes?`${details[e.bookingId].duration_minutes} Min.`:'–'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{details[e.bookingId]?.cost?fmtEur(details[e.bookingId].cost):'–'}</td>
                  <td className="px-4 py-2 max-w-[150px] truncate text-gray-500">{details[e.bookingId]?.notes||'–'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Btn className="border-gray-200 hover:bg-gray-50" onClick={()=>openEdit(e)}>✏️</Btn>
                      <Btn className={details[e.bookingId]?.notified_sms?'bg-green-100 text-green-700 border-green-300':'border-gray-200 hover:bg-gray-50'} onClick={()=>send(e,'sms')}>📱{details[e.bookingId]?.notified_sms?' ✅':''}</Btn>
                      <Btn className={details[e.bookingId]?.notified_whatsapp?'bg-green-100 text-green-700 border-green-300':'border-gray-200 hover:bg-gray-50'} onClick={()=>send(e,'whatsapp')}>💬{details[e.bookingId]?.notified_whatsapp?' ✅':''}</Btn>
                      <Btn className={details[e.bookingId]?.notified_email?'bg-green-100 text-green-700 border-green-300':'border-gray-200 hover:bg-gray-50'} onClick={()=>send(e,'email')}>✉️{details[e.bookingId]?.notified_email?' ✅':''}</Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Keine Reinigungen im gewählten Zeitraum.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editEntry && (
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.45)'}} onClick={()=>setEditEntry(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-1">🧹 {editEntry.houseName}</h3>
            <p className="text-sm text-gray-500 mb-3">{fmtDate(editEntry.date)} · {editEntry.guestName||'Manuelle Markierung'}</p>
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Uhrzeit</label>
                  <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.scheduled_time} onChange={e=>setForm((f:any)=>({...f,scheduled_time:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Umfang</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.scope} onChange={e=>setForm((f:any)=>({...f,scope:e.target.value}))}>
                    <option value="grund">Grundreinigung</option>
                    <option value="reinigung">Zwischenreinigung</option>
                    <option value="bettwaesche">Bettwäsche-Wechsel</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Dauer (Min.)</label><input type="number" min="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.duration_minutes} onChange={e=>setForm((f:any)=>({...f,duration_minutes:e.target.value}))} /></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Kosten (€)</label><input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.cost} onChange={e=>setForm((f:any)=>({...f,cost:e.target.value}))} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.windows} onChange={e=>setForm((f:any)=>({...f,windows:e.target.checked}))} />🪟 Fenster putzen</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.cleaner_confirmed} onChange={e=>setForm((f:any)=>({...f,cleaner_confirmed:e.target.checked}))} />✅ Reinigungskraft bestätigt</label>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Notizen</label><textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.notes} onChange={e=>setForm((f:any)=>({...f,notes:e.target.value}))} /></div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50" onClick={()=>setEditEntry(null)}>Abbrechen</button>
              <button disabled={savingEdit} className="border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" onClick={()=>saveEdit()}>💾 Speichern</button>
              {editEntry.bookingId && editEntry.status!=='done' && (
                <button disabled={savingEdit} className="bg-green-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-green-700 disabled:opacity-50" onClick={()=>saveEdit({cleaning_org:true,cleaning_done:true})}>✅ Erledigt</button>
              )}
              {editEntry.bookingId && editEntry.status==='planned' && (
                <button disabled={savingEdit} className="bg-amber-500 text-white rounded-lg px-3 py-2 text-sm hover:bg-amber-600 disabled:opacity-50" onClick={()=>saveEdit({cleaning_org:true,cleaning_done:false})}>📋 Organisiert</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
