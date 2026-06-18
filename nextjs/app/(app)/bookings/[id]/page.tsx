'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import InvoiceListSection from '../../components/InvoiceListSection'
export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = ['angefragt','bestaetigt','eingecheckt','ausgecheckt','storniert','no_show','gesperrt']
const STATUS_LABELS: Record<string,string> = { angefragt:'Angefragt', bestaetigt:'Bestätigt', eingecheckt:'Eingecheckt', ausgecheckt:'Ausgecheckt', storniert:'Storniert', no_show:'No-Show', gesperrt:'Gesperrt' }
const PAYMENT_OPTIONS = ['offen','bezahlt','teilweise','erstattet']
const PAYMENT_LABELS: Record<string,string> = { offen:'Offen', bezahlt:'Bezahlt', teilweise:'Teilweise', erstattet:'Erstattet' }
const PAYMENT_METHOD_OPTIONS = ['ueberweisung','kreditkarte','paypal','bar','sonstige']
const PAYMENT_METHOD_LABELS: Record<string,string> = { ueberweisung:'Überweisung', kreditkarte:'Kreditkarte', paypal:'PayPal', bar:'Bar', sonstige:'Sonstige' }

function Field({ label, children, span2 }: any) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
const sel = inp

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 font-semibold text-gray-800 text-sm">{title}</div>
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

const EMPTY: any = {
  house_id: '', channel_id: '', booking_date: new Date().toISOString().slice(0,10),
  checkin_date: '', checkout_date: '', nights: '', guest_count: 1, adults: 1, children: 0,
  guest_name: '', company_name: '', guest_email: '', guest_phone: '', nationality: '',
  daily_rate: '', cleaning_fee: 0, discount_percent: 0, total_price: '',
  commission_rate: 0, commission_amount: 0,
  payment_method: 'ueberweisung', payment_status: 'offen', payment_date: '',
  invoice_number: '', status: 'bestaetigt',
  deposit_taken: false, deposit_returned: false, deposit_amount: '',
  breakfast_included: false, pets_allowed: false, parking: true,
  guest_notes: '', internal_notes: '', block_reason: '',
  cancellation_date: '', cancellation_reason: '',
  is_owner_block: false,
}

export default function BookingFormPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const isNew = id === 'new'

  const [form, setForm] = useState<any>(EMPTY)
  const [houses, setHouses] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const reloadBooking = useCallback(() => {
    if (!isNew) fetch(`/api/bookings/${id}`).then(r=>r.json()).then(d => setForm((prev: any) => ({ ...prev, ...d })))
  }, [id, isNew])

  useEffect(() => {
    Promise.all([
      fetch('/api/houses').then(r=>r.json()),
      fetch('/api/channels').then(r=>r.json()),
      fetch('/api/company-settings').then(r=>r.json()),
    ]).then(([h,c,s]) => {
      setHouses(h.data??h)
      setChannels(c.data??c)
      setSettings(s)
    })
    if (!isNew) {
      fetch(`/api/bookings/${id}`).then(r=>r.json()).then(d => {
        setForm({ ...EMPTY, ...d })
        setLoading(false)
      })
    }
  }, [id, isNew])

  const set = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }))

  // Auto-calculate nights when dates change
  const calcNights = (ci: string, co: string) => {
    if (!ci || !co) return ''
    const diff = Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000)
    return diff > 0 ? diff : ''
  }

  const handleCheckin = (v: string) => {
    const nights = calcNights(v, form.checkout_date)
    setForm((p: any) => ({ ...p, checkin_date: v, nights }))
  }

  const handleCheckout = (v: string) => {
    const nights = calcNights(form.checkin_date, v)
    setForm((p: any) => ({ ...p, checkout_date: v, nights }))
  }

  // Auto-calculate total price
  const handleDailyRate = (v: string) => {
    const nights = parseFloat(form.nights) || 0
    const rate = parseFloat(v) || 0
    const cleaning = parseFloat(form.cleaning_fee) || 0
    const discount = parseFloat(form.discount_percent) || 0
    const subtotal = rate * nights + cleaning
    const total = subtotal * (1 - discount / 100)
    setForm((p: any) => ({ ...p, daily_rate: v, total_price: total > 0 ? total.toFixed(2) : '' }))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = { ...form }
      // Convert empty strings to null for numeric/date fields
      ;['house_id','channel_id','nights','guest_count','adults','children','daily_rate','cleaning_fee',
        'discount_percent','total_price','commission_rate','commission_amount','deposit_amount'].forEach(k => {
        if (payload[k] === '') payload[k] = null
      })
      ;['booking_date','checkin_date','checkout_date','payment_date','cancellation_date'].forEach(k => {
        if (payload[k] === '') payload[k] = null
      })

      const res = isNew
        ? await fetch('/api/bookings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
        : await fetch(`/api/bookings/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })

      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Fehler beim Speichern'); setSaving(false); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      if (isNew) router.push(`/bookings/${data.id}`)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Buchung von "${form.guest_name}" wirklich löschen?`)) return
    setDeleting(true)
    await fetch(`/api/bookings/${id}`, { method:'DELETE' })
    router.push('/bookings')
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Laden…</div>

  const isBlock = form.is_owner_block || form.status === 'gesperrt'

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={()=>router.push('/bookings')} className="text-gray-400 hover:text-gray-600 text-sm">← Zurück</button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          {isNew ? 'Neue Buchung' : (form.guest_name || 'Buchung bearbeiten')}
        </h1>
        {!isNew && (
          <button onClick={handleDelete} disabled={deleting} className="text-red-500 hover:text-red-700 text-sm border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors">
            🗑 Löschen
          </button>
        )}
        <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
          {saving ? 'Speichern…' : saved ? '✅ Gespeichert' : 'Speichern'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Status badge row */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={()=>set('status',s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${form.status===s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-2">
          <input type="checkbox" checked={!!form.is_owner_block} onChange={e=>set('is_owner_block',e.target.checked)} className="accent-slate-600" />
          Eigentümer-Sperre
        </label>
      </div>

      <Section title="📍 Objekt & Kanal">
        <Field label="Haus">
          <select className={sel} value={form.house_id||''} onChange={e=>set('house_id',e.target.value)}>
            <option value="">— Haus wählen —</option>
            {houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        <Field label="Kanal">
          <select className={sel} value={form.channel_id||''} onChange={e=>set('channel_id',e.target.value)}>
            <option value="">— Kanal wählen —</option>
            {channels.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Buchungsdatum">
          <input type="date" className={inp} value={form.booking_date||''} onChange={e=>set('booking_date',e.target.value)} />
        </Field>
        <Field label="Personenanzahl">
          <input type="number" className={inp} value={form.guest_count||''} min={0} onChange={e=>set('guest_count',e.target.value)} />
        </Field>
        <Field label="Erwachsene">
          <input type="number" className={inp} value={form.adults||''} min={0} onChange={e=>set('adults',e.target.value)} />
        </Field>
        <Field label="Kinder">
          <input type="number" className={inp} value={form.children||''} min={0} onChange={e=>set('children',e.target.value)} />
        </Field>
      </Section>

      <Section title="📅 Zeitraum">
        <Field label="Check-in">
          <input type="date" className={inp} value={form.checkin_date||''} onChange={e=>handleCheckin(e.target.value)} />
        </Field>
        <Field label="Check-out">
          <input type="date" className={inp} value={form.checkout_date||''} onChange={e=>handleCheckout(e.target.value)} />
        </Field>
        <Field label="Nächte">
          <input type="number" className={inp} value={form.nights||''} readOnly />
        </Field>
        {isBlock && (
          <Field label="Sperrgrund" span2>
            <input type="text" className={inp} value={form.block_reason||''} onChange={e=>set('block_reason',e.target.value)} />
          </Field>
        )}
      </Section>

      {!isBlock && (
        <>
          <Section title="👤 Gast">
            <Field label="Gastname" span2>
              <input type="text" className={inp} value={form.guest_name||''} onChange={e=>set('guest_name',e.target.value)} />
            </Field>
            <Field label="Firma">
              <input type="text" className={inp} value={form.company_name||''} onChange={e=>set('company_name',e.target.value)} />
            </Field>
            <Field label="Nationalität">
              <input type="text" className={inp} value={form.nationality||''} onChange={e=>set('nationality',e.target.value)} placeholder="DE, AT, CH…" />
            </Field>
            <Field label="E-Mail">
              <input type="email" className={inp} value={form.guest_email||''} onChange={e=>set('guest_email',e.target.value)} />
            </Field>
            <Field label="Telefon">
              <input type="tel" className={inp} value={form.guest_phone||''} onChange={e=>set('guest_phone',e.target.value)} />
            </Field>
          </Section>

          <Section title="💶 Preise">
            <Field label="Tagesrate (€)">
              <input type="number" className={inp} value={form.daily_rate||''} step="0.01" onChange={e=>handleDailyRate(e.target.value)} />
            </Field>
            <Field label="Reinigungsgebühr (€)">
              <input type="number" className={inp} value={form.cleaning_fee||''} step="0.01" onChange={e=>set('cleaning_fee',e.target.value)} />
            </Field>
            <Field label="Rabatt (%)">
              <input type="number" className={inp} value={form.discount_percent||''} min={0} max={100} onChange={e=>set('discount_percent',e.target.value)} />
            </Field>
            <Field label="Gesamtpreis (€)">
              <input type="number" className={inp} value={form.total_price||''} step="0.01" onChange={e=>set('total_price',e.target.value)} />
            </Field>
            <Field label="Kommission (%)">
              <input type="number" className={inp} value={form.commission_rate||''} step="0.1" onChange={e=>set('commission_rate',e.target.value)} />
            </Field>
            <Field label="Kommission (€)">
              <input type="number" className={inp} value={form.commission_amount||''} step="0.01" onChange={e=>set('commission_amount',e.target.value)} />
            </Field>
          </Section>

          <Section title="💳 Zahlung & Rechnung">
            <Field label="Zahlungsart">
              <select className={sel} value={form.payment_method||''} onChange={e=>set('payment_method',e.target.value)}>
                {PAYMENT_METHOD_OPTIONS.map(o=><option key={o} value={o}>{PAYMENT_METHOD_LABELS[o]}</option>)}
              </select>
            </Field>
            <Field label="Zahlungsstatus">
              <select className={sel} value={form.payment_status||''} onChange={e=>set('payment_status',e.target.value)}>
                {PAYMENT_OPTIONS.map(o=><option key={o} value={o}>{PAYMENT_LABELS[o]}</option>)}
              </select>
            </Field>
            <Field label="Zahlungseingang">
              <input type="date" className={inp} value={form.payment_date||''} onChange={e=>set('payment_date',e.target.value)} />
            </Field>
            <Field label="Kaution (€)">
              <input type="number" className={inp} value={form.deposit_amount||''} step="0.01" onChange={e=>set('deposit_amount',e.target.value)} />
            </Field>
            <div className="flex flex-col gap-2 justify-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!form.deposit_taken} onChange={e=>set('deposit_taken',e.target.checked)} className="accent-blue-600" />
                Kaution eingezogen
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!form.deposit_returned} onChange={e=>set('deposit_returned',e.target.checked)} className="accent-blue-600" />
                Kaution zurückgegeben
              </label>
            </div>
          </Section>

          {!isNew && (
            <InvoiceListSection
              booking={{ ...form, id, house_name: houses.find((h:any)=>h.id===form.house_id)?.name }}
              settings={settings}
              onUpdate={reloadBooking}
            />
          )}

          {(form.status === 'storniert' || form.status === 'no_show') && (
            <Section title="❌ Stornierung">
              <Field label="Stornodatum">
                <input type="date" className={inp} value={form.cancellation_date||''} onChange={e=>set('cancellation_date',e.target.value)} />
              </Field>
              <Field label="Stornogrund" span2>
                <input type="text" className={inp} value={form.cancellation_reason||''} onChange={e=>set('cancellation_reason',e.target.value)} />
              </Field>
            </Section>
          )}

          <Section title="⚙️ Optionen">
            <div className="sm:col-span-2 flex flex-wrap gap-4">
              {[
                ['breakfast_included','Frühstück inklusive'],
                ['pets_allowed','Haustiere erlaubt'],
                ['parking','Parkplatz'],
              ].map(([k,l])=>(
                <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={!!form[k]} onChange={e=>set(k,e.target.checked)} className="accent-blue-600" />
                  {l}
                </label>
              ))}
            </div>
          </Section>
        </>
      )}

      <Section title="📝 Notizen">
        <Field label="Gastnotiz" span2>
          <textarea className={inp} rows={2} value={form.guest_notes||''} onChange={e=>set('guest_notes',e.target.value)} placeholder="Notizen vom Gast…" />
        </Field>
        <Field label="Interne Notiz" span2>
          <textarea className={inp} rows={2} value={form.internal_notes||''} onChange={e=>set('internal_notes',e.target.value)} placeholder="Interne Anmerkungen…" />
        </Field>
      </Section>

      {/* Save button bottom */}
      <div className="flex justify-between items-center pt-2">
        {!isNew && (
          <button onClick={handleDelete} disabled={deleting} className="text-red-500 hover:text-red-700 text-sm">
            🗑 Buchung löschen
          </button>
        )}
        <button onClick={save} disabled={saving} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg disabled:opacity-50">
          {saving ? 'Speichern…' : saved ? '✅ Gespeichert' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
