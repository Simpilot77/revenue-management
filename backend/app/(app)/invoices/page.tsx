'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { exportInvoiceFromData, buildStornoPreviewData } from '../tasks/pdfExport'
import InvoicePreviewModal from '../components/InvoicePreviewModal'
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
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal] = useState<any>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/invoices').then(r => r.json()),
      fetch('/api/company-settings').then(r => r.json()),
    ]).then(([inv, s]) => {
      setInvoices(Array.isArray(inv) ? inv : [])
      setSettings(s)
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return invoices.filter(inv => {
      const b = inv.bookings
      if (typeFilter && inv.type !== typeFilter) return false
      if (!q) return true
      return (inv.invoice_number||'').toLowerCase().includes(q)
        || (b?.guest_name||'').toLowerCase().includes(q)
        || (b?.house_name||'').toLowerCase().includes(q)
    })
  }, [invoices, search, typeFilter])

  const gaps = useMemo(() => findGaps(invoices), [invoices])
  const dupNrs = useMemo(() => {
    const count: Record<string, number> = {}
    invoices.forEach(inv => { if (inv.invoice_number) count[inv.invoice_number] = (count[inv.invoice_number]||0)+1 })
    return new Set(Object.keys(count).filter(k => count[k]>1))
  }, [invoices])

  const hasStorno = (inv: any) =>
    invoices.some(i => i.reference_invoice_id === inv.id && i.type === 'storno')

  const handleReprint = async (inv: any) => {
    if (!inv.data) { alert('Keine gespeicherten PDF-Daten.'); return }
    await exportInvoiceFromData(inv.data)
  }

  const handleStorno = (inv: any) => {
    const stornoNum = window.prompt('Rechnungsnummer für Stornorechnung:', `${inv.invoice_number || ''}-S`)
    if (!stornoNum) return
    const data = buildStornoPreviewData(
      { id: inv.id, invoice_number: inv.invoice_number, invoice_date: inv.invoice_date, data: inv.data || {} },
      stornoNum.trim(),
      inv.lang || 'de'
    )
    setModal({ data, bookingId: inv.booking_id })
  }

  const handleModalChange = (field: string, value: any) => {
    setModal((prev: any) => prev ? { ...prev, data: { ...prev.data, [field]: value } } : prev)
  }

  const handleModalLangChange = (lang: string) => {
    if (!modal) return
    const existing = modal.data
    const refreshed = buildStornoPreviewData(
      { id: existing._reference_invoice_id, invoice_number: existing._reference_invoice_number, invoice_date: existing.invoice_date, data: existing },
      existing.invoice_number,
      lang
    )
    setModal((prev: any) => ({ ...prev, data: { ...refreshed, invoice_number: existing.invoice_number } }))
  }

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

      <div className="flex gap-3 flex-wrap">
        <input className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Suche nach Nr., Gast, Haus…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
          <option value="">Alle Typen</option>
          <option value="normal">Normal</option>
          <option value="partial">Teilrechnung</option>
          <option value="storno">Storno</option>
        </select>
      </div>

      {/* Summary */}
      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            ['Rechnungen gesamt', invoices.filter(i=>i.type!=='storno').length],
            ['Stornos', invoices.filter(i=>i.type==='storno').length],
            ['Gesamtbetrag', fmtEur(invoices.filter(i=>i.type!=='storno').reduce((s,i)=>s+parseFloat(i.brutto_total||0),0))],
            ['Dieses Jahr', invoices.filter(i=>i.type!=='storno'&&(i.invoice_date||'').startsWith(new Date().getFullYear().toString())).length],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-xl font-bold text-gray-900 mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-400">Laden…</div> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  {['Rechnungsnr.','Typ','Haus','Gast','Datum','Betrag','Buchungsstatus','Aktionen'].map(h => (
                    <th key={h} className="px-4 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const b = inv.bookings
                  const isDupe = dupNrs.has(inv.invoice_number)
                  return (
                    <tr key={inv.id} className={`border-t border-gray-50 hover:bg-gray-50 ${isDupe?'bg-red-50 hover:bg-red-100':''}`}>
                      <td className="px-4 py-2 font-mono whitespace-nowrap">
                        {inv.invoice_number}
                        {inv.manual && <span className="ml-1 text-xs" title="Manuell">✍️</span>}
                        {isDupe && <span className="ml-1 text-xs text-red-600">⚠ Duplikat</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[inv.type]||'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABEL[inv.type]||inv.type||'—'}
                        </span>
                        {inv.reference_invoice_number && (
                          <div className="text-xs text-gray-400 mt-0.5">→ {inv.reference_invoice_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{b?.house_name||'—'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{b?.guest_name||'—'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(inv.invoice_date||inv.created_at)}</td>
                      <td className="px-4 py-2 text-right font-medium whitespace-nowrap">{fmtEur(parseFloat(inv.brutto_total||0))}</td>
                      <td className="px-4 py-2">
                        {b?.status && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status]||'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[b.status]||b.status}</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1.5 justify-end flex-wrap">
                          {inv.data && (
                            <button className="text-xs border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 whitespace-nowrap" onClick={() => handleReprint(inv)}>
                              📄 PDF
                            </button>
                          )}
                          {(inv.type === 'normal' || inv.type === 'partial') && !hasStorno(inv) && (
                            <button className="text-xs border border-red-200 text-red-600 rounded-lg px-2 py-1 hover:bg-red-50 whitespace-nowrap" onClick={() => handleStorno(inv)}>
                              🔴 Storno
                            </button>
                          )}
                          {b?.id && (
                            <button className="text-xs border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 whitespace-nowrap" onClick={() => router.push(`/bookings/${b.id}`)}>
                              ✏️ Buchung
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length===0 && (
                  <tr><td colSpan={8} className="px-8 py-14 text-center">
                    <div className="text-gray-400 text-sm">
                      {invoices.length === 0
                        ? <>
                            <div className="text-3xl mb-3">🧾</div>
                            <div className="font-medium text-gray-500 mb-1">Noch keine Rechnungen</div>
                            <div className="text-gray-400">Rechnungen erscheinen hier, sobald sie in einer Buchung erstellt wurden.</div>
                          </>
                        : 'Keine Treffer für diese Suche.'
                      }
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <InvoicePreviewModal
          data={modal.data}
          settings={settings}
          onClose={() => { setModal(null); load() }}
          onLangChange={handleModalLangChange}
          onChange={handleModalChange}
          onRecorded={load}
        />
      )}
    </div>
  )
}
