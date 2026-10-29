import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SEGMENT_BY_ID } from '../../engine/data';
import type { DayRecord, TrafficSource } from '../../engine/types';
import { useGame } from '../../store/game';
import { eur, num, pct, ratio } from '../format';

// Reference categorical palette (dataviz skill), assigned in fixed order.
const C = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
const SRC_LABEL: Record<TrafficSource, string> = { paid_social: 'Paid social', paid_search: 'Paid search', organic_search: 'Organic search', organic_social: 'Organic social', direct: 'Direct / (none)', returning: 'Returning / email' };
const SOURCES = Object.keys(SRC_LABEL) as TrafficSource[];
const axis = { fontSize: 11, fill: '#52514e' };
const grid = <CartesianGrid stroke="#e5e7eb" strokeDasharray="0" vertical={false} />;
const tip = { contentStyle: { fontSize: 12, borderRadius: 8 }, formatter: (v: number) => (Number.isInteger(v) ? num(v) : v.toFixed(2)) };

export default function Analytics() {
  const { game } = useGame();
  const g = game!;
  const [range, setRange] = useState<7 | 30 | 0>(30);
  const h = useMemo(() => (range ? g.history.slice(-range) : g.history), [g.history, range]);

  if (g.history.length === 0) {
    return <div className="p-8 max-w-xl mx-auto text-slate-600"><h1 className="text-xl font-bold mb-2">Analytics</h1>No data yet. Launch a campaign and advance a day: every visit, order and euro will show up here.</div>;
  }

  const sum = (f: (d: DayRecord) => number) => h.reduce((a, d) => a + f(d), 0);
  const revenue = sum((d) => d.revenue), spend = sum((d) => d.adSpend), profit = sum((d) => d.profit), orders = sum((d) => d.orders);
  const sessions = sum((d) => SOURCES.reduce((a, s) => a + d.sessions[s], 0));
  const newCust = sum((d) => d.newCustomers), repeat = sum((d) => d.repeatOrders);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold flex-1">Reports</h1>
        <div className="flex rounded-md border border-slate-300 overflow-hidden text-sm">
          {([7, 30, 0] as const).map((r) => <button key={r} className={`px-3 py-1 ${range === r ? 'bg-blue-600 text-white' : 'bg-white'}`} onClick={() => setRange(r)}>{r ? `Last ${r} days` : 'All time'}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Revenue" value={eur(revenue)} />
        <Kpi label="Profit" value={eur(profit)} tone={profit >= 0 ? 'good' : 'bad'} sub="after ads, product, shipping, fees, overhead" />
        <Kpi label="Ad spend" value={eur(spend)} />
        <Kpi label="Blended ROAS (MER)" value={spend ? `${ratio(revenue, spend).toFixed(2)}×` : '—'} sub="all revenue ÷ all ad spend" />
        <Kpi label="Orders" value={num(orders)} sub={`${num(newCust)} new · ${num(repeat)} repeat`} />
        <Kpi label="Conversion rate" value={pct(ratio(orders, sessions), 2)} sub={`${num(sessions)} sessions`} />
        <Kpi label="Customer acquisition cost" value={newCust ? eur(spend / newCust, 2) : '—'} sub="ad spend ÷ new customers" />
        <Kpi label="Satisfaction · reviews" value={`${Math.round(g.satisfaction * 100)}%`} sub={g.reviews.length ? `★ ${(g.reviews.reduce((a, r) => a + r.rating, 0) / g.reviews.length).toFixed(1)} from ${g.reviews.length} reviews` : 'no reviews yet'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Revenue, ad spend and profit per day (€)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={h} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {grid}<XAxis dataKey="day" tick={axis} /><YAxis tick={axis} width={48} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Line isAnimationActive={false} dataKey="revenue" name="Revenue" stroke={C[0]} strokeWidth={2} dot={false} />
              <Line isAnimationActive={false} dataKey="adSpend" name="Ad spend" stroke={C[1]} strokeWidth={2} dot={false} />
              <Line isAnimationActive={false} dataKey="profit" name="Profit" stroke={C[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Sessions by traffic source (store data)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={h.map((d) => ({ day: d.day, ...d.sessions }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {grid}<XAxis dataKey="day" tick={axis} /><YAxis tick={axis} width={40} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
              {SOURCES.map((s, i) => <Area isAnimationActive={false} key={s} dataKey={s} name={SRC_LABEL[s]} stackId="1" stroke="#fff" strokeWidth={1} fill={C[i]} fillOpacity={0.9} />)}
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <AttributionPanel h={h} />
      <ChannelTable h={h} />
      <CampaignDrilldown h={h} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Orders by audience segment">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Object.entries(h.reduce<Record<string, number>>((a, d) => { for (const [k, v] of Object.entries(d.ordersBySegment)) a[k] = (a[k] ?? 0) + (v ?? 0); return a; }, {})).map(([k, v]) => ({ seg: k === 'retarget' ? 'Retargeting' : SEGMENT_BY_ID[k as keyof typeof SEGMENT_BY_ID].name, orders: v }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {grid}<XAxis dataKey="seg" tick={{ ...axis, fontSize: 10 }} interval={0} /><YAxis tick={axis} width={36} /><Tooltip {...tip} />
              <Bar isAnimationActive={false} dataKey="orders" name="Orders" fill={C[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500">Organic, direct and returning orders are counted in the segment of the visitor, not the ad.</p>
        </Panel>
        <Panel title="Brand health: NOVA awareness (% of market)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={h.map((d) => ({ day: d.day, awareness: +(d.awareness * 100).toFixed(2) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {grid}<XAxis dataKey="day" tick={axis} /><YAxis tick={axis} width={36} unit="%" /><Tooltip {...tip} />
              <Line isAnimationActive={false} dataKey="awareness" name="Awareness %" stroke={C[0]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <ShareBar d={h.at(-1)!} sentiment={h.at(-1)!.sentiment} />
        </Panel>
      </div>
    </div>
  );
}

function AttributionPanel({ h }: { h: DayRecord[] }) {
  const store = h.reduce((a, d) => a + d.orders, 0);
  const truePaid = h.reduce((a, d) => a + d.ordersBySource.paid_social + d.ordersBySource.paid_search, 0);
  const pulse = h.reduce((a, d) => a + d.platformReported.social, 0);
  const seekr = h.reduce((a, d) => a + d.platformReported.search, 0);
  const ga = h.reduce((a, d) => a + d.ga4Orders.paid_social + d.ga4Orders.paid_search, 0);
  const rows: [string, number, string][] = [
    ['Store orders (all channels, ground truth)', store, 'Every order your shop actually received.'],
    ['Orders from ad clicks (store backend)', truePaid, 'Orders that truly came through an ad click.'],
    ['Pulse + Seekr report', pulse + seekr, 'Platforms add view-through and brand-search credit, so they claim more than they drove.'],
    ['Analytics (paid channels)', ga, 'Visitors who decline cookies show up as “direct”, so analytics under-counts paid.'],
  ];
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <Panel title="Who gets credit? Same sales, four answers">
      <div className="space-y-2">
        {rows.map(([k, v, note], i) => (
          <div key={k}>
            <div className="flex justify-between text-sm"><span>{k}</span><b>{num(v)}</b></div>
            <div className="h-2.5 bg-slate-100 rounded"><div className="h-2.5 rounded" style={{ width: `${(v / max) * 100}%`, background: C[i] }} /></div>
            <div className="text-xs text-slate-500">{note}</div>
          </div>
        ))}
      </div>
      {pulse + seekr > store && <div className="mt-2 text-xs rounded bg-amber-50 p-2">The platforms claim <b>{num(pulse + seekr)}</b> conversions, but you only sold <b>{num(store)}</b> orders in total. Judge spend by total profit, not platform ROAS.</div>}
    </Panel>
  );
}

function ChannelTable({ h }: { h: DayRecord[] }) {
  const [view, setView] = useState<'store' | 'ga4'>('ga4');
  const sessionsKey = view === 'ga4' ? 'ga4Sessions' : 'sessions';
  const ordersKey = view === 'ga4' ? 'ga4Orders' : 'ordersBySource';
  const spendBy = { paid_social: 0, paid_search: 0 } as Record<string, number>;
  const g = useGame.getState().game!;
  for (const d of h) for (const [id, c] of Object.entries(d.campaigns)) {
    const ch = g.campaigns.find((x) => x.id === id)?.channel ?? (c.lostIsBudget !== undefined ? 'search' : 'social');
    spendBy[ch === 'social' ? 'paid_social' : 'paid_search'] += c.spend;
  }
  const aov = h.reduce((a, d) => a + d.revenue, 0) / Math.max(1, h.reduce((a, d) => a + d.orders, 0));
  return (
    <Panel title="Traffic acquisition by channel" right={
      <select className="input w-auto text-xs" value={view} onChange={(e) => setView(e.target.value as 'store' | 'ga4')}>
        <option value="ga4">Analytics view (cookie-consent limited)</option>
        <option value="store">Store backend (complete)</option>
      </select>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="text-left py-1">Channel</th><th className="text-right">Sessions</th><th className="text-right">Orders</th><th className="text-right">Conv. rate</th><th className="text-right">Revenue (est.)</th><th className="text-right">Spend</th><th className="text-right">ROAS</th></tr></thead>
          <tbody>
            {SOURCES.map((s, i) => {
              const ses = h.reduce((a, d) => a + d[sessionsKey][s], 0);
              const ord = h.reduce((a, d) => a + d[ordersKey][s], 0);
              const sp = spendBy[s] ?? 0;
              return (
                <tr key={s} className="border-t">
                  <td className="py-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm mr-2" style={{ background: C[i] }} />{SRC_LABEL[s]}</td>
                  <td className="text-right">{num(ses)}</td><td className="text-right">{num(ord)}</td><td className="text-right">{pct(ratio(ord, ses), 2)}</td>
                  <td className="text-right">{eur(ord * aov)}</td><td className="text-right">{sp ? eur(sp) : '—'}</td><td className="text-right">{sp ? `${ratio(ord * aov, sp).toFixed(2)}×` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-1">Switch views to see how much paid traffic hides inside “Direct” when visitors decline cookies.</p>
    </Panel>
  );
}

function CampaignDrilldown({ h }: { h: DayRecord[] }) {
  const g = useGame.getState().game!;
  const ids = [...new Set(h.flatMap((d) => Object.keys(d.campaigns)))];
  const [id, setId] = useState(ids[0] ?? '');
  const [metric, setMetric] = useState<'spend' | 'clicks' | 'ctr' | 'cpc' | 'conversions' | 'roas' | 'frequency'>('conversions');
  if (!ids.length) return null;
  const sel = ids.includes(id) ? id : ids[0];
  const name = (cid: string) => g.campaigns.find((c) => c.id === cid)?.name ?? `${cid} (deleted)`;
  const data = h.map((d) => {
    const c = d.campaigns[sel];
    const v = !c ? 0 : metric === 'ctr' ? +(ratio(c.clicks, c.impressions) * 100).toFixed(2) : metric === 'cpc' ? +ratio(c.spend, c.clicks).toFixed(2) : metric === 'roas' ? +ratio(c.revenue, c.spend).toFixed(2) : metric === 'frequency' ? +c.frequency.toFixed(2) : +c[metric].toFixed(2);
    return { day: d.day, v };
  });
  const labels = { spend: 'Spend (€)', clicks: 'Clicks', ctr: 'CTR (%)', cpc: 'CPC (€)', conversions: 'Conversions (platform)', roas: 'ROAS (platform)', frequency: 'Frequency (7-day)' };
  return (
    <Panel title="Campaign performance over time" right={
      <div className="flex gap-2">
        <select className="input w-auto text-xs" value={sel} onChange={(e) => setId(e.target.value)}>{ids.map((i) => <option key={i} value={i}>{name(i)}</option>)}</select>
        <select className="input w-auto text-xs" value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>{Object.entries(labels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {grid}<XAxis dataKey="day" tick={axis} /><YAxis tick={axis} width={44} /><Tooltip {...tip} />
          <Line isAnimationActive={false} dataKey="v" name={labels[metric]} stroke={C[0]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function ShareBar({ d, sentiment }: { d: DayRecord; sentiment: number }) {
  const g = useGame.getState().game!;
  const order = ['nova', 'lumiere', 'glowgo', 'verde'];
  return (
    <div className="mt-2">
      <div className="text-xs text-slate-500 mb-1">Share of category orders (latest day) · NOVA sentiment {sentiment >= 0 ? '+' : ''}{sentiment.toFixed(2)}</div>
      <div className="flex h-4 rounded overflow-hidden gap-[2px] bg-white">
        {order.map((b, i) => <div key={b} title={`${b}: ${pct(d.competitorShare[b] ?? 0)}`} style={{ width: `${(d.competitorShare[b] ?? 0) * 100}%`, background: C[i] }} />)}
      </div>
      <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-600">
        {order.map((b, i) => <span key={b}><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: C[i] }} />{g.brands.find((x) => x.id === b)!.name} {pct(d.competitorShare[b] ?? 0, 0)}</span>)}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-2 gap-2"><h2 className="font-semibold text-sm">{title}</h2>{right}</div>
      {children}
    </section>
  );
}
