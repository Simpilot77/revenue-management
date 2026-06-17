'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  angefragt: 'Angefragt', bestaetigt: 'Bestätigt', eingecheckt: 'Eingecheckt',
  ausgecheckt: 'Ausgecheckt', storniert: 'Storniert', no_show: 'No-Show', gesperrt: 'Gesperrt',
}
const STATUS_COLORS: Record<string, string> = {
  angefragt: 'bg-amber-100 text-amber-800', bestaetigt: 'bg-blue-100 text-blue-800',
  eingecheckt: 'bg-green-100 text-green-800', ausgecheckt: 'bg-gray-100 text-gray-700',
  storniert: 'bg-red-100 text-red-700', no_show: 'bg-orange-100 text-orange-800',
  gesperrt: 'bg-slate-100 text-slate-700',
}
const PAYMENT_LABELS: Record<string, string> = {
  offen: 'Offen', bezahlt: 'Bezahlt', teilweise: 'Teilw.', erstattet: 'Erstattet',
}
const PAYMENT_COLORS: Record<string, string> = {
  offen: 'bg-red-100 text-red-700', bezahlt: 'bg-green-100 text-green-800',
  teilweise: 'bg-amber-100 text-amber-800', erstattet: 'bg-gray-100 text-gray-600',
}

const COLUMNS = [
  { key: 'booking_date',   label: 'Buchungsdatum', type: 'date' },
  { key: 'house_short',    label: 'Haus',          editable: false },
  { key: 'guest_name',     label: 'Gastname',      type: 'text' },
  { key: 'company_name',   label: 'Firma',         type: 'text' },
  { key: 'checkin_date',   label: 'Anreise',       type: 'date' },
  { key: 'checkout_date',  label: 'Abreise',       type: 'date' },
  { key: 'nights',         label: 'Nächte',        type: 'number' },
  { key: 'guest_count',    label: 'Gäste',         type: 'number' },
  { key: 'channel_name',   label: 'Kanal',         editable: false },
  { key: 'total_price',    label: 'Gesamtpreis',   type: 'number' },
  { key: 'invoice_number', label: 'Rechnungsnr.',  type: 'text' },
  { key: 'status',         label: 'Status',        type: 'select', options: STATUS_LABELS },
  { key: 'payment_status', label: 'Zahlung',       type: 'select', options: PAYMENT_LABELS },
]

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}

// ─── Inline-editable cell ────────────────────────────────────────────────────
function EditableCell({ booking, col, editingCell, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit, isDuplicate }: any) {
  const inputRef = useRef<any>(null)
  const isEditing = editingCell?.id === booking.id && editingCell?.field === col.key

  useEffect(() => {
    if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select?.() }
  }, [isEditing])

  if (!isEditing) {
    let display: React.ReactNode
    if (col.key === 'booking_date' || col.key === 'checkin_date' || col.key === 'checkout_date') {
      display = <span className="whitespace-nowrap">{fmtDate(booking[col.key])}</span>
    } else if (col.key === 'total_price') {
      display = <span className="font-medium whitespace-nowrap">{fmtEur(booking[col.key])}</span>
    } else if (col.key === 'invoice_number') {
      display = isDuplicate && booking[col.key]
        ? <span className="font-mono text-xs text-red-700 font-semibold">{booking[col.key]} ⚠</span>
        : booking[col.key]
          ? <span className="font-mono text-xs text-gray-600">{booking[col.key]}</span>
          : <span className="text-amber-500 text-xs">⚠ fehlt</span>
    } else if (col.key === 'status') {
      display = <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[booking[col.key]] ?? ''}`}>{STATUS_LABELS[booking[col.key]] ?? booking[col.key]}</span>
    } else if (col.key === 'payment_status') {
      display = <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[booking[col.key]] ?? ''}`}>{PAYMENT_LABELS[booking[col.key]] ?? booking[col.key]}</span>
    } else if (col.key === 'channel_name') {
      display = booking.channel_color
        ? <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: booking.channel_color }}>{booking.channel_short}</span>
        : <span>{booking.channel_name}</span>
    } else {
      display = <span>{booking[col.key] ?? ''}</span>
    }

    return (
      <td
        className={`px-3 py-2 text-sm ${col.editable !== false ? 'cursor-text hover:bg-blue-50 group relative' : ''}`}
        onClick={e => { e.stopPropagation(); if (col.editable !== false) onStartEdit(booking.id, col.key, booking[col.key] ?? '') }}
      >
        {display}
      </td>
    )
  }

  const cls = 'w-full min-w-[80px] border border-blue-400 rounded px-1.5 py-0.5 text-sm outline-none ring-2 ring-blue-200 bg-white'
  const handleKey = (e: any) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }

  if (col.type === 'select') {
    return (
      <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
        <select ref={inputRef} className={cls} value={editingCell.value} onChange={e => onChangeEdit(e.target.value)} onBlur={onSaveEdit} onKeyDown={handleKey}>
          {Object.entries(col.options as Record<string,string>).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </td>
    )
  }
  return (
    <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
      <input ref={inputRef} type={col.type} className={cls} value={editingCell.value}
        onChange={e => onChangeEdit(e.target.value)} onBlur={onSaveEdit} onKeyDown={handleKey} />
    </td>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [allBookings, setAllBookings] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [houses, setHouses] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', house_id: '', status: '', payment_status: '' })
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState('checkin_date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  const [editingCell, setEditingCell] = useState<any>(null)
  const [duplicateInvoices, setDuplicateInvoices] = useState(new Set<number>())
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const limit = 25

  const loadAll = useCallback(async () => {
    const r = await fetch('/api/bookings?limit=500')
    const j = await r.json()
    const all = j.data ?? []
    setAllBookings(all)
    // detect duplicates
    const map: Record<string, number[]> = {}
    all.forEach((b: any) => { if (b.invoice_number) { if (!map[b.invoice_number]) map[b.invoice_number] = []; map[b.invoice_number].push(b.id) } })
    const dupes = new Set<number>()
    Object.values(map).forEach(ids => { if (ids.length > 1) ids.forEach(id => dupes.add(id)) })
    setDuplicateInvoices(dupes)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(limit), page: String(page) })
    if (filters.search) params.set('search', filters.search)
    if (filters.house_id) params.set('house_id', filters.house_id)
    if (filters.status) params.set('status', filters.status)
    if (filters.payment_status) params.set('payment_status', filters.payment_status)
    const r = await fetch(`/api/bookings?${params}`)
    const j = await r.json()
    setBookings(j.data ?? [])
    setTotal(j.total ?? 0)
    setLoading(false)
  }, [filters, page])

  useEffect(() => {
    fetch('/api/houses').then(r => r.json()).then(j => setHouses(j.data ?? []))
    fetch('/api/channels').then(r => r.json()).then(j => setChannels(j.data ?? []))
    loadAll()
  }, [loadAll])

  useEffect(() => { load() }, [load])

  const sorted = useMemo(() => [...bookings].sort((a, b) => {
    const av = a[sortField], bv = b[sortField]
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
    return sortDir === 'asc' ? cmp : -cmp
  }), [bookings, sortField, sortDir])

  const analytics = useMemo(() => {
    const rev = allBookings.filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status))
    return {
      count: rev.length,
      revenue: rev.reduce((s: number, b: any) => s + parseFloat(b.total_price ?? 0), 0),
    }
  }, [allBookings])

  const handleSort = (key: string) => {
    if (sortField === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(key); setSortDir('asc') }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Buchung von "${name}" wirklich löschen?`)) return
    await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
    load(); loadAll()
  }

  const saveEdit = async () => {
    if (!editingCell) return
    const { id, field, value } = editingCell
    setEditingCell(null)
    const col = COLUMNS.find(c => c.key === field)
    const val = col?.type === 'number' ? parseFloat(value) || 0 : value
    const booking = bookings.find(b => b.id === id) ?? allBookings.find(b => b.id === id)
    if (!booking) return
    await fetch(`/api/bookings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...booking, [field]: val }) })
    load(); loadAll()
  }

  const totalPages = Math.ceil(total / limit)

  const handleLodgifySync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/lodgify-sync', { method: 'POST' })
      const j = await res.json()
      if (j.error) { setSyncMsg('Fehler: ' + j.error) }
      else { setSyncMsg(`✅ ${j.regular} Buchungen + ${j.ownerBlocks} Sperren synchronisiert`); load() }
    } catch (e: any) { setSyncMsg('Fehler: ' + e.message) }
    setSyncing(false)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Buchungen <span className="text-gray-400 text-lg font-normal">({total})</span></h1>
        <div className="flex gap-2 items-center flex-wrap">
          {syncMsg && <span className="text-sm text-gray-600">{syncMsg}</span>}
          <button onClick={handleLodgifySync} disabled={syncing} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            {syncing ? '⏳ Synchronisiere…' : '🔄 Lodgify Sync'}
          </button>
          <Link href="/bookings/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">+ Neue Buchung</Link>
        </div>
      </div>

      {/* Analytics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-6">
        <div><div className="text-xs text-gray-400">Aktive Buchungen</div><div className="text-xl font-bold">{analytics.count}</div></div>
        <div><div className="text-xs text-gray-400">Gesamtumsatz</div><div className="text-xl font-bold">{fmtEur(analytics.revenue)}</div></div>
      </div>

      {duplicateInvoices.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          🚨 {duplicateInvoices.size} Buchungen haben doppelte Rechnungsnummern (rot markiert).
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="🔍 Suche…" value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }} />
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.house_id} onChange={e => { setFilters(f => ({ ...f, house_id: e.target.value })); setPage(1) }}>
            <option value="">Alle Häuser</option>
            {houses.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}>
            <option value="">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.payment_status} onChange={e => { setFilters(f => ({ ...f, payment_status: e.target.value })); setPage(1) }}>
            <option value="">Alle Zahlungen</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button className={`text-xs px-3 py-1 rounded-full font-medium border ${filters.payment_status === 'offen' && filters.status === 'bestaetigt' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
            onClick={() => setFilters(f => f.payment_status === 'offen' && f.status === 'bestaetigt' ? { ...f, payment_status: '', status: '' } : { ...f, payment_status: 'offen', status: 'bestaetigt' })}>
            💰 Offene Posten
          </button>
          <button className="text-xs px-3 py-1 rounded-full font-medium border bg-gray-50 text-gray-600 border-gray-200"
            onClick={() => { setFilters({ search: '', house_id: '', status: '', payment_status: '' }); setPage(1) }}>
            ✕ Zurücksetzen
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-3 text-gray-400 font-medium text-center w-10">#</th>
                <th className="px-3 py-3 text-gray-500 font-medium">Aktionen</th>
                {COLUMNS.map(col => (
                  <th key={col.key} className="text-left text-gray-500 font-medium px-3 py-3 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort(col.key)}>
                    {col.label} {sortField === col.key ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">⇅</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={COLUMNS.length + 2} className="text-center text-gray-400 py-10">Laden…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={COLUMNS.length + 2} className="text-center text-gray-400 py-10">Keine Buchungen gefunden</td></tr>
              ) : sorted.map((b: any, idx: number) => (
                <tr key={b.id} className={`hover:bg-gray-50 cursor-pointer ${duplicateInvoices.has(b.id) ? 'bg-red-50/60' : ''}`} onClick={() => router.push(`/bookings/${b.id}`)}>
                  <td className="px-3 py-2 text-center text-xs text-gray-400 font-mono">{(page - 1) * limit + idx + 1}</td>
                  <td className="px-2 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => router.push(`/bookings/${b.id}`)} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold" title="Bearbeiten">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                        Bearbeiten
                      </button>
                      <button onClick={() => router.push(`/tasks?booking=${b.id}`)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200" title="Aufgaben">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      </button>
                      <button onClick={() => handleDelete(b.id, b.guest_name)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-100" title="Löschen">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </td>
                  {COLUMNS.map(col => (
                    <EditableCell key={col.key} booking={b} col={col}
                      editingCell={editingCell?.id === b.id ? editingCell : null}
                      onStartEdit={(id: number, field: string, value: any) => setEditingCell({ id, field, value: value ?? '' })}
                      onChangeEdit={(v: string) => setEditingCell((p: any) => p ? { ...p, value: v } : null)}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => setEditingCell(null)}
                      isDuplicate={col.key === 'invoice_number' && duplicateInvoices.has(b.id)}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Seite {page} von {totalPages} · {total} Einträge</span>
            <div className="flex gap-2">
              <button className="text-sm px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Zurück</button>
              <button className="text-sm px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Weiter →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
