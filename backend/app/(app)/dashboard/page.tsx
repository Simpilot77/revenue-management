'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell, ReferenceLine, ComposedChart,
} from 'recharts'

const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const DOW_NAMES   = ['Mo','Di','Mi','Do','Fr','Sa','So']
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
// JS Sun=0 → German Mo=0..So=6
function germanDow(d: Date) { const j = d.getDay(); return j === 0 ? 6 : j - 1 }

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

function KpiCard({ label, value, sub, color='blue', icon, tooltip, onClick }: any) {
  const colors: any = { blue:'text-blue-700 bg-blue-50', green:'text-green-700 bg-green-50', purple:'text-purple-700 bg-purple-50', orange:'text-orange-700 bg-orange-50', red:'text-red-700 bg-red-50', teal:'text-teal-700 bg-teal-50' }
  return (
    <div className={`kpi-card ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-shadow' : ''}`} onClick={onClick} title={tooltip}>
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
  const [excludeLongStay, setExcludeLongStay] = useState(false)
  const [longStayThreshold, setLongStayThreshold] = useState(28)

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

  const filtered = useMemo(() => {
    return bookings.filter(b => {
      if (!b.checkin_date) return false
      const ci = b.checkin_date.slice(0,10), co = (b.checkout_date||'').slice(0,10)
      return co >= from && ci <= to
    })
  }, [bookings, from, to])

  const active = useMemo(() => {
    const base = filtered.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status))
    return excludeLongStay ? base.filter(b => (b.nights||0) <= longStayThreshold) : base
  }, [filtered, excludeLongStay, longStayThreshold])
  const cancelled = useMemo(() => filtered.filter(b => b.status === 'storniert'), [filtered])

  // Core KPIs
  const kpis = useMemo(() => {
    if (!active.length) return null
    const totalNights = active.reduce((s,b) => s+(b.nights||0), 0)
    const totalRevenue = active.reduce((s,b) => s+parseFloat(b.total_price??0), 0)
    const adr = totalNights > 0 ? totalRevenue/totalNights : 0
    const fromD = new Date(from), toD = new Date(to)
    const rangeDays = Math.round((toD.getTime()-fromD.getTime())/86400000)+1
    const availNights = rangeDays * (houses.length||1)
    const occupancyRate = availNights > 0 ? (totalNights/availNights)*100 : 0
    const revpar = availNights > 0 ? totalRevenue/availNights : 0
    const netAdr = revpar // Revenue / available nights = belegungsbereinigter ADR
    const avgLos = active.length > 0 ? totalNights/active.length : 0
    const withLt = active.filter(b=>b.booking_date&&b.checkin_date)
    const avgLeadTime = withLt.length > 0
      ? withLt.reduce((s,b)=>s+Math.max(0,Math.round((new Date(b.checkin_date).getTime()-new Date(b.booking_date).getTime())/86400000)),0) / withLt.length
      : 0
    const cancellationRate = filtered.length > 0 ? (cancelled.length/filtered.length)*100 : 0
    const returning = active.filter(b => b.is_returning_guest)
    return {
      occupancyRate, totalRevenue, totalNights, confirmedBookings: active.length,
      adr, revpar, netAdr, avgLos: +avgLos.toFixed(1), avgLeadTime: +avgLeadTime.toFixed(0),
      cancellationRate, cancellations: cancelled.length, returningGuests: returning.length,
      returningList: returning, cancelledList: cancelled,
    }
  }, [active, cancelled, filtered, houses, from, to])

  // Trailing occupancy: last 365 days (historical demand rate)
  const trailingOccupancy = useMemo(() => {
    const endD = new Date()
    const startD = new Date(Date.now() - 365*86400000)
    const s = startD.toISOString().slice(0,10), e = endD.toISOString().slice(0,10)
    const allActive = bookings.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status))
    let bookedNights = 0
    allActive.forEach(b => {
      const ci = b.checkin_date?.slice(0,10)||'', co = b.checkout_date?.slice(0,10)||''
      if (co < s || ci > e) return
      const ciT = Math.max(new Date(ci).getTime(), startD.getTime())
      const coT = Math.min(new Date(co).getTime(), endD.getTime())
      bookedNights += Math.max(0, Math.round((coT-ciT)/86400000))
    })
    const avail = 365 * (houses.length||1)
    return avail > 0 ? +(bookedNights/avail*100).toFixed(1) : 0
  }, [bookings, houses])

  // Weekday analytics
  const weekdayStats = useMemo(() => {
    const houseCount = Math.max(1, houses.length)
    // totalDow × houseCount = total available "slots" per weekday across all houses
    const totalDow = [0,0,0,0,0,0,0]
    const endD = new Date(to)
    for (let d = new Date(from); d <= endD; d.setDate(d.getDate()+1)) totalDow[germanDow(d)]++
    const availDow = totalDow.map(n => n * houseCount)

    const bookedDow = [0,0,0,0,0,0,0]
    const revDow    = [0,0,0,0,0,0,0]
    const checkinDow= [0,0,0,0,0,0,0]
    const losSumDow = [0,0,0,0,0,0,0]
    const losCntDow = [0,0,0,0,0,0,0]

    active.forEach(b => {
      const ci = new Date(b.checkin_date), co = new Date(b.checkout_date)
      const nights = b.nights||0, revenue = parseFloat(b.total_price??0)
      // per-night attribution
      for (let d = new Date(ci); d < co; d.setDate(d.getDate()+1)) {
        const ds = d.toISOString().slice(0,10)
        if (ds >= from && ds <= to) {
          const dow = germanDow(d)
          bookedDow[dow]++
          if (nights > 0) revDow[dow] += revenue/nights
        }
      }
      // check-in day
      if (b.checkin_date?.slice(0,10) >= from && b.checkin_date?.slice(0,10) <= to) {
        const dow = germanDow(ci)
        checkinDow[dow]++
        losSumDow[dow] += nights
        losCntDow[dow]++
      }
    })

    const totalCheckins = checkinDow.reduce((s,n)=>s+n,0)

    // Lead time → ADR buckets
    const ltBuckets = [{l:'0–7d',mn:0,mx:7},{l:'8–14d',mn:8,mx:14},{l:'15–30d',mn:15,mx:30},{l:'31–60d',mn:31,mx:60},{l:'61–90d',mn:61,mx:90},{l:'91+d',mn:91,mx:9999}]
    const ltData = ltBuckets.map(({l,mn,mx}) => {
      const bbs = active.filter(bk => {
        if (!bk.booking_date||!bk.checkin_date) return false
        const lt = Math.round((new Date(bk.checkin_date).getTime()-new Date(bk.booking_date).getTime())/86400000)
        return lt >= mn && lt <= mx
      })
      const tn = bbs.reduce((s,bk)=>s+(bk.nights||0),0)
      const tr = bbs.reduce((s,bk)=>s+parseFloat(bk.total_price??0),0)
      return { name:l, adr: tn>0 ? Math.round(tr/tn) : 0, bookings: bbs.length }
    })

    return {
      byDow: DOW_NAMES.map((name,i) => ({
        name,
        hitRate:    availDow[i]>0   ? +(bookedDow[i]/availDow[i]*100).toFixed(1) : 0,
        checkinPct: totalCheckins>0  ? +(checkinDow[i]/totalCheckins*100).toFixed(1) : 0,
        avgLos:     losCntDow[i]>0  ? +(losSumDow[i]/losCntDow[i]).toFixed(1) : 0,
        adr:        bookedDow[i]>0  ? Math.round(revDow[i]/bookedDow[i]) : 0,
        netAdr:     availDow[i]>0   ? Math.round(revDow[i]/availDow[i]) : 0,
        bookedNights: bookedDow[i],
        totalNights:  availDow[i],
      })),
      ltData,
    }
  }, [active, from, to])

  // Monthly data
  const monthly = useMemo(() => {
    const fromYear = parseInt(from.slice(0,4)), fromMonth = parseInt(from.slice(5,7))
    const toYear   = parseInt(to.slice(0,4)),   toMonth   = parseInt(to.slice(5,7))
    const months: any[] = []
    for (let y = fromYear; y <= toYear; y++) {
      const mStart = y===fromYear ? fromMonth : 1, mEnd = y===toYear ? toMonth : 12
      for (let m = mStart; m <= mEnd; m++) {
        const monthKey = `${y}-${String(m).padStart(2,'0')}`
        const isPast = monthKey < currentMonthStr, isCurrent = monthKey === currentMonthStr, isFuture = monthKey > currentMonthStr
        const days = daysInMonth(y, m)
        let revenue = 0, nights = 0, count = 0, leadTimeSum = 0, leadTimeN = 0, losSum = 0
        const revByHouse: Record<number,number> = {}, occByHouse: Record<number,number> = {}
        active.forEach(b => {
          const n = overlapNights(b.checkin_date?.slice(0,10)||'', b.checkout_date?.slice(0,10)||'', y, m)
          if (!n) return
          const total = parseFloat(b.total_price??0), totalN = b.nights||1
          const monthRevenue = totalN>0 ? (total/totalN)*n : 0
          revenue += monthRevenue; nights += n; count++; losSum += totalN
          if (b.booking_date&&b.checkin_date) {
            const lt = Math.round((new Date(b.checkin_date).getTime()-new Date(b.booking_date).getTime())/86400000)
            if (lt>0) { leadTimeSum += lt; leadTimeN++ }
          }
          revByHouse[b.house_id] = (revByHouse[b.house_id]||0)+monthRevenue
          occByHouse[b.house_id] = (occByHouse[b.house_id]||0)+n
        })
        const availNights = days*(houses.length||1)
        const row: any = {
          month: monthKey, monthLabel: MONTH_NAMES[m-1], revenue: +revenue.toFixed(0),
          nights, count, occupancyRate: availNights>0 ? +(nights/availNights*100).toFixed(1) : 0,
          avg_lead_time: leadTimeN>0 ? +(leadTimeSum/leadTimeN).toFixed(1) : 0,
          avg_los: count>0 ? +(losSum/count).toFixed(1) : 0,
          isPast, isCurrent, isFuture,
        }
        houses.forEach(h => {
          row[`rev_h${h.id}`] = +(revByHouse[h.id]||0).toFixed(0)
          row[`occ_h${h.id}`] = days>0 ? +((occByHouse[h.id]||0)/days*100).toFixed(1) : 0
        })
        months.push(row)
      }
    }
    return months
  }, [active, houses, from, to, currentMonthStr])

  // House comparison
  const houseData = useMemo(() => {
    const fromD = new Date(from), toD = new Date(to)
    const rangeDays = Math.round((toD.getTime()-fromD.getTime())/86400000)+1
    return houses.map(h => {
      const hb = active.filter(b=>b.house_id===h.id), hc = cancelled.filter(b=>b.house_id===h.id)
      const nights = hb.reduce((s,b)=>s+(b.nights||0),0), revenue = hb.reduce((s,b)=>s+parseFloat(b.total_price??0),0)
      return {
        ...h, bookings:hb.length, nights, revenue: +revenue.toFixed(0),
        adr: nights>0 ? +( revenue/nights).toFixed(2) : 0,
        revpar: rangeDays>0 ? +(revenue/rangeDays).toFixed(2) : 0,
        avgGuests: hb.length>0 ? +(hb.reduce((s,b)=>s+(b.guest_count||0),0)/hb.length).toFixed(1) : 0,
        occupancyRate: rangeDays>0 ? +(nights/rangeDays*100).toFixed(1) : 0,
        cancellations: hc.length,
      }
    })
  }, [active, cancelled, houses, from, to])

  // Cashflow
  const cashflow = useMemo(() => {
    const map: Record<string,{cashflow:number,payments:number}> = {}
    active.filter(b=>b.payment_status==='bezahlt'&&b.checkin_date).forEach(b => {
      const mk = b.checkin_date.slice(0,7)
      if (!map[mk]) map[mk]={cashflow:0,payments:0}
      map[mk].cashflow += parseFloat(b.total_price??0); map[mk].payments++
    })
    return monthly.map(m => ({ ...m, cashflow:+(map[m.month]?.cashflow||0).toFixed(0), payments:map[m.month]?.payments||0 }))
  }, [active, monthly])

  const handleLodgifySync = async (mode: 'new_only'|'full_sync') => {
    setSyncModeModal(false); setSyncing(true); setSyncMsg('')
    const res = await fetch('/api/lodgify-sync', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({mode}) })
    const j = await res.json()
    if (j.error) setSyncMsg('❌ '+j.error)
    else if (mode==='full_sync') setSyncMsg(`✅ Komplett-Sync: ${j.regular} Buchungen importiert`)
    else setSyncMsg(`✅ ${j.inserted} neu, ${j.updated} aktualisiert`)
    setSyncing(false); setTimeout(()=>setSyncMsg(''),8000)
    fetch('/api/bookings?limit=1000').then(r=>r.json()).then(d=>setBookings(d.data??[]))
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
          <button onClick={()=>setSyncModeModal(true)} disabled={syncing} className="btn-secondary flex items-center gap-1.5">
            {syncing?'⏳':'🔄'} Lodgify Import
          </button>
          <a href="/bookings/new" className="btn-primary">+ Neue Buchung</a>
        </div>
      </div>

      {syncMsg && <div className={`text-sm px-4 py-2 rounded-lg ${syncMsg.startsWith('✅')?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>{syncMsg}</div>}

      {/* Langzeitbuchungen Filter */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-amber-800">
          <input type="checkbox" checked={excludeLongStay} onChange={e=>setExcludeLongStay(e.target.checked)} className="rounded" />
          Langzeitbuchungen ausschließen
        </label>
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <span>ab</span>
          <input type="number" min={1} max={365} value={longStayThreshold}
            onChange={e=>setLongStayThreshold(Math.max(1,+e.target.value))}
            className="w-16 border border-amber-300 rounded-lg px-2 py-1 text-sm text-center bg-white" />
          <span>Nächten gilt eine Buchung als Langzeitbuchung</span>
          {excludeLongStay && (() => {
            const n = active.length > 0 ? filtered.filter(b=>['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status)&&(b.nights||0)>longStayThreshold).length : 0
            return n > 0 ? <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{n} ausgeblendet</span> : null
          })()}
        </div>
      </div>

      {/* Lodgify Sync Modal */}
      {syncModeModal && (
        <div style={{position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.45)'}} onClick={()=>setSyncModeModal(false)}>
          <div className="card" style={{minWidth:360,maxWidth:440,padding:28}} onClick={e=>e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">🔄 Lodgify-Synchronisierung</h3>
            <p className="text-sm text-gray-500 mb-5">Wie soll synchronisiert werden?</p>
            <div className="flex flex-col gap-3 mb-5">
              <button className="w-full text-left p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors" onClick={()=>handleLodgifySync('new_only')}>
                <div className="font-semibold text-blue-900 mb-1">➕ Nur neue Buchungen</div>
                <div className="text-xs text-blue-700">Bereits vorhandene Buchungen bleiben unverändert.</div>
              </button>
              <button className="w-full text-left p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                onClick={()=>{ if(confirm('⚠️ Alle bestehenden Buchungen werden gelöscht und komplett neu aus Lodgify importiert. Fortfahren?')) handleLodgifySync('full_sync') }}>
                <div className="font-semibold text-red-900 mb-1">🔁 Komplett neu synchronisieren</div>
                <div className="text-xs text-red-700">Alle bestehenden Buchungen werden gelöscht und vollständig neu importiert.</div>
              </button>
            </div>
            <div className="flex justify-end"><button className="btn-secondary text-sm" onClick={()=>setSyncModeModal(false)}>Abbrechen</button></div>
          </div>
        </div>
      )}

      {kpis ? (
        <>
          {/* KPIs Row 1: Core */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Auslastung" value={fmtPct(kpis.occupancyRate)} sub={`${kpis.totalNights} Nächte belegt`} color="blue" icon="🏠" tooltip="Belegte Nächte / verfügbare Nächte im Zeitraum" />
            <KpiCard label="Umsatz" value={fmtEur(kpis.totalRevenue)} sub={`${kpis.confirmedBookings} Buchungen`} color="green" icon="💶" />
            <KpiCard label="ADR" value={fmtEur(kpis.adr)} sub="Ø Tagespreis (belegte Nächte)" color="purple" icon="📊" tooltip="Average Daily Rate: Umsatz / tatsächlich belegte Nächte" />
            <KpiCard label="RevPAR" value={fmtEur(kpis.revpar)} sub="Umsatz / alle verf. Nächte" color="orange" icon="📈" tooltip="Revenue per Available Room: Umsatz / alle verfügbaren Nächte" />
          </div>

          {/* KPIs Row 2: Lead & LOS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ø Aufenthalt" value={`${kpis.avgLos} Nächte`} sub="Length of Stay" color="blue" icon="🌙" tooltip="Durchschnittliche Aufenthaltsdauer über alle Buchungen" />
            <KpiCard label="Ø Vorlaufzeit" value={`${kpis.avgLeadTime} Tage`} sub="Lead Time: Buchung → Check-in" color="purple" icon="⏱️" tooltip="Tage zwischen Buchungsdatum und Anreisedatum" />
            <KpiCard label="Stornoquote" value={fmtPct(kpis.cancellationRate)} sub={`${kpis.cancellations} Stornos`} color="red" icon="❌"
              onClick={()=>setListModal({title:'Stornierte Buchungen',bookings:kpis.cancelledList})} />
            <KpiCard label="Stammgäste" value={kpis.returningGuests} sub="Wiederholungsbuchungen" color="green" icon="⭐"
              onClick={()=>setListModal({title:'Stammgäste',bookings:kpis.returningList})} />
          </div>

          {/* KPIs Row 3: Advanced */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Net ADR (bel.-bereinigt)"
              value={fmtEur(kpis.netAdr)}
              sub="Umsatz / alle verf. Nächte"
              color="teal" icon="🎯"
              tooltip="Belegungsbereinigter ADR = RevPAR. Der tatsächliche Erlös pro verfügbarem Tag inkl. Leerstände." />
            <KpiCard
              label="Trailing Occ. (letzte 365d)"
              value={fmtPct(trailingOccupancy)}
              sub="Historische Belegungsrate"
              color="blue" icon="📅"
              tooltip="Tatsächlich gebuchte Nächte der letzten 365 Tage im Verhältnis zu allen verfügbaren Nächten." />
            <KpiCard
              label="Bester Check-in-Tag"
              value={weekdayStats.byDow.length ? weekdayStats.byDow.reduce((a,b)=>b.checkinPct>a.checkinPct?b:a).name : '–'}
              sub={weekdayStats.byDow.length ? `${weekdayStats.byDow.reduce((a,b)=>b.checkinPct>a.checkinPct?b:a).checkinPct}% aller Anreisen` : ''}
              color="green" icon="📌"
              tooltip="Wochentag mit den häufigsten Check-ins. Das ist dein stärkster Ankertag für den Buchungsfluss." />
            <KpiCard
              label="Schwächster Wochentag"
              value={weekdayStats.byDow.filter(d=>d.totalNights>0).length ? weekdayStats.byDow.filter(d=>d.totalNights>0).reduce((a,b)=>b.hitRate<a.hitRate?b:a).name : '–'}
              sub={weekdayStats.byDow.filter(d=>d.totalNights>0).length ? `${weekdayStats.byDow.filter(d=>d.totalNights>0).reduce((a,b)=>b.hitRate<a.hitRate?b:a).hitRate}% Hit Rate` : ''}
              color="orange" icon="⚠️"
              tooltip="Wochentag mit der niedrigsten Hit Rate — hier besteht der größte Handlungsbedarf bei der Preisgestaltung." />
          </div>

          {/* Charts: Revenue & Occupancy */}
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
                {revType==='bar' ? (
                  <BarChart data={monthly} margin={{top:0,right:0,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                    <YAxis tick={{fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v:any)=>fmtEur(+v)} labelStyle={{fontWeight:600}} />
                    {revBreak==='house'&&<Legend wrapperStyle={{fontSize:11}} />}
                    {revBreak==='total'
                      ? <Bar dataKey="revenue" radius={[4,4,0,0]} name="Umsatz">
                          {monthly.map((m,i)=>{const b=m.revenue>=10000?'#16a34a':m.revenue>=8000?'#ca8a04':'#dc2626';return<Cell key={i} fill={m.isFuture?(m.revenue>=10000?'#bbf7d0':m.revenue>=8000?'#fef08a':'#fecaca'):b} />})}
                        </Bar>
                      : houses.map((h,i)=><Bar key={h.id} stackId="r" dataKey={`rev_h${h.id}`} fill={HOUSE_COLORS[i%5]} name={h.name} radius={i===houses.length-1?[4,4,0,0]:[0,0,0,0]} />)
                    }
                  </BarChart>
                ) : (
                  <LineChart data={monthly} margin={{top:0,right:10,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                    <YAxis tick={{fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v:any)=>fmtEur(+v)} labelStyle={{fontWeight:600}} />
                    {revBreak==='house'&&<Legend wrapperStyle={{fontSize:11}} />}
                    <ReferenceLine x={MONTH_NAMES[now.getMonth()]} stroke="#1d4ed8" strokeDasharray="4 2" strokeWidth={1.5} />
                    {revBreak==='total'
                      ? <Line type="monotone" dataKey="revenue" stroke="#1d4ed8" strokeWidth={2} dot={{r:4}} name="Umsatz" />
                      : houses.map((h,i)=><Line key={h.id} type="monotone" dataKey={`rev_h${h.id}`} stroke={HOUSE_COLORS[i%5]} strokeWidth={2} dot={{r:3}} name={h.name} />)
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
                {occType==='bar' ? (
                  <BarChart data={monthly} margin={{top:0,right:0,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                    <YAxis domain={[0,100]} tick={{fontSize:11}} tickFormatter={v=>`${v}%`} />
                    <Tooltip formatter={(v:any)=>`${v} %`} labelStyle={{fontWeight:600}} />
                    {occBreak==='house'&&<Legend wrapperStyle={{fontSize:11}} />}
                    {occBreak==='total'
                      ? <Bar dataKey="occupancyRate" radius={[4,4,0,0]} name="Auslastung">
                          {monthly.map((m,i)=>{const b=m.occupancyRate>=70?'#16a34a':m.occupancyRate>=50?'#ca8a04':'#dc2626';return<Cell key={i} fill={m.isFuture?(m.occupancyRate>=70?'#bbf7d0':m.occupancyRate>=50?'#fef08a':'#fecaca'):b} />})}
                        </Bar>
                      : houses.map((h,i)=><Bar key={h.id} dataKey={`occ_h${h.id}`} fill={HOUSE_COLORS[i%5]} radius={[4,4,0,0]} name={h.name} />)
                    }
                  </BarChart>
                ) : (
                  <LineChart data={monthly} margin={{top:0,right:10,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{fontSize:11}} />
                    <YAxis domain={[0,100]} tick={{fontSize:11}} tickFormatter={v=>`${v}%`} />
                    <Tooltip formatter={(v:any)=>`${v} %`} labelStyle={{fontWeight:600}} />
                    {occBreak==='house'&&<Legend wrapperStyle={{fontSize:11}} />}
                    <ReferenceLine x={MONTH_NAMES[now.getMonth()]} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5} />
                    {occBreak==='total'
                      ? <Line type="monotone" dataKey="occupancyRate" stroke="#10b981" strokeWidth={2} dot={{r:4}} name="Auslastung" />
                      : houses.map((h,i)=><Line key={h.id} type="monotone" dataKey={`occ_h${h.id}`} stroke={HOUSE_COLORS[i%5]} strokeWidth={2} dot={{r:3}} name={h.name} />)
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
              <p className="text-xs text-gray-400 mb-3">Tage zwischen Buchung und Anreise (Lead Time)</p>
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
              <p className="text-xs text-gray-400 mb-3">Length of Stay (LOS) — durchschnittliche gebuchte Nächte</p>
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

          {/* ── Wochentag-Analyse ─────────────────────────────────────────── */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Wochentag-Analyse</h2>
            <p className="text-xs text-gray-400 mb-4">Hit Rate, Check-in-Verteilung, ADR & LOS nach Wochentag — zeigt deine blinden Flecken und Anker-Tage</p>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Hit Rate & Check-in % */}
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-0.5">Belegung & Check-in-Verteilung je Wochentag</h3>
                <p className="text-xs text-gray-400 mb-3">
                  <span className="text-blue-600 font-medium">Hit Rate</span> = Anteil belegter Nächte ·
                  <span className="text-green-600 font-medium ml-1">Check-in %</span> = Anteil der Anreisen
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weekdayStats.byDow} margin={{top:0,right:0,left:0,bottom:0}} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{fontSize:12}} />
                    <YAxis tickFormatter={v=>`${v}%`} tick={{fontSize:11}} domain={[0,100]} />
                    <Tooltip formatter={(v:any,name:any)=>[`${v}%`, name==='hitRate'?'Hit Rate':'Check-in %']} labelStyle={{fontWeight:600}} />
                    <Legend formatter={(v:string)=>v==='hitRate'?'Hit Rate (Belegung)':'Check-in %'} wrapperStyle={{fontSize:11}} />
                    <Bar dataKey="hitRate" fill="#2563eb" radius={[4,4,0,0]} name="hitRate">
                      {weekdayStats.byDow.map((d,i)=>(
                        <Cell key={i} fill={d.hitRate>=70?'#16a34a':d.hitRate>=50?'#2563eb':d.hitRate>=30?'#f59e0b':'#dc2626'} />
                      ))}
                    </Bar>
                    <Bar dataKey="checkinPct" fill="#10b981" radius={[4,4,0,0]} name="checkinPct" opacity={0.75} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ADR & Net ADR */}
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-0.5">ADR & Net ADR je Wochentag</h3>
                <p className="text-xs text-gray-400 mb-3">
                  <span className="text-purple-600 font-medium">ADR</span> = Ø Preis belegter Nächte ·
                  <span className="text-orange-500 font-medium ml-1">Net ADR</span> = Umsatz / alle Tage (inkl. Leerstand)
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weekdayStats.byDow} margin={{top:0,right:0,left:0,bottom:0}} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{fontSize:12}} />
                    <YAxis tick={{fontSize:11}} tickFormatter={v=>`${v}€`} />
                    <Tooltip formatter={(v:any,name:any)=>[fmtEur(+v), name==='adr'?'ADR':'Net ADR']} labelStyle={{fontWeight:600}} />
                    <Legend formatter={(v:string)=>v==='adr'?'ADR (belegte Nächte)':'Net ADR (alle Nächte)'} wrapperStyle={{fontSize:11}} />
                    <Bar dataKey="adr" fill="#8b5cf6" radius={[4,4,0,0]} name="adr" />
                    <Bar dataKey="netAdr" fill="#f97316" radius={[4,4,0,0]} name="netAdr" opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mt-6">
              {/* LOS by DOW */}
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-0.5">Ø Aufenthaltsdauer nach Anreisetag</h3>
                <p className="text-xs text-gray-400 mb-3">LOS nach Check-in-Wochentag — hilft bei der Festlegung von Mindestaufenthalten</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weekdayStats.byDow} margin={{top:0,right:0,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{fontSize:12}} />
                    <YAxis tick={{fontSize:11}} tickFormatter={v=>`${v}N`} />
                    <Tooltip formatter={(v:any)=>[`${v} Nächte`,'Ø Aufenthalt']} labelStyle={{fontWeight:600}} />
                    <Bar dataKey="avgLos" radius={[4,4,0,0]} name="Ø LOS">
                      {weekdayStats.byDow.map((d,i)=>(<Cell key={i} fill={d.avgLos>=5?'#16a34a':d.avgLos>=3?'#2563eb':'#f59e0b'} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Lead Time → ADR */}
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-0.5">ADR nach Buchungsvorlaufzeit</h3>
                <p className="text-xs text-gray-400 mb-3">Frühe Bucher vs. Last-Minute — zeigt ob Frühbucher höhere Preise zahlen</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={weekdayStats.ltData} margin={{top:0,right:10,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{fontSize:11}} />
                    <YAxis yAxisId="l" tick={{fontSize:11}} tickFormatter={v=>`${v}€`} />
                    <YAxis yAxisId="r" orientation="right" tick={{fontSize:11}} tickFormatter={v=>`${v}`} />
                    <Tooltip formatter={(v:any,name:any)=>name==='adr'?[fmtEur(+v),'ADR']:[`${v} Buchungen`,'Anzahl']} labelStyle={{fontWeight:600}} />
                    <Legend wrapperStyle={{fontSize:11}} formatter={(v:string)=>v==='adr'?'ADR':'Buchungen'} />
                    <Bar yAxisId="l" dataKey="adr" fill="#8b5cf6" radius={[4,4,0,0]} name="adr" />
                    <Line yAxisId="r" type="monotone" dataKey="bookings" stroke="#f59e0b" strokeWidth={2} dot={{r:4}} name="bookings" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Wochentag Detailtabelle */}
            <div className="card mt-6">
              <h3 className="font-semibold text-gray-800 mb-3">Detailtabelle Wochentag-Kennzahlen</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                      {['Tag','Hit Rate','Check-in %','Bel. Nächte','Verf. Nächte','ADR','Net ADR','Ø LOS'].map(h=>(
                        <th key={h} className="text-left pb-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {weekdayStats.byDow.map(d=>(
                      <tr key={d.name} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 font-semibold text-gray-900">{d.name}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.hitRate>=70?'bg-green-100 text-green-700':d.hitRate>=50?'bg-blue-100 text-blue-700':d.hitRate>=30?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>
                            {d.hitRate} %
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{d.checkinPct} %</td>
                        <td className="py-2 pr-4 text-gray-700">{d.bookedNights}</td>
                        <td className="py-2 pr-4 text-gray-700">{d.totalNights}</td>
                        <td className="py-2 pr-4 text-gray-700">{d.adr>0?fmtEur(d.adr):'–'}</td>
                        <td className="py-2 pr-4 font-medium text-gray-900">{d.netAdr>0?fmtEur(d.netAdr):'–'}</td>
                        <td className="py-2 pr-4 text-gray-700">{d.avgLos>0?`${d.avgLos} N`:'–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                        <span className={`badge ${h.occupancyRate>=70?'bg-green-100 text-green-700':h.occupancyRate>=40?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>{fmtPct(h.occupancyRate)}</span>
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
