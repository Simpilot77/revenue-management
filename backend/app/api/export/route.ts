import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TABLES = [
  'bookings',
  'booking_tasks',
  'customers',
  'cleaning_markers',
  'cleaning_details',
  'cleaning_exclusions',
  'calendar_extra_tasks',
  'deleted_bookings',
  'invoices',
  'dsgvo_audit_log',
]

export async function GET() {
  const supabase = await createClient()
  const result: Record<string, any[]> = {}

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
    result[table] = data ?? []
  }

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    version: 1,
    tables: result,
  })
}
