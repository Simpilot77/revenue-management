'use client'
// Invoice number helpers for Next.js app — replaces numbering.js (uses fetch instead of axios)

export function splitInvoiceNumber(invoiceNumber: string) {
  const parts = String(invoiceNumber || '').split('-')
  if (parts.length >= 3) {
    return { prefix: parts[0], year: parts[1], suffix: parts.slice(2).join('-') }
  }
  return { prefix: '', year: '', suffix: invoiceNumber || '' }
}

export function composeInvoiceNumber({ prefix, year, suffix }: { prefix: string; year: string; suffix: string }) {
  if (!prefix || !year || !suffix) return ''
  const paddedSuffix = String(suffix).replace(/[^0-9]/g, '').padStart(4, '0')
  return `${prefix}-${year}-${paddedSuffix}`
}

export function findConflict(list: any[], field: string, value: string, excludeId: number) {
  if (!value) return null
  return list.find(item => item.id !== excludeId && item[field] && item[field] === value) || null
}

export function findInvoiceNumberGaps(invoiceNumbers: string[]) {
  const byHouseYear: Record<string, number[]> = {}
  invoiceNumbers.forEach(inv => {
    const parts = String(inv || '').split('-')
    if (parts.length < 3) return
    const key = `${parts[0]}-${parts[1]}`
    const num = parseInt(parts[2])
    if (isNaN(num)) return
    if (!byHouseYear[key]) byHouseYear[key] = []
    byHouseYear[key].push(num)
  })

  const gaps: Record<string, number[]> = {}
  Object.entries(byHouseYear).forEach(([key, nums]) => {
    const present = new Set(nums)
    const highest = Math.max(1000, ...nums)
    const missing: number[] = []
    for (let i = 1000; i <= highest; i++) {
      if (!present.has(i)) missing.push(i)
    }
    if (missing.length) gaps[key] = missing
  })
  return gaps
}

// Suggest the next invoice number for a given house prefix (e.g. "15a")
// Queries /api/invoices, finds max suffix for this prefix+year, returns next number starting from 1001
export async function suggestNextInvoiceNumber(houseShort: string): Promise<string> {
  const year = new Date().getFullYear()
  // Derive prefix: e.g. "15a" → "15a", just use houseShort lowercased
  const prefix = (houseShort || '').toLowerCase().replace(/\s+/g, '')

  try {
    const res = await fetch('/api/invoices')
    const invoices: any[] = await res.json()
    // Find all invoice numbers for this prefix+year
    const prefix_year = `${prefix}-${year}`
    const nums = invoices
      .map((inv: any) => inv.invoice_number || '')
      .filter((n: string) => n.startsWith(prefix_year + '-'))
      .map((n: string) => {
        const parts = n.split('-')
        return parseInt(parts[parts.length - 1])
      })
      .filter((n: number) => !isNaN(n))

    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1001
    const suffix = String(next).padStart(4, '0')
    return `${prefix}-${year}-${suffix}`
  } catch {
    const suffix = '1001'
    return `${prefix}-${year}-${suffix}`
  }
}

// Check if an invoice number is already used by another booking.
// Returns true if the value can be used (no conflict, or user confirmed).
export async function checkInvoiceNumberDuplicate(value: string, excludeBookingId?: number): Promise<boolean> {
  if (!value) return true
  try {
    const res = await fetch('/api/invoices')
    const invoices: any[] = await res.json()
    const conflict = invoices.find(
      (inv: any) =>
        inv.invoice_number === value &&
        (excludeBookingId == null || inv.booking_id !== excludeBookingId)
    )
    if (!conflict) return true
    return window.confirm(
      `Rechnungsnummer "${value}" ist bereits vergeben.\n\nTrotzdem verwenden?`
    )
  } catch {
    return true
  }
}
