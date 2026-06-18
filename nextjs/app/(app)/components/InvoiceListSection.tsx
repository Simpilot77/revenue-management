'use client'
import { useState, useEffect } from 'react'
import InvoicePreviewModal from './InvoicePreviewModal'
import { buildInvoicePreviewData, buildStornoPreviewData, buildPartialInvoicePreviewData } from '../tasks/pdfExport'

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const TYPE_LABELS: Record<string, string> = {
  normal: 'Rechnung',
  partial: 'Teilrechnung',
  storno: 'Storno',
}
const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-blue-50 text-blue-700',
  partial: 'bg-violet-50 text-violet-700',
  storno: 'bg-red-50 text-red-700',
}

interface Props {
  booking: any
  onUpdate?: () => void
  settings?: any
}

export default function InvoiceListSection({ booking, onUpdate, settings }: Props) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [lang, setLang] = useState('de')
  const [modal, setModal] = useState<any | null>(null)
  const [modalData, setModalData] = useState<any | null>(null)

  const loadInvoices = () => {
    if (!booking?.id) return
    fetch(`/api/invoices?booking_id=${booking.id}`)
      .then(r => r.json())
      .then(d => setInvoices(Array.isArray(d) ? d : []))
  }

  useEffect(() => { loadInvoices() }, [booking?.id])

  const openNewInvoice = () => {
    const data = buildInvoicePreviewData(booking, lang, settings)
    setModalData(data)
    setModal('new')
  }

  const openPartialInvoice = () => {
    const pctStr = window.prompt('Anteil in % (z. B. 50 für eine Hälfte):', '50')
    if (pctStr === null) return
    const pct = parseFloat(pctStr)
    if (isNaN(pct) || pct <= 0 || pct > 100) { alert('Ungültiger Prozentwert.'); return }
    const data = buildPartialInvoicePreviewData(booking, pct / 100, lang, settings)
    setModalData(data)
    setModal('partial')
  }

  const openStorno = (invoice: any) => {
    const pctStr = window.prompt('Nächste Rechnungsnummer für die Stornorechnung:',
      invoice.invoice_number ? `${invoice.invoice_number}-S` : '')
    if (pctStr === null) return
    const stornoNum = pctStr.trim()
    if (!stornoNum) return
    const data = buildStornoPreviewData(
      {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        data: invoice.data || buildInvoicePreviewData(booking, invoice.lang || lang, settings),
      },
      stornoNum,
      invoice.lang || lang
    )
    setModalData(data)
    setModal('storno')
  }

  const openReprint = (invoice: any) => {
    if (!invoice.data) return
    setModalData({ ...invoice.data })
    setModal('reprint')
  }

  const handleModalClose = () => {
    setModal(null)
    setModalData(null)
    loadInvoices()
    onUpdate?.()
  }

  const handleLangChange = (newLang: string) => {
    setLang(newLang)
    if (modalData) {
      const refreshed = modal === 'storno'
        ? buildStornoPreviewData(
            {
              id: modalData._reference_invoice_id,
              invoice_number: modalData._reference_invoice_number,
              invoice_date: modalData.invoice_date,
              data: modalData,
            },
            modalData.invoice_number,
            newLang
          )
        : buildInvoicePreviewData(booking, newLang, settings)
      setModalData({ ...refreshed, ...keepEdits(modalData, refreshed) })
    }
  }

  const keepEdits = (current: any, refreshed: any) => {
    const editableFields = ['invoice_number', 'company_name', 'guest_name', 'billing_street',
      'billing_zip', 'billing_city', 'billing_country', 'billing_address_freetext',
      'customer_number', 'contact_person', 'accommodation_qty', 'accommodation_unit_price',
      'cleaning_fee', 'discount_pct', 'extra_items', 'brutto_total', 'netto_total', 'vat_amount']
    const overrides: any = {}
    for (const k of editableFields) {
      if (current[k] !== refreshed[k]) overrides[k] = current[k]
    }
    return overrides
  }

  const handleChange = (field: string, value: any) => {
    setModalData((prev: any) => ({ ...prev, [field]: value }))
  }

  const hasStorno = (invoice: any) =>
    invoices.some(inv => inv.reference_invoice_id === invoice.id && inv.type === 'storno')

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
        <span className="font-semibold text-gray-800 text-sm">🧾 Rechnungen</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openPartialInvoice}
            className="text-xs px-3 py-1.5 border border-violet-200 text-violet-700 hover:bg-violet-50 rounded-lg font-medium transition-colors"
          >
            ✂️ Teilrechnung…
          </button>
          <button
            type="button"
            onClick={openNewInvoice}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Neue Rechnung
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Noch keine Rechnungen für diese Buchung.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${TYPE_COLORS[inv.type] || 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_LABELS[inv.type] || inv.type}
                  </span>
                  <span className="text-sm font-mono font-medium text-gray-800 truncate">
                    {inv.invoice_number}
                    {inv.manual && <span className="ml-1 text-amber-500" title="Manuell eingegeben">✍️</span>}
                  </span>
                  {inv.invoice_date && (
                    <span className="text-xs text-gray-400">{inv.invoice_date}</span>
                  )}
                  {inv.reference_invoice_number && (
                    <span className="text-xs text-gray-400">→ {inv.reference_invoice_number}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-gray-700">{fmtEur(inv.brutto_total)}</span>
                  {inv.data && (
                    <button type="button"
                      onClick={() => openReprint(inv)}
                      className="text-xs px-2 py-1 border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600">
                      📄 PDF
                    </button>
                  )}
                  {(inv.type === 'normal' || inv.type === 'partial') && !hasStorno(inv) && (
                    <button type="button"
                      onClick={() => openStorno(inv)}
                      className="text-xs px-2 py-1 border border-red-200 hover:bg-red-50 rounded-lg text-red-600">
                      🔴 Storno
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && modalData && (
        <InvoicePreviewModal
          data={modalData}
          onClose={handleModalClose}
          onLangChange={handleLangChange}
          onChange={handleChange}
          onRecorded={() => { loadInvoices(); onUpdate?.() }}
          settings={settings}
        />
      )}
    </div>
  )
}
