'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'

const ALL_PAGES = [
  { key: 'dashboard',  label: 'Dashboard',     icon: '🏠' },
  { key: 'bookings',   label: 'Buchungen',      icon: '📋' },
  { key: 'calendar',   label: 'Kalender',       icon: '📅' },
  { key: 'tasks',      label: 'Aufgaben',       icon: '✅' },
  { key: 'cleaning',   label: 'Reinigung',      icon: '🧹' },
  { key: 'reports',    label: 'Auswertungen',   icon: '📊' },
  { key: 'invoices',   label: 'Rechnungen',     icon: '🧾' },
  { key: 'customers',  label: 'Kunden',         icon: '👥' },
  { key: 'users',      label: 'Benutzer',       icon: '👤' },
  { key: 'settings',   label: 'Einstellungen',  icon: '⚙️' },
]

const DEFAULT_PAGES: Record<string, boolean> = Object.fromEntries(ALL_PAGES.map(p => [p.key, true]))

function PermissionPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [pages, setPages] = useState<Record<string, boolean>>(DEFAULT_PAGES)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(`/api/users/${userId}/permissions`).then(r => r.json()).then(d => {
      setIsAdmin(d.isAdmin)
      setPages(d.pages ?? DEFAULT_PAGES)
      setLoading(false)
    })
  }, [userId])

  const toggle = (key: string) => setPages(prev => ({ ...prev, [key]: !prev[key] }))
  const setAll = (v: boolean) => setPages(Object.fromEntries(ALL_PAGES.map(p => [p.key, v])))

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/users/${userId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages }),
    })
    setSaving(false)
    if (res.ok) { setMsg('✅ Gespeichert'); setTimeout(() => { setMsg(''); onClose() }, 800) }
    else setMsg('❌ Fehler beim Speichern')
  }

  if (loading) return <div className="px-4 py-3 text-sm text-gray-400">Lade…</div>

  return (
    <div className="px-4 py-4 bg-blue-50 border-t border-blue-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Seitenzugriff</span>
        <div className="flex gap-2">
          <button onClick={() => setAll(true)} className="text-xs text-blue-600 hover:underline">Alle</button>
          <span className="text-gray-300">·</span>
          <button onClick={() => setAll(false)} className="text-xs text-red-500 hover:underline">Keine</button>
        </div>
      </div>
      {isAdmin && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ Dieser Benutzer hat aktuell vollen Admin-Zugriff (keine Einschränkungen). Beim Speichern werden die gewählten Rechte aktiv.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {ALL_PAGES.map(p => (
          <label key={p.key} className="flex items-center gap-2 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={!!pages[p.key]}
              onChange={() => toggle(p.key)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 group-hover:text-gray-900">
              {p.icon} {p.label}
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Abbrechen</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePages, setInvitePages] = useState<Record<string, boolean>>(DEFAULT_PAGES)
  const [showInvitePerms, setShowInvitePerms] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/users').then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
  }
  useEffect(load, [])

  const toggleInvitePage = (key: string) => setInvitePages(prev => ({ ...prev, [key]: !prev[key] }))
  const setAllInvite = (v: boolean) => setInvitePages(Object.fromEntries(ALL_PAGES.map(p => [p.key, v])))

  const invite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), pages: invitePages }),
    })
    const data = await res.json()
    setInviting(false)
    if (res.ok) {
      setInviteLink(data.link || '')
      setMsg('✅ Einladungslink erstellt für ' + inviteEmail)
      setInviteEmail('')
      setShowInvitePerms(false)
      setInvitePages(DEFAULT_PAGES)
      load()
    } else {
      setMsg('❌ Fehler: ' + (data.error || 'Unbekannt'))
    }
  }

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Benutzer ${email} wirklich löschen?`)) return
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">👤 Benutzer</h1>

      {/* Invite form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Einladungslink erstellen</h2>
        <p className="text-xs text-gray-400">E-Mail-Adresse des neuen Benutzers eingeben → Link generieren → Link selbst per E-Mail verschicken.</p>
        <div className="flex gap-2">
          <input type="email"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="E-Mail-Adresse des neuen Benutzers…" value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && invite()} />
          <button onClick={() => setShowInvitePerms(v => !v)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            🔐 Rechte {showInvitePerms ? '▲' : '▼'}
          </button>
          <button onClick={invite} disabled={inviting || !inviteEmail.trim()}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {inviting ? '⏳ Erstelle…' : '🔗 Link erstellen'}
          </button>
        </div>

        {showInvitePerms && (
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Seitenzugriff für neuen Benutzer</span>
              <div className="flex gap-2">
                <button onClick={() => setAllInvite(true)} className="text-xs text-blue-600 hover:underline">Alle</button>
                <span className="text-gray-300">·</span>
                <button onClick={() => setAllInvite(false)} className="text-xs text-red-500 hover:underline">Keine</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PAGES.map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={!!invitePages[p.key]} onChange={() => toggleInvitePage(p.key)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">{p.icon} {p.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {msg && <p className="text-sm">{msg}</p>}

        {inviteLink && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-green-800">Einladungslink — bitte manuell per E-Mail weiterleiten:</p>
            <div className="flex gap-2 items-center">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 text-xs bg-white border border-green-200 rounded-lg px-3 py-2 text-gray-700 select-all"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(inviteLink); setMsg('📋 Link kopiert!') }}
                className="shrink-0 bg-green-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-green-700">
                Kopieren
              </button>
            </div>
            <p className="text-xs text-green-700">Der Link ist einmalig gültig. Der Benutzer kann damit ein Passwort setzen und sich anmelden.</p>
            <button onClick={() => setInviteLink('')} className="text-xs text-green-600 hover:underline">Link ausblenden</button>
          </div>
        )}
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 font-semibold text-gray-800">Aktive Benutzer</div>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Lade…</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map(u => (
              <div key={u.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{u.email}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Erstellt: {u.created_at ? new Date(u.created_at).toLocaleDateString('de-DE') : '—'}
                      {u.last_sign_in_at && ` · Login: ${new Date(u.last_sign_in_at).toLocaleDateString('de-DE')}`}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${u.email_confirmed_at ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {u.email_confirmed_at ? 'Bestätigt' : 'Ausstehend'}
                  </span>
                  <button
                    onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                    className={`text-xs border rounded px-2 py-1 shrink-0 transition-colors ${expandedUser === u.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    🔐 Rechte
                  </button>
                  <button onClick={() => deleteUser(u.id, u.email)}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-50 shrink-0">
                    Löschen
                  </button>
                </div>
                {expandedUser === u.id && (
                  <PermissionPanel userId={u.id} onClose={() => setExpandedUser(null)} />
                )}
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-10 text-gray-400">Keine Benutzer gefunden</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
