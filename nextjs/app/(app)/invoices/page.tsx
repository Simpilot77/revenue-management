'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
export const dynamic = 'force-dynamic'

function fmtDate(d: string) { if (!d) return ''; return new Date(d).toLocaleDateString('de-DE') }
function fmtEur(n: number) { return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n??0) }

const TYPE_LABEL: Record<string,string> = { normal:'Normal', storno:'Storno', partial:'Teilrechnung' }
const TYPE_COLOR: Record<string,string> = { normal:'bg-green-100 text-green-700', storno:'bg-red-100 text-red-700', partial:'bg-blue-100 text-blue-700' }
const STATUS_LABEL: Record<string,string> = { bestaetigt:'Bestätigt', eingecheckt:'Eingecheckt', ausgecheckt:'Ausgecheckt', angefragt:'Angefragt', storniert:'Storniert', no_show:'No-Show' }
const STATUS_COLOR: Record<string,string> = { bestaetigt:'bg-blue-100 text-blue-700', eingecheckt:'bg-green-100 text-green-700', ausgecheckt:'bg-gray-100 text-gray-600', angefragt:'bg-amber-100 text-amber-700', storniert:'bg-gray-100 text-gray-400', no_show:'bg-orange-100 text-orange-700' }

function parseYear(inv: string) { const m = inv.match(/-(\d{4})-/); return m ? parseInt(m[1]) : null }
function parseNum(inv: string) { const m = inv.match(/-(\d+)$/); return m ? parseInt(m[1]) : null }
function parsePrefix(inv: string) { const m = inv.match(/^(.+)-\d{4}-/); return m ? m[1] : null }

function findGaps(invoices: any[]) {
  const byKey: Record<string, number[]> = {}
  invoices.forEach(inv => {
    const n = inv.invoice_number
    if (!n) return
    const prefix = parsePrefix(n)
    const year = parseYear(n)
    const num = parseNum(n)
    if (!prefix || !year || !num) return
    const key = `${prefix}-${year}`
    if (!byKey[key]) byKey[key] = []
    byKey[key].push(num)
  })
  const gaps: { key: string; missing: number[] }[] = []
  Object.entries(byKey).forEach(([key, nums]) => {
    const max = Math.max(...nums)
    const missing = []
    for (let i = 1000; i < max; i++) { if (!nums.includes(i)) missing.push(i) }
    if (missing.length) gaps.push({ key, missing })
  })
  return gaps
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/invoices').then(r => r.json()).then(d => {
      setInvoices(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return invoices.filter(inv => {
      if (!q) return true
      const b = inv.bookings
      return (inv.invoice_number||'').toLowerCase().includes(q)
        || (b?.guest_name||'').toLowerCase().includes(q)
        || (b?.house_name||'').toLowerCase().includes(q)
    })
  }, [invoices, search])

  const gaps = useMemo(() => findGaps(invoices), [invoices])
  const dupNrs = useMemo(() => {
    const count: Record<string, number> = {}
    invoices.forEach(inv => { if (inv.invoice_number) count[inv.invoice_number] = (count[inv.invoice_number]||0)+1 })
    return new Set(Object.keys(count).filter(k => count[k]>1))
  }, [invoices])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">🧾 Rechnungsmanagement</h1>

      {gaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          <div className="font-semibold">{gaps.reduce((s,g)=>s+g.missing.length,0)} Lücke(n) in der Nummerierung</div>
          {gaps.sort((a,b)=>a.key.localeCompare(b.key)).map(g => (
            <div key={g.key}><strong>{g.key}:</strong> fehlend {g.missing.map(n=>String(n).padStart(4,'0')).join(', ')}</div>
          ))}
        </div>
      )}
      {dupNrs.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          ⚠️ Doppelte Rechnungsnummern: {[...dupNrs].join(', ')}
        </div>
      )}
      {gaps.length===0 && dupNrs.size===0 && invoices.length>0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">✅ Keine Lücken oder Duplikate.</div>
      )}

      <div className="flex gap-3">
        <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Suche nach Nr., Gast, Haus…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Laden…</div> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  {['Rechnungsnr.','Typ','Haus','Gast','Datum','Betrag','Buchungsstatus',''].map(h => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const b = inv.bookings
                  const isDupe = dupNrs.has(inv.invoice_number)
                  return (
                    <tr key={inv.id} className={`border-t border-gray-50 hover:bg-gray-50 ${isDupe?'bg-red-50 hover:bg-red-100':''}`}>
                      <td className="px-4 py-2 font-mono">
                        {inv.invoice_number}
                        {inv.is_manual && <span className="ml-1 text-xs" title="Manuell">✍️</span>}
                        {isDupe && <span className="ml-1 text-xs text-red-600">⚠ Duplikat</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[inv.invoice_type]||'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABEL[inv.invoice_type]||inv.invoice_type}
                        </span>
                      </td>
                      <td className="px-4 py-2">{b?.house_name||'—'}</td>
                      <td className="px-4 py-2">{b?.guest_name||'—'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(inv.created_at)}</td>
                      <td className="px-4 py-2 text-right">{fmtEur(parseFloat(inv.amount||0))}</td>
                      <td className="px-4 py-2">
                        {b?.status && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status]||'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[b.status]||b.status}</span>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {b?.id && <button className="text-xs border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50" onClick={() => router.push(`/bookings/${b.id}/edit`)}>✏️ Buchung</button>}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length===0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Keine Rechnungen.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
