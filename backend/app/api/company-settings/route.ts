import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('company_settings').select('*').order('id').limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? {})
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const body = await req.json()
  const { id, ...rest } = body
  let result
  if (id) {
    const { data, error } = await supabase.from('company_settings').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await supabase.from('company_settings').insert({ ...rest, updated_at: new Date().toISOString() }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }
  return NextResponse.json(result)
}
