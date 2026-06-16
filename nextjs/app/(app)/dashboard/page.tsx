'use client'

import { useState, useEffect } from 'react'

export const dynamic = 'force-dynamic'

function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0)
}
function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DashboardPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [houses, setHouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/bookings?limit=500').then(r => r.json()),
      fetch('/api/houses').then(r => r.json()),
    ]).then(([b, h]) => {
      setBookings(b.data ?? [])
      setHouses(h.data ?? [])
      setLoading(false)
    })
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const active = bookings.filter(b => ['bestaetigt', 'eingecheckt', 'ausgecheckt'].includes(b.status))
  const totalRevenue = active.reduce((s, b) => s + parseFloat(b.total_price ?? 0), 0)
  const occupied = bookings.filter(b => ['bestaetigt', 'eingecheckt'].includes(b.status) && b.checkin_date <= today && b.checkout_date > today)
  const storniert = bookings.filter(b => b.status === 'storniert')
  const stornoRate = bookings.length ? ((storniert.length / bookings.length) * 100).toFixed(1) : '0'
  const returning = active.filter(b => b.is_returning_guest)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Laden…</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Gesamtumsatz', value: fmtEur(totalRevenue), sub: `${active.length} Buchungen` },
          { label: 'Häuser belegt', value: `${occupied.length} / ${houses.length}`, sub: 'Stand heute' },
          { label: 'Stammgäste', value: returning.length.toString(), sub: 'aller Buchungen' },
          { label: 'Stornoquote', value: `${stornoRate}%`, sub: `${storniert.length} Stornierungen` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* House Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {houses.map((house: any) => {
          const current = bookings.find(b => b.house_id === house.id && ['bestaetigt', 'eingecheckt'].includes(b.status) && b.checkin_date <= today && b.checkout_date > today)
          const next = bookings.filter(b => b.house_id === house.id && b.status === 'bestaetigt' && b.checkin_date > today).sort((a, b) => a.checkin_date.localeCompare(b.checkin_date))[0]
          return (
            <div key={house.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className={`px-5 py-4 text-white ${current ? 'bg-red-500' : 'bg-emerald-500'}`}>
                <div className="font-bold text-lg">{house.name}</div>
                <div className="text-sm opacity-80">{current ? 'Belegt' : 'Frei'}</div>
              </div>
              <div className="p-4 text-sm space-y-1">
                {current ? (
                  <>
                    <div className="font-medium text-gray-800">{current.guest_name}</div>
                    <div className="text-gray-400">bis {fmtDate(current.checkout_date)}</div>
                  </>
                ) : <div className="text-gray-400">Kein aktueller Gast</div>}
                {next && <div className="text-blue-600 text-xs mt-2">Nächste Ankunft: {fmtDate(next.checkin_date)} · {next.guest_name}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent bookings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-800">Aktuelle Buchungen</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-50">
                <th className="px-4 py-2 text-left">Gast</th>
                <th className="px-4 py-2 text-left">Haus</th>
                <th className="px-4 py-2 text-left">Check-in</th>
                <th className="px-4 py-2 text-left">Check-out</th>
                <th className="px-4 py-2 text-right">Betrag</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {active.slice(0, 15).map((b: any) => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{b.guest_name}</td>
                  <td className="px-4 py-2 text-gray-500">{b.house_name}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtDate(b.checkin_date)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtDate(b.checkout_date)}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmtEur(parseFloat(b.total_price ?? 0))}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
