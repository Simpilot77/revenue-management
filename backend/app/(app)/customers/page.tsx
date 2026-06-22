'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const fmt  = (n: number) => new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(n ?? 0)
const fmtD = (s: string) => s ? new Date(s).toLocaleDateString('de-DE') : '—'

const STATUS_COLOR: Record<string,string> = {
  bestaetigt:'bg-blue-100 text-blue-700', eingecheckt:'bg-green-100 text-green-700',
  ausgecheckt:'bg-gray-100 text-gray-600', angefragt:'bg-amber-100 text-amber-700',
  storniert:'bg-gray-100 text-gray-400', no_show:'bg-orange-100 text-orange-700',
}
const STATUS_LABEL: Record<string,string> = {
  bestaetigt:'Bestätigt', eingecheckt:'Eingecheckt', ausgecheckt:'Ausgecheckt',
  angefragt:'Angefragt', storniert:'Storniert', no_show:'No-Show',
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [sortBy, setSortBy]       = useState<'last'|'name'|'bookings'|'revenue'>('last')
  const [selected, setSelected]   = useState<any>(null)
  const [editing, setEditing]     = useState<any>(null)
  const [saving, setSaving]       = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    fetch('/api/customers')
      .then(r => r.json())
      .then(d => {
        if (d?.error) { setError(d.error); setCustomers([]) }
        else setCustomers(Array.isArray(d) ? d : [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = customers.filter(c =>
      !q ||
      c.guest_name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.guest_email?.toLowerCase().includes(q) ||
      c.guest_phone?.includes(q)
    )
    list = [...list].sort((a, b) => {
      if (sortBy === 'name')     return (a.guest_name||'').localeCompare(b.guest_name||'', 'de')
      if (sortBy === 'bookings') return b.bookings_count - a.bookings_count
      if (sortBy === 'revenue')  return b.total_revenue - a.total_revenue
      return (b.last_checkin||'') > (a.last_checkin||'') ? 1 : -1
    })
    return list
  }, [customers, search, sortBy])

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    const latest = editing.bookings?.[0]
    if (latest) {
      await fetch(`/api/bookings/${latest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_email: editing.guest_email,
          guest_phone: editing.guest_phone,
          company_name: editing.company_name,
          nationality: editing.nationality,
        }),
      })
    }
    setSaving(false)
    setEditing(null)
    load()
  }

  const exportCSV = () => {
    const rows = [['Name','Firma','E-Mail','Telefon','Buchungen','Umsatz','Letzte Buchung']]
    filtered.forEach(c => rows.push([
      c.guest_name, c.company_name||'', c.guest_email||'', c.guest_phone||'',
      c.bookings_count, fmt(c.total_revenue), fmtD(c.last_checkin),
    ] as any[]))
    const csv = rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv)
    a.download = `kunden_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 Kundendatenbank</h1>
          <p className="text-sm text-gray-400 mt-0.5">{loading ? '…' : `${filtered.length} von ${customers.length} Kunden`}</p>
        </div>
        <button onClick={exportCSV} disabled={!filtered.length}
          className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-40">
          📥 CSV exportieren
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Suche nach Name, Firma, E-Mail, Telefon…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
          value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="last">Letzte Buchung</option>
          <option value="name">Name A–Z</option>
          <option value="bookings">Buchungen ↓</option>
          <option value="revenue">Umsatz ↓</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">❌ Fehler: {error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Lade Kundendaten…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    ['Name / Firma','text-left'],
                    ['E-Mail','text-left hidden md:table-cell'],
                    ['Telefon','text-left hidden lg:table-cell'],
                    ['Buchungen','text-center'],
                    ['Umsatz','text-right'],
                    ['Letzte Buchung','text-right hidden sm:table-cell'],
                    ['Nächte','text-right hidden lg:table-cell'],
                  ].map(([h, cls]) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${cls}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c, i) => (
                  <tr key={i} onClick={() => setSelected(c)}
                    className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${i%2===1?'bg-gray-50/30':''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.guest_name}</div>
                      {c.company_name && <div className="text-xs text-gray-500">{c.company_name}</div>}
                      {c.nationality && <div className="text-xs text-gray-400">{c.nationality}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {c.guest_email ? <a href={`mailto:${c.guest_email}`} className="hover:text-blue-600" onClick={e=>e.stopPropagation()}>{c.guest_email}</a> : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {c.guest_phone ? <a href={`tel:${c.guest_phone}`} className="hover:text-blue-600" onClick={e=>e.stopPropagation()}>{c.guest_phone}</a> : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{c.bookings_count}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(c.total_revenue)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{fmtD(c.last_checkin)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">{c.nights_total}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-14 text-gray-400">
                    {search ? 'Keine Treffer für diese Suche.' : 'Keine Kunden vorhanden — Kunden werden aus Buchungsdaten zusammengestellt.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.guest_name}</h2>
                {selected.company_name && <p className="text-sm text-gray-500">{selected.company_name}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing({...selected}); setSelected(null) }}
                  className="text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100">
                  ✏️ Bearbeiten
                </button>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl px-2">×</button>
              </div>
            </div>

            {/* Stats */}
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-gray-50 bg-gray-50/50 shrink-0">
              {[
                ['Buchungen', selected.bookings_count],
                ['Umsatz', fmt(selected.total_revenue)],
                ['Nächte', selected.nights_total],
                ['Letzte Buchung', fmtD(selected.last_checkin)],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <div className="text-xs text-gray-400">{label}</div>
                  <div className="font-semibold text-gray-900 mt-0.5">{val}</div>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div className="px-6 py-3 flex flex-wrap gap-4 text-sm border-b border-gray-50 shrink-0">
              {selected.guest_email && (
                <a href={`mailto:${selected.guest_email}`} className="text-blue-600 hover:underline">✉️ {selected.guest_email}</a>
              )}
              {selected.guest_phone && (
                <a href={`tel:${selected.guest_phone}`} className="text-blue-600 hover:underline">📞 {selected.guest_phone}</a>
              )}
              {selected.nationality && <span className="text-gray-500">🌍 {selected.nationality}</span>}
            </div>

            {/* Bookings */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-white border-b border-gray-50">
                Buchungshistorie ({selected.bookings?.length ?? 0})
              </div>
              <div className="divide-y divide-gray-50">
                {(selected.bookings || []).map((b: any) => (
                  <div key={b.id} className="px-6 py-3 flex items-start justify-between gap-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => { setSelected(null); router.push(`/bookings/${b.id}`) }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{b.house_name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {fmtD(b.checkin_date)} – {fmtD(b.checkout_date)} · {b.nights} Nächte
                        {b.channel_name && ` · ${b.channel_name}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-gray-900">{fmt(parseFloat(b.total_price||0))}</div>
                      {b.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${STATUS_COLOR[b.status]||'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[b.status]||b.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">✏️ Kundendaten bearbeiten</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-400">Änderungen werden in der neuesten Buchung gespeichert.</p>
              {([
                ['E-Mail', 'guest_email', 'email'],
                ['Telefon', 'guest_phone', 'tel'],
                ['Firma', 'company_name', 'text'],
                ['Nationalität', 'nationality', 'text'],
              ] as [string,string,string][]).map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input type={type}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editing[key]||''}
                    onChange={e => setEditing((p: any) => ({...p, [key]: e.target.value}))} />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
                <button onClick={() => setEditing(null)}
                  className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">Abbrechen</button>
                <button onClick={saveEdit} disabled={saving}
                  className="text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
