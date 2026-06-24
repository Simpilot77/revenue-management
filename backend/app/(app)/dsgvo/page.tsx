'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'

export default function DSGVOPage() {
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState<'email' | 'name'>('name')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [deleteResult, setDeleteResult] = useState<any>(null)
  const [anonResult, setAnonResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleAuskunft = async () => {
    if (!search.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const param = searchType === 'email' ? `email=${encodeURIComponent(search)}` : `name=${encodeURIComponent(search)}`
      const res = await fetch(`/api/dsgvo/auskunft?${param}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!search.trim()) return
    if (!confirm(`Achtung: Personenbezogene Daten für "${search}" werden unwiderruflich gelöscht/anonymisiert. Fortfahren?`)) return
    setLoading(true)
    setError('')
    setDeleteResult(null)
    try {
      const res = await fetch('/api/dsgvo/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [searchType]: search, confirm: true }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDeleteResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnonymize = async () => {
    if (!confirm('Alle Buchungen mit Checkout älter als 10 Jahre werden anonymisiert. Fortfahren?')) return
    setLoading(true)
    setError('')
    setAnonResult(null)
    try {
      const res = await fetch('/api/dsgvo/anonymize', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnonResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const exportJSON = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dsgvo_auskunft_${search.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🔒 DSGVO-Verwaltung</h1>
        <p className="text-sm text-gray-500 mt-1">Datenauskunft (Art. 15), Löschung (Art. 17) und automatische Anonymisierung</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">❌ {error}</div>}

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">🔍 Person suchen</h2>
        <div className="flex gap-3 flex-wrap">
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={searchType} onChange={e => setSearchType(e.target.value as any)}>
            <option value="name">Nach Name</option>
            <option value="email">Nach E-Mail</option>
          </select>
          <input className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder={searchType === 'email' ? 'E-Mail-Adresse eingeben…' : 'Name eingeben…'}
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuskunft()} />
          <button onClick={handleAuskunft} disabled={loading || !search.trim()}
            className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? '⏳ Suche…' : '📋 Auskunft (Art. 15)'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">📋 Datenauskunft</h2>
            <button onClick={exportJSON}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
              📥 Als JSON exportieren
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
            {Object.entries(result.person || {}).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <div className="text-xs text-gray-400 capitalize">{k}</div>
                <div className="text-sm font-medium text-gray-900">{String(v)}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {result.buchungen?.length || 0} Buchung(en)
            </div>
            <div className="space-y-1.5">
              {(result.buchungen || []).map((b: any, i: number) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-700">{b.haus} · {b.checkin} – {b.checkout}</span>
                  <span className="font-medium text-gray-900">{b.betrag} €</span>
                </div>
              ))}
            </div>
          </div>

          {result.rechnungen?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                {result.rechnungen.length} Rechnung(en)
              </div>
              <div className="space-y-1.5">
                {result.rechnungen.map((r: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-700">{r.rechnungsnummer} ({r.typ})</span>
                    <span className="font-medium text-gray-900">{r.betrag} €</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 space-y-1 border-t border-gray-100 pt-3">
            <div><strong>Rechtsgrundlage:</strong> {result.rechtsgrundlage}</div>
            <div><strong>Aufbewahrungsfrist:</strong> {result.aufbewahrungsfrist}</div>
            <div><strong>Empfänger:</strong> {result.empfaenger?.join(', ')}</div>
          </div>

          {/* Delete button */}
          <div className="border-t border-gray-100 pt-4">
            <button onClick={handleDelete} disabled={loading}
              className="bg-red-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              🗑️ Daten löschen (Art. 17)
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Kontaktdaten (E-Mail, Telefon) werden sofort gelöscht. Name und Buchungsdaten werden nach Ablauf der steuerlichen Aufbewahrungspflicht (10 Jahre) automatisch anonymisiert.
            </p>
          </div>
        </div>
      )}

      {deleteResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
          <div className="font-semibold">✅ {deleteResult.message}</div>
          <div>Vollständig anonymisiert: {deleteResult.vollstaendig_anonymisiert}</div>
          <div>Kontaktdaten gelöscht: {deleteResult.kontaktdaten_geloescht}</div>
          {deleteResult.hinweis_aufbewahrungspflicht && (
            <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
              ⚠️ {deleteResult.hinweis_aufbewahrungspflicht}
            </div>
          )}
        </div>
      )}

      {/* Auto-Anonymize */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">🔄 Automatische Anonymisierung</h2>
        <p className="text-sm text-gray-500">
          Anonymisiert alle Buchungen, deren Checkout mehr als 10 Jahre zurückliegt. Läuft automatisch am 1. jedes Monats — kann hier auch manuell ausgelöst werden.
        </p>
        <button onClick={handleAnonymize} disabled={loading}
          className="border border-gray-200 rounded-lg px-5 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          {loading ? '⏳ Läuft…' : '▶️ Jetzt ausführen'}
        </button>
        {anonResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
            ✅ {anonResult.message}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
        <div className="font-semibold">ℹ️ DSGVO-Maßnahmen in dieser Datenbank</div>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Row Level Security (RLS) auf allen 15 Tabellen aktiv</li>
          <li>SSL/TLS-Verschlüsselung für alle Datenbankverbindungen</li>
          <li>IBAN und Steuer-Nr. werden verschlüsselt gespeichert (pgcrypto)</li>
          <li>Automatische Anonymisierung nach 10 Jahren (pg_cron)</li>
          <li>Audit-Log für alle DSGVO-Aktionen (Auskunft, Löschung)</li>
          <li>Passwort-Hashing: scram-sha-256</li>
        </ul>
      </div>
    </div>
  )
}
