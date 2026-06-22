import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data } = await supabase.from('user_permissions').select('pages').eq('user_id', id).maybeSingle()
  // No entry = admin (full access)
  return NextResponse.json({ pages: data?.pages ?? null, isAdmin: !data })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { pages } = await req.json()
  const { error } = await supabase.from('user_permissions')
    .upsert({ user_id: id, pages, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
