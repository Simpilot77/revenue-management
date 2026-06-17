'use client'
import { useState, useEffect } from 'react'
export const dynamic = 'force-dynamic'

const DEFAULT: any = {
  company_name: 'Workation Wolfsburg', owner_name: 'Nils Flegel',
  phone: '', email: 'info@workation-wolfsburg.com', website: 'www.workation-wolfsburg.com',
  address_street: 'Laagbergstraße 15', address_zip: '38440', address_city: 'Wolfsburg', country: 'Deutschland',
  tax_id: '', vat_id: '', vat_rate: 7,
  bank_name: '', bank_iban: '', bank_bic: '', bank_account_name: '',
  invoice_footer: 'Zahlbar innerhalb von 14 Tagen ohne Abzug. Vielen Dank für Ihren Aufenthalt!',
  cleaning_phone: '', cleaning_whatsapp: '', cleaning_email: '',
  cleaning_template: 'Reinigung {haus} am {datum} bis {uhrzeit} Uhr · {umfang}{fenster}\nNotizen: {notizen}',
}

function Field({ label, value, onChange, type='text', rows=0 }: any) {
  const cls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {rows > 0
        ? <textarea rows={rows} className={cls} value={value||''} onChange={e => onChange(e.target.value)} />
        : <input type={type} className={cls} value={value||''} onChange={e => onChange(e.target.value)} />
      }
    </div>
  )
}

export default function SettingsPage() {
  const [s, setS] = useState<any>(DEFAULT)
  const [id, setId] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [templates, setTemplates] = useState<string[]>([])
  const [newTpl, setNewTpl] = useState('')

  useEffect(() => {
    fetch('/api/company-settings').then(r => r.json()).then(d => {
      if (d?.id) { setId(d.id); setS({ ...DEFAULT, ...d }) }
    })
    fetch('/api/extra-task-templates').then(r => r.json()).then(d => {
      setTemplates((Array.isArray(d) ? d : []).map((t: any) => t.title))
    })
  }, [])

  const set = (key: string) => (val: any) => setS((prev: any) => ({ ...prev, [key]: val }))

  const save = async () => {
    setSaving(true)
    await fetch('/api/company-settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(id ? { ...s, id } : s) })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const addTemplate = async () => {
    if (!newTpl.trim()) return
    await fetch('/api/extra-task-templates', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:newTpl.trim() }) })
    setTemplates(prev => [...prev, newTpl.trim()]); setNewTpl('')
  }

  const Section = ({ title, children }: any) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 font-semibold text-gray-800">{title}</div>
      <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <button onClick={save} disabled={saving} className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Speichern…' : saved ? '✅ Gespeichert' : 'Speichern'}
        </button>
      </div>

      <Section title="🏢 Unternehmen">
        <Field label="Firmenname" value={s.company_name} onChange={set('company_name')} />
        <Field label="Inhaber" value={s.owner_name} onChange={set('owner_name')} />
        <Field label="E-Mail" value={s.email} onChange={set('email')} type="email" />
        <Field label="Telefon" value={s.phone} onChange={set('phone')} type="tel" />
        <Field label="Website" value={s.website} onChange={set('website')} />
        <Field label="Straße" value={s.address_street} onChange={set('address_street')} />
        <Field label="PLZ" value={s.address_zip} onChange={set('address_zip')} />
        <Field label="Stadt" value={s.address_city} onChange={set('address_city')} />
      </Section>

      <Section title="💰 Steuer & Bank">
        <Field label="Steuernummer" value={s.tax_id} onChange={set('tax_id')} />
        <Field label="USt-ID" value={s.vat_id} onChange={set('vat_id')} />
        <Field label="MwSt-Satz (%)" value={s.vat_rate} onChange={set('vat_rate')} type="number" />
        <Field label="Bank" value={s.bank_name} onChange={set('bank_name')} />
        <Field label="IBAN" value={s.bank_iban} onChange={set('bank_iban')} />
        <Field label="BIC" value={s.bank_bic} onChange={set('bank_bic')} />
        <div className="sm:col-span-2">
          <Field label="Kontoinhaber" value={s.bank_account_name} onChange={set('bank_account_name')} />
        </div>
      </Section>

      <Section title="🧾 Rechnungen">
        <div className="sm:col-span-2">
          <Field label="Rechnungsfußzeile" value={s.invoice_footer} onChange={set('invoice_footer')} rows={3} />
        </div>
      </Section>

      <Section title="🧹 Reinigung">
        <Field label="SMS-Nummer" value={s.cleaning_phone} onChange={set('cleaning_phone')} type="tel" />
        <Field label="WhatsApp-Nummer" value={s.cleaning_whatsapp} onChange={set('cleaning_whatsapp')} type="tel" />
        <Field label="E-Mail" value={s.cleaning_email} onChange={set('cleaning_email')} type="email" />
        <div className="sm:col-span-2">
          <Field label="Nachrichtenvorlage" value={s.cleaning_template} onChange={set('cleaning_template')} rows={4} />
          <p className="text-xs text-gray-400 mt-1">Platzhalter: {'{haus}'} {'{datum}'} {'{uhrzeit}'} {'{umfang}'} {'{fenster}'} {'{notizen}'}</p>
        </div>
      </Section>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 font-semibold text-gray-800">🔗 Lodgify Integration</div>
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">API-Schlüssel</label>
            <input type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={s.extra_settings?.lodgify_api_key || ''}
              onChange={e => setS((prev: any) => ({ ...prev, extra_settings: { ...(prev.extra_settings||{}), lodgify_api_key: e.target.value } }))}
              placeholder="Lodgify API Key…" />
            <p className="text-xs text-gray-400 mt-1">Zu finden unter Lodgify → Einstellungen → API</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Haus-Mapping (JSON)</label>
            <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
              value={s.extra_settings?.lodgify_house_map || '{}'}
              onChange={e => setS((prev: any) => ({ ...prev, extra_settings: { ...(prev.extra_settings||{}), lodgify_house_map: e.target.value } }))}
              placeholder='{"12345": 1, "12346": 2, "12347": 3}' />
            <p className="text-xs text-gray-400 mt-1">Lodgify Property-ID → Haus-ID in der App. Z.B.: {`{"12345": 1, "12346": 2}`}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 font-semibold text-gray-800">🗑️ Zusatzaufgaben-Vorlagen</div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {templates.map((t, i) => (
              <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-sm">{t}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Neue Vorlage…" value={newTpl} onChange={e => setNewTpl(e.target.value)} onKeyDown={e => e.key==='Enter' && addTemplate()} />
            <button onClick={addTemplate} disabled={!newTpl.trim()} className="bg-amber-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-amber-600 disabled:opacity-50">Hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
  )
}
