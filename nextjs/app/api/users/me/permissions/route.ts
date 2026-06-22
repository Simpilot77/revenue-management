import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ pages: null, isAdmin: false }, { status: 401 })
  const { data } = await supabase.from('user_permissions').select('pages').eq('user_id', user.id).maybeSingle()
  // No entry = admin (full access to everything)
  return NextResponse.json({ pages: data?.pages ?? null, isAdmin: !data })
}
