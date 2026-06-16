'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-white/70 hover:text-white border border-white/30 hover:border-white/60 rounded-lg px-3 py-1.5 transition-colors"
    >
      Abmelden
    </button>
  )
}
