'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/users').then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
  }
  useEffect(load, [])

  const invite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/users/invite', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: inviteEmail.trim() }) })
    const data = await res.json()
    setInviting(false)
    if (res.ok) { setMsg('✅ Einladung gesendet an ' + inviteEmail); setInviteEmail(''); load() }
    else setMsg('❌ Fehler: ' + (data.error || 'Unbekannt'))
    setTimeout(() => setMsg(''), 4000)
  }

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Benutzer ${email} wirklich löschen?`)) return
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">👤 Benutzer</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Neuen Benutzer einladen</h2>
        <div className="flex gap-2">
          <input type="email" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="E-Mail-Adresse…" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && invite()} />
          <button onClick={invite} disabled={inviting || !inviteEmail.trim()}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {inviting ? 'Sende…' : 'Einladen'}
          </button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 font-semibold text-gray-800">Aktive Benutzer</div>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Lade…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-Mail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Erstellt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Letzter Login</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.created_at ? new Date(u.created_at).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.email_confirmed_at ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {u.email_confirmed_at ? 'Bestätigt' : 'Ausstehend'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteUser(u.id, u.email)}
                      className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-50">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Keine Benutzer gefunden</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
