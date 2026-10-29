import { useEffect, useState } from 'react';
import { generateBackground } from '../../engine/adapters';
import { ANGLE_LABEL, OFFER_LABEL, copyChecks, detectAngles } from '../../engine/creative';
import { MOOD_LABEL, SEGMENT_BY_ID } from '../../engine/data';
import type { Creative, Cta, Layout, Mood, Offer } from '../../engine/types';
import { uid, useGame } from '../../store/game';
import { AdCreative } from '../components/AdCreative';

const LAYOUTS: { id: Layout; label: string; hint: string }[] = [
  { id: 'hero', label: 'Hero', hint: 'Big product, centered headline' },
  { id: 'split', label: 'Split', hint: 'Product left, story right' },
  { id: 'ugc', label: 'UGC', hint: 'Creator-style, native to feeds' },
  { id: 'minimal', label: 'Minimal', hint: 'Editorial, lots of space' },
];
const MOOD_SWATCH: Record<Mood, string> = { white: 'linear-gradient(135deg,#fff,#e2e8f0)', pastel: 'linear-gradient(135deg,#fde2e4,#e0e7ff)', bold: 'linear-gradient(135deg,#f97316,#db2777)', green: 'linear-gradient(135deg,#ecfdf5,#86efac)', dark: 'linear-gradient(135deg,#1c1917,#57534e)' };
const CTAS: Cta[] = ['Shop Now', 'Learn More', 'Get Offer', 'Discover'];

export function Studio() {
  const { game, studioCreativeId, openStudio, upsertCreative, deleteCreative, launchCreative, runPretest, pretest } = useGame();
  const g = game!;
  const mine = g.creatives.filter((c) => c.brandId === 'nova');
  const blank = (): Creative => ({ id: uid('cr'), name: `Ad ${mine.length + 1}`, brandId: 'nova', productId: 'nova-c', layout: 'hero', mood: 'white', headline: '', body: '', cta: 'Shop Now', offer: 'none', createdDay: g.day });
  const [draft, setDraft] = useState<Creative>(() => mine.find((c) => c.id === studioCreativeId) ?? mine.at(-1) ?? blank());
  const [msg, setMsg] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    const found = mine.find((c) => c.id === studioCreativeId);
    if (found) setDraft(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioCreativeId]);

  const saved = mine.find((c) => c.id === draft.id);
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(draft);
  const set = (p: Partial<Creative>) => setDraft((d) => ({ ...d, ...p }));
  const product = g.products.find((p) => p.id === draft.productId)!;
  const brand = g.brands[0];
  const checks = copyChecks(draft);
  const angles = detectAngles(`${draft.headline} ${draft.body}`, draft.offer);
  const inUse = g.campaigns.filter((c) => c.brandId === 'nova' && c.creativeId === draft.id);
  const pt = pretest[draft.id];
  const myProducts = g.products.filter((p) => p.brandId === 'nova');
  const valid = draft.headline.trim().length > 0;

  const save = () => { upsertCreative(draft); setMsg('Saved.'); };
  const variation = () => {
    const v = { ...draft, id: uid('cr'), name: `${draft.name} (B)`, createdDay: g.day };
    upsertCreative(v);
    openStudio(v.id);
    setDraft(v);
    setMsg('Variation created. Change one thing at a time to learn what works.');
  };

  return (
    <div className="grid lg:grid-cols-[200px_1fr_380px] gap-4 p-4 max-w-7xl mx-auto">
      <aside className="space-y-2">
        <button className="btn-primary w-full" onClick={() => { const b = blank(); setDraft(b); openStudio(null); }}>+ New creative</button>
        {mine.map((c) => {
          const p = g.products.find((x) => x.id === c.productId)!;
          return (
            <button key={c.id} onClick={() => { setDraft(c); openStudio(c.id); }} className={`flex w-full items-center gap-2 rounded-lg border p-1.5 text-left ${draft.id === c.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
              <AdCreative creative={c} product={p} brand={brand} size={48} />
              <div className="min-w-0"><div className="text-sm font-medium truncate">{c.name}</div><div className="text-xs text-slate-500 truncate">{c.headline || '—'}</div></div>
            </button>
          );
        })}
      </aside>

      <main className="min-w-0 space-y-3">
        <div className="card p-4 flex justify-center bg-slate-100">
          <div className="w-full max-w-[420px]"><AdCreative creative={draft} product={product} brand={brand} size="100%" /></div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-semibold uppercase text-slate-500 mb-1">As a Seekr search ad</div>
          <div className="text-xs"><b>Sponsored</b> · {brand.domain}</div>
          <div className="text-blue-800 text-lg">{draft.headline || 'Your headline'}</div>
          <div className="text-sm text-slate-600">{draft.body || 'Your ad copy'}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Message check</div>
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="text-sm text-slate-600 mr-1">Detected angles:</span>
            {angles.length ? angles.map((a) => <span key={a} className="rounded-full bg-violet-100 text-violet-800 px-2 py-0.5 text-xs">{ANGLE_LABEL[a]}</span>) : <span className="text-xs text-slate-400">none</span>}
          </div>
          <ul className="space-y-1 text-sm">
            {checks.issues.map((i) => <li key={i.text} className={i.level === 'warn' ? 'text-amber-700' : 'text-emerald-700'}>{i.level === 'warn' ? '⚠️' : '✓'} {i.text}</li>)}
          </ul>
          <p className="text-xs text-slate-500 mt-2">How well this ad works depends on <b>who sees it</b>. The same ad can win with one audience and flop with another. Launch it, or pre-test it.</p>
        </div>
      </main>

      <aside className="space-y-3">
        <div className="card p-4 space-y-3">
          <div><label className="label">Name</label><input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></div>
          {myProducts.length > 1 && (
            <div><label className="label">Product</label>
              <select className="input" value={draft.productId} onChange={(e) => set({ productId: e.target.value })}>{myProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </div>
          )}
          <div>
            <label className="label">Layout</label>
            <div className="grid grid-cols-4 gap-1">
              {LAYOUTS.map((l) => <button key={l.id} title={l.hint} onClick={() => set({ layout: l.id })} className={`btn text-xs ${draft.layout === l.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300'}`}>{l.label}</button>)}
            </div>
          </div>
          <div>
            <label className="label">Background</label>
            <div className="flex gap-2">
              {(Object.keys(MOOD_SWATCH) as Mood[]).map((m) => (
                <button key={m} title={MOOD_LABEL[m]} onClick={() => set({ mood: m, bgImage: undefined })} className={`w-9 h-9 rounded-full border-2 ${draft.mood === m ? 'border-blue-600 scale-110' : 'border-slate-200'}`} style={{ background: MOOD_SWATCH[m] }} />
              ))}
            </div>
            <div className="text-xs text-slate-500 mt-1">{MOOD_LABEL[draft.mood]}</div>
            {g.settings.imageApiUrl && (
              <button className="btn-ghost text-xs mt-2" disabled={aiBusy} onClick={async () => {
                setAiBusy(true);
                try { set({ bgImage: await generateBackground(g.settings, `Soft ${MOOD_LABEL[draft.mood]} skincare product photography background, no text, ${draft.headline}`) }); setMsg('AI background applied.'); }
                catch (e) { setMsg(`AI background failed: ${(e as Error).message}`); }
                setAiBusy(false);
              }}>{aiBusy ? 'Generating…' : '✨ Generate AI background'}</button>
            )}
          </div>
          <div>
            <label className="label">Headline <span className={draft.headline.length > 40 ? 'text-red-600' : ''}>{draft.headline.length}/40</span></label>
            <input className="input" value={draft.headline} placeholder="e.g. Brighter skin in 4 weeks" onChange={(e) => set({ headline: e.target.value })} />
          </div>
          <div>
            <label className="label">Ad copy <span className={draft.body.length > 140 ? 'text-red-600' : ''}>{draft.body.length}/140</span></label>
            <textarea className="input h-20" value={draft.body} placeholder="What’s in it, who it’s for, why trust it" onChange={(e) => set({ body: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Call to action</label><select className="input" value={draft.cta} onChange={(e) => set({ cta: e.target.value as Cta })}>{CTAS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Offer</label><select className="input" value={draft.offer} onChange={(e) => set({ offer: e.target.value as Offer })}>{(Object.keys(OFFER_LABEL) as Offer[]).map((o) => <option key={o} value={o}>{OFFER_LABEL[o]}</option>)}</select></div>
          </div>
          {draft.offer !== 'none' && <div className="text-xs text-slate-500">Offers are honored: people who buy through this ad get the {OFFER_LABEL[draft.offer].toLowerCase()}, which cuts your margin.</div>}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <button className="btn-primary" disabled={!valid || !dirty} onClick={save}>{saved ? 'Save' : 'Save creative'}</button>
            <button className="btn-ghost" disabled={!saved} onClick={variation}>Duplicate as variation</button>
            <button className="btn-ghost" disabled={!saved || dirty} onClick={() => launchCreative(draft.id)}>🚀 Use in campaign</button>
            {saved && <button className="btn-ghost text-red-600" onClick={() => { const err = deleteCreative(draft.id); if (err) setMsg(err); else { setDraft(blank()); openStudio(null); } }}>Delete</button>}
          </div>
          {inUse.length > 0 && <div className="text-xs text-amber-700">Used by {inUse.map((c) => c.name).join(', ')}. Saved edits go live there. Fatigue is tracked per creative, so a fresh variation starts with a clean slate.</div>}
          {msg && <div className="text-xs text-blue-700">{msg}</div>}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Audience pre-test</div>
            <button className="btn-ghost text-xs" disabled={!saved || dirty || g.cash < 100} onClick={() => runPretest(draft.id)}>Run panel · €100</button>
          </div>
          <p className="text-xs text-slate-500 mt-1">A small survey panel rates the saved creative. It’s directional, not exact: real campaigns are the ground truth.</p>
          {pt && (
            <div className="mt-2 space-y-1.5">
              {pt.error && <div className="text-xs text-amber-700">{pt.error}</div>}
              {pt.rows.map((r) => (
                <div key={r.segment} className="text-xs">
                  <div className="flex justify-between"><span>{SEGMENT_BY_ID[r.segment].name}</span><span className="text-slate-500">{r.note}</span></div>
                  <div className="h-2 bg-slate-100 rounded"><div className={`h-2 rounded ${r.resonance > 60 ? 'bg-emerald-500' : r.resonance > 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${r.resonance}%` }} /></div>
                </div>
              ))}
              <div className="text-[10px] text-slate-400">Source: {pt.source}</div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
