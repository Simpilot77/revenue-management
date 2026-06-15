import { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, ComposedChart
} from 'recharts';
import api from '../utils/api';
import { findInvoiceNumberGaps, houseLabelForKey, isManualInvoiceNumber } from '../utils/numbering';
import { formatCurrency, formatPercent, formatDate, MONTH_NAMES, STATUS_LABELS, STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../utils/format';

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
import {
  exportMonthlyReport, exportHouseComparison, exportChannelReport,
  exportPickupReport, exportLeadTimeReport, exportYoYReport, exportForecast,
  exportBookingsOverview,
} from '../utils/pdfExport';

const TAB_LABELS = ['Monatlich', 'Häuservergleich', 'Channel-Mix', 'Pickup', 'Vorlaufzeit', 'Jahresvergleich', 'Forecast', 'Buchungsübersicht'];

function SectionHeader({ title }) {
  return <h2 className="font-semibold text-gray-800 mb-4">{title}</h2>;
}

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [houses, setHouses] = useState([]);
  const [channels, setChannels] = useState([]);
  const [houseFilter, setHouseFilter] = useState('');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [bookingsDetail, setBookingsDetail] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [sortBy, setSortBy] = useState('checkin_date');
  const [sortDir, setSortDir] = useState('desc');
  const [drillDown, setDrillDown] = useState(null);
  const [guestDist, setGuestDist] = useState([]);
  const [cashflow, setCashflow] = useState([]);

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const params = { from, to, ...(houseFilter ? { house_id: houseFilter } : {}) };

  useEffect(() => {
    api.get('/meta/houses').then(r => setHouses(r.data));
    api.get('/meta/channels').then(r => setChannels(r.data));
  }, []);

  useEffect(() => {
    if (tab !== 0) return;
    api.get('/reports/guest-distribution', { params }).then(r => setGuestDist(r.data || []));
    api.get('/reports/cashflow', { params }).then(r => setCashflow(r.data || []));
  }, [tab, year, houseFilter]);

  useEffect(() => {
    if (tab !== 7) return;
    setBookingsLoading(true);
    const p = { from: `${year}-01-01`, to: `${year}-12-31`, limit: 500, ...(houseFilter ? { house_id: houseFilter } : {}) };
    api.get('/bookings', { params: p })
      .then(r => setBookingsDetail((r.data.data || []).filter(b => ['bestaetigt','eingecheckt','ausgecheckt'].includes(b.status))))
      .finally(() => setBookingsLoading(false));
  }, [tab, year, houseFilter]);

  useEffect(() => {
    if (tab === 7) return;
    setLoading(true);
    const endpoints = {
      0: ['/reports/occupancy-monthly', params],
      1: ['/reports/houses', params],
      2: ['/reports/channels', params],
      3: ['/reports/pickup', params],
      4: ['/reports/lead-time', params],
      5: ['/reports/yoy', { ...(houseFilter ? { house_id: houseFilter } : {}) }],
      6: ['/reports/forecast', houseFilter ? { house_id: houseFilter } : {}],
    };
    const [endpoint, p] = endpoints[tab];
    api.get(endpoint, { params: p }).then(r => {
      setData(d => ({ ...d, [tab]: r.data }));
    }).finally(() => setLoading(false));
  }, [tab, year, houseFilter]);

  const currentYear = new Date().getFullYear();
  const tabData = data[tab];
  const chartRef = useRef(null);

  const handlePdfExport = async () => {
    if (tab === 7) {
      await exportBookingsOverview(bookingsDetail, channels, year);
      return;
    }
    if (!tabData) return;
    // Capture the visible chart/content area as an image
    let chartImg = null;
    if (chartRef.current) {
      try {
        const canvas = await html2canvas(chartRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        chartImg = canvas.toDataURL('image/jpeg', 0.88);
      } catch (e) {
        console.warn('Chart capture failed:', e);
      }
    }
    if (tab === 0) await exportMonthlyReport(tabData, year, chartImg);
    else if (tab === 1) await exportHouseComparison(tabData, from, to, chartImg);
    else if (tab === 2) await exportChannelReport(tabData, from, to, chartImg);
    else if (tab === 3) await exportPickupReport(tabData, from, to, chartImg);
    else if (tab === 4) await exportLeadTimeReport(tabData, from, to, chartImg);
    else if (tab === 5 && tabData?.current) await exportYoYReport(tabData.current, tabData.previous, chartImg);
    else if (tab === 6) await exportForecast(tabData, chartImg);
  };

  const monthlyData = (tabData || []).map(r => ({
    ...r,
    monthLabel: MONTH_NAMES[parseInt(r.month?.slice(5, 7) || r.month || 1) - 1] || r.month,
    cashflow: cashflow.find(c => c.month === r.month)?.cashflow ?? 0,
  }));

  return (
    <div className="p-6 space-y-6">
      {drillDown && <DrillDownModal title={drillDown.title} bookingIds={drillDown.ids} onClose={() => setDrillDown(null)} />}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Auswertungen</h1>
        <div className="flex gap-3">
          <select className="form-select w-36" value={houseFilter} onChange={e => setHouseFilter(e.target.value)}>
            <option value="">Alle Häuser</option>
            {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {tab !== 6 && (
            <select className="form-select w-28" value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          <button
            onClick={handlePdfExport}
            disabled={tab === 7 ? bookingsDetail.length === 0 : !tabData}
            className="btn-secondary flex items-center gap-2 disabled:opacity-40"
          >
            📄 PDF Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {TAB_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === i ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 7 && loading ? (
        <div className="text-center text-gray-400 py-12">Daten werden geladen…</div>
      ) : tab !== 7 && !tabData ? null : (

        <div ref={chartRef}>
          {/* Tab 0: Monthly */}
          {tab === 0 && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="card">
                  <SectionHeader title="Umsatz & Cash Flow pro Monat (Klick für Buchungsdetails)" />
                  <p className="text-xs text-gray-400 -mt-3 mb-3">
                    <span className="font-medium text-blue-700">Umsatz</span> = Buchungsbetrag, anteilig auf die Aufenthaltstage verteilt (Accrual) ·{' '}
                    <span className="font-medium text-amber-600">Cash Flow</span> = tatsächliche Zahlungseingänge nach Rechnungsdatum (inkl. Teilrechnungen/Stornos)
                  </p>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#1d4ed8" radius={[4,4,0,0]} name="Umsatz" cursor="pointer" onClick={(d) => d.booking_ids?.length && setDrillDown({ title: `Buchungen ${d.monthLabel} ${year}`, ids: d.booking_ids })} />
                      <Line type="monotone" dataKey="cashflow" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Cash Flow" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <SectionHeader title="Auslastung & ADR pro Monat" />
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} />
                      <Tooltip formatter={(v, name) => name === 'Auslastung' ? `${v} %` : formatCurrency(v)} />
                      <Bar yAxisId="left" dataKey="occupancy_rate" fill="#10b981" radius={[4,4,0,0]} name="Auslastung" />
                      <Bar yAxisId="right" dataKey="adr" fill="#8b5cf6" radius={[4,4,0,0]} name="ADR" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Monat','Buchungen','Nächte','Belegungsn.','Auslastung'].map(h => (
                        <th key={h} className="text-left text-gray-500 font-medium px-4 py-3">{h}</th>
                      ))}
                      {/* Per-house free nights headers */}
                      {(monthlyData[0]?.house_free_nights
                        ? Object.values(monthlyData[0].house_free_nights)
                        : [{short:'A'},{short:'B'},{short:'C'}]
                      ).map(h => (
                        <th key={h.short} className="text-left text-gray-500 font-medium px-4 py-3 whitespace-nowrap">
                          Frei {h.short}
                        </th>
                      ))}
                      {['Umsatz','Cash Flow','ADR','RevPAR'].map(h => (
                        <th key={h} className="text-left text-gray-500 font-medium px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {monthlyData.map(r => (
                      <tr key={r.month} className="hover:bg-gray-50 cursor-pointer" onClick={() => r.booking_ids?.length && setDrillDown({ title: `Buchungen ${r.monthLabel} ${year}`, ids: r.booking_ids })}>
                        <td className="px-4 py-2 font-medium">{r.monthLabel} {year}</td>
                        <td className="px-4 py-2">{r.bookings}</td>
                        <td className="px-4 py-2">{r.booked_nights}</td>
                        <td className="px-4 py-2">{r.bed_nights}</td>
                        <td className="px-4 py-2"><span className={`badge ${r.occupancy_rate >= 70 ? 'bg-green-100 text-green-700' : r.occupancy_rate >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{formatPercent(r.occupancy_rate)}</span></td>
                        {/* Per-house free nights */}
                        {r.house_free_nights
                          ? Object.values(r.house_free_nights).map(h => (
                              <td key={h.short} className="px-4 py-2">
                                <span className={`font-medium ${h.free > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                  {h.free}
                                </span>
                                {h.free > 0 && <span className="text-xs text-gray-400 ml-1">N.</span>}
                              </td>
                            ))
                          : <td className="px-4 py-2 text-gray-400">—</td>
                        }
                        <td className="px-4 py-2 font-medium">{formatCurrency(r.revenue)}</td>
                        <td className="px-4 py-2 font-medium text-amber-700">{formatCurrency(r.cashflow)}</td>
                        <td className="px-4 py-2">{formatCurrency(r.adr)}</td>
                        <td className="px-4 py-2">{formatCurrency(r.revpar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Guest distribution */}
              {guestDist.length > 0 && (
                <div className="card">
                  <SectionHeader title="Buchungen nach Personenanzahl" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>{['Personen','Buchungen','Anteil','Gebuchte Nächte','Umsatz Ø'].map(h => (
                          <th key={h} className="text-left text-gray-500 font-medium px-4 py-3">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(() => {
                          const total = guestDist.reduce((s, r) => s + r.bookings, 0);
                          return guestDist.map(r => (
                            <tr key={r.guest_count} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium">{r.guest_count} {r.guest_count === 1 ? 'Person' : 'Personen'}</td>
                              <td className="px-4 py-2">{r.bookings}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[80px]">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(r.bookings / total * 100).toFixed(0)}%` }} />
                                  </div>
                                  <span>{(r.bookings / total * 100).toFixed(0)} %</span>
                                </div>
                              </td>
                              <td className="px-4 py-2">{r.total_nights}</td>
                              <td className="px-4 py-2">{formatCurrency(r.total_revenue / r.bookings)}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 1: House comparison */}
          {tab === 1 && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="card">
                  <SectionHeader title="Umsatz je Haus" />
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={tabData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => formatCurrency(v)} />
                      <Bar dataKey="revenue" fill="#1d4ed8" radius={[4,4,0,0]} name="Umsatz" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <SectionHeader title="Auslastung je Haus (%)" />
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={tabData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={v => `${v} %`} />
                      <Bar dataKey="occupancy_rate" fill="#10b981" radius={[4,4,0,0]} name="Auslastung" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Channel Mix */}
          {tab === 2 && tabData.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card">
                <SectionHeader title="Umsatz nach Kanal" />
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={tabData} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" outerRadius={100} label={({ channel, percent }) => `${channel} ${(percent*100).toFixed(0)}%`}>
                      {tabData.map((entry, i) => <Cell key={i} fill={entry.color || `hsl(${i*50},60%,50%)`} />)}
                    </Pie>
                    <Tooltip formatter={v => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <SectionHeader title="Buchungen nach Kanal" />
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={tabData} dataKey="bookings" nameKey="channel" cx="50%" cy="50%" outerRadius={100} label={({ channel, percent }) => `${channel} ${(percent*100).toFixed(0)}%`}>
                      {tabData.map((entry, i) => <Cell key={i} fill={entry.color || `hsl(${i*50},60%,50%)`} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card lg:col-span-2 p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Kanal','Buchungen','Nächte','Umsatz','ADR'].map(h => (
                      <th key={h} className="text-left text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tabData.map(r => (
                      <tr key={r.channel} className="hover:bg-gray-50 cursor-pointer" onClick={() => r.booking_ids?.length && setDrillDown({ title: `Kanal: ${r.channel}`, ids: r.booking_ids })}>
                        <td className="px-4 py-2">
                          <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: r.color }}></span>
                          {r.channel}
                        </td>
                        <td className="px-4 py-2">{r.bookings}</td>
                        <td className="px-4 py-2">{r.nights}</td>
                        <td className="px-4 py-2 font-medium">{formatCurrency(r.revenue)}</td>
                        <td className="px-4 py-2">{formatCurrency(r.adr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Pickup */}
          {tab === 3 && (
            <div className="card">
              <SectionHeader title={`Pickup-Report ${year} — Buchungseingänge pro Tag`} />
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tabData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="pickup_date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={d => `Datum: ${d}`} formatter={(v, name) => name === 'Umsatz' ? formatCurrency(v) : v} />
                  <Bar dataKey="new_bookings" fill="#1d4ed8" radius={[2,2,0,0]} name="Neue Buchungen" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tab 4: Lead Time */}
          {tab === 4 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card">
                <SectionHeader title="Buchungs-Vorlaufzeit (Klick für Details)" />
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={tabData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="lead_time_bucket" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="#8b5cf6" radius={[0,4,4,0]} name="Buchungen" cursor="pointer" onClick={(d) => d.booking_ids?.length && setDrillDown({ title: `Vorlaufzeit: ${d.lead_time_bucket}`, ids: d.booking_ids })} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Vorlaufzeit','Buchungen','Ø Umsatz'].map(h => (
                      <th key={h} className="text-left text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tabData.map(r => (
                      <tr key={r.lead_time_bucket} className="hover:bg-gray-50 cursor-pointer" onClick={() => r.booking_ids?.length && setDrillDown({ title: `Vorlaufzeit: ${r.lead_time_bucket}`, ids: r.booking_ids })}>
                        <td className="px-4 py-2 font-medium">{r.lead_time_bucket}</td>
                        <td className="px-4 py-2">{r.bookings}</td>
                        <td className="px-4 py-2">{formatCurrency(r.avg_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 5: Year-over-Year */}
          {tab === 5 && tabData?.current && (
            <div className="space-y-6">
              <div className="card">
                <SectionHeader title={`Umsatz: ${tabData.current.year} vs. ${tabData.previous.year}`} />
                {(() => {
                  const merged = MONTH_NAMES.map((label, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    const cur = tabData.current.months.find(r => r.month === m);
                    const prev = tabData.previous.months.find(r => r.month === m);
                    return { month: label, current: cur?.revenue || 0, previous: prev?.revenue || 0 };
                  });
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={merged}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => formatCurrency(v)} />
                        <Bar dataKey="current" fill="#1d4ed8" radius={[4,4,0,0]} name={`${tabData.current.year}`} />
                        <Bar dataKey="previous" fill="#93c5fd" radius={[4,4,0,0]} name={`${tabData.previous.year}`} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Tab 7: Buchungsübersicht */}
          {tab === 7 && (() => {
            const COLUMNS = [
              { label: 'Rechnungsnr.', field: 'invoice_number' },
              { label: 'Haus',         field: 'house_short' },
              { label: 'Gast',         field: 'guest_name' },
              { label: 'Kanal',        field: 'channel_short' },
              { label: 'Buchungsdatum',field: 'booking_date' },
              { label: 'Check-in',     field: 'checkin_date' },
              { label: 'Check-out',    field: 'checkout_date' },
              { label: 'Nächte',       field: 'nights' },
              { label: 'Status',       field: 'status' },
              { label: 'Brutto',       field: 'gross' },
              { label: 'Komm. %',      field: 'commRate' },
              { label: 'Komm. €',      field: 'commAmt' },
              { label: 'Netto',        field: 'net' },
            ];
            const toggleSort = (field) => {
              if (sortBy === field) {
                setSortDir(d => d === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy(field);
                setSortDir('desc');
              }
            };
            const mapped = bookingsDetail.map(b => {
              const ch = channels.find(c => c.id === b.channel_id);
              const commRate = ch?.commission_rate ?? 0;
              const gross = parseFloat(b.total_price) || 0;
              const commAmt = gross * commRate / 100;
              const net = gross - commAmt;
              return { ...b, commRate, commAmt, net, gross, channelColor: ch?.color };
            });
            const dir = sortDir === 'asc' ? 1 : -1;
            const rows = [...mapped].sort((a, b) => {
              const av = a[sortBy], bv = b[sortBy];
              if (typeof av === 'number') return (av - bv) * dir;
              return String(av || '').localeCompare(String(bv || '')) * dir;
            });
            const totalGross = rows.reduce((s, r) => s + r.net + r.commAmt, 0);
            const totalComm = rows.reduce((s, r) => s + r.commAmt, 0);
            const totalNet = rows.reduce((s, r) => s + r.net, 0);

            // Gap detection: per house+year, find missing sequence numbers (starting at 1000)
            const gapWarnings = Object.entries(findInvoiceNumberGaps(rows.map(r => r.invoice_number)))
              .map(([key, missing]) => ({ key, label: houseLabelForKey(key), missing }))
              .sort((a, b) => a.key.localeCompare(b.key));

            // Rows missing invoice number
            const missingInvoice = new Set(rows.filter(r => !r.invoice_number).map(r => r.id));

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="card text-center">
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalGross)}</div>
                    <div className="text-sm text-gray-500 mt-1">Brutto-Umsatz</div>
                  </div>
                  <div className="card text-center">
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(totalComm)}</div>
                    <div className="text-sm text-gray-500 mt-1">Portalkommissionen</div>
                  </div>
                  <div className="card text-center">
                    <div className="text-2xl font-bold text-green-700">{formatCurrency(totalNet)}</div>
                    <div className="text-sm text-gray-500 mt-1">Netto-Erlös</div>
                  </div>
                </div>
                {gapWarnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 space-y-1.5">
                    <div className="font-semibold">⚠️ Lücken in den Rechnungsnummern</div>
                    {gapWarnings.map(g => (
                      <div key={g.key} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="font-semibold whitespace-nowrap">{g.label}:</span>
                        <span>fehlende Nummern {g.missing.map(n => String(n).padStart(4, '0')).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {bookingsLoading ? (
                  <div className="text-center text-gray-400 py-12">Daten werden geladen…</div>
                ) : (
                  <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            {COLUMNS.map(c => (
                              <th key={c.field} className="text-left text-gray-500 font-medium px-3 py-3 whitespace-nowrap">
                                <button
                                  className="inline-flex items-center gap-1 hover:text-gray-800"
                                  onClick={() => toggleSort(c.field)}
                                >
                                  {c.label}
                                  {sortBy === c.field && <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {rows.map(r => (
                            <tr key={r.id} className={missingInvoice.has(r.id) ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}>
                              <td className="px-3 py-2 font-mono text-xs text-gray-700">
                                {r.invoice_number || <span className="text-gray-300">—</span>}
                                {r.invoice_number && isManualInvoiceNumber(r) && <span className="ml-1" title="Manuell eingegeben">✍️</span>}
                              </td>
                              <td className="px-3 py-2 font-medium">{r.house_short}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium">{r.guest_name}</div>
                                {r.company_name && <div className="text-xs text-gray-400">{r.company_name}</div>}
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.channelColor || '#999' }}></span>
                                  <span>{r.channel_short || '—'}</span>
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{r.booking_date?.slice(0,10) || <span className="text-gray-300">—</span>}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{r.checkin_date?.slice(0,10)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{r.checkout_date?.slice(0,10)}</td>
                              <td className="px-3 py-2 text-center">{r.nights}</td>
                              <td className="px-3 py-2">
                                <span className={`badge text-xs ${
                                  r.status === 'storniert' ? 'bg-red-100 text-red-700' :
                                  r.status === 'ausgecheckt' ? 'bg-gray-100 text-gray-600' :
                                  r.status === 'eingecheckt' ? 'bg-green-100 text-green-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>{r.status}</span>
                              </td>
                              <td className="px-3 py-2 font-medium text-right">{formatCurrency(r.net + r.commAmt)}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{r.commRate > 0 ? `${r.commRate}%` : <span className="text-gray-300">—</span>}</td>
                              <td className="px-3 py-2 text-right text-red-600">{r.commAmt > 0 ? formatCurrency(r.commAmt) : <span className="text-gray-300">—</span>}</td>
                              <td className="px-3 py-2 font-semibold text-right text-green-700">{formatCurrency(r.net)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t font-semibold">
                          <tr>
                            <td colSpan={9} className="px-3 py-3 text-gray-600">Gesamt ({rows.length} Buchungen)</td>
                            <td className="px-3 py-3 text-right">{formatCurrency(totalGross)}</td>
                            <td></td>
                            <td className="px-3 py-3 text-right text-red-600">{formatCurrency(totalComm)}</td>
                            <td className="px-3 py-3 text-right text-green-700">{formatCurrency(totalNet)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tab 6: Forecast */}
          {tab === 6 && (
            <div className="space-y-6">
              <div className="card">
                <SectionHeader title="Auslastungsvorschau — nächste 90 Tage" />
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={tabData.map(r => ({ ...r, monthLabel: r.month }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v, name) => name === 'Auslastung' ? `${v} %` : formatCurrency(v)} />
                    <Bar dataKey="occupancy_rate" fill="#f59e0b" radius={[4,4,0,0]} name="Auslastung" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Monat','Buchungen','Belegte Bett-Nächte','Verf. Bett-Nächte','Auslastung','Umsatz'].map(h => (
                      <th key={h} className="text-left text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tabData.map(r => (
                      <tr key={r.month} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{r.month}</td>
                        <td className="px-4 py-2">{r.bookings}</td>
                        <td className="px-4 py-2">{r.bed_nights_booked}</td>
                        <td className="px-4 py-2">{r.available_bed_nights}</td>
                        <td className="px-4 py-2"><span className={`badge ${r.occupancy_rate >= 70 ? 'bg-green-100 text-green-700' : r.occupancy_rate >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{formatPercent(r.occupancy_rate)}</span></td>
                        <td className="px-4 py-2 font-medium">{formatCurrency(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
