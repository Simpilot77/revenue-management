'use client'
export const dynamic = 'force-dynamic'

import { useRef, useState } from 'react'

const TABLE_LABELS: Record<string, string> = {
  bookings:             'Buchungen',
  booking_tasks:        'Aufgaben-Status',
  customers:            'Kunden',
  cleaning_markers:     'Reinigungsmarkierungen',
  cleaning_details:     'Reinigungsdetails',
  cleaning_exclusions:  'Reinigungsausnahmen',
  calendar_extra_tasks: 'Zusatzaufgaben',
  deleted_bookings:     'Gelöschte Buchungen',
  invoices:             'Rechnungen',
}

export default function DatenPage() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exportResult, setExportResult] = useState<{ rows: Record<string,number>; date: string } | null>(null)
  const [importResult, setImportResult] = useState<{ results: Record<string,any> } | null>(null)
  const [error, setError] = useState('')
  const [confirmImport, setConfirmImport] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    setError('')
    setExportResult(null)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Export fehlgeschlagen') }
      const data = await res.json()
      const rows: Record<string,number> = {}
      for (const [k, v] of Object.entries(data.tables as Record<string,any[]>)) rows[k] = v.length

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `datenbank_export_${new Date().toISOString().slice(0,10)}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setExportResult({ rows, date: data.exported_at })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data?.tables) throw new Error('Ungültiges Dateiformat — kein "tables"-Schlüssel gefunden.')
      const rows: Record<string,number> = {}
      for (const [k, v] of Object.entries(data.tables as Record<string,any[]>)) rows[k] = v.length
      setConfirmImport({ data, rows })
    } catch (e: any) {
      setError('Datei konnte nicht gelesen werden: ' + e.message)
    }
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!confirmImport) return
    setImporting(true)
    setError('')
    setImportResult(null)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmImport.data),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setImportResult(result)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
      setConfirmImport(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">🗄️ Datensicherung</h1>
      <p className="text-sm text-gray-500">Exportiere alle Daten als JSON-Datei und importiere sie auf einem anderen System oder nach einem Reset.</p>

      {/* Export */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">📤 Export</h2>
        <p className="text-sm text-gray-500">Lädt alle Buchungen, Aufgaben, Reinigungen, Rechnungen und Kundendaten als JSON-Datei herunter.</p>
        <button onClick={handleExport} disabled={exporting}
          className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {exporting ? '⏳ Exportiere…' : '📥 Jetzt exportieren'}
        </button>
        {exportResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-green-800">✅ Export erfolgreich — {new Date(exportResult.date).toLocaleString('de-DE')}</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(exportResult.rows).map(([k, n]) => (
                <div key={k} className="text-xs text-green-700">{TABLE_LABELS[k] ?? k}: <strong>{n}</strong> Einträge</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Import */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">📤 Import</h2>
        <p className="text-sm text-gray-500">Vorhandene Einträge werden per Upsert aktualisiert — bestehende Daten werden <strong>nicht gelöscht</strong>, nur ergänzt oder überschrieben.</p>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        <button onClick={() => fileRef.current?.click()}
          className="border border-gray-200 rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-gray-50">
          📂 JSON-Datei auswählen
        </button>
        {importResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-green-800">✅ Import abgeschlossen</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(importResult.results).map(([k, r]: [string, any]) => (
                <div key={k} className={`text-xs ${r.error ? 'text-red-600' : 'text-green-700'}`}>
                  {TABLE_LABELS[k] ?? k}: {r.error ? `❌ ${r.error}` : <strong>{r.inserted} importiert</strong>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">❌ {error}</div>}

      {/* Confirm modal */}
      {confirmImport && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)' }}
          onClick={() => setConfirmImport(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">📤 Import bestätigen</h3>
            <p className="text-sm text-gray-600">Folgende Daten werden in die Datenbank importiert (Upsert):</p>
            <div className="grid grid-cols-2 gap-1 bg-gray-50 rounded-lg p-3">
              {Object.entries(confirmImport.rows).map(([k, n]: [string, any]) => (
                <div key={k} className="text-xs text-gray-700">{TABLE_LABELS[k] ?? k}: <strong>{n}</strong></div>
              ))}
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">⚠️ Bestehende Einträge mit gleicher ID werden überschrieben.</p>
            <div className="flex gap-2 justify-end">
              <button className="border border-gray-200 rounded-lg px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setConfirmImport(null)}>Abbrechen</button>
              <button className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50" disabled={importing} onClick={handleImport}>
                {importing ? '⏳ Importiere…' : '✅ Jetzt importieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
