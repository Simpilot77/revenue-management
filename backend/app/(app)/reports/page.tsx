'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from 'recharts'
export const dynamic = 'force-dynamic'

const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#854d0e']

function fmtEur(n: number) { return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n??0) }
function fmtDate(d: string) { if(!d)return''; return new Date(d).toLocaleDateString('de-DE') }

const STATUS_LABEL: Record<string,string> = { bestaetigt:'Bestätigt', eingecheckt:'Eingecheckt', ausgecheckt:'Ausgecheckt', angefragt:'Angefragt', storniert:'Storniert', no_show:'No-Show', gesperrt:'Gesperrt' }
const STATUS_COLOR: Record<string,string> = { bestaetigt:'bg-blue-100 text-blue-700', eingecheckt:'bg-green-100 text-green-700', ausgecheckt:'bg-gray-100 text-gray-600', angefragt:'bg-amber-100 text-amber-700', storniert:'bg-gray-100 text-gray-400', no_show:'bg-orange-100 text-orange-700' }

const TABS = ['Monatlich','Häuser','Kanäle','Buchungsübersicht']

export default function ReportsPage() {
  const [tab, setTab] = useState(0)
  const [year, setYear] = useState(new Date().getFullYear())
  const [houses, setHouses] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [houseFilter, setHouseFilter] = useState('')
  const [sortBy, setSortBy] = useState('checkin_date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')

  useEffect(() => {
    Promise.all([
      fetch('/api/houses').then(r=>r.json()),
      fetch('/api/channels').then(r=>r.json()),
    ]).then(([h,c]) => { setHouses(h.data??h); setChannels(c.data??c) })
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ from:`${year}-01-01`, to:`${year}-12-31`, limit:'1000' })
    if (houseFilter) params.set('house_id', houseFilter)
    fetch(`/api/bookings?${params}`).then(r=>r.json()).then(d => {
      setBookings(d.data??[])
      setLoading(false)
    })
  }, [year, houseFilter])

  const active = useMemo(() => bookings.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status)), [bookings])

  // Monthly data
  const monthly = useMemo(() => {
    const m: Record<number,{revenue:number,nights:number,bookings:number,occupancy:number}> = {}
    for (let i=0;i<12;i++) m[i]={revenue:0,nights:0,bookings:0,occupancy:0}
    active.forEach(b => {
      const mo = new Date(b.checkin_date).getMonth()
      m[mo].revenue += parseFloat(b.total_price||0)
      m[mo].nights += b.nights||0
      m[mo].bookings++
    })
    return Object.entries(m).map(([mo,v]) => ({ name:MONTHS[+mo], ...v }))
  }, [active])

  // House data
  const byHouse = useMemo(() => {
    const m: Record<string,{name:string,revenue:number,nights:number,bookings:number}> = {}
    active.forEach(b => {
      if (!m[b.house_id]) m[b.house_id]={name:b.house_name||'?',revenue:0,nights:0,bookings:0}
      m[b.house_id].revenue += parseFloat(b.total_price||0)
      m[b.house_id].nights += b.nights||0
      m[b.house_id].bookings++
    })
    return Object.values(m)
  }, [active])

  // Channel data
  const byChannel = useMemo(() => {
    const m: Record<string,{name:string,revenue:number,bookings:number}> = {}
    active.forEach(b => {
      const ch = b.channel_name||b.channel||'Direkt'
      if (!m[ch]) m[ch]={name:ch,revenue:0,bookings:0}
      m[ch].revenue += parseFloat(b.total_price||0)
      m[ch].bookings++
    })
    return Object.values(m).sort((a,b)=>b.revenue-a.revenue)
  }, [active])

  // Sorted bookings for tab 3
  const sortedBookings = useMemo(() => {
    return [...active].sort((a,b) => {
      const av = a[sortBy]||'', bv = b[sortBy]||''
      const dir = sortDir==='asc'?1:-1
      if (typeof av==='number') return (av-bv)*dir
      return String(av).localeCompare(String(bv))*dir
    })
  }, [active, sortBy, sortDir])

  const totalRevenue = active.reduce((s,b)=>s+parseFloat(b.total_price||0),0)
  const totalNights  = active.reduce((s,b)=>s+(b.nights||0),0)
  const avgRev = active.length ? totalRevenue/active.length : 0
  const currentYear = new Date().getFullYear()

  const SortTh = ({col,label}:{col:string,label:string}) => (
    <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase cursor-pointer hover:text-gray-800 whitespace-nowrap" onClick={() => { if(sortBy===col) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortBy(col);setSortDir('desc')} }}>
      {label}{sortBy===col ? (sortDir==='asc'?'▲':'▼') : ''}
    </th>
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Auswertungen</h1>
        <div className="flex gap-2 flex-wrap">
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={houseFilter} onChange={e=>setHouseFilter(e.target.value)}>
            <option value="">Alle Häuser</option>
            {houses.map((h:any)=><option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={year} onChange={e=>setYear(+e.target.value)}>
            {[currentYear-2,currentYear-1,currentYear,currentYear+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Gesamtumsatz',value:fmtEur(totalRevenue)},
          {label:'Buchungen',value:active.length},
          {label:'Nächte',value:totalNights},
          {label:'Ø pro Buchung',value:fmtEur(avgRev)},
        ].map(k=>(
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab===i?'border-blue-600 text-blue-700':'-mb-px border-transparent text-gray-500 hover:text-gray-800'}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Laden…</div> : (
        <>
          {/* Tab 0: Monthly */}
          {tab===0 && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Umsatz pro Monat</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{fontSize:12}} />
                    <YAxis tickFormatter={v=>fmtEur(v)} tick={{fontSize:11}} width={80} />
                    <Tooltip formatter={(v:any)=>fmtEur(v)} />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[4,4,0,0]} name="Umsatz" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Buchungen & Nächte pro Monat</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{fontSize:12}} />
                    <YAxis tick={{fontSize:11}} />
                    <Tooltip />
                    <Line type="monotone" dataKey="bookings" stroke="#2563eb" name="Buchungen" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="nights" stroke="#16a34a" name="Nächte" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tab 1: Houses */}
          {tab===1 && (
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Umsatz nach Haus</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byHouse} layout="vertical">
                    <XAxis type="number" tickFormatter={v=>fmtEur(v)} tick={{fontSize:11}} />
                    <YAxis type="category" dataKey="name" tick={{fontSize:12}} width={80} />
                    <Tooltip formatter={(v:any)=>fmtEur(v)} />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[0,4,4,0]} name="Umsatz" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Details</h2>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-gray-500 border-b">{['Haus','Buchungen','Nächte','Umsatz'].map(h=><th key={h} className="pb-2 text-left">{h}</th>)}</tr></thead>
                  <tbody>{byHouse.map((h:any,i:number)=>(
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 font-medium">{h.name}</td>
                      <td className="py-2">{h.bookings}</td>
                      <td className="py-2">{h.nights}</td>
                      <td className="py-2 font-medium">{fmtEur(h.revenue)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Channels */}
          {tab===2 && (
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Buchungen nach Kanal</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={byChannel} dataKey="bookings" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({name,percent}:any)=>`${name} ${(percent*100).toFixed(0)}%`}>
                      {byChannel.map((_:any,i:number)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(v:any)=>[v,'Buchungen']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Details</h2>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-gray-500 border-b">{['Kanal','Buchungen','Umsatz'].map(h=><th key={h} className="pb-2 text-left">{h}</th>)}</tr></thead>
                  <tbody>{byChannel.map((c:any,i:number)=>(
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:COLORS[i%COLORS.length]}} />{c.name}</td>
                      <td className="py-2">{c.bookings}</td>
                      <td className="py-2 font-medium">{fmtEur(c.revenue)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Bookings overview */}
          {tab===3 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <SortTh col="guest_name" label="Gast" />
                      <SortTh col="house_name" label="Haus" />
                      <SortTh col="checkin_date" label="Anreise" />
                      <SortTh col="checkout_date" label="Abreise" />
                      <SortTh col="nights" label="N." />
                      <SortTh col="total_price" label="Umsatz" />
                      <SortTh col="status" label="Status" />
                      <SortTh col="invoice_number" label="Rechnung" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBookings.map((b:any)=>(
                      <tr key={b.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{b.guest_name}</td>
                        <td className="px-4 py-2">{b.house_name}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{fmtDate(b.checkin_date)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{fmtDate(b.checkout_date)}</td>
                        <td className="px-4 py-2 text-center">{b.nights}</td>
                        <td className="px-4 py-2 font-medium whitespace-nowrap">{fmtEur(parseFloat(b.total_price||0))}</td>
                        <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status]||'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[b.status]||b.status}</span></td>
                        <td className="px-4 py-2 font-mono text-xs">{b.invoice_number||'–'}</td>
                      </tr>
                    ))}
                    {sortedBookings.length===0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Keine Buchungen im gewählten Jahr.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
