import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/format';

const EMPTY = { name: '', email: '', password: '', role: 'viewer' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      if (editId) {
        await api.put(`/users/${editId}`, form);
        setSuccess('Benutzer aktualisiert');
      } else {
        await api.post('/users', form);
        setSuccess('Benutzer angelegt');
      }
      setForm(EMPTY); setEditId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setEditId(u.id);
    setError(''); setSuccess('');
  };

  const handleDeactivate = async (u) => {
    if (!confirm(`Benutzer "${u.name}" deaktivieren?`)) return;
    await api.delete(`/users/${u.id}`);
    load();
  };

  const ROLE_COLORS = { admin: 'bg-red-100 text-red-700', manager: 'bg-blue-100 text-blue-700', viewer: 'bg-gray-100 text-gray-600' };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Benutzerverwaltung</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">{editId ? 'Benutzer bearbeiten' : 'Neuen Benutzer anlegen'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="form-label">E-Mail *</label>
              <input type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="form-label">{editId ? 'Neues Passwort (leer = unverändert)' : 'Passwort *'}</label>
              <input type="password" className="form-input" value={form.password} onChange={e => set('password', e.target.value)} required={!editId} minLength={8} placeholder="Mindestens 8 Zeichen" />
            </div>
            <div>
              <label className="form-label">Rolle</label>
              <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="viewer">Viewer — nur lesen</option>
                <option value="manager">Manager — lesen & schreiben</option>
                <option value="admin">Admin — voller Zugriff</option>
              </select>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2">✓ {success}</div>}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Speichern…' : editId ? '💾 Aktualisieren' : '+ Anlegen'}
              </button>
              {editId && (
                <button type="button" className="btn-secondary" onClick={() => { setEditId(null); setForm(EMPTY); }}>
                  Abbrechen
                </button>
              )}
            </div>
          </form>
        </div>

        {/* User list */}
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Name','Rolle','Erstellt',''].map(h => (
                <th key={h} className="text-left text-gray-500 font-medium px-4 py-3">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleEdit(u)} className="text-blue-500 hover:text-blue-700 mr-2">✏️</button>
                    {u.active && <button onClick={() => handleDeactivate(u)} className="text-red-400 hover:text-red-600">🚫</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role explanation */}
      <div className="card bg-blue-50 border-blue-100">
        <h3 className="font-medium text-blue-900 mb-2">Rollenübersicht</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>🔵 <strong>Admin</strong> — Voller Zugriff: Buchungen, Auswertungen, Benutzerverwaltung</li>
          <li>🟢 <strong>Manager</strong> — Buchungen anlegen/bearbeiten/löschen, alle Auswertungen</li>
          <li>⚪ <strong>Viewer</strong> — Nur lesen: Buchungen und Auswertungen anzeigen, nichts bearbeiten</li>
        </ul>
      </div>
    </div>
  );
}
