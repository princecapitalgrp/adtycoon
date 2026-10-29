import { useEffect, useMemo, useState } from 'react';
import { KEYWORDS, SEGMENTS } from '../../engine/data';
import type { Campaign, CampaignDay, Channel, GameState, SegmentId } from '../../engine/types';
import { uid, useGame } from '../../store/game';
import { AdCreative } from '../components/AdCreative';
import { eur, num, pct, ratio } from '../format';

type Range = 1 | 7 | 0;

export function aggregate(g: GameState, campaignId: string, range: Range): CampaignDay & { days: number } {
  const hist = range === 0 ? g.history : g.history.slice(-range);
  const out = { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, clickConversions: 0, revenue: 0, frequency: 0, days: 0, lostIsBudget: 0, qualityScore: 0 };
  for (const h of hist) {
    const c = h.campaigns[campaignId];
    if (!c) continue;
    out.days++;
    out.impressions += c.impressions; out.reach += c.reach; out.clicks += c.clicks; out.spend += c.spend;
    out.conversions += c.conversions; out.clickConversions += c.clickConversions; out.revenue += c.revenue;
    out.frequency = c.frequency; out.lostIsBudget += c.lostIsBudget ?? 0; out.qualityScore = c.qualityScore ?? out.qualityScore;
  }
  if (out.days) out.lostIsBudget /= out.days;
  return out;
}

export function AdsManager() {
  const { game, adsDraftCreativeId, upsertCampaign } = useGame();
  const g = game!;
  const [range, setRange] = useState<Range>(7);
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null);
  const mine = g.campaigns.filter((c) => c.brandId === 'nova');
  const adv = g.unlocks.advancedMetrics;

  useEffect(() => { if (adsDraftCreativeId) setEditing('new'); }, [adsDraftCreativeId]);

  const totals = useMemo(() => {
    const t = { spend: 0, conv: 0, rev: 0, clicks: 0, imps: 0 };
    for (const c of mine) { const a = aggregate(g, c.id, range); t.spend += a.spend; t.conv += a.conversions; t.rev += a.revenue; t.clicks += a.clicks; t.imps += a.impressions; }
    return t;
  }, [g, mine, range]);
  const budgetSum = mine.filter((c) => c.status === 'active').reduce((a, c) => a + c.dailyBudget, 0);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold flex-1">Ads Manager <span className="text-sm font-normal text-slate-500">Pulse social + Seekr search</span></h1>
        <div className="text-sm text-slate-600">Active budgets {eur(budgetSum)}/day · account limit <b>{eur(g.unlocks.spendLimit)}/day</b></div>
        <select className="input w-auto" value={range} onChange={(e) => setRange(Number(e.target.value) as Range)}>
          <option value={1}>Yesterday</option><option value={7}>Last 7 days</option><option value={0}>Lifetime</option>
        </select>
        <button className="btn-primary" onClick={() => setEditing('new')}>+ Create campaign</button>
      </div>
      {budgetSum > g.unlocks.spendLimit && <div className="rounded bg-amber-50 border border-amber-200 p-2 text-sm">Your budgets exceed the account spending limit, so delivery is scaled down proportionally. Hit milestones to raise the limit.</div>}

      {editing && <CampaignForm initial={editing === 'new' ? null : editing} draftCreativeId={adsDraftCreativeId} onClose={() => setEditing(null)} onSave={(c) => { upsertCampaign(c); setEditing(null); }} />}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-2 text-left">On</th><th className="p-2 text-left">Campaign</th><th className="p-2 text-right">Budget</th>
              <th className="p-2 text-right">Spend</th><th className="p-2 text-right">Impr.</th>
              {adv && <><th className="p-2 text-right">Reach</th><th className="p-2 text-right">Freq.</th><th className="p-2 text-right">CPM</th></>}
              <th className="p-2 text-right">Clicks</th><th className="p-2 text-right">CTR</th><th className="p-2 text-right">CPC</th>
              <th className="p-2 text-right" title="As reported by the ad platform (includes view-through for social)">Conv.*</th><th className="p-2 text-right">CPA</th>
              <th className="p-2 text-right">Revenue*</th><th className="p-2 text-right">ROAS*</th>
              {adv && <th className="p-2 text-right" title="Search: Quality Score / impression share lost to budget">QS / IS lost</th>}
            </tr>
          </thead>
          <tbody>
            {mine.length === 0 && <tr><td colSpan={20} className="p-6 text-center text-slate-500">No campaigns yet. Create one: pick a creative, an audience or keywords, and a budget.</td></tr>}
            {mine.map((c) => {
              const a = aggregate(g, c.id, range);
              const cr = g.creatives.find((x) => x.id === c.creativeId);
              const roas = ratio(a.revenue, a.spend);
              return (
                <tr key={c.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => setEditing(c)}>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={c.status === 'active'} onChange={() => upsertCampaign({ ...c, status: c.status === 'active' ? 'paused' : 'active' })} />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.channel === 'social' ? '💬 Pulse' : '🔎 Seekr'} · {cr?.name ?? 'missing creative'} · {c.channel === 'social' ? `${c.segments.length} audiences` : `${c.keywords.length} keywords · max CPC ${eur(c.maxCpc, 2)}`}</div>
                  </td>
                  <td className="p-2 text-right">{eur(c.dailyBudget)}</td>
                  <td className="p-2 text-right">{eur(a.spend, 2)}</td>
                  <td className="p-2 text-right">{num(a.impressions)}</td>
                  {adv && <><td className="p-2 text-right">{c.channel === 'social' ? num(a.reach) : '—'}</td><td className={`p-2 text-right ${a.frequency > 3.2 ? 'text-red-600 font-medium' : ''}`}>{c.channel === 'social' ? a.frequency.toFixed(1) : '—'}</td><td className="p-2 text-right">{eur(ratio(a.spend, a.impressions) * 1000, 2)}</td></>}
                  <td className="p-2 text-right">{num(a.clicks)}</td>
                  <td className="p-2 text-right">{pct(ratio(a.clicks, a.impressions), 2)}</td>
                  <td className="p-2 text-right">{eur(ratio(a.spend, a.clicks), 2)}</td>
                  <td className="p-2 text-right">{num(a.conversions)}</td>
                  <td className="p-2 text-right">{a.conversions ? eur(a.spend / a.conversions, 2) : '—'}</td>
                  <td className="p-2 text-right">{eur(a.revenue)}</td>
                  <td className={`p-2 text-right font-medium ${a.spend === 0 ? '' : roas >= 2 ? 'text-emerald-700' : roas < 1.3 ? 'text-red-600' : ''}`}>{a.spend ? `${roas.toFixed(2)}×` : '—'}</td>
                  {adv && <td className="p-2 text-right">{c.channel === 'search' ? `${a.qualityScore || '—'}/10 · ${pct(a.lostIsBudget ?? 0, 0)}` : '—'}</td>}
                </tr>
              );
            })}
          </tbody>
          {mine.length > 0 && (
            <tfoot className="border-t bg-slate-50 font-medium">
              <tr>
                <td /><td className="p-2">Total</td><td className="p-2 text-right">{eur(budgetSum)}</td><td className="p-2 text-right">{eur(totals.spend, 2)}</td><td className="p-2 text-right">{num(totals.imps)}</td>
                {adv && <><td /><td /><td /></>}
                <td className="p-2 text-right">{num(totals.clicks)}</td><td className="p-2 text-right">{pct(ratio(totals.clicks, totals.imps), 2)}</td><td className="p-2 text-right">{eur(ratio(totals.spend, totals.clicks), 2)}</td>
                <td className="p-2 text-right">{num(totals.conv)}</td><td className="p-2 text-right">{totals.conv ? eur(totals.spend / totals.conv, 2) : '—'}</td>
                <td className="p-2 text-right">{eur(totals.rev)}</td><td className="p-2 text-right">{totals.spend ? `${ratio(totals.rev, totals.spend).toFixed(2)}×` : '—'}</td>{adv && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-slate-500">* Platform-reported. Pulse counts view-through conversions (people who saw an ad and later bought anyway); Seekr takes credit for brand searches. Compare these with real store orders in Analytics.
        {!adv && ' Reach, frequency, CPM and Quality Score unlock with the “Profitable week” milestone.'}</p>
    </div>
  );
}

function CampaignForm({ initial, draftCreativeId, onClose, onSave }: { initial: Campaign | null; draftCreativeId: string | null; onClose: () => void; onSave: (c: Campaign) => void }) {
  const { game, openStudio, deleteCampaign } = useGame();
  const g = game!;
  const myCreatives = g.creatives.filter((c) => c.brandId === 'nova');
  const [c, setC] = useState<Campaign>(() => initial ?? {
    id: uid('cmp'), name: `Campaign ${g.campaigns.filter((x) => x.brandId === 'nova').length + 1}`, brandId: 'nova', channel: 'social', status: 'active',
    dailyBudget: Math.min(30, g.unlocks.spendLimit), creativeId: draftCreativeId ?? myCreatives.at(-1)?.id ?? '', segments: [], keywords: [], maxCpc: 1, createdDay: g.day,
  });
  const set = (p: Partial<Campaign>) => setC((x) => ({ ...x, ...p }));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const valid = c.creativeId && (c.channel === 'social' ? c.segments.length > 0 : c.keywords.length > 0) && c.dailyBudget > 0;

  const brandVolume = (b: string) => Math.round(SEGMENTS.reduce((a, s) => a + s.population * g.segments[s.id].awareness[b] * s.inMarket * s.searchUsage * 0.3, 0));
  const bidders = (kw: string) => g.campaigns.filter((x) => x.brandId !== 'nova' && x.channel === 'search' && x.keywords.includes(kw)).length;

  return (
    <div className="card p-4 shadow-lg border-blue-200">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-lg">{initial ? `Edit: ${initial.name}` : 'New campaign'}</h2>
        <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          {!initial && (
            <div className="grid grid-cols-2 gap-2">
              {(['social', 'search'] as Channel[]).map((ch) => (
                <button key={ch} onClick={() => set({ channel: ch })} className={`rounded-lg border p-3 text-left ${c.channel === ch ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                  <div className="font-semibold">{ch === 'social' ? '💬 Pulse social' : '🔎 Seekr search'}</div>
                  <div className="text-xs text-slate-500">{ch === 'social' ? 'Show image ads in feeds. Create demand; pay per 1,000 views.' : 'Text ads on searches. Capture demand; pay per click.'}</div>
                </button>
              ))}
            </div>
          )}
          <div><label className="label">Name</label><input className="input" value={c.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div>
            <label className="label">Creative</label>
            {myCreatives.length === 0 ? (
              <button className="btn-ghost" onClick={() => openStudio(null)}>Create one in Creative Studio →</button>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {myCreatives.map((cr) => {
                  const p = g.products.find((x) => x.id === cr.productId)!;
                  return (
                    <button key={cr.id} onClick={() => set({ creativeId: cr.id })} className={`shrink-0 rounded-lg border-2 p-1 ${c.creativeId === cr.id ? 'border-blue-600' : 'border-transparent'}`} title={cr.headline}>
                      <AdCreative creative={cr} product={p} brand={g.brands[0]} size={96} />
                      <div className="text-xs w-24 truncate">{cr.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
            {c.channel === 'search' && <div className="text-xs text-slate-500 mt-1">Search ads use the creative’s headline + body as text. Matching your keywords in the copy improves Quality Score.</div>}
          </div>
          <div>
            <label className="label">Daily budget: {eur(c.dailyBudget)}</label>
            <input type="range" min={5} max={Math.max(5, g.unlocks.spendLimit)} step={5} className="w-full" value={c.dailyBudget} onChange={(e) => set({ dailyBudget: Number(e.target.value) })} />
          </div>
          {c.channel === 'search' && (
            <div>
              <label className="label">Max cost per click</label>
              <input type="number" step={0.1} min={0.1} max={10} className="input w-28" value={c.maxCpc} onChange={(e) => set({ maxCpc: Math.max(0.1, Number(e.target.value) || 0.1) })} />
              <span className="text-xs text-slate-500 ml-2">Higher bids win better positions.</span>
            </div>
          )}
        </div>

        <div>
          {c.channel === 'social' ? (
            <>
              <label className="label">Audiences</label>
              <div className="space-y-1">
                {SEGMENTS.map((s) => (
                  <label key={s.id} className={`flex items-start gap-2 rounded border p-2 cursor-pointer ${c.segments.includes(s.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                    <input type="checkbox" className="mt-1" checked={c.segments.includes(s.id)} onChange={() => set({ segments: toggle(c.segments, s.id as SegmentId) })} />
                    <div className="flex-1"><div className="text-sm font-medium">{s.name} <span className="text-xs text-slate-400">~{num(s.population * s.socialUsage)} reachable</span></div><div className="text-xs text-slate-500">{s.blurb}</div></div>
                  </label>
                ))}
                {g.unlocks.retargeting ? (
                  <label className={`flex items-start gap-2 rounded border p-2 cursor-pointer ${c.segments.includes('retarget') ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                    <input type="checkbox" className="mt-1" checked={c.segments.includes('retarget')} onChange={() => set({ segments: toggle(c.segments, 'retarget') })} />
                    <div><div className="text-sm font-medium">🔁 Retargeting: recent site visitors <span className="text-xs text-slate-400">~{num(g.retargetPool)} people</span></div><div className="text-xs text-slate-500">Visited but didn’t buy (last ~2 weeks). Small, warm, saturates fast.</div></div>
                  </label>
                ) : <div className="text-xs text-slate-400 p-2">🔒 Retargeting unlocks at €1,000 revenue.</div>}
              </div>
            </>
          ) : (
            <>
              <label className="label">Keywords</label>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {KEYWORDS.filter((k) => k.kw !== 'hyaluronic moisturizer' || g.unlocks.product2).map((k) => {
                  const vol = k.brandId ? brandVolume(k.brandId) : k.volume;
                  const comp = bidders(k.kw);
                  return (
                    <label key={k.kw} className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer ${c.keywords.includes(k.kw) ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                      <input type="checkbox" checked={c.keywords.includes(k.kw)} onChange={() => set({ keywords: toggle(c.keywords, k.kw) })} />
                      <span className="flex-1 text-sm">{k.kw}{k.brandId === 'nova' && <span className="text-xs text-amber-700"> (your brand)</span>}{k.brandId && k.brandId !== 'nova' && <span className="text-xs text-slate-400"> (competitor brand)</span>}</span>
                      <span className="text-xs text-slate-500 w-20 text-right">~{num(vol)}/day</span>
                      <span className="text-xs w-20 text-right">{comp === 0 ? <span className="text-emerald-600">low comp.</span> : comp === 1 ? 'medium' : <span className="text-red-600">high comp.</span>}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t">
        <button className="btn-primary" disabled={!valid} onClick={() => onSave(c)}>{initial ? 'Save changes' : '🚀 Launch campaign'}</button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        {initial && <button className="btn-ghost text-red-600 ml-auto" onClick={() => { if (confirm('Delete this campaign? Its history stays in Analytics.')) { deleteCampaign(initial.id); onClose(); } }}>Delete</button>}
      </div>
    </div>
  );
}
