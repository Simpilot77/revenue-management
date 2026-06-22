import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UPSERT_TABLES: Record<string, string> = {
  bookings:              'id',
  booking_tasks:         'booking_id',
  customers:             'id',
  cleaning_markers:      'id',
  cleaning_details:      'booking_id',
  cleaning_exclusions:   'id',
  calendar_extra_tasks:  'id',
  deleted_bookings:      'id',
  invoices:              'id',
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const body = await req.json()

  if (!body?.tables || typeof body.tables !== 'object') {
    return NextResponse.json({ error: 'Ungültiges Format' }, { status: 400 })
  }

  const results: Record<string, { inserted: number; error?: string }> = {}

  for (const [table, conflictCol] of Object.entries(UPSERT_TABLES)) {
    const rows = body.tables[table]
    if (!Array.isArray(rows) || rows.length === 0) {
      results[table] = { inserted: 0 }
      continue
    }
    const { data, error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: conflictCol })
      .select()
    if (error) {
      results[table] = { inserted: 0, error: error.message }
    } else {
      results[table] = { inserted: data?.length ?? rows.length }
    }
  }

  const hasError = Object.values(results).some(r => r.error)
  return NextResponse.json({ results }, { status: hasError ? 207 : 200 })
}
