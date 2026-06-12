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

  const set = (field, value) => setSettings(s => ({ ...s, [field]: value }));
  const setHouse = (houseId, field, value) =>
    setSettings(s => ({
      ...s,
      houses: {
        ...s.houses,
        [houseId]: { ...(s.houses?.[houseId] || {}), [field]: value },
      },
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

      {/* 6. Häuser */}
      <Section title="Häuser">
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

      {/* 7. Lodgify-Integration */}
      <Section title="🔗 Lodgify-Integration">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            API-Schlüssel für die Lodgify-Synchronisation. Der Sync importiert Buchungen <strong>und Eigentümer-Sperren</strong> aus Lodgify.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Lodgify API Key">
              <input
                className="form-input w-full font-mono text-sm"
                type="password"
                placeholder="Ihr Lodgify API-Schlüssel"
                value={settings.lodgify_api_key || ''}
                onChange={e => set('lodgify_api_key', e.target.value)}
              />
            </Field>
            <Field label="Lodgify Account-ID">
              <input
                className="form-input w-full font-mono text-sm"
                placeholder="z.B. 834414"
                value={settings.lodgify_account_id || ''}
                onChange={e => set('lodgify_account_id', e.target.value)}
              />
            </Field>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="text-sm font-semibold text-blue-800">🔧 Einrichtung (einmalig)</div>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Gehe zu <strong>github.com/Simpilot77/revenue-management → Settings → Secrets → Actions</strong></li>
              <li>Lege diese Secrets an:</li>
            </ol>
            <div className="font-mono text-xs bg-white border border-blue-100 rounded p-3 space-y-1">
              <div><span className="text-blue-600 font-semibold">LODGIFY_API_KEY</span> = {settings.lodgify_api_key ? '••••••••' : '<dein API-Schlüssel>'}</div>
              <div><span className="text-blue-600 font-semibold">LODGIFY_ACCOUNT_ID</span> = {settings.lodgify_account_id || '<z.B. 834414>'}</div>
              <div><span className="text-blue-600 font-semibold">LODGIFY_HOUSE_MAP</span> = {'{"<Lodgify-ID>": 1, ...}'}</div>
            </div>
            <div className="text-xs text-blue-600">Nach der Einrichtung läuft der Sync automatisch alle 6 Stunden. Manuell: Dashboard → 🔄 Lodgify Import</div>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>• Den API-Schlüssel findest du in Lodgify unter <strong>Einstellungen → API</strong>.</div>
            <div>• <code className="bg-slate-100 px-1 rounded">LODGIFY_HOUSE_MAP</code>: JSON-Objekt, das Lodgify-Property-IDs auf unsere Haus-IDs (1/2/3) abbildet. Beispiel: <code className="bg-slate-100 px-1 rounded">{'{"123456":1,"234567":2,"345678":3}'}</code></div>
            <div>• Eigentümer-Sperren erscheinen im Kalender <span className="font-semibold text-slate-600">dunkelgrau</span> mit 🔒-Symbol.</div>
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
