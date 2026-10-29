import { useMemo, useState } from 'react';
import { trendIntensity } from '../../engine/creative';
import { ARTICLES, bestOfList, search, suggestedQueries } from '../../engine/search';
import { useGame, type SiteRoute } from '../../store/game';
import { ProductImage } from '../components/Bottle';
import { ProductPage } from '../components/ProductPage';
import { eur } from '../format';

export function SearchTab() {
  const { search: st, runSearch, backSite } = useGame();
  return (
    <div>
      <SearchBar initial={st.query} onSearch={runSearch} compact={!!st.query || !!st.site} />
      {st.site ? (
        <div>
          <div className="px-4 py-2 border-b bg-white"><button className="text-sm text-blue-700 hover:underline" onClick={backSite}>← Back</button></div>
          <Site route={st.site} />
        </div>
      ) : st.query ? <Results q={st.query} /> : null}
    </div>
  );
}

function SearchBar({ initial, onSearch, compact }: { initial: string; onSearch: (q: string) => void; compact: boolean }) {
  const { game } = useGame();
  const [q, setQ] = useState(initial);
  const sugg = suggestedQueries(game!);
  return (
    <div className={compact ? 'bg-white border-b px-4 py-3 flex items-center gap-4' : 'flex flex-col items-center pt-16 pb-8 px-4'}>
      <div className={`font-black tracking-tight ${compact ? 'text-xl' : 'text-5xl mb-6'}`}><span className="text-blue-600">See</span><span className="text-amber-500">kr</span></div>
      <form className={`flex gap-2 ${compact ? 'flex-1 max-w-2xl' : 'w-full max-w-xl'}`} onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); }}>
        <input className="input rounded-full px-4 py-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, brands, trends, marketing topics…" />
        <button className="btn-primary rounded-full">Search</button>
      </form>
      {!compact && (
        <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-xl">
          {sugg.map((s) => <button key={s} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100" onClick={() => { setQ(s); onSearch(s); }}>{s}</button>)}
        </div>
      )}
    </div>
  );
}

function Results({ q }: { q: string }) {
  const { game, openSite } = useGame();
  const g = game!;
  const r = useMemo(() => search(g, q), [g, q]);
  const empty = !r.ads.length && !r.shopping.length && !r.organic.length;
  return (
    <div className="max-w-3xl px-4 py-4 space-y-5">
      {empty && <div className="text-slate-500">No results for “{q}”. Try “vitamin c serum”, a brand name, or a marketing topic like “roas”.</div>}
      {r.ads.map((a) => (
        <div key={a.campaignId} className={a.isPlayer ? 'rounded-lg ring-2 ring-amber-300 p-2 -m-2' : ''}>
          <div className="text-xs"><b>Sponsored</b> · {a.url}{a.isPlayer && <span className="ml-2 text-amber-700">(your ad — previews don’t cost you anything)</span>}</div>
          <button className="text-lg text-blue-800 hover:underline text-left" onClick={() => openSite({ type: 'product', productId: a.creative.productId })}>{a.creative.headline}</button>
          <div className="text-sm text-slate-600">{a.creative.body}</div>
        </div>
      ))}
      {r.shopping.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Shopping</div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {r.shopping.map((s) => (
              <button key={s.product.id} className="card w-40 shrink-0 text-left p-2 hover:shadow" onClick={() => openSite({ type: 'product', productId: s.product.id })}>
                <ProductImage color={s.product.color} brand={s.product.name.split(' ')[0].toUpperCase()} label={s.product.short} size={140} jar={s.product.id === 'nova-h'} />
                <div className="text-xs mt-1 line-clamp-2">{s.product.name}</div>
                <div className="font-semibold text-sm">{eur(s.price, 2)} {s.price < s.listPrice - 0.01 && <span className="text-xs text-red-600">sale</span>}</div>
                <div className="text-xs text-slate-500">{s.rating.count ? `★ ${s.rating.avg.toFixed(1)} (${s.rating.count})` : 'No reviews'} · {s.domain}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {r.organic.map((o, i) => (
        <div key={i}>
          <div className="text-xs text-slate-500">{o.url}</div>
          <button className="text-lg text-blue-800 hover:underline text-left" onClick={() => openSite(o.target as SiteRoute)}>{o.title}</button>
          <div className="text-sm text-slate-600">{o.rating && o.rating.count > 0 && <span className="text-amber-600">★ {o.rating.avg.toFixed(1)} ({o.rating.count}) · </span>}{o.snippet}</div>
        </div>
      ))}
    </div>
  );
}

function Site({ route }: { route: SiteRoute }) {
  const { game, openSite } = useGame();
  const g = game!;
  if (route.type === 'product') return <ProductPage productId={route.productId} />;
  if (route.type === 'site') {
    const b = g.brands.find((x) => x.id === route.brandId)!;
    const prods = g.products.filter((p) => p.brandId === b.id && (b.id !== 'nova' || p.id === 'nova-c' || g.unlocks.product2));
    return (
      <div className="bg-white min-h-full">
        <div className="px-6 py-10 text-center" style={{ background: `${b.color}22` }}>
          <div className="text-3xl font-black tracking-wider" style={{ color: b.color }}>{b.name.toUpperCase()}</div>
          <div className="text-slate-600 mt-1">{b.tagline}</div>
        </div>
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {prods.map((p) => (
            <button key={p.id} className="card p-3 text-left hover:shadow" onClick={() => openSite({ type: 'product', productId: p.id })}>
              <ProductImage color={p.color} brand={b.name.split(' ')[0].toUpperCase()} label={p.short} size={160} jar={p.id === 'nova-h'} />
              <div className="font-medium mt-1">{p.name}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (route.type === 'article') {
    const a = ARTICLES.find((x) => x.id === route.articleId)!;
    return (
      <article className="max-w-2xl mx-auto p-6 bg-white min-h-full">
        <div className="text-xs text-slate-500">{a.source}</div>
        <h1 className="text-2xl font-bold mt-1">{a.title}</h1>
        {a.body.map((p) => <p key={p} className="mt-3 text-slate-700 leading-relaxed">{p}</p>)}
      </article>
    );
  }
  if (route.type === 'bestof') {
    const list = bestOfList(g);
    return (
      <article className="max-w-2xl mx-auto p-6 bg-white min-h-full">
        <div className="text-xs text-slate-500">beautyreviewer.net · updated day {g.day}</div>
        <h1 className="text-2xl font-bold mt-1">The best vitamin C serums of 2026</h1>
        <p className="text-sm text-slate-600 mt-2">Ranked by customer reviews, popularity and formulation. Brands can’t pay for placement.</p>
        <ol className="mt-4 space-y-3">
          {list.map((x, i) => (
            <li key={x.p.id} className="card p-3 flex items-center gap-3">
              <div className="text-2xl font-black text-slate-300 w-8">{i + 1}</div>
              <ProductImage color={x.p.color} brand={x.p.name.split(' ')[0].toUpperCase()} label={x.p.short} size={64} />
              <div className="flex-1">
                <button className="font-semibold text-blue-800 hover:underline" onClick={() => openSite({ type: 'product', productId: x.p.id })}>{x.p.name}</button>
                <div className="text-sm text-slate-500">{eur(x.price, 2)} · {x.rating.count ? `★ ${x.rating.avg.toFixed(1)} from ${x.rating.count} reviews` : 'Too new to rate'}</div>
              </div>
            </li>
          ))}
        </ol>
      </article>
    );
  }
  const t = g.trends.find((x) => x.tag === route.tag);
  const k = t ? trendIntensity(t, g.day) : 0;
  return (
    <article className="max-w-2xl mx-auto p-6 bg-white min-h-full">
      <div className="text-xs text-slate-500">trendwatch.social</div>
      <h1 className="text-2xl font-bold mt-1">{route.tag}</h1>
      {t && <p className="mt-3 text-slate-700">{t.blurb}</p>}
      <p className="mt-3 text-slate-700">{k > 0.6 ? 'This trend is near its peak right now.' : k > 0 ? (g.day <= (t?.peakDay ?? 0) ? 'Still growing — early movers get the most attention.' : 'Past its peak and cooling off.') : 'This trend has faded.'}</p>
      {t && <p className="mt-3 text-sm text-slate-500">Brands riding this trend lean into the <b>{t.angle === 'antiaging' ? 'anti-aging' : t.angle}</b> message{t.mood ? ` and a ${t.mood} visual style` : ''}.</p>}
    </article>
  );
}
