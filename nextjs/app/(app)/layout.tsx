'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',     icon: '🏠' },
  { href: '/bookings',   label: 'Buchungen',      icon: '📋' },
  { href: '/calendar',   label: 'Kalender',       icon: '📅' },
  { href: '/tasks',      label: 'Aufgaben',       icon: '✅' },
  { href: '/cleaning',   label: 'Reinigung',      icon: '🧹' },
  { href: '/reports',    label: 'Auswertungen',   icon: '📊' },
  { href: '/invoices',   label: 'Rechnungen',     icon: '🧾' },
  { href: '/settings',   label: 'Einstellungen',  icon: '⚙️' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="font-bold text-lg leading-tight">Workation</div>
          <div className="text-xs text-white/50 mt-0.5">Wolfsburg</div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full text-xs text-white/50 hover:text-white transition-colors text-left"
          >
            Abmelden →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
