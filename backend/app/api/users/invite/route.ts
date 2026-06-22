import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, pages } = await req.json()
  if (!email) return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Save page permissions right after invite
  const userId = data?.user?.id
  if (userId && pages) {
    const supabase = await createClient()
    await supabase.from('user_permissions').upsert({
      user_id: userId,
      pages,
      updated_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ ok: true, user: data?.user })
}
