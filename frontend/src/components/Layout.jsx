import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/bookings', label: 'Buchungen', icon: '📋' },
  { to: '/calendar', label: 'Kalender', icon: '📅' },
  { to: '/tasks', label: 'Aufgaben', icon: '☑️' },
  { to: '/reports', label: 'Auswertungen', icon: '📈' },
  { to: '/customers', label: 'Kunden', icon: '👤' },
  { to: '/settings', label: 'Einstellungen', icon: '⚙️' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-blue-800">
          <div className="text-lg font-bold">🏠 Workation Wolfsburg</div>
          <div className="text-blue-300 text-xs mt-1">Revenue Management</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`
              }
            >
              <span>{icon}</span> {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`
              }
            >
              <span>👥</span> Benutzer
            </NavLink>
          )}
        </nav>
        <div className="p-4 border-t border-blue-800">
          <div className="text-xs text-blue-300 mb-1">{user?.name}</div>
          <div className="text-xs text-blue-400 mb-3 capitalize">{user?.role}</div>
          <button onClick={handleLogout} className="text-xs text-blue-300 hover:text-white transition-colors">
            ← Abmelden
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
