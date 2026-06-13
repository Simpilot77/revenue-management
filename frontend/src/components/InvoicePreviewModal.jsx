import { useState, useEffect } from 'react';
import { exportInvoiceFromData } from '../utils/pdfExport';

// ─── Load presets from company_settings ──────────────────────────────────────
function loadPresets() {
  try {
    const s = JSON.parse(localStorage.getItem('company_settings') || '{}');
    return s.invoice_presets || {};
  } catch { return {}; }
}

// ─── Small preset selector row ────────────────────────────────────────────────
function PresetSelector({ presets = [], onApply }) {
  const [sel, setSel] = useState('');
  if (!presets.length) return null;
  return (
    <div className="flex items-center gap-2 mb-2 flex-wrap">
      <span className="text-xs text-gray-400 whitespace-nowrap">Vorlage:</span>
      <select
        className="form-input text-xs py-0.5 h-7 flex-1 min-w-0"
        value={sel}
        onChange={e => setSel(e.target.value)}
      >
        <option value="">— auswählen —</option>
        {presets.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
      </select>
      <button
        type="button"
        disabled={sel === ''}
        className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 font-medium disabled:opacity-40 whitespace-nowrap"
        onClick={() => { onApply(presets[parseInt(sel)]); setSel(''); }}
      >
        Übernehmen
      </button>
    </div>
  );
}

// ─── Format ISO date → DD.MM.YYYY ────────────────────────────────────────────
function fmtForDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ─── Parse split invoice number ───────────────────────────────────────────────
function splitInvNum(invNum) {
  const m = (invNum || '').match(/^(.*-)(\d{1,4})$/);
  if (m) return { prefix: m[1], suffix: m[2].padStart(4, '0') };
  return { prefix: invNum || '', suffix: '' };
}

// ─── Parse DE date range from service_period ─────────────────────────────────
function parseServicePeriod(sp) {
  const m = (sp || '').match(/(\d{2})\.(\d{2})\.(\d{4})\s*[–-]\s*(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return { from: `${m[3]}-${m[2]}-${m[1]}`, to: `${m[6]}-${m[5]}-${m[4]}` };
  return { from: '', to: '' };
}

export default function InvoicePreviewModal({ data, onClose, onLangChange, onChange }) {
  const [generating, setGenerating] = useState(false);
  const set = (field, value) => onChange(field, value);

  // ── Preset data ──
  const presets = loadPresets();

  // ── Split invoice number state ──
  const [invNum, setInvNum] = useState(() => splitInvNum(data.invoice_number));
  const updateInvNum = (prefix, suffix) => {
    const next = { prefix, suffix };
    setInvNum(next);
    set('invoice_number', prefix + suffix);
  };

  // ── Date range picker state ──
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [periodDates, setPeriodDates] = useState(() => parseServicePeriod(data.service_period));
  const applyDateRange = (from, to) => {
    const text = [from && fmtForDisplay(from), to && fmtForDisplay(to)].filter(Boolean).join(' – ');
    if (text) set('service_period', text);
  };

  // ── Extra items ──
  const extraItems = data.extra_items || [];
  const setExtraItems = (items) => set('extra_items', items);
  const addExtraItem = () => setExtraItems([...extraItems, { description: '', qty: 1, unit_price: 0, note: '' }]);
  const removeExtraItem = (i) => setExtraItems(extraItems.filter((_, idx) => idx !== i));
  const updateExtraItem = (i, field, value) =>
    setExtraItems(extraItems.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleGenerate = async () => {
    setGenerating(true);
    try { await exportInvoiceFromData(data); }
    finally { setGenerating(false); onClose(); }
  };

  // ── Generic field component ──
  const F = ({ label, field, type = 'text', rows = 2, colSpan, readOnly }) => (
    <div className={colSpan === 2 ? 'md:col-span-2' : colSpan === 3 ? 'col-span-full' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea className="form-input text-sm w-full" rows={rows}
          value={data[field] || ''} onChange={e => set(field, e.target.value)} />
      ) : (
        <input type={type} className={`form-input text-sm w-full${readOnly ? ' bg-gray-50 text-gray-400' : ''}`}
          readOnly={readOnly}
          value={data[field] ?? ''} step={type === 'number' ? '0.01' : undefined}
          onChange={e => set(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)} />
      )}
    </div>
  );

  const fmtEur = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', overflowY: 'auto', padding: '24px 16px' }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '100%', maxWidth: '780px', padding: 0 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <h2 className="text-base font-semibold text-gray-900">🧾 Rechnung erstellen</h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
              {['de','en'].map(lang => (
                <button key={lang} type="button"
                  className={`px-3 py-1.5 font-medium transition-colors ${data.lang === lang ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => onLangChange(lang)}>
                  {lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
                </button>
              ))}
            </div>
            <button type="button" className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="p-6 space-y-6" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>

          {/* Empfänger */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📬 Empfänger</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <F label="Firma / Unternehmen" field="company_name" />
              <F label="Name des Gastes" field="guest_name" />
              <F label="c/o Zeile (leer = keine eigene Adresse vorhanden)" field="co_line" />
              <F label="Straße + Hausnummer" field="billing_street" />
              <div className="grid grid-cols-2 gap-2">
                <F label="PLZ" field="billing_zip" />
                <F label="Ort" field="billing_city" />
              </div>
              <F label="Land" field="billing_country" />
            </div>
          </section>

          {/* Rechnungsdaten */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📋 Rechnungsdaten</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              {/* Split invoice number */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Rechnungsnummer</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-0.5">Präfix (editierbar)</label>
                    <input
                      className="form-input text-sm w-full font-mono"
                      value={invNum.prefix}
                      onChange={e => updateInvNum(e.target.value, invNum.suffix)}
                      placeholder="15a-2026-"
                    />
                  </div>
                  <div className="mt-4 text-gray-400 font-bold text-lg">+</div>
                  <div style={{ width: '110px' }}>
                    <label className="block text-xs text-gray-400 mb-0.5">Nummer (4-stellig)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      className="form-input text-sm w-full font-mono text-center"
                      value={invNum.suffix}
                      placeholder="0042"
                      onChange={e => {
                        const s = e.target.value.replace(/\D/g, '').slice(0, 4);
                        updateInvNum(invNum.prefix, s.padStart(Math.max(s.length, 4), '0').slice(-4));
                      }}
                      onBlur={e => {
                        const s = e.target.value.replace(/\D/g, '').slice(0, 4).padStart(4, '0');
                        updateInvNum(invNum.prefix, s);
                      }}
                    />
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 whitespace-nowrap">
                      {data.invoice_number || '—'}
                    </div>
                  </div>
                </div>
              </div>

              <F label="Rechnungsdatum" field="invoice_date" />

              {/* Service period with date picker */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Leistungszeitraum</label>
                <div className="flex items-center gap-1.5">
                  <input
                    className="form-input text-sm flex-1"
                    value={data.service_period || ''}
                    onChange={e => set('service_period', e.target.value)}
                    placeholder="z. B. 01.01.2026 – 08.01.2026"
                  />
                  <button
                    type="button"
                    className={`px-2 py-2 rounded-lg border text-sm transition-colors ${showDatePicker ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'}`}
                    onClick={() => setShowDatePicker(v => !v)}
                    title="Zeitraum per Kalender auswählen"
                  >
                    📅
                  </button>
                </div>
                {showDatePicker && (
                  <div className="mt-2 p-3 border border-blue-200 rounded-xl bg-blue-50/60 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Von (Anreise)</label>
                        <input
                          type="date"
                          className="form-input text-sm w-full"
                          value={periodDates.from}
                          onChange={e => {
                            const next = { ...periodDates, from: e.target.value };
                            setPeriodDates(next);
                            applyDateRange(e.target.value, next.to);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Bis (Abreise)</label>
                        <input
                          type="date"
                          className="form-input text-sm w-full"
                          value={periodDates.to}
                          onChange={e => {
                            const next = { ...periodDates, to: e.target.value };
                            setPeriodDates(next);
                            applyDateRange(next.from, e.target.value);
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="w-full text-xs py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      onClick={() => setShowDatePicker(false)}
                    >
                      ✓ Übernommen – Schließen
                    </button>
                  </div>
                )}
              </div>

              <F label="Kundennummer" field="customer_number" />
              <F label="Ansprechpartner" field="contact_person" />
              {data.external_reference && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Externe Buchungsnr. (Referenz)</label>
                  <input readOnly className="form-input text-sm w-full bg-gray-50 text-gray-500 font-mono" value={data.external_reference} />
                </div>
              )}
            </div>
          </section>

          {/* Anrede & Einleitung */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">✉️ Anrede & Einleitung</h3>
            <PresetSelector
              presets={presets.salutations || []}
              onApply={p => {
                if (p.salutation !== undefined)  set('salutation',   p.salutation);
                if (p.intro_line1 !== undefined) set('intro_line1',  p.intro_line1);
                if (p.intro_line2 !== undefined) set('intro_line2',  p.intro_line2);
              }}
            />
            <div className="space-y-3">
              <F label="Anrede" field="salutation" />
              <F label="Einleitungstext (Zeile 1)" field="intro_line1" type="textarea" rows={2} colSpan={3} />
              <F label="Einleitungstext (Zeile 2)" field="intro_line2" type="textarea" rows={2} colSpan={3} />
            </div>
          </section>

          {/* Leistungspositionen */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📦 Leistungspositionen</h3>
            <div className="space-y-4">

              {/* Accommodation */}
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">🏠 Unterkunft</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <F label="Bezeichnung" field="accommodation_desc" />
                  <F label="Haus" field="accommodation_sub_house" />
                  <F label="Zeitraum (Unterzeile)" field="accommodation_sub_dates" />
                  <F label="Personenanzahl (Unterzeile)" field="accommodation_sub_persons" />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Anzahl (Nächte)</label>
                    <input type="number" min="0" step="1" className="form-input text-sm w-full"
                      value={data.accommodation_qty ?? ''}
                      onChange={e => set('accommodation_qty', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Einzelpreis (€ / Nacht)</label>
                    <input type="number" min="0" step="0.01" className="form-input text-sm w-full"
                      value={data.accommodation_unit_price ?? ''}
                      onChange={e => set('accommodation_unit_price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Gesamtpreis (Unterkunft)</label>
                    <div className="form-input text-sm bg-gray-100 text-gray-600 font-mono font-semibold">
                      {fmtEur((data.accommodation_qty || 0) * (data.accommodation_unit_price || 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cleaning */}
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">🧹 Reinigung</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <F label="Bezeichnung" field="cleaning_fee_desc" />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Betrag (€)</label>
                    <input type="number" step="0.01" min="0" className="form-input text-sm w-full"
                      value={data.cleaning_fee || 0}
                      onChange={e => set('cleaning_fee', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </div>

              {/* Discount */}
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">🏷 Rabatt</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <F label="Bezeichnung" field="discount_desc" />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Rabatt (%)</label>
                    <input type="number" step="0.1" min="0" max="100" className="form-input text-sm w-full"
                      value={data.discount_pct || 0}
                      onChange={e => set('discount_pct', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Extra line items */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">➕ Zusätzliche Positionen</h3>
              <button type="button" onClick={addExtraItem}
                className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors border border-blue-200">
                + Position hinzufügen
              </button>
            </div>
            {extraItems.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Keine weiteren Positionen. Klicke „+ Position hinzufügen".</p>
            ) : (
              <div className="space-y-3">
                {extraItems.map((item, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Bezeichnung</label>
                        <input className="form-input text-sm w-full" value={item.description}
                          onChange={e => updateExtraItem(i, 'description', e.target.value)}
                          placeholder="z.B. Parkgebühr, Zusatzleistung …" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Anzahl</label>
                        <input type="number" min="0" step="0.5" className="form-input text-sm w-full" value={item.qty}
                          onChange={e => updateExtraItem(i, 'qty', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Einzelpreis (€)</label>
                        <input type="number" min="0" step="0.01" className="form-input text-sm w-full" value={item.unit_price}
                          onChange={e => updateExtraItem(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Gesamtpreis</label>
                        <div className="form-input text-sm bg-gray-100 text-gray-600 font-mono font-semibold">
                          {fmtEur((item.qty || 0) * (item.unit_price || 0))}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Vermerk (erscheint unter der Position)</label>
                        <input className="form-input text-sm w-full" value={item.note}
                          onChange={e => updateExtraItem(i, 'note', e.target.value)}
                          placeholder="Optionaler Hinweis für den Gast …" />
                      </div>
                      <div className="flex items-end">
                        <button type="button" onClick={() => removeExtraItem(i)}
                          className="w-full text-xs px-2 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-colors border border-red-200">
                          🗑 Entfernen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Beträge */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">💶 Beträge</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nettobetrag (€)</label>
                <input type="number" step="0.01" className="form-input text-sm w-full font-mono"
                  value={parseFloat(data.netto_total || 0).toFixed(2)}
                  onChange={e => {
                    const netto = parseFloat(e.target.value) || 0;
                    const vr = parseFloat(data.vat_rate || 7);
                    const brutto = netto * (1 + vr / 100);
                    set('netto_total', netto); set('brutto_total', brutto); set('vat_amount', brutto - netto);
                  }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">MwSt. ({data.vat_rate}%)</label>
                <input readOnly className="form-input text-sm w-full font-mono bg-gray-50 text-gray-400"
                  value={fmtEur(data.vat_amount)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Brutto-Gesamt (€)</label>
                <input type="number" step="0.01" className="form-input text-sm w-full font-mono font-semibold"
                  value={parseFloat(data.brutto_total || 0).toFixed(2)}
                  onChange={e => {
                    const brutto = parseFloat(e.target.value) || 0;
                    const vr = parseFloat(data.vat_rate || 7);
                    const netto = brutto / (1 + vr / 100);
                    set('brutto_total', brutto); set('netto_total', netto); set('vat_amount', brutto - netto);
                  }} />
              </div>
            </div>
          </section>

          {/* Zahlungshinweis */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">💳 Zahlungshinweis</h3>
            <PresetSelector
              presets={presets.payments || []}
              onApply={p => { if (p.text !== undefined) set('payment_text', p.text); }}
            />
            <F label="Text (erscheint fett auf der Rechnung)" field="payment_text" type="textarea" rows={3} colSpan={3} />
          </section>

          {/* AGB */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📜 AGB & Hinweise</h3>
            <PresetSelector
              presets={presets.agbs || []}
              onApply={p => {
                if (p.agb1 !== undefined) set('agb1', p.agb1);
                if (p.agb2 !== undefined) set('agb2', p.agb2);
              }}
            />
            <div className="space-y-3">
              <F label="AGB Satz 1" field="agb1" type="textarea" rows={3} colSpan={3} />
              <F label="AGB Satz 2 (mit Website)" field="agb2" type="textarea" rows={3} colSpan={3} />
            </div>
          </section>

          {/* Abschluss */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🤝 Abschluss</h3>
            <PresetSelector
              presets={presets.closings || []}
              onApply={p => {
                if (p.closing_text !== undefined) set('closing_text', p.closing_text);
                if (p.closing !== undefined)      set('closing',      p.closing);
                if (p.owner_name !== undefined)   set('owner_name',   p.owner_name);
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <F label="Schlusstext" field="closing_text" type="textarea" rows={2} colSpan={3} />
              </div>
              <F label="Grußformel" field="closing" />
              <F label="Name (Unterschrift)" field="owner_name" />
              <F label="Website (blau angezeigt)" field="website" />
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-400">Änderungen gelten nur für diese Rechnung und werden nicht gespeichert.</p>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary text-sm" onClick={onClose}>Abbrechen</button>
            <button type="button" className="btn-primary text-sm flex items-center gap-2"
              onClick={handleGenerate} disabled={generating}>
              {generating ? '⏳ Erstelle PDF…' : '📄 PDF erstellen & herunterladen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
