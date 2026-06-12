import { useState } from 'react';
import { exportInvoiceFromData } from '../utils/pdfExport';

export default function InvoicePreviewModal({ data, onClose, onLangChange, onChange }) {
  const [generating, setGenerating] = useState(false);
  const set = (field, value) => onChange(field, value);

  const extraItems = data.extra_items || [];
  const setExtraItems = (items) => set('extra_items', items);

  const addExtraItem    = () => setExtraItems([...extraItems, { description: '', qty: 1, unit_price: 0, note: '' }]);
  const removeExtraItem = (i) => setExtraItems(extraItems.filter((_, idx) => idx !== i));
  const updateExtraItem = (i, field, value) => {
    setExtraItems(extraItems.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try { await exportInvoiceFromData(data); }
    finally { setGenerating(false); onClose(); }
  };

  const F = ({ label, field, type = 'text', rows = 2, colSpan }) => (
    <div className={colSpan === 2 ? 'md:col-span-2' : colSpan === 3 ? 'col-span-full' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea className="form-input text-sm w-full" rows={rows}
          value={data[field] || ''} onChange={e => set(field, e.target.value)} />
      ) : (
        <input type={type} className="form-input text-sm w-full"
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

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📋 Rechnungsdaten</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <F label="Rechnungsnummer" field="invoice_number" />
              <F label="Rechnungsdatum" field="invoice_date" />
              <F label="Leistungszeitraum" field="service_period" />
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

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">✉️ Anrede & Einleitung</h3>
            <div className="space-y-3">
              <F label="Anrede" field="salutation" />
              <F label="Einleitungstext (Zeile 1)" field="intro_line1" type="textarea" rows={2} colSpan={3} />
              <F label="Einleitungstext (Zeile 2)" field="intro_line2" type="textarea" rows={2} colSpan={3} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📦 Leistungspositionen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <F label="Unterkunft – Bezeichnung" field="accommodation_desc" />
              <F label="Unterkunft – Haus" field="accommodation_sub_house" />
              <F label="Unterkunft – Zeitraum" field="accommodation_sub_dates" />
              <F label="Unterkunft – Personenanzahl" field="accommodation_sub_persons" />
              <F label="Reinigung – Bezeichnung" field="cleaning_fee_desc" />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Reinigung – Betrag (€)</label>
                <input type="number" step="0.01" min="0" className="form-input text-sm w-full"
                  value={data.cleaning_fee || 0}
                  onChange={e => set('cleaning_fee', parseFloat(e.target.value) || 0)} />
              </div>
              <F label="Rabatt – Bezeichnung" field="discount_desc" />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rabatt – Prozent (%)</label>
                <input type="number" step="0.1" min="0" max="100" className="form-input text-sm w-full"
                  value={data.discount_pct || 0}
                  onChange={e => set('discount_pct', parseFloat(e.target.value) || 0)} />
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
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Bezeichnung</label>
                        <input className="form-input text-sm w-full" value={item.description}
                          onChange={e => updateExtraItem(i, 'description', e.target.value)}
                          placeholder="z.B. Parkgebühr, Zusatzleistung …" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Menge</label>
                        <input type="number" min="0" step="0.5" className="form-input text-sm w-full" value={item.qty}
                          onChange={e => updateExtraItem(i, 'qty', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Einzelpreis (€)</label>
                        <input type="number" min="0" step="0.01" className="form-input text-sm w-full" value={item.unit_price}
                          onChange={e => updateExtraItem(i, 'unit_price', parseFloat(e.target.value) || 0)} />
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
                    <div className="text-right text-xs text-gray-500 font-medium">
                      Gesamt: {fmtEur((item.qty || 0) * (item.unit_price || 0))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

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

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">💳 Zahlungshinweis</h3>
            <F label="Text (erscheint fett auf der Rechnung)" field="payment_text" type="textarea" rows={3} colSpan={3} />
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📜 AGB & Hinweise</h3>
            <div className="space-y-3">
              <F label="AGB Satz 1" field="agb1" type="textarea" rows={3} colSpan={3} />
              <F label="AGB Satz 2 (mit Website)" field="agb2" type="textarea" rows={3} colSpan={3} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🤝 Abschluss</h3>
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
