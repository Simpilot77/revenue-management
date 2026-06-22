import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, pages } = await req.json()
  if (!email) return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 })

  const admin = createAdminClient()

  // Generate invite link instead of sending email
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
  })
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

  const link = data?.properties?.action_link
  return NextResponse.json({ ok: true, user: data?.user, link })
}
