'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'

function fmtEur(n: number) { return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('de-DE') : '—' }

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name'|'bookings'|'revenue'|'last'>('last')
  const [selected, setSelected] = useState<any>(null)
  const [editing, setEditing] = useState<any>(null)

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => { setCustomers(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    let list = customers.filter(c => {
      const q = search.toLowerCase()
      return !q || c.guest_name?.toLowerCase().includes(q) || c.company_name?.toLowerCase().includes(q) || c.guest_email?.toLowerCase().includes(q)
    })
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.guest_name||'').localeCompare(b.guest_name||'')
      if (sortBy === 'bookings') return b.bookings_count - a.bookings_count
      if (sortBy === 'revenue') return b.total_revenue - a.total_revenue
      return (b.last_checkin||'') > (a.last_checkin||'') ? 1 : -1
    })
    return list
  }, [customers, search, sortBy])

  // Simple customer number: index in sorted-by-first-booking order
  const customerNumber = (c: any) => {
    const idx = [...customers].sort((a,b) => (a.bookings[a.bookings.length-1]?.checkin_date||'') > (b.bookings[b.bookings.length-1]?.checkin_date||'') ? 1 : -1).findIndex(x => x.guest_name === c.guest_name)
    return String(idx + 1).padStart(4, '0')
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">👥 Kunden</h1>
        <div className="text-sm text-gray-500">{filtered.length} Kunden</div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Suche nach Name, Firma, E-Mail…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
          value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="last">Letzte Buchung</option>
          <option value="name">Name A–Z</option>
          <option value="bookings">Buchungen</option>
          <option value="revenue">Umsatz</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Lade Kundendaten…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nr.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">E-Mail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Telefon</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Buchungen</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Umsatz</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Letzte Buchung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c, i) => (
                <tr key={i} className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{customerNumber(c)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.guest_name}</div>
                    {c.company_name && <div className="text-xs text-gray-500">{c.company_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{c.guest_email || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{c.guest_phone || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{c.bookings_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium hidden sm:table-cell">{fmtEur(c.total_revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">{fmtDate(c.last_checkin)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Keine Kunden gefunden</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.guest_name}</h2>
                {selected.company_name && <p className="text-sm text-gray-500">{selected.company_name}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing({...selected}); setSelected(null) }}
                  className="text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100">
                  ✏️ Bearbeiten
                </button>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2">×</button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Kundennr.:</span> <span className="font-mono text-gray-900">{customerNumber(selected)}</span></div>
                <div><span className="text-gray-500">Buchungen:</span> <span className="font-semibold text-gray-900">{selected.bookings_count}</span></div>
                <div><span className="text-gray-500">Umsatz gesamt:</span> <span className="font-semibold text-gray-900">{fmtEur(selected.total_revenue)}</span></div>
                <div><span className="text-gray-500">Nächte gesamt:</span> <span className="font-semibold text-gray-900">{selected.nights_total}</span></div>
                {selected.guest_email && <div className="col-span-2"><span className="text-gray-500">E-Mail:</span> <a href={`mailto:${selected.guest_email}`} className="text-blue-600 hover:underline">{selected.guest_email}</a></div>}
                {selected.guest_phone && <div className="col-span-2"><span className="text-gray-500">Telefon:</span> <a href={`tel:${selected.guest_phone}`} className="text-blue-600 hover:underline">{selected.guest_phone}</a></div>}
                {selected.nationality && <div><span className="text-gray-500">Herkunft:</span> <span className="text-gray-900">{selected.nationality}</span></div>}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Buchungshistorie</h3>
                <div className="space-y-2">
                  {selected.bookings.map((b: any) => (
                    <div key={b.id} className="flex items-start justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <div className="font-medium text-gray-900">{b.house_name}</div>
                        <div className="text-xs text-gray-500">{fmtDate(b.checkin_date)} – {fmtDate(b.checkout_date)} · {b.nights} Nächte · {b.channel_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{fmtEur(parseFloat(b.total_price||0))}</div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          b.status === 'storniert' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Kunde bearbeiten</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Kundendaten werden aus Buchungen zusammengeführt. Änderungen werden in der neuesten Buchung gespeichert.</p>
              {[
                ['E-Mail', 'guest_email', 'email'],
                ['Telefon', 'guest_phone', 'tel'],
                ['Firma', 'company_name', 'text'],
                ['Nationalität', 'nationality', 'text'],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input type={type} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editing[key]||''} onChange={e => setEditing((p: any) => ({...p, [key]: e.target.value}))} />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditing(null)} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">Abbrechen</button>
                <button onClick={() => {
                  // Save to the most recent booking
                  const latestBooking = editing.bookings[0]
                  if (latestBooking) {
                    fetch(`/api/bookings/${latestBooking.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ guest_email: editing.guest_email, guest_phone: editing.guest_phone, company_name: editing.company_name, nationality: editing.nationality })
                    }).then(() => {
                      setCustomers(prev => prev.map(c => c.guest_name === editing.guest_name ? {...c, ...editing} : c))
                      setEditing(null)
                    })
                  }
                }} className="text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700">Speichern</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
