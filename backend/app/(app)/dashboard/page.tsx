'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell, ReferenceLine,
} from 'recharts'

const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const HOUSE_COLORS = ['#1d4ed8','#10b981','#8b5cf6','#f59e0b','#ef4444']

function fmtEur(n: number) { return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n??0) }
function fmtPct(n: number) { return `${(n??0).toFixed(1)} %` }
function fmtDate(d: string) { if(!d)return''; return new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) }

function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate() }
function overlapNights(ci: string, co: string, year: number, month: number) {
  const ms = new Date(year, month-1, 1), me = new Date(year, month, 1)
  const cs = new Date(ci), ce = new Date(co)
  const start = cs < ms ? ms : cs, end = ce > me ? me : ce
  const diff = Math.round((end.getTime()-start.getTime())/86400000)
  return Math.max(0, diff)
}

function Toggle({ value, onChange, options }: any) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((o: any) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${value===o.value ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function KpiCard({ label, value, sub, color='blue', icon, onClick }: any) {
  const colors: any = { blue:'text-blue-700 bg-blue-50', green:'text-green-700 bg-green-50', purple:'text-purple-700 bg-purple-50', orange:'text-orange-700 bg-orange-50', red:'text-red-700 bg-red-50' }
  return (
    <div className={`kpi-card ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`text-lg p-1.5 rounded-lg ${colors[color]}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}{onClick && <span className="ml-1 text-blue-400">→ Details</span>}</div>}
    </div>
  )
}

function BookingListModal({ title, bookings, onClose }: any) {
  const router = useRouter()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{title} <span className="text-gray-400 font-normal text-base">({bookings.length})</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold">×</button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>{['Haus','Gast','Check-in','Check-out','Nächte','Preis','Status'].map(h=>(
                <th key={h} className="text-left text-gray-500 font-medium px-4 py-2 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((b: any) => (
                <tr key={b.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => { onClose(); router.push(`/bookings/${b.id}`) }}>
                  <td className="px-4 py-2 font-medium">{b.house_short||b.house_name}</td>
                  <td className="px-4 py-2"><div>{b.guest_name}</div>{b.company_name&&<div className="text-xs text-gray-400">{b.company_name}</div>}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(b.checkin_date)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(b.checkout_date)}</td>
                  <td className="px-4 py-2 text-center">{b.nights}</td>
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{fmtEur(parseFloat(b.total_price??0))}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const now = new Date()
  const thisYear = now.getFullYear()
  const [from, setFrom] = useState(`${thisYear}-01-01`)
  const [to, setTo] = useState(`${thisYear}-12-31`)
  const [bookings, setBookings] = useState<any[]>([])
  const [houses, setHouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [listModal, setListModal] = useState<any>(null)
  const [revType, setRevType] = useState<'bar'|'line'>('bar')
  const [revBreak, setRevBreak] = useState<'total'|'house'>('total')
  const [occType, setOccType] = useState<'bar'|'line'>('line')
  const [occBreak, setOccBreak] = useState<'total'|'house'>('total')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncModeModal, setSyncModeModal] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/bookings?limit=1000').then(r=>r.json()),
      fetch('/api/houses').then(r=>r.json()),
    ]).then(([b,h]) => {
      setBookings(b.data??[])
      setHouses(h.data??h)
      setLoading(false)
    })
  }, [])

  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

  // Filter by date range
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      if (!b.checkin_date) return false
      const ci = b.checkin_date.slice(0,10), co = (b.checkout_date||'').slice(0,10)
      return co >= from && ci <= to
    })
  }, [bookings, from, to])

  const active = useMemo(() => filtered.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status)), [filtered])
  const cancelled = useMemo(() => filtered.filter(b => b.status === 'storniert'), [filtered])

  // KPIs
  const kpis = useMemo(() => {
    if (!active.length) return null
    const totalNights = active.reduce((s,b) => s+(b.nights||0), 0)
    const totalRevenue = active.reduce((s,b) => s+parseFloat(b.total_price??0), 0)
    const adr = totalNights > 0 ? totalRevenue/totalNights : 0
    // available nights = days in range * num houses
    const fromD = new Date(from), toD = new Date(to)
    const rangeDays = Math.round((toD.getTime()-fromD.getTime())/86400000)+1
    const availNights = rangeDays * (houses.length||1)
    const occupancyRate = availNights > 0 ? (totalNights/availNights)*100 : 0
    const revpar = availNights > 0 ? totalRevenue/availNights : 0
    const avgLos = active.length > 0 ? totalNights/active.length : 0
    const avgLeadTime = active.filter(b=>b.booking_date&&b.checkin_date).reduce((s,b) => {
      const d = Math.round((new Date(b.checkin_date).getTime()-new Date(b.booking_date).getTime())/86400000)
      return s+(d>0?d:0)
    }, 0) / (active.filter(b=>b.booking_date&&b.checkin_date).length||1)
    const cancellationRate = filtered.length > 0 ? (cancelled.length/filtered.length)*100 : 0
    const returning = active.filter(b => b.is_returning_guest)

    return {
      occupancyRate, totalRevenue, totalNights, confirmedBookings: active.length,
      adr, revpar, avgLos: +avgLos.toFixed(1), avgLeadTime: +avgLeadTime.toFixed(0),
      cancellationRate, cancellations: cancelled.length, returningGuests: returning.length,
      returningList: returning, cancelledList: cancelled,
    }
  }, [active, cancelled, filtered, houses, from, to])

  // Monthly data
  const monthly = useMemo(() => {
    const fromYear = parseInt(from.slice(0,4)), fromMonth = parseInt(from.slice(5,7))
    const toYear = parseInt(to.slice(0,4)), toMonth = parseInt(to.slice(5,7))
    const months: any[] = []

    for (let y = fromYear; y <= toYear; y++) {
      const mStart = y === fromYear ? fromMonth : 1
      const mEnd = y === toYear ? toMonth : 12
      for (let m = mStart; m <= mEnd; m++) {
        const monthKey = `${y}-${String(m).padStart(2,'0')}`
        const isPast = monthKey < currentMonthStr
        const isCurrent = monthKey === currentMonthStr
        const isFuture = monthKey > currentMonthStr
        const days = daysInMonth(y, m)

        let revenue = 0, nights = 0, count = 0, leadTimeSum = 0, leadTimeN = 0, losSum = 0
        const revByHouse: Record<number,number> = {}
        const occByHouse: Record<number,number> = {}

        active.forEach(b => {
          const n = overlapNights(b.checkin_date?.slice(0,10)||'', b.checkout_date?.slice(0,10)||'', y, m)
          if (!n) return
          const total = parseFloat(b.total_price??0)
          const totalN = b.nights||1
          const monthRevenue = totalN > 0 ? (total/totalN)*n : 0
          revenue += monthRevenue
          nights += n
          count++
          losSum += totalN
          if (b.booking_date && b.checkin_date) {
            const lt = Math.round((new Date(b.checkin_date).getTime()-new Date(b.booking_date).getTime())/86400000)
            if (lt > 0) { leadTimeSum += lt; leadTimeN++ }
          }
          const hid = b.house_id
          revByHouse[hid] = (revByHouse[hid]||0)+monthRevenue
          occByHouse[hid] = (occByHouse[hid]||0)+n
        })

        const availNights = days * (houses.length||1)
        const occupancyRate = availNights > 0 ? +(nights/availNights*100).toFixed(1) : 0
        const row: any = {
          month: monthKey, monthLabel: MONTH_NAMES[m-1],
          revenue: +revenue.toFixed(0), nights, count, occupancyRate,
          avg_lead_time: leadTimeN > 0 ? +(leadTimeSum/leadTimeN).toFixed(1) : 0,
          avg_los: count > 0 ? +(losSum/count).toFixed(1) : 0,
          isPast, isCurrent, isFuture,
        }
        houses.forEach(h => {
          row[`rev_h${h.id}`] = +(revByHouse[h.id]||0).toFixed(0)
          const hAvail = days
          row[`occ_h${h.id}`] = hAvail > 0 ? +((occByHouse[h.id]||0)/hAvail*100).toFixed(1) : 0
        })
        months.push(row)
      }
    }
    return months
  }, [active, houses, from, to, currentMonthStr])

  // House data
  const houseData = useMemo(() => {
    const fromD = new Date(from), toD = new Date(to)
    const rangeDays = Math.round((toD.getTime()-fromD.getTime())/86400000)+1
    return houses.map(h => {
      const hb = active.filter(b => b.house_id === h.id)
      const hc = cancelled.filter(b => b.house_id === h.id)
      const nights = hb.reduce((s,b)=>s+(b.nights||0),0)
      const revenue = hb.reduce((s,b)=>s+parseFloat(b.total_price??0),0)
      const adr = nights > 0 ? revenue/nights : 0
      const revpar = rangeDays > 0 ? revenue/rangeDays : 0
      const avgGuests = hb.length > 0 ? hb.reduce((s,b)=>s+(b.guest_count||0),0)/hb.length : 0
      const occRate = rangeDays > 0 ? nights/rangeDays*100 : 0
      return {
        ...h, bookings: hb.length, nights, revenue: +revenue.toFixed(0),
        adr: +adr.toFixed(2), revpar: +revpar.toFixed(2),
        avgGuests: +avgGuests.toFixed(1), occupancyRate: +occRate.toFixed(1),
        cancellations: hc.length, capacity: h.capacity||1
      }
    })
  }, [active, cancelled, houses, from, to])

  // Cashflow (by checkin month)
  const cashflow = useMemo(() => {
    const map: Record<string,{cashflow:number,payments:number}> = {}
    active.filter(b=>b.payment_status==='bezahlt'&&b.checkin_date).forEach(b => {
      const mk = b.checkin_date.slice(0,7)
      if (!map[mk]) map[mk] = {cashflow:0, payments:0}
      map[mk].cashflow += parseFloat(b.total_price??0)
      map[mk].payments++
    })
    return monthly.map(m => ({
      ...m, cashflow: +(map[m.month]?.cashflow||0).toFixed(0),
      payments: map[m.month]?.payments||0
    }))
  }, [active, monthly])

  const handleLodgifySync = async (mode: 'new_only' | 'full_sync') => {
    setSyncModeModal(false)
    setSyncing(true); setSyncMsg('')
    const res = await fetch('/api/lodgify-sync', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ mode }),
    })
    const j = await res.json()
    if (j.error) setSyncMsg('❌ '+j.error)
    else if (mode === 'full_sync') setSyncMsg(`✅ Komplett-Sync: ${j.regular} Buchungen importiert`)
    else setSyncMsg(`✅ ${j.inserted} neu, ${j.updated} aktualisiert`)
    setSyncing(false)
    setTimeout(()=>setSyncMsg(''),8000)
    // reload bookings
    const from2 = from, to2 = to
    fetch(`/api/bookings?from=${from2}&to=${to2}&limit=1000`).then(r=>r.json()).then(d=>setBookings(d.data??[]))
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Daten werden geladen…</div>

  return (
    <div className="p-6 space-y-6">
      {listModal && <BookingListModal title={listModal.title} bookings={listModal.bookings} onClose={()=>setListModal(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Übersicht Revenue Management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-gray-500">Von</label>
          <input type="date" className="form-input" style={{width:'9rem'}} value={from} onChange={e=>setFrom(e.target.value)} />
          <label className="text-xs text-gray-500">Bis</label>
          <input type="date" className="form-input" style={{width:'9rem'}} value={to} onChange={e=>setTo(e.target.value)} />
          <button onClick={() => setSyncModeModal(true)} disabled={syncing} className="btn-secondary flex items-center gap-1.5">
            {syncing ? '⏳' : '🔄'} Lodgify Import
          </button>
          <a href="/bookings/new" className="btn-primary">+ Neue Buchung</a>
        </div>
      </div>

      {syncMsg && <div className={`text-sm px-4 py-2 rounded-lg ${syncMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{syncMsg}</div>}

      {/* Lodgify Sync Mode Modal */}
      {syncModeModal && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)' }} onClick={() => setSyncModeModal(false)}>
          <div className="card" style={{ minWidth:360, maxWidth:440, padding:28 }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">🔄 Lodgify-Synchronisierung</h3>
            <p className="text-sm text-gray-500 mb-5">Wie soll synchronisiert werden?</p>
            <div className="flex flex-col gap-3 mb-5">
              <button
                className="w-full text-left p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                onClick={() => handleLodgifySync('new_only')}
              >
                <div className="font-semibold text-blue-900 mb-1">➕ Nur neue Buchungen</div>
                <div className="text-xs text-blue-700">Bereits vorhandene Buchungen bleiben unverändert. Neue Buchungen aus Lodgify werden hinzugefügt.</div>
              </button>
              <button
                className="w-full text-left p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                onClick={() => {
                  if (confirm('⚠️ Alle bestehenden Buchungen werden gelöscht und komplett neu aus Lodgify importiert. Fortfahren?')) {
                    handleLodgifySync('full_sync')
                  }
                }}
              >
                <div className="font-semibold text-red-900 mb-1">🔁 Komplett neu synchronisieren</div>
                <div className="text-xs text-red-700">Alle bestehenden Buchungen werden gelöscht und vollständig aus Lodgify neu importiert.</div>
              </button>
            </div>
            <div className="flex justify-end">
              <button className="btn-secondary text-sm" onClick={() => setSyncModeModal(false)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {kpis ? (
        <>
          {/* KPIs Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Auslastung" value={fmtPct(kpis.occupancyRate)} sub={`${kpis.totalNights} Nächte belegt`} color="blue" icon="🏠" />
            <KpiCard label="Umsatz" value={fmtEur(kpis.totalRevenue)} sub={`${kpis.confirmedBookings} Buchungen`} color="green" icon="💶" />
            <KpiCard label="ADR" value={fmtEur(kpis.adr)} sub="Ø Tagespreis" color="purple" icon="📊" />
            <KpiCard label="RevPAR" value={fmtEur(kpis.revpar)} sub="pro Haus/Nacht" color="orange" icon="📈" />
          </div>
          {/* KPIs Row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ø Aufenthalt" value={`${kpis.avgLos} Nächte`} sub="Länge des Aufenthalts" color="blue" icon="🌙" />
            <KpiCard label="Ø Vorlaufzeit" value={`${kpis.avgLeadTime} Tage`} sub="Buchung bis Check-in" color="purple" icon="⏱️" />
            <KpiCard label="Stornoquote" value={fmtPct(kpis.cancellationRate)} sub={`${kpis.cancellations} Stornos`} color="red" icon="❌"
              onClick={() => setListModal({ title: 'Stornierte Buchungen', bookings: kpis.cancelledList })} />
            <KpiCard label="Stammgäste" value={kpis.returningGuests} sub="Wiederholungsbuchungen" color="green" icon="⭐"
              onClick={() => setListModal({ title: 'Stammgäste', bookings: kpis.returningList })} />
          </div>

          {/* Revenue & Occupancy Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <h2 className="font-semibold text-gray-800">Umsatz pro Monat</h2>
                <div className="flex gap-2 flex-wrap">
                  <Toggle value={revType} onChange={setRevType} options={[{value:'bar',label:'▐▌ Balken'},{value:'line',label:'〜 Kurve'}]} />
                  <Toggle value={revBreak} onChange={setRevBreak} options={[{value:'total',label:'Gesamt'},{value:'house',label:'Je Haus'}]} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-2">Buchungsumsatz, anteilig auf Aufenthaltstage verteilt (Accrual)</p>
              <ResponsiveContainer width="100%" height={220}>
                {revType === 'bar' ? (
                  <BarChart data={monthly} margin={{top:0,right:0,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                    <YAxis tick={{fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v:any)=>fmtEur(+v)} labelStyle={{fontWeight:600}} />
                    {revBreak==='house' && <Legend wrapperStyle={{fontSize:11}} />}
                    {revBreak==='total'
                      ? <Bar dataKey="revenue" radius={[4,4,0,0]} name="Umsatz">
                          {monthly.map((m,i)=>{
                            const base = m.revenue>=10000?'#16a34a':m.revenue>=8000?'#ca8a04':'#dc2626'
                            const fill = m.isFuture ? (m.revenue>=10000?'#bbf7d0':m.revenue>=8000?'#fef08a':'#fecaca') : base
                            return <Cell key={i} fill={fill} />
                          })}
                        </Bar>
                      : houses.map((h,i)=><Bar key={h.id} stackId="r" dataKey={`rev_h${h.id}`} fill={HOUSE_COLORS[i%HOUSE_COLORS.length]} name={h.name} radius={i===houses.length-1?[4,4,0,0]:[0,0,0,0]} />)
                    }
                  </BarChart>
                ) : (
                  <LineChart data={monthly} margin={{top:0,right:10,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                    <YAxis tick={{fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v:any)=>fmtEur(+v)} labelStyle={{fontWeight:600}} />
                    {revBreak==='house' && <Legend wrapperStyle={{fontSize:11}} />}
                    <ReferenceLine x={MONTH_NAMES[now.getMonth()]} stroke="#1d4ed8" strokeDasharray="4 2" strokeWidth={1.5} />
                    {revBreak==='total'
                      ? <Line type="monotone" dataKey="revenue" stroke="#1d4ed8" strokeWidth={2} dot={{r:4}} name="Umsatz" />
                      : houses.map((h,i)=><Line key={h.id} type="monotone" dataKey={`rev_h${h.id}`} stroke={HOUSE_COLORS[i%HOUSE_COLORS.length]} strokeWidth={2} dot={{r:3}} name={h.name} />)
                    }
                  </LineChart>
                ) as any}
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="font-semibold text-gray-800">Auslastung % pro Monat</h2>
                <div className="flex gap-2 flex-wrap">
                  <Toggle value={occType} onChange={setOccType} options={[{value:'bar',label:'▐▌ Balken'},{value:'line',label:'〜 Kurve'}]} />
                  <Toggle value={occBreak} onChange={setOccBreak} options={[{value:'total',label:'Gesamt'},{value:'house',label:'Je Haus'}]} />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                {occType === 'bar' ? (
                  <BarChart data={monthly} margin={{top:0,right:0,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                    <YAxis domain={[0,100]} tick={{fontSize:11}} tickFormatter={v=>`${v}%`} />
                    <Tooltip formatter={(v:any)=>`${v} %`} labelStyle={{fontWeight:600}} />
                    {occBreak==='house' && <Legend wrapperStyle={{fontSize:11}} />}
                    {occBreak==='total'
                      ? <Bar dataKey="occupancyRate" radius={[4,4,0,0]} name="Auslastung">
                          {monthly.map((m,i)=>{
                            const base = m.occupancyRate>=70?'#16a34a':m.occupancyRate>=50?'#ca8a04':'#dc2626'
                            const fill = m.isFuture ? (m.occupancyRate>=70?'#bbf7d0':m.occupancyRate>=50?'#fef08a':'#fecaca') : base
                            return <Cell key={i} fill={fill} />
                          })}
                        </Bar>
                      : houses.map((h,i)=><Bar key={h.id} dataKey={`occ_h${h.id}`} fill={HOUSE_COLORS[i%HOUSE_COLORS.length]} radius={[4,4,0,0]} name={h.name} />)
                    }
                  </BarChart>
                ) : (
                  <LineChart data={monthly} margin={{top:0,right:10,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                    <YAxis domain={[0,100]} tick={{fontSize:11}} tickFormatter={v=>`${v}%`} />
                    <Tooltip formatter={(v:any)=>`${v} %`} labelStyle={{fontWeight:600}} />
                    {occBreak==='house' && <Legend wrapperStyle={{fontSize:11}} />}
                    <ReferenceLine x={MONTH_NAMES[now.getMonth()]} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5} />
                    {occBreak==='total'
                      ? <Line type="monotone" dataKey="occupancyRate" stroke="#10b981" strokeWidth={2} dot={{r:4}} name="Auslastung" />
                      : houses.map((h,i)=><Line key={h.id} type="monotone" dataKey={`occ_h${h.id}`} stroke={HOUSE_COLORS[i%HOUSE_COLORS.length]} strokeWidth={2} dot={{r:3}} name={h.name} />)
                    }
                  </LineChart>
                ) as any}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cashflow */}
          <div className="card">
            <div className="mb-1">
              <h2 className="font-semibold text-gray-800">Einnahme-Cashflow — bezahlte Buchungen nach Check-in</h2>
              <p className="text-xs text-gray-400">Gesamt: <span className="font-semibold text-gray-700">{fmtEur(cashflow.reduce((s,r)=>s+r.cashflow,0))}</span></p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashflow} margin={{top:0,right:0,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                <YAxis tick={{fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v:any)=>fmtEur(+v)} labelStyle={{fontWeight:600}} />
                <Bar dataKey="cashflow" radius={[4,4,0,0]} name="Cashflow">
                  {cashflow.map((m,i)=>(<Cell key={i} fill={m.isFuture?'#a7f3d0':m.isCurrent?'#059669':'#10b981'} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Lead time & LOS */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-1">Ø Vorlaufzeit pro Monat</h2>
              <p className="text-xs text-gray-400 mb-3">Tage zwischen Buchung und Anreise</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthly} margin={{top:4,right:10,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                  <YAxis tick={{fontSize:11}} tickFormatter={v=>`${v}d`} />
                  <Tooltip formatter={(v:any)=>[`${v} Tage`,'Ø Vorlaufzeit']} labelStyle={{fontWeight:600}} />
                  <Line type="monotone" dataKey="avg_lead_time" stroke="#8b5cf6" strokeWidth={2.5} dot={{r:4,fill:'#8b5cf6'}} name="Ø Vorlaufzeit" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-1">Ø Aufenthaltsdauer pro Monat</h2>
              <p className="text-xs text-gray-400 mb-3">Durchschnittliche gebuchte Nächte</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthly} margin={{top:4,right:10,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                  <YAxis tick={{fontSize:11}} tickFormatter={v=>`${v}N`} />
                  <Tooltip formatter={(v:any)=>[`${v} Nächte`,'Ø Aufenthalt']} labelStyle={{fontWeight:600}} />
                  <Line type="monotone" dataKey="avg_los" stroke="#f59e0b" strokeWidth={2.5} dot={{r:4,fill:'#f59e0b'}} name="Ø Aufenthalt" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* House comparison */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Häuservergleich</h2>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Haus','Buchungen','Nächte','Auslastung','Umsatz','ADR','RevPAR','Ø Gäste','Stornos'].map(h=>(
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {houseData.map(h=>(
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{h.name}</td>
                      <td className="py-3 pr-4 text-gray-700">{h.bookings}</td>
                      <td className="py-3 pr-4 text-gray-700">{h.nights}</td>
                      <td className="py-3 pr-4">
                        <span className={`badge ${h.occupancyRate>=70?'bg-green-100 text-green-700':h.occupancyRate>=40?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>
                          {fmtPct(h.occupancyRate)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium text-gray-900">{fmtEur(h.revenue)}</td>
                      <td className="py-3 pr-4 text-gray-700">{fmtEur(h.adr)}</td>
                      <td className="py-3 pr-4 text-gray-700">{fmtEur(h.revpar)}</td>
                      <td className="py-3 pr-4 text-center text-gray-700">{h.avgGuests||'—'}</td>
                      <td className="py-3 pr-4 text-red-600">{h.cancellations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-10 text-gray-400">Keine aktiven Buchungen im gewählten Zeitraum.</div>
      )}
    </div>
  )
}
