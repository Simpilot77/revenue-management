import { useState, useRef } from 'react';
import { HOUSES } from '../utils/mockData';
import { getDatabase, importDatabase } from '../utils/api';

const DEFAULT_SETTINGS = {
  company_name: 'Workation Wolfsburg',
  owner_name: 'Nils Flegel',
  phone: '',
  email: 'info@workation-wolfsburg.com',
  website: 'www.workation-wolfsburg.com',
  street: 'Laagbergstraße 15',
  zip: '38440',
  city: 'Wolfsburg',
  country: 'Deutschland',
  tax_number: '',
  vat_id: '',
  vat_rate: 7,
  bank_name: '',
  iban: '',
  bic: '',
  invoice_intro: 'wir berechnen Ihnen folgende Leistungen:',
  invoice_footer: 'Zahlbar innerhalb von 14 Tagen ohne Abzug. Vielen Dank für Ihren Aufenthalt!',
  houses: Object.fromEntries(
    HOUSES.map(h => [h.id, { address: `Laagbergstraße ${h.house_number}, 38440 Wolfsburg`, description: h.description }])
  ),
  lodgify_api_key: '',
  lodgify_account_id: '',
  lodgify_house_map: '',
  cleaning_notification: {
    phone: '',
    template: 'Reinigung {haus} am {datum} bis {uhrzeit} Uhr · {umfang}{fenster}\nNotizen: {notizen}',
  },
  invoice_presets: {
    salutations: [
      {
        name: 'Standard (Deutsch)',
        salutation: 'Sehr geehrter Gast,',
        intro_line1: 'vielen Dank für Ihren Aufenthalt bei Workation Wolfsburg.',
        intro_line2: 'Gerne stellen wir Ihnen folgende Leistungen in Rechnung:',
      },
      {
        name: 'Firma / Geschäftsreise',
        salutation: 'Sehr geehrte Damen und Herren,',
        intro_line1: 'vielen Dank für die Buchung unserer Unterkunft.',
        intro_line2: 'Wir erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:',
      },
    ],
    payments: [
      {
        name: 'Standard 14 Tage',
        text: 'Bitte überweisen Sie den Gesamtbetrag innerhalb von 14 Tagen auf das unten genannte Konto.',
      },
      {
        name: 'Sofort fällig',
        text: 'Der Rechnungsbetrag ist sofort nach Erhalt dieser Rechnung auf das unten genannte Konto zu überweisen.',
      },
    ],
    agbs: [
      {
        name: 'Standard AGB',
        agb1: 'Der Mietvertrag kommt erst mit dem vollständigen bzw. fristgerechten Eingang des Geldbetrages zustande.',
        agb2: 'Es gelten die Hausordnung und unsere AGB\'s, welche unter www.workation-wolfsburg.com einsehbar sind.',
      },
    ],
    closings: [
      {
        name: 'Standard',
        closing_text: 'Wir freuen uns, Sie als Gäste willkommen heißen zu dürfen, und wünschen einen angenehmen Aufenthalt.',
        closing: 'Mit freundlichen Grüßen,',
        owner_name: 'Nils Flegel',
      },
      {
        name: 'Englisch',
        closing_text: 'We look forward to welcoming you and wish you a pleasant stay.',
        closing: 'Kind regards,',
        owner_name: 'Nils Flegel',
      },
    ],
  },
};

function Section({ title, children }) {
  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-base font-semibold text-slate-700 border-b border-slate-200 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Preset list manager ─────────────────────────────────────────────────────

const PRESET_SCHEMAS = {
  salutations: [
    { key: 'salutation',  label: 'Anrede',               type: 'text' },
    { key: 'intro_line1', label: 'Einleitungstext Zeile 1', type: 'textarea' },
    { key: 'intro_line2', label: 'Einleitungstext Zeile 2', type: 'textarea' },
  ],
  payments: [
    { key: 'text', label: 'Zahlungshinweis-Text', type: 'textarea' },
  ],
  agbs: [
    { key: 'agb1', label: 'AGB Satz 1', type: 'textarea' },
    { key: 'agb2', label: 'AGB Satz 2 (mit Website)', type: 'textarea' },
  ],
  closings: [
    { key: 'closing_text', label: 'Schlusstext',       type: 'textarea' },
    { key: 'closing',      label: 'Grußformel',         type: 'text' },
    { key: 'owner_name',   label: 'Name (Unterschrift)', type: 'text' },
  ],
};

const PRESET_SECTION_LABELS = {
  salutations: '✉️ Anrede & Einleitung',
  payments:    '💳 Zahlungshinweise',
  agbs:        '📜 AGB-Texte',
  closings:    '🤝 Abschluss-Texte',
};

function PresetManager({ type, presets = [], onChange }) {
  const schema = PRESET_SCHEMAS[type] || [];
  const [expanded, setExpanded] = useState(null); // index of expanded item

  const addPreset = () => {
    const empty = { name: `Vorlage ${presets.length + 1}`, ...Object.fromEntries(schema.map(f => [f.key, ''])) };
    onChange([...presets, empty]);
    setExpanded(presets.length);
  };

  const removePreset = (i) => {
    onChange(presets.filter((_, idx) => idx !== i));
    setExpanded(null);
  };

  const updatePreset = (i, key, value) => {
    onChange(presets.map((p, idx) => idx === i ? { ...p, [key]: value } : p));
  };

  return (
    <div className="space-y-2">
      {presets.map((preset, i) => (
        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Header row */}
          <div
            className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <span className="flex-1 text-sm font-medium text-slate-700">
              {preset.name || `Vorlage ${i + 1}`}
            </span>
            <button
              type="button"
              className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 font-medium"
              onClick={e => { e.stopPropagation(); removePreset(i); }}
            >
              🗑 Löschen
            </button>
            <span className="text-slate-400 text-xs">{expanded === i ? '▲' : '▼'}</span>
          </div>
          {/* Expanded editor */}
          {expanded === i && (
            <div className="p-4 space-y-3 bg-white border-t border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name der Vorlage</label>
                <input
                  className="form-input w-full"
                  value={preset.name || ''}
                  onChange={e => updatePreset(i, 'name', e.target.value)}
                  placeholder="z.B. Standard, Firmenkunde, Englisch…"
                />
              </div>
              {schema.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="form-input w-full text-sm"
                      rows={3}
                      value={preset[field.key] || ''}
                      onChange={e => updatePreset(i, field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="form-input w-full text-sm"
                      value={preset[field.key] || ''}
                      onChange={e => updatePreset(i, field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="w-full py-2 text-sm text-blue-700 border border-blue-200 border-dashed rounded-xl bg-blue-50/50 hover:bg-blue-50 transition-colors font-medium"
        onClick={addPreset}
      >
        + Neue Vorlage hinzufügen
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('company_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        // ensure houses key exists
        if (!parsed.houses) {
          parsed.houses = DEFAULT_SETTINGS.houses;
        }
        return parsed;
      }
    } catch (_) {}
    return DEFAULT_SETTINGS;
  });

  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success'|'error', msg }
  const importRef = useRef(null);

  const [extraTaskTemplates, setExtraTaskTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('extra_task_templates') || '[]'); } catch { return []; }
  });
  const [newTaskTemplate, setNewTaskTemplate] = useState('');

  const addTaskTemplate = () => {
    const text = newTaskTemplate.trim();
    if (!text || extraTaskTemplates.includes(text)) return;
    const updated = [...extraTaskTemplates, text];
    setExtraTaskTemplates(updated);
    localStorage.setItem('extra_task_templates', JSON.stringify(updated));
    setNewTaskTemplate('');
  };

  const removeTaskTemplate = (i) => {
    const updated = extraTaskTemplates.filter((_, idx) => idx !== i);
    setExtraTaskTemplates(updated);
    localStorage.setItem('extra_task_templates', JSON.stringify(updated));
  };

  // ── Cleaning checklists per type ──────────────────────────────────────────
  const CLEANING_TYPES = ['Reinigung', 'Endreinigung', 'Zwischenreinigung', 'Sonstiges'];
  const DEFAULT_CLEANING_TASKS = [
    'Bettwäsche wechseln',
    'Küche reinigen',
    'Staubsaugen',
    'Wischen',
    'Bäder reinigen',
    'Schränke reinigen',
    'Fenster putzen',
    'Müll entsorgen',
    'Handtücher wechseln',
  ];
  const [cleaningChecklists, setCleaningChecklists] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('cleaning_checklists') || '{}');
      const result = {};
      CLEANING_TYPES.forEach(t => { result[t] = raw[t] || [...DEFAULT_CLEANING_TASKS]; });
      return result;
    } catch { return Object.fromEntries(CLEANING_TYPES.map(t => [t, [...DEFAULT_CLEANING_TASKS]])); }
  });
  const [activeCleaningType, setActiveCleaningType] = useState(CLEANING_TYPES[0]);
  const [newCleaningTask, setNewCleaningTask] = useState('');

  const saveCleaningChecklists = (updated) => {
    setCleaningChecklists(updated);
    localStorage.setItem('cleaning_checklists', JSON.stringify(updated));
  };
  const addCleaningTask = () => {
    const text = newCleaningTask.trim();
    if (!text) return;
    const updated = { ...cleaningChecklists, [activeCleaningType]: [...(cleaningChecklists[activeCleaningType] || []), text] };
    saveCleaningChecklists(updated);
    setNewCleaningTask('');
  };
  const removeCleaningTask = (type, idx) => {
    const updated = { ...cleaningChecklists, [type]: cleaningChecklists[type].filter((_, i) => i !== idx) };
    saveCleaningChecklists(updated);
  };
  const toggleCleaningTaskEnabled = (type, idx) => {
    const list = cleaningChecklists[type] || [];
    const item = list[idx];
    const updated = { ...cleaningChecklists, [type]: list.map((t, i) => i === idx ? (typeof t === 'object' ? t.text : t) : t) };
    saveCleaningChecklists(updated);
  };

  // ── User management ────────────────────────────────────────────────────────
  const PERMISSIONS = ['Buchungen', 'Rechnungen', 'Reinigung', 'Aufgaben', 'Einstellungen', 'Auswertungen'];
  const [appUsers, setAppUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch { return []; }
  });
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [editingUser, setEditingUser] = useState(null);

  const saveUsers = (updated) => {
    setAppUsers(updated);
    localStorage.setItem('app_users', JSON.stringify(updated));
  };
  const addUser = () => {
    const name = newUserName.trim();
    if (!name) return;
    const user = { id: Date.now().toString(), name, role: newUserRole, permissions: newUserRole === 'admin' ? [...PERMISSIONS] : ['Buchungen', 'Aufgaben', 'Reinigung'] };
    saveUsers([...appUsers, user]);
    setNewUserName('');
    setNewUserRole('user');
  };
  const removeUser = (id) => saveUsers(appUsers.filter(u => u.id !== id));
  const togglePermission = (userId, perm) => {
    saveUsers(appUsers.map(u => {
      if (u.id !== userId) return u;
      const has = u.permissions.includes(perm);
      return { ...u, permissions: has ? u.permissions.filter(p => p !== perm) : [...u.permissions, perm] };
    }));
  };
  const updateUserRole = (userId, role) => {
    saveUsers(appUsers.map(u => {
      if (u.id !== userId) return u;
      return { ...u, role, permissions: role === 'admin' ? [...PERMISSIONS] : u.permissions };
    }));
  };

  const set = (field, value) => setSettings(s => ({ ...s, [field]: value }));
  const setPresets = (type, list) =>
    setSettings(s => ({
      ...s,
      invoice_presets: { ...(s.invoice_presets || {}), [type]: list },
    }));
  const setHouse = (houseId, field, value) =>
    setSettings(s => ({
      ...s,
      houses: {
        ...s.houses,
        [houseId]: { ...(s.houses?.[houseId] || {}), [field]: value },
      },
    }));
  const setCleaningNotif = (field, value) =>
    setSettings(s => ({
      ...s,
      cleaning_notification: { ...(s.cleaning_notification || {}), [field]: value },
    }));

  const handleSave = () => {
    localStorage.setItem('company_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Einstellungen</h1>
          <p className="text-sm text-slate-500 mt-0.5">Unternehmens- und Rechnungsdaten</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              Gespeichert!
            </span>
          )}
          <button onClick={handleSave} className="btn-primary">
            Speichern
          </button>
        </div>
      </div>

      {/* 1. Unternehmen */}
      <Section title="Unternehmen">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Firmenname">
            <input className="form-input w-full" value={settings.company_name} onChange={e => set('company_name', e.target.value)} />
          </Field>
          <Field label="Inhaber / Name">
            <input className="form-input w-full" value={settings.owner_name} onChange={e => set('owner_name', e.target.value)} />
          </Field>
          <Field label="Telefon">
            <input className="form-input w-full" value={settings.phone} onChange={e => set('phone', e.target.value)} />
          </Field>
          <Field label="E-Mail">
            <input type="email" className="form-input w-full" value={settings.email} onChange={e => set('email', e.target.value)} />
          </Field>
          <Field label="Website">
            <input className="form-input w-full" value={settings.website} onChange={e => set('website', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* 2. Adresse */}
      <Section title="Adresse">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Straße + Hausnummer">
              <input className="form-input w-full" value={settings.street} onChange={e => set('street', e.target.value)} />
            </Field>
          </div>
          <Field label="PLZ">
            <input className="form-input w-full" value={settings.zip} onChange={e => set('zip', e.target.value)} />
          </Field>
          <Field label="Stadt">
            <input className="form-input w-full" value={settings.city} onChange={e => set('city', e.target.value)} />
          </Field>
          <Field label="Land">
            <input className="form-input w-full" value={settings.country} onChange={e => set('country', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* 3. Steuer */}
      <Section title="Steuer">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Steuernummer (FA)">
            <input className="form-input w-full" value={settings.tax_number} onChange={e => set('tax_number', e.target.value)} placeholder="z. B. 15/123/04567" />
          </Field>
          <Field label="USt-IdNr.">
            <input className="form-input w-full" value={settings.vat_id} onChange={e => set('vat_id', e.target.value)} placeholder="z. B. DE123456789" />
          </Field>
          <Field label="MwSt-Satz (%)">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="form-input w-32"
              value={settings.vat_rate}
              onChange={e => set('vat_rate', parseFloat(e.target.value) || 0)}
            />
          </Field>
        </div>
      </Section>

      {/* 4. Bankverbindung */}
      <Section title="Bankverbindung">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bankname">
            <input className="form-input w-full" value={settings.bank_name} onChange={e => set('bank_name', e.target.value)} />
          </Field>
          <Field label="IBAN">
            <input className="form-input w-full" value={settings.iban} onChange={e => set('iban', e.target.value)} placeholder="DE00 0000 0000 0000 0000 00" />
          </Field>
          <Field label="BIC">
            <input className="form-input w-full" value={settings.bic} onChange={e => set('bic', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* 5. Rechnungstexte */}
      <Section title="Rechnungstexte">
        <Field label="Einleitungstext (nach Anrede)">
          <textarea
            className="form-input w-full"
            rows={3}
            value={settings.invoice_intro}
            onChange={e => set('invoice_intro', e.target.value)}
            placeholder="z. B. wir berechnen Ihnen folgende Leistungen:"
          />
        </Field>
        <Field label="Fußtext / Zahlungshinweis">
          <textarea
            className="form-input w-full"
            rows={3}
            value={settings.invoice_footer}
            onChange={e => set('invoice_footer', e.target.value)}
            placeholder="z. B. Zahlbar innerhalb von 14 Tagen ..."
          />
        </Field>
      </Section>

      {/* 5b. Reinigungs-Benachrichtigung */}
      <Section title="🧹 Reinigungs-Benachrichtigung">
        <p className="text-sm text-slate-600">
          Telefonnummer und Textvorlage für die SMS/WhatsApp-Benachrichtigung im Reinigungsmanagement.
          Platzhalter: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{'{haus}'}</code>{' '}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{'{datum}'}</code>{' '}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{'{uhrzeit}'}</code>{' '}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{'{umfang}'}</code>{' '}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{'{fenster}'}</code>{' '}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{'{notizen}'}</code>
        </p>
        <Field label="Telefonnummer (für SMS/WhatsApp)">
          <input
            className="form-input w-full"
            value={settings.cleaning_notification?.phone || ''}
            onChange={e => setCleaningNotif('phone', e.target.value)}
            placeholder="z. B. +49 170 1234567"
          />
        </Field>
        <Field label="E-Mail-Adresse (für E-Mail-Benachrichtigung)">
          <input
            className="form-input w-full"
            value={settings.cleaning_notification?.email || ''}
            onChange={e => setCleaningNotif('email', e.target.value)}
            placeholder="z. B. reinigung@beispiel.de"
          />
        </Field>
        <Field label="Textvorlage">
          <textarea
            className="form-input w-full"
            rows={4}
            value={settings.cleaning_notification?.template || ''}
            onChange={e => setCleaningNotif('template', e.target.value)}
          />
        </Field>
      </Section>

      {/* 6. Zusatzaufgaben-Vorlagen */}
      <Section title="🗑️ Zusatzaufgaben-Vorlagen (Kalender)">
        <p className="text-sm text-slate-600">
          Diese Vorlagen erscheinen im Kalender als Schnellauswahl, wenn du auf eine Zelle in der Zeile „Zusatzaufgaben" klickst.
        </p>
        <div className="space-y-2">
          {extraTaskTemplates.map((tpl, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-3 py-1">{tpl}</span>
              <button
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                onClick={() => removeTaskTemplate(i)}
              >✕ Entfernen</button>
            </div>
          ))}
          {extraTaskTemplates.length === 0 && (
            <p className="text-sm text-slate-400 italic">Noch keine Vorlagen – unten hinzufügen.</p>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            className="form-input flex-1"
            placeholder="z. B. Müllabfuhr, Gartenpflege, Fensterreinigung …"
            value={newTaskTemplate}
            onChange={e => setNewTaskTemplate(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTaskTemplate(); }}
          />
          <button className="btn-primary text-sm px-4" onClick={addTaskTemplate} disabled={!newTaskTemplate.trim()}>
            + Hinzufügen
          </button>
        </div>
      </Section>

      {/* 7. Reinigungschecklisten */}
      <Section title="🧹 Reinigungschecklisten">
        <p className="text-sm text-slate-600">
          Definiere die Unteraufgaben pro Reinigungstyp. Diese Vorlagen erscheinen im Reinigungsmanagement beim Erstellen eines neuen Eintrags.
        </p>
        <div className="flex gap-2 flex-wrap mb-3">
          {CLEANING_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setActiveCleaningType(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeCleaningType === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'}`}
            >{t}</button>
          ))}
        </div>
        <div className="space-y-1.5 mb-3">
          {(cleaningChecklists[activeCleaningType] || []).map((task, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
              <span className="text-sm flex-1 text-slate-700">{task}</span>
              <button
                className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50"
                onClick={() => removeCleaningTask(activeCleaningType, idx)}
              >✕</button>
            </div>
          ))}
          {(cleaningChecklists[activeCleaningType] || []).length === 0 && (
            <p className="text-sm text-slate-400 italic">Keine Aufgaben – unten hinzufügen.</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            className="form-input flex-1"
            placeholder="Neue Aufgabe hinzufügen …"
            value={newCleaningTask}
            onChange={e => setNewCleaningTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCleaningTask(); }}
          />
          <button className="btn-primary text-sm px-4" onClick={addCleaningTask} disabled={!newCleaningTask.trim()}>
            + Hinzufügen
          </button>
        </div>
      </Section>

      {/* 8. Benutzerverwaltung */}
      <Section title="👤 Benutzerverwaltung">
        <p className="text-sm text-slate-600">
          Lege Benutzer und deren Berechtigungen fest. Der Admin kann alle Bereiche bearbeiten. Benutzer können nur auf freigegebene Bereiche zugreifen.
        </p>
        <div className="space-y-3 mb-4">
          {appUsers.length === 0 && (
            <p className="text-sm text-slate-400 italic">Noch keine Benutzer angelegt.</p>
          )}
          {appUsers.map(user => (
            <div key={user.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{user.name}</div>
                    <select
                      className="text-xs text-slate-500 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
                      value={user.role}
                      onChange={e => updateUserRole(user.id, e.target.value)}
                    >
                      <option value="admin">Admin</option>
                      <option value="user">Benutzer</option>
                    </select>
                  </div>
                </div>
                <button
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                  onClick={() => removeUser(user.id)}
                >✕ Entfernen</button>
              </div>
              {user.role !== 'admin' && (
                <div>
                  <div className="text-xs text-slate-400 mb-1.5 font-medium">Berechtigungen:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PERMISSIONS.map(perm => {
                      const has = user.permissions.includes(perm);
                      return (
                        <button
                          key={perm}
                          onClick={() => togglePermission(user.id, perm)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${has ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300 hover:border-blue-400'}`}
                        >{perm}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              {user.role === 'admin' && (
                <div className="text-xs text-emerald-600 font-medium">✅ Voller Zugriff auf alle Bereiche</div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="form-label text-xs">Name</label>
            <input
              className="form-input w-full"
              placeholder="z. B. Maria Müller"
              value={newUserName}
              onChange={e => setNewUserName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addUser(); }}
            />
          </div>
          <div>
            <label className="form-label text-xs">Rolle</label>
            <select
              className="form-input"
              value={newUserRole}
              onChange={e => setNewUserRole(e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="user">Benutzer</option>
            </select>
          </div>
          <button className="btn-primary text-sm px-4 h-9" onClick={addUser} disabled={!newUserName.trim()}>
            + Hinzufügen
          </button>
        </div>
      </Section>

      {/* 9. Häuser */}
      <Section title="🏠 Haus-Adressen">
        <p className="text-sm text-slate-600">
          Diese Adressen werden im Rechnungstext für das jeweils vermietete Haus verwendet.
          Die Firmenadresse (siehe oben) erscheint weiterhin nur im Kopfbereich der Rechnung.
        </p>
        <div className="space-y-4">
          {HOUSES.map(h => (
            <div key={h.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="font-medium text-slate-700">{h.name} – {h.description}</div>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Adresse">
                  <input
                    className="form-input w-full"
                    value={settings.houses?.[h.id]?.address || ''}
                    onChange={e => setHouse(h.id, 'address', e.target.value)}
                  />
                </Field>
                <Field label="Beschreibung">
                  <input
                    className="form-input w-full"
                    value={settings.houses?.[h.id]?.description || ''}
                    onChange={e => setHouse(h.id, 'description', e.target.value)}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 6b. Rechnungsvorlagen */}
      <Section title="📝 Rechnungsvorlagen">
        <p className="text-sm text-slate-600">
          Lege hier Textvorlagen für Rechnungen an. In der Rechnungsvorschau kannst du eine Vorlage per Dropdown auswählen und mit einem Klick übernehmen.
        </p>
        <div className="space-y-5">
          {Object.keys(PRESET_SCHEMAS).map(type => (
            <div key={type}>
              <div className="text-sm font-semibold text-slate-700 mb-2">{PRESET_SECTION_LABELS[type]}</div>
              <PresetManager
                type={type}
                presets={settings.invoice_presets?.[type] || []}
                onChange={list => setPresets(type, list)}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* 7. Lodgify-Integration */}
      <Section title="🔗 Lodgify-Integration">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Gib hier deinen Lodgify API-Schlüssel ein. Danach importiert der Button <strong>„🔄 Lodgify Import"</strong> auf dem Dashboard
            alle Buchungen und Eigentümer-Sperren direkt aus Lodgify.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Lodgify API Key">
              <div className="flex gap-2">
                <input
                  className="form-input flex-1 font-mono text-sm"
                  type="text"
                  placeholder="API-Schlüssel eingeben oder einfügen"
                  value={settings.lodgify_api_key || ''}
                  onChange={e => set('lodgify_api_key', e.target.value)}
                  onDrop={e => { e.preventDefault(); set('lodgify_api_key', e.dataTransfer.getData('text').trim()); }}
                  onDragOver={e => e.preventDefault()}
                />
                <button
                  type="button"
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg whitespace-nowrap"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text.trim()) set('lodgify_api_key', text.trim());
                    } catch (_) {
                      alert('Clipboard-Zugriff verweigert. Bitte Cmd+V / Strg+V direkt im Feld verwenden.');
                    }
                  }}
                >📋 Einfügen</button>
                {settings.lodgify_api_key && (
                  <button
                    type="button"
                    onClick={() => set('lodgify_api_key', '')}
                    className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 text-xs rounded-lg"
                    title="Löschen"
                  >✕</button>
                )}
              </div>
              {settings.lodgify_api_key && (
                <div className="text-xs text-green-600 mt-1">✓ API-Schlüssel hinterlegt ({settings.lodgify_api_key.length} Zeichen)</div>
              )}
            </Field>
            <Field label="Haus-Zuordnung (optional)">
              <input
                className="form-input w-full font-mono text-sm"
                placeholder='{"123456":1,"234567":2,"345678":3}'
                value={settings.lodgify_house_map || ''}
                onChange={e => set('lodgify_house_map', e.target.value)}
              />
            </Field>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2 text-xs text-blue-700">
            <div className="font-semibold text-blue-800 text-sm">ℹ️ Hinweise</div>
            <div>• Den API-Schlüssel findest du in Lodgify unter <strong>Einstellungen → Integrationen → API</strong>.</div>
            <div>• <strong>Haus-Zuordnung</strong>: Lodgify Property-IDs auf Haus-Nummern (1/2/3) abbilden. Beispiel: <code className="bg-white px-1 rounded">{'{"123456":1,"234567":2}'}</code>. Ohne Angabe wird die Reihenfolge aus Lodgify verwendet.</div>
            <div>• Eigentümer-Sperren erscheinen im Kalender <span className="font-semibold text-slate-600">dunkelgrau</span> mit 🔒-Symbol.</div>
            <div>• Nach dem Speichern einfach auf dem Dashboard auf <strong>🔄 Lodgify Import</strong> klicken.</div>
          </div>
        </div>
      </Section>

      {/* 8. Datenbank Export / Import */}
      <Section title="💾 Vollständige Datensicherung – Export & Import">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Exportiert den <strong>kompletten App-Stand</strong> als JSON-Datei: Buchungen, Kunden, Aufgaben-Status,
            Fälligkeitsdaten, Reinigungsmarkierungen, Statistik-Ausschlüsse und alle Unternehmenseinstellungen.
            Beim Import wird alles vollständig wiederhergestellt.
          </p>

          {/* Was ist enthalten */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ['📋', 'Buchungen'],
              ['👥', 'Kunden'],
              ['✅', 'Aufgaben-Status'],
              ['📅', 'Fälligkeitsdaten'],
              ['🧹', 'Reinigungsmarkierungen'],
              ['🏢', 'Unternehmenseinstellungen'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Export */}
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={() => {
                const data = getDatabase();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
                a.href = url;
                a.download = `workation-backup-${ts}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              ⬇ Vollständig exportieren
            </button>

            {/* Import */}
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => importRef.current?.click()}
            >
              ⬆ Backup importieren
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const data = JSON.parse(ev.target.result);
                    const exportedAt = data.exported_at
                      ? new Date(data.exported_at).toLocaleString('de-DE')
                      : 'unbekanntem Datum';
                    const hasTasks    = data.booking_tasks    ? '✅' : '—';
                    const hasDues     = data.booking_task_dues ? '✅' : '—';
                    const hasSettings = data.company_settings  ? '✅' : '—';
                    const hasCleaning = data.cleaning_markers  ? '✅' : '—';
                    if (!confirm(
                      `Import bestätigen?\n\n` +
                      `Backup vom: ${exportedAt}\n\n` +
                      `📋 Buchungen:              ${data.bookings?.length ?? 0}\n` +
                      `👥 Kunden:                 ${data.customers?.length ?? 0}\n` +
                      `✅ Aufgaben-Status:        ${hasTasks}\n` +
                      `📅 Fälligkeitsdaten:       ${hasDues}\n` +
                      `🧹 Reinigungsmarkierungen: ${hasCleaning}\n` +
                      `🏢 Unternehmenseinst.:     ${hasSettings}\n\n` +
                      `Dies ersetzt ALLE aktuellen Daten. Fortfahren?`
                    )) return;
                    importDatabase(data);
                    setImportStatus({
                      type: 'success',
                      msg: `Import erfolgreich: ${data.bookings?.length ?? 0} Buchungen, ${data.customers?.length ?? 0} Kunden und alle Einstellungen wiederhergestellt. Seite wird neu geladen…`
                    });
                    setTimeout(() => window.location.reload(), 2000);
                  } catch (err) {
                    setImportStatus({ type: 'error', msg: `Import fehlgeschlagen: ${err.message}` });
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </div>

          {importStatus && (
            <div className={`text-sm rounded-lg px-4 py-3 ${importStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {importStatus.msg}
            </div>
          )}

          <div className="text-xs text-slate-400 space-y-1 pt-1">
            <div>• Der Dateiname enthält Datum und Uhrzeit der Sicherung für einfache Zuordnung.</div>
            <div>• Beim Import werden <strong>alle</strong> Daten vollständig ersetzt – vorher exportieren!</div>
            <div>• Ältere Backups (Version 1) ohne Aufgaben-Daten werden ebenfalls unterstützt.</div>
          </div>
        </div>
      </Section>

      <div className="flex justify-end pb-6">
        <button onClick={handleSave} className="btn-primary px-8">
          Einstellungen speichern
        </button>
      </div>
    </div>
  );
}
