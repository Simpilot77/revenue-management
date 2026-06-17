'use client'
import { useState, useEffect } from 'react'
import { buildInvoicePreviewData, buildStornoPreviewData, buildPartialInvoicePreviewData, exportInvoiceFromData } from './pdfExport'
import { suggestNextInvoiceNumber } from './invoiceHelpers'
import InvoicePreviewModal from './InvoicePreviewModal'

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  storno: { label: 'Storno', cls: 'bg-red-100 text-red-700' },
  partial: { label: 'Teil', cls: 'bg-blue-100 text-blue-700' },
  normal: { label: 'Normal', cls: 'bg-green-100 text-green-700' },
}

function fmtEur(v: any) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
}

interface Props {
  booking: any
  onUpdate?: () => void
  invoiceLang?: string
  settings?: any
}

export default function InvoiceListSection({ booking, onUpdate, invoiceLang = 'de', settings }: Props) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoicePreview, setInvoicePreview] = useState<any>(null)
  const [lang, setLang] = useState(invoiceLang)
  const [busyId, setBusyId] = useState<any>(null)

  const fetchInvoices = async () => {
    if (!booking?.id) return
    const res = await fetch(`/api/invoices?booking_id=${booking.id}`)
    const data = await res.json()
    setInvoices(Array.isArray(data) ? data : [])
  }

  useEffect(() => { fetchInvoices() }, [booking?.id])

  const closeModal = () => {
    setInvoicePreview(null)
    fetchInvoices()
    onUpdate?.()
  }

  const handleLangChange = (newLang: string) => {
    setLang(newLang)
    setInvoicePreview((prev: any) => {
      if (!prev) return prev
      const fresh = prev._type === 'storno'
        ? buildStornoPreviewData(
            invoices.find(i => i.id === prev._reference_invoice_id) || { data: prev, id: prev._reference_invoice_id, invoice_number: prev._reference_invoice_number, invoice_date: prev.invoice_date },
            prev.invoice_number, newLang
          )
        : prev._type === 'partial'
          ? buildPartialInvoicePreviewData(booking, prev._fraction || 0.5, newLang, settings)
          : buildInvoicePreviewData(booking, newLang, settings)
      return {
        ...fresh,
        company_name: prev.company_name,
        guest_name: prev.guest_name,
        billing_street: prev.billing_street,
        billing_zip: prev.billing_zip,
        billing_city: prev.billing_city,
        billing_country: prev.billing_country,
        invoice_number: prev.invoice_number,
        invoice_date: prev.invoice_date,
        service_period: prev.service_period,
        customer_number: prev.customer_number,
        extra_items: prev.extra_items || [],
        _fraction: prev._fraction,
      }
    })
  }

  const openNewInvoice = () => {
    const data = buildInvoicePreviewData(booking, lang, settings)
    setInvoicePreview({ ...data, _house_short: booking.house_short, extra_items: [] })
  }

  const openPartialInvoice = async () => {
    const input = window.prompt('Anteil der Teilrechnung in % (z. B. 50):', '50')
    if (input == null) return
    const pct = parseFloat(input.replace(',', '.'))
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      window.alert('Bitte einen Anteil zwischen 1 und 100 eingeben.')
      return
    }
    const fraction = pct / 100
    setBusyId('partial')
    try {
      const nextNumber = await suggestNextInvoiceNumber(booking.house_short || String(booking.house_id || ''))
      const data = buildPartialInvoicePreviewData(booking, fraction, lang, settings)
      setInvoicePreview({ ...data, invoice_number: nextNumber, extra_items: [], _fraction: fraction, _house_short: booking.house_short })
    } finally { setBusyId(null) }
  }

  const openStorno = async (inv: any) => {
    setBusyId(inv.id)
    try {
      const nextNumber = await suggestNextInvoiceNumber(booking.house_short || String(booking.house_id || ''))
      setInvoicePreview(buildStornoPreviewData(inv, nextNumber, inv.lang || 'de'))
    } finally { setBusyId(null) }
  }

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">🧾 Rechnungen</h3>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={openNewInvoice}>
              🧾 Neue Rechnung erstellen…
            </button>
            <button type="button" className="btn-secondary text-xs px-2 py-1" disabled={busyId === 'partial'} onClick={openPartialInvoice}>
              {busyId === 'partial' ? '…' : '✂️ Teilrechnung erstellen…'}
            </button>
          </div>
        </div>

        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine Rechnungen erstellt.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => {
              const isStornoed = invoices.some(
                other => other.type === 'storno' && other.reference_invoice_id === inv.id
              )
              const badge = TYPE_BADGE[inv.type] || TYPE_BADGE.normal
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm text-gray-700">{inv.invoice_number}</span>
                    <span className="text-xs text-gray-400">{inv.invoice_date}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    {inv.type === 'storno' && inv.reference_invoice_number && (
                      <span className="text-xs text-gray-400 truncate">↩ Storno zu {inv.reference_invoice_number}</span>
                    )}
                    <span className="text-sm text-gray-600">{fmtEur(inv.brutto_total)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" className="btn-secondary text-xs px-2 py-1"
                      onClick={() => inv.data && exportInvoiceFromData({ ...inv.data, _settings: settings })}>
                      📄 PDF erneut
                    </button>
                    {(inv.type === 'normal' || inv.type === 'partial') && !isStornoed && (
                      <button type="button" className="btn-secondary text-xs px-2 py-1 text-red-600"
                        disabled={busyId === inv.id} onClick={() => openStorno(inv)}>
                        {busyId === inv.id ? '…' : '🔴 Stornieren'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {invoicePreview && (
        <InvoicePreviewModal
          data={invoicePreview}
          settings={settings}
          onClose={closeModal}
          onLangChange={handleLangChange}
          onChange={(field: string, value: any) => setInvoicePreview((prev: any) => ({ ...prev, [field]: value }))}
        />
      )}
    </>
  )
}
