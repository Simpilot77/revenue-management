import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell, ReferenceLine,
} from 'recharts';
import api from '../utils/api';
import { formatCurrency, formatPercent, formatDate, MONTH_NAMES, STATUS_LABELS, STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../utils/format';
import { exportDashboard } from '../utils/pdfExport';

const HOUSE_COLORS = ['#1d4ed8', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

// Small toggle button row
function ChartToggle({ value, onChange, options }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors border
            ${value === o.value
              ? 'bg-blue-700 text-white border-blue-700'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
            }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DrillDownModal({ title, bookingIds, onClose }) {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!bookingIds?.length) { setLoading(false); return; }
    api.get('/reports/drill-down', { params: { ids: bookingIds.join(',') } })
      .then(r => setBookings(r.data.data || []))
      .finally(() => setLoading(false));
  }, [bookingIds]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{title} <span className="text-gray-400 font-normal text-base">({bookingIds?.length} Buchungen)</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none">×</button>
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Lade…</div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Keine Buchungen</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  {['Haus','Gast','Anreise','Abreise','N.','Kanal','Gesamtpreis','Status','Zahlung'].map(h => (
                    <th key={h} className="text-left text-gray-500 font-medium px-4 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => { onClose(); navigate(`/bookings/${b.id}/edit`); }}>
                    <td className="px-4 py-2 font-medium">{b.house_short}</td>
                    <td className="px-4 py-2">
                      <div>{b.guest_name}</div>
                      {b.company_name && <div className="text-xs text-gray-400">{b.company_name}</div>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(b.checkin_date)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(b.checkout_date)}</td>
                    <td className="px-4 py-2 text-center">{b.nights}</td>
                    <td className="px-4 py-2">
                      {b.channel_short && <span className="badge text-white text-xs" style={{ backgroundColor: b.channel_color }}>{b.channel_short}</span>}
                    </td>
                    <td className="px-4 py-2 font-medium whitespace-nowrap">{formatCurrency(b.total_price)}</td>
                    <td className="px-4 py-2"><span className={`badge ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span></td>
                    <td className="px-4 py-2"><span className={`badge ${PAYMENT_STATUS_COLORS[b.payment_status]}`}>{PAYMENT_STATUS_LABELS[b.payment_status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color = 'blue', icon }) {
  const colors = {
    blue: 'text-blue-700 bg-blue-50',
    green: 'text-green-700 bg-green-50',
    purple: 'text-purple-700 bg-purple-50',
    orange: 'text-orange-700 bg-orange-50',
    red: 'text-red-700 bg-red-50',
  };
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`text-lg p-1.5 rounded-lg ${colors[color]}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [kpis, setKpis]         = useState(null);
  const [monthly, setMonthly]   = useState([]);
  const [cashflow, setCashflow]  = useState([]);
  const [houseData, setHouseData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [drillDown, setDrillDown] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Refs for PDF chart capture
  const revChartRef = useRef(null);
  const occChartRef = useRef(null);
  const revparChartRef = useRef(null);
  const cashflowChartRef = useRef(null);

  // Chart toggles
  const [revType,    setRevType]    = useState('bar');   // 'bar' | 'line'
  const [revBreak,   setRevBreak]   = useState('total'); // 'total' | 'house'
  const [occType,    setOccType]    = useState('line');  // 'bar' | 'line'
  const [occBreak,   setOccBreak]   = useState('total'); // 'total' | 'house'
  const [revparType,  setRevparType]  = useState('bar');   // 'bar' | 'line'
  const [revparBreak, setRevparBreak] = useState('total'); // 'total' | 'house'

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to,   setTo]   = useState(`${now.getFullYear()}-12-31`);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/reports/kpis',              { params: { from, to } }),
      api.get('/reports/occupancy-monthly', { params: { from, to } }),
      api.get('/reports/houses',            { params: { from, to } }),
      api.get('/reports/cashflow',          { params: { from, to } }),
    ]).then(([k, m, h, cf]) => {
      setKpis(k.data);
      setCashflow((cf.data || []).map(r => ({
        ...r,
        monthLabel: MONTH_NAMES[parseInt(r.month.slice(5, 7)) - 1],
      })));
      // Flatten per-house maps so recharts can use simple dataKey strings
      setMonthly(m.data.map(r => {
        const monthStr = r.month?.slice(0, 7); // 'YYYY-MM'
        const flat = {
          ...r,
          monthLabel: MONTH_NAMES[parseInt(r.month.slice(5, 7)) - 1],
          isPast:    monthStr < currentMonthStr,
          isCurrent: monthStr === currentMonthStr,
          isFuture:  monthStr > currentMonthStr,
        };
        if (r.revenue_per_house) {
          Object.entries(r.revenue_per_house).forEach(([hid, val]) => {
            flat[`rev_h${hid}`] = val;
          });
        }
        if (r.occupancy_per_house) {
          Object.entries(r.occupancy_per_house).forEach(([hid, val]) => {
            flat[`occ_h${hid}`] = val;
          });
        }
        if (r.revpar_per_house) {
          Object.entries(r.revpar_per_house).forEach(([hid, val]) => {
            flat[`revpar_h${hid}`] = val;
          });
        }
        return flat;
      }));
      setHouseData(h.data);
    }).finally(() => setLoading(false));
  }, [from, to]);

  const handleImport = () => {
    setImporting(true);
    setImportMsg(null);
    api.post('/admin/lodgify-sync')
      .then(r => {
        const d = r.data || {};
        setImportMsg({ ok: true, text: d.message || 'Import abgeschlossen' });
        // Daten neu laden damit Dashboard aktualisiert wird
        setLoading(true);
        Promise.all([
          api.get('/reports/kpis',              { params: { from, to } }),
          api.get('/reports/occupancy-monthly', { params: { from, to } }),
          api.get('/reports/houses',            { params: { from, to } }),
          api.get('/reports/cashflow',          { params: { from, to } }),
        ]).then(([k, m, h, cf]) => {
          setKpis(k.data);
          setCashflow((cf.data || []).map(r => ({
            ...r,
            monthLabel: MONTH_NAMES[parseInt(r.month.slice(5, 7)) - 1],
          })));
          const currentMonthStr2 = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
          setMonthly(m.data.map(r2 => {
            const monthStr = r2.month?.slice(0,7);
            const flat = { ...r2, monthLabel: MONTH_NAMES[parseInt(r2.month.slice(5,7))-1], isPast: monthStr < currentMonthStr2, isCurrent: monthStr === currentMonthStr2, isFuture: monthStr > currentMonthStr2 };
            ['revenue_per_house','occupancy_per_house','revpar_per_house'].forEach(key => {
              if (r2[key]) Object.entries(r2[key]).forEach(([hid, val]) => { flat[`${key === 'revenue_per_house' ? 'rev' : key === 'occupancy_per_house' ? 'occ' : 'revpar'}_h${hid}`] = val; });
            });
            return flat;
          }));
          setHouseData(h.data);
        }).finally(() => setLoading(false));
      })
      .catch(() => setImportMsg({ ok: false, text: 'Import fehlgeschlagen' }))
      .finally(() => setImporting(false));
  };

  const captureChart = async (ref) => {
    if (!ref.current) return null;
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return canvas.toDataURL('image/jpeg', 0.92);
    } catch (e) {
      console.warn('Chart capture failed:', e);
      return null;
    }
  };

  const handleDashboardPdfExport = async () => {
    setExporting(true);
    try {
      const [umsatz, auslastung, revpar, cashflowImg] = await Promise.all([
        captureChart(revChartRef),
        captureChart(occChartRef),
        captureChart(revparChartRef),
        captureChart(cashflowChartRef),
      ]);
      const cashflowTotal = cashflow.reduce((s, r) => s + r.cashflow, 0);
      const periodLabel = `${formatDate(from)} – ${formatDate(to)}`;
      await exportDashboard(kpis, houseData, cashflowTotal, { umsatz, auslastung, revpar, cashflow: cashflowImg }, periodLabel);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {drillDown && <DrillDownModal title={drillDown.title} bookingIds={drillDown.ids} onClose={() => setDrillDown(null)} />}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Übersicht Revenue Management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-gray-500">Von</label>
          <input type="date" className="form-input w-36 text-sm py-1.5" value={from} onChange={e => setFrom(e.target.value)} />
          <label className="text-xs text-gray-500">Bis</label>
          <input type="date" className="form-input w-36 text-sm py-1.5" value={to} onChange={e => setTo(e.target.value)} />
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn btn-secondary text-sm flex items-center gap-1.5"
          >
            {importing ? '⏳' : '🔄'} Lodgify Import
          </button>
          {kpis && (
            <button
              onClick={handleDashboardPdfExport}
              disabled={exporting}
              className="btn btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {exporting ? '⏳' : '📄'} Dashboard PDF
            </button>
          )}
          <Link to="/bookings/new" className="btn-primary text-sm">
            + Neue Buchung
          </Link>
        </div>
      </div>

      {importMsg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${importMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {importMsg.text}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">Daten werden geladen…</div>
      ) : kpis && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Auslastung" value={formatPercent(kpis.occupancy_rate)} sub={`${kpis.total_nights} Nächte belegt`} color="blue" icon="🏠" />
            <KpiCard label="Umsatz" value={formatCurrency(kpis.total_revenue)} sub={`${kpis.confirmed_bookings} Buchungen`} color="green" icon="💶" />
            <KpiCard label="ADR" value={formatCurrency(kpis.adr)} sub="Ø Tagespreis" color="purple" icon="📊" />
            <KpiCard label="RevPAR" value={formatCurrency(kpis.revpar_house ?? kpis.revpar)} sub={`pro Haus/Nacht · ${formatCurrency(kpis.revpar)} pro Bett`} color="orange" icon="📈" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ø Aufenthalt" value={`${kpis.avg_los} Nächte`} sub="Länge des Aufenthalts" color="blue" icon="🌙" />
            <KpiCard label="Ø Vorlaufzeit" value={`${kpis.avg_lead_time} Tage`} sub="Buchung bis Check-in" color="purple" icon="⏱️" />
            <KpiCard label="Stornoquote" value={formatPercent(kpis.cancellation_rate)} sub={`${kpis.cancellations} Stornos`} color="red" icon="❌" />
            <KpiCard label="Stammgäste" value={kpis.returning_guests} sub="Wiederholungsbuchungen" color="green" icon="⭐" />
          </div>

          {/* ── Revenue & Occupancy charts with toggles ── */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Revenue */}
            <div className="card">
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <h2 className="font-semibold text-gray-800">Umsatz pro Monat</h2>
                <div className="flex gap-2 flex-wrap">
                  <ChartToggle value={revType}  onChange={setRevType}
                    options={[{ value:'bar', label:'▐▌ Balken' }, { value:'line', label:'〜 Kurve' }]} />
                  <ChartToggle value={revBreak} onChange={setRevBreak}
                    options={[{ value:'total', label:'Gesamt' }, { value:'house', label:'Je Haus' }]} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-2">Buchungsumsatz, anteilig auf die Aufenthaltstage verteilt (Accrual) — nicht der tatsächliche Zahlungseingang, siehe Cash Flow weiter unten</p>
              <div ref={revChartRef}>
              <ResponsiveContainer width="100%" height={220}>
                {revType === 'bar' ? (
                  <BarChart data={monthly} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => formatCurrency(v)} labelStyle={{ fontWeight: 600 }} />
                    {revBreak === 'house' && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    {revBreak === 'total'
                      ? <Bar dataKey="revenue" radius={[4,4,0,0]} name="Umsatz" cursor="pointer"
                          onClick={d => d.booking_ids?.length && setDrillDown({ title: `Buchungen ${d.monthLabel}`, ids: d.booking_ids })}>
                          {monthly.map((m, i) => (
                            <Cell key={i} fill={m.isFuture ? '#bfdbfe' : m.isPast ? '#93c5fd' : '#1d4ed8'} />
                          ))}
                        </Bar>
                      : houseData.map((h, i) =>
                          <Bar key={h.id} stackId="r" dataKey={`rev_h${h.id}`} fill={HOUSE_COLORS[i % HOUSE_COLORS.length]} name={h.name} radius={i === houseData.length-1 ? [4,4,0,0] : [0,0,0,0]} />
                        )
                    }
                  </BarChart>
                ) : (
                  <LineChart data={monthly} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => formatCurrency(v)} labelStyle={{ fontWeight: 600 }} />
                    {revBreak === 'house' && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    <ReferenceLine x={MONTH_NAMES[now.getMonth()]} stroke="#1d4ed8" strokeDasharray="4 2" strokeWidth={1.5} />
                    {revBreak === 'total'
                      ? <Line type="monotone" dataKey="revenue" stroke="#1d4ed8" strokeWidth={2}
                          dot={(p) => {
                            const d = monthly[p.index];
                            const c = d?.isFuture ? '#bfdbfe' : d?.isPast ? '#93c5fd' : '#1d4ed8';
                            return <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={c} stroke={c} />;
                          }} name="Umsatz" />
                      : houseData.map((h, i) =>
                          <Line key={h.id} type="monotone" dataKey={`rev_h${h.id}`} stroke={HOUSE_COLORS[i % HOUSE_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} name={h.name} />
                        )
                    }
                  </LineChart>
                )}
              </ResponsiveContainer>
              </div>
            </div>

            {/* Occupancy */}
            <div className="card">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="font-semibold text-gray-800">Auslastung % pro Monat</h2>
                <div className="flex gap-2 flex-wrap">
                  <ChartToggle value={occType}  onChange={setOccType}
                    options={[{ value:'bar', label:'▐▌ Balken' }, { value:'line', label:'〜 Kurve' }]} />
                  <ChartToggle value={occBreak} onChange={setOccBreak}
                    options={[{ value:'total', label:'Gesamt' }, { value:'house', label:'Je Haus' }]} />
                </div>
              </div>
              <div ref={occChartRef}>
              <ResponsiveContainer width="100%" height={220}>
                {occType === 'bar' ? (
                  <BarChart data={monthly} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0,100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => `${v} %`} labelStyle={{ fontWeight: 600 }} />
                    {occBreak === 'house' && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    {occBreak === 'total'
                      ? <Bar dataKey="occupancy_rate" radius={[4,4,0,0]} name="Auslastung" cursor="pointer"
                          onClick={d => d.booking_ids?.length && setDrillDown({ title: `Buchungen ${d.monthLabel}`, ids: d.booking_ids })}>
                          {monthly.map((m, i) => (
                            <Cell key={i} fill={m.isFuture ? '#6ee7b7' : m.isPast ? '#34d399' : '#10b981'} />
                          ))}
                        </Bar>
                      : houseData.map((h, i) =>
                          <Bar key={h.id} dataKey={`occ_h${h.id}`} fill={HOUSE_COLORS[i % HOUSE_COLORS.length]} radius={[4,4,0,0]} name={h.name} />
                        )
                    }
                  </BarChart>
                ) : (
                  <LineChart data={monthly} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0,100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => `${v} %`} labelStyle={{ fontWeight: 600 }} />
                    {occBreak === 'house' && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    <ReferenceLine x={MONTH_NAMES[now.getMonth()]} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5} />
                    {occBreak === 'total'
                      ? <Line type="monotone" dataKey="occupancy_rate" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Auslastung"
                          onClick={(_, p) => p?.payload?.booking_ids?.length && setDrillDown({ title: `Buchungen ${p.payload.monthLabel}`, ids: p.payload.booking_ids })} />
                      : houseData.map((h, i) =>
                          <Line key={h.id} type="monotone" dataKey={`occ_h${h.id}`} stroke={HOUSE_COLORS[i % HOUSE_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} name={h.name} />
                        )
                    }
                  </LineChart>
                )}
              </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── RevPAR chart ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <h2 className="font-semibold text-gray-800">RevPAR pro Monat</h2>
                <p className="text-xs text-gray-400">Revenue per available room/house · Zusatz: pro Bett</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ChartToggle value={revparType}  onChange={setRevparType}
                  options={[{ value:'bar', label:'▐▌ Balken' }, { value:'line', label:'〜 Kurve' }]} />
                <ChartToggle value={revparBreak} onChange={setRevparBreak}
                  options={[{ value:'total', label:'Gesamt' }, { value:'house', label:'Je Haus' }]} />
              </div>
            </div>
            <div ref={revparChartRef}>
            <ResponsiveContainer width="100%" height={220}>
              {revparType === 'bar' ? (
                <BarChart data={monthly} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} />
                  <Tooltip formatter={(v, name) => [formatCurrency(v), name]} labelStyle={{ fontWeight: 600 }} />
                  {revparBreak === 'house' && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {revparBreak === 'total'
                    ? <>
                        <Bar dataKey="revpar_house" radius={[4,4,0,0]} name="RevPAR (Haus)">
                          {monthly.map((m, i) => (
                            <Cell key={i} fill={m.isFuture ? '#fed7aa' : m.isPast ? '#fb923c' : '#f97316'} />
                          ))}
                        </Bar>
                        <Bar dataKey="revpar" radius={[4,4,0,0]} name="RevPAR (Bett)" fill="#fde68a">
                          {monthly.map((m, i) => (
                            <Cell key={i} fill={m.isFuture ? '#fef3c7' : m.isPast ? '#fde68a' : '#fbbf24'} />
                          ))}
                        </Bar>
                      </>
                    : houseData.map((h, i) =>
                        <Bar key={h.id} dataKey={`revpar_h${h.id}`} fill={HOUSE_COLORS[i % HOUSE_COLORS.length]} radius={[4,4,0,0]} name={h.name} />
                      )
                  }
                </BarChart>
              ) : (
                <LineChart data={monthly} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} />
                  <Tooltip formatter={(v, name) => [formatCurrency(v), name]} labelStyle={{ fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={MONTH_NAMES[now.getMonth()]} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1.5} />
                  {revparBreak === 'total'
                    ? <>
                        <Line type="monotone" dataKey="revpar_house" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} name="RevPAR (Haus)" />
                        <Line type="monotone" dataKey="revpar" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} name="RevPAR (Bett)" />
                      </>
                    : houseData.map((h, i) =>
                        <Line key={h.id} type="monotone" dataKey={`revpar_h${h.id}`} stroke={HOUSE_COLORS[i % HOUSE_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} name={h.name} />
                      )
                  }
                </LineChart>
              )}
            </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{background:'#f97316'}}></span> Vergangenheit</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded border-2 border-orange-500" style={{background:'#fff'}}></span> Aktueller Monat</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{background:'#fed7aa'}}></span> Zukunft</span>
            </div>
          </div>

          {/* ── Cashflow chart ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <div>
                <h2 className="font-semibold text-gray-800">Cash Flow — tatsächliche Zahlungseingänge</h2>
                <p className="text-xs text-gray-400">Pro Rechnungsdatum (inkl. Teilrechnungen & Stornos) — nicht zu verwechseln mit dem Accrual-Umsatz oben</p>
              </div>
            </div>
            <div className="flex gap-6 mb-3 text-xs flex-wrap">
              {cashflow.reduce((s, r) => s + r.cashflow, 0) !== 0 && (
                <span className="text-gray-500">
                  Gesamt: <span className="font-semibold text-gray-800">{formatCurrency(cashflow.reduce((s, r) => s + r.cashflow, 0))}</span>
                  {' '}· <span className="text-gray-400">{cashflow.reduce((s, r) => s + r.payments, 0)} Rechnungen</span>
                </span>
              )}
            </div>
            <div ref={cashflowChartRef}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cashflow} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  labelStyle={{ fontWeight: 600 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                        <div className="font-semibold text-gray-800 mb-1">{label}</div>
                        <div className="text-emerald-700 font-bold">{formatCurrency(d?.cashflow || 0)}</div>
                        <div className="text-gray-500">{d?.payments || 0} Rechnungen</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="cashflow" radius={[4,4,0,0]} name="Cash Flow" fill="#059669">
                  {cashflow.map((m, i) => {
                    const ms = m.month?.slice(0,7);
                    return <Cell key={i} fill={ms > currentMonthStr ? '#a7f3d0' : ms < currentMonthStr ? '#10b981' : '#059669'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{background:'#10b981'}}></span> Vergangenheit</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded border-2 border-emerald-700" style={{background:'#fff'}}></span> Aktueller Monat</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{background:'#a7f3d0'}}></span> Zukunft</span>
            </div>
          </div>

          {/* ── Lead Time & Avg LOS per month ── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-1">Ø Vorlaufzeit pro Monat</h2>
              <p className="text-xs text-gray-400 mb-3">Tage zwischen Buchung und Anreise</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthly} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}d`} />
                  <Tooltip
                    formatter={(v) => [`${v} Tage`, 'Ø Vorlaufzeit']}
                    labelStyle={{ fontWeight: 600 }}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone" dataKey="avg_lead_time" stroke="#8b5cf6" strokeWidth={2.5}
                    dot={{ r: 5, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }} name="Ø Vorlaufzeit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-1">Ø Aufenthaltsdauer pro Monat</h2>
              <p className="text-xs text-gray-400 mb-3">Durchschnittliche gebuchte Nächte</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthly} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}N`} />
                  <Tooltip
                    formatter={(v) => [`${v} Nächte`, 'Ø Aufenthalt']}
                    labelStyle={{ fontWeight: 600 }}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone" dataKey="avg_los" stroke="#f59e0b" strokeWidth={2.5}
                    dot={{ r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }} name="Ø Aufenthalt"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* House Comparison */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Häuservergleich ({from} – {to})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Haus','Kapazität','Buchungen','Nächte','Auslastung','Umsatz','ADR','RevPAR','Stornos'].map(h => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {houseData.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium">{h.name}</td>
                      <td className="py-3 pr-4 text-gray-600">{h.capacity} Betten</td>
                      <td className="py-3 pr-4">{h.bookings}</td>
                      <td className="py-3 pr-4">{h.nights}</td>
                      <td className="py-3 pr-4">
                        <span className={`badge ${h.occupancy_rate >= 70 ? 'bg-green-100 text-green-700' : h.occupancy_rate >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {formatPercent(h.occupancy_rate)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium">{formatCurrency(h.revenue)}</td>
                      <td className="py-3 pr-4">{formatCurrency(h.adr)}</td>
                      <td className="py-3 pr-4">{formatCurrency(h.revpar)}</td>
                      <td className="py-3 pr-4 text-red-600">{h.cancellations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
