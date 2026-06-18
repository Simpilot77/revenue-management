'use client'
import { useState, useEffect } from 'react'
export const dynamic = 'force-dynamic'

// ─── Invoice preset schemas ───────────────────────────────────────────────────
const PRESET_SCHEMAS: Record<string, { key: string; label: string; type: string }[]> = {
  salutations: [
    { key: 'salutation',  label: 'Anrede',                    type: 'text'     },
    { key: 'intro_line1', label: 'Einleitungstext Zeile 1',   type: 'textarea' },
    { key: 'intro_line2', label: 'Einleitungstext Zeile 2',   type: 'textarea' },
  ],
  payments: [{ key: 'text', label: 'Zahlungshinweis-Text', type: 'textarea' }],
  agbs: [
    { key: 'agb1', label: 'AGB Satz 1',             type: 'textarea' },
    { key: 'agb2', label: 'AGB Satz 2 (mit Website)', type: 'textarea' },
  ],
  closings: [
    { key: 'closing_text', label: 'Schlusstext',        type: 'textarea' },
    { key: 'closing',      label: 'Grußformel',          type: 'text'     },
    { key: 'owner_name',   label: 'Name (Unterschrift)', type: 'text'     },
  ],
}

const PRESET_LABELS: Record<string, string> = {
  salutations: '✉️ Anrede & Einleitung',
  payments:    '💳 Zahlungshinweise',
  agbs:        '📜 AGB-Texte',
  closings:    '🤝 Abschluss-Texte',
}

function PresetManager({ type, presets = [], onChange }: { type: string; presets: any[]; onChange: (list: any[]) => void }) {
  const schema = PRESET_SCHEMAS[type] || []
  const [expanded, setExpanded] = useState<number | null>(null)
  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  const addPreset = () => {
    const empty = { name: `Vorlage ${presets.length + 1}`, ...Object.fromEntries(schema.map(f => [f.key, ''])) }
    onChange([...presets, empty])
    setExpanded(presets.length)
  }
  const remove = (i: number) => { onChange(presets.filter((_, idx) => idx !== i)); setExpanded(null) }
  const update = (i: number, key: string, val: string) =>
    onChange(presets.map((p, idx) => idx === i ? { ...p, [key]: val } : p))

  return (
    <div className="space-y-2">
      {presets.map((preset, i) => (
        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100"
               onClick={() => setExpanded(expanded === i ? null : i)}>
            <span className="flex-1 text-sm font-medium text-gray-700">{preset.name || `Vorlage ${i+1}`}</span>
            <button type="button" className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200"
                    onClick={e => { e.stopPropagation(); remove(i) }}>🗑</button>
            <span className="text-gray-400 text-xs">{expanded === i ? '▲' : '▼'}</span>
          </div>
          {expanded === i && (
            <div className="p-4 space-y-3 bg-white border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name der Vorlage</label>
                <input className={inp} value={preset.name || ''} placeholder="z.B. Standard, Firmenkunde…"
                       onChange={e => update(i, 'name', e.target.value)} />
              </div>
              {schema.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                  {field.type === 'textarea'
                    ? <textarea className={inp} rows={3} value={preset[field.key] || ''} onChange={e => update(i, field.key, e.target.value)} />
                    : <input className={inp} value={preset[field.key] || ''} onChange={e => update(i, field.key, e.target.value)} />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addPreset}
              className="w-full py-2 text-sm text-blue-700 border border-blue-200 border-dashed rounded-xl bg-blue-50/50 hover:bg-blue-50 font-medium">
        + Neue Vorlage hinzufügen
      </button>
    </div>
  )
}

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
  const [houses, setHouses] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/company-settings').then(r => r.json()).then(d => {
      if (d?.id) { setId(d.id); setS({ ...DEFAULT, ...d }) }
    })
    fetch('/api/extra-task-templates').then(r => r.json()).then(d => {
      setTemplates((Array.isArray(d) ? d : []).map((t: any) => t.title))
    })
    fetch('/api/houses').then(r => r.json()).then(d => setHouses(d.data ?? d ?? []))
  }, [])

  const set = (key: string) => (val: any) => setS((prev: any) => ({ ...prev, [key]: val }))

  const setPresets = (type: string, list: any[]) =>
    setS((prev: any) => ({ ...prev, invoice_presets: { ...(prev.invoice_presets || {}), [type]: list } }))

  const setHouseSetting = (houseId: string, field: string, val: string) =>
    setS((prev: any) => ({
      ...prev,
      houses: { ...(prev.houses || {}), [houseId]: { ...(prev.houses?.[houseId] || {}), [field]: val } },
    }))

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

      {/* Invoice presets */}
      {(['salutations','payments','agbs','closings'] as const).map(type => (
        <div key={type} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 font-semibold text-gray-800">{PRESET_LABELS[type]}</div>
          <div className="px-6 py-5">
            <PresetManager
              type={type}
              presets={s.invoice_presets?.[type] || []}
              onChange={list => setPresets(type, list)}
            />
          </div>
        </div>
      ))}

      {/* House settings */}
      {houses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 font-semibold text-gray-800">🏠 Häuser (Rechnungs-Einstellungen)</div>
          <div className="px-6 py-5 space-y-4">
            {houses.map((h: any) => (
              <div key={h.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="font-medium text-gray-800 text-sm">{h.name}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Hausnummer / Rechnungspräfix (z.B. 15a)</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                      value={s.houses?.[h.id]?.house_number || h.house_number || ''}
                      onChange={e => setHouseSetting(String(h.id), 'house_number', e.target.value)}
                      placeholder="15a" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Adresse (Straße PLZ Ort)</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={s.houses?.[h.id]?.address || h.address || ''}
                      onChange={e => setHouseSetting(String(h.id), 'address', e.target.value)}
                      placeholder="Laagbergstraße 15a, 38440 Wolfsburg" />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400">Der Rechnungspräfix wird für die automatische Rechnungsnummerierung verwendet (z.B. 15a-2026-1001).</p>
          </div>
        </div>
      )}

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
