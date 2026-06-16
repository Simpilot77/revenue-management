import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from './LogoutButton'

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: bookings },
    { data: houses },
  ] = await Promise.all([
    supabase.from('bookings').select('*').order('checkin_date', { ascending: false }),
    supabase.from('houses').select('*').order('id'),
  ])

  const active = (bookings ?? []).filter(b =>
    ['bestaetigt', 'eingecheckt', 'ausgecheckt'].includes(b.status)
  )
  const totalRevenue = active.reduce((s: number, b: any) => s + parseFloat(b.total_price ?? 0), 0)
  const today = new Date().toISOString().slice(0, 10)

  const occupied = (bookings ?? []).filter((b: any) =>
    ['bestaetigt', 'eingecheckt'].includes(b.status) &&
    b.checkin_date <= today && b.checkout_date > today
  )

  const storniert = (bookings ?? []).filter((b: any) => b.status === 'storniert')
  const stornoRate = bookings?.length
    ? ((storniert.length / bookings.length) * 100).toFixed(1)
    : '0'

  const returning = active.filter((b: any) => b.is_returning_guest)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-4 flex items-center justify-between shadow">
        <div>
          <div className="text-xl font-bold">Workation Wolfsburg</div>
          <div className="text-xs opacity-70">Revenue Management · Supabase</div>
        </div>
        <LogoutButton />
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Gesamtumsatz', value: fmtEur(totalRevenue), sub: `${active.length} Buchungen` },
            { label: 'Häuser belegt', value: `${occupied.length} / ${houses?.length ?? 3}`, sub: 'Stand heute' },
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
          {(houses ?? []).map((house: any) => {
            const current = (bookings ?? []).find((b: any) =>
              b.house_id === house.id &&
              ['bestaetigt', 'eingecheckt'].includes(b.status) &&
              b.checkin_date <= today && b.checkout_date > today
            )
            const next = (bookings ?? [])
              .filter((b: any) =>
                b.house_id === house.id &&
                ['bestaetigt'].includes(b.status) &&
                b.checkin_date > today
              )
              .sort((a: any, b: any) => a.checkin_date.localeCompare(b.checkin_date))[0]

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
                      <div className="text-gray-400">bis {new Date(current.checkout_date).toLocaleDateString('de-DE')}</div>
                    </>
                  ) : (
                    <div className="text-gray-400">Kein aktueller Gast</div>
                  )}
                  {next && (
                    <div className="text-blue-600 text-xs mt-2">
                      Nächste Ankunft: {new Date(next.checkin_date).toLocaleDateString('de-DE')} · {next.guest_name}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-800">
            Aktuelle Buchungen
          </div>
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
                {(active ?? []).slice(0, 15).map((b: any) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{b.guest_name}</td>
                    <td className="px-4 py-2 text-gray-500">{b.house_name}</td>
                    <td className="px-4 py-2 text-gray-600">{new Date(b.checkin_date).toLocaleDateString('de-DE')}</td>
                    <td className="px-4 py-2 text-gray-600">{new Date(b.checkout_date).toLocaleDateString('de-DE')}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmtEur(parseFloat(b.total_price ?? 0))}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
