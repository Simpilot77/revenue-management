import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const ids = searchParams.get('ids') // comma-separated booking_ids
  if (!ids) return NextResponse.json([])
  const idList = ids.split(',').map(Number).filter(Boolean)
  const { data, error } = await supabase.from('booking_tasks').select('*').in('booking_id', idList)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
