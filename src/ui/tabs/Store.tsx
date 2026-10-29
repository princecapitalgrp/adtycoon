import { useState } from 'react';
import { storeAngles, storeUxFactors } from '../../engine/conversion';
import { ANGLE_LABEL } from '../../engine/creative';
import { PAYMENT_FEE, RESTOCK_LEAD_DAYS, SHIPPING_COST, SHIPPING_FEE } from '../../engine/data';
import { brandRating } from '../../engine/sim';
import type { DescStyle } from '../../engine/types';
import { useGame } from '../../store/game';
import { ProductPage } from '../components/ProductPage';
import { eur } from '../format';

export function StoreTab() {
  const { game, updateStore, orderStock } = useGame();
  const g = game!;
  const s = g.store;
  const [msg, setMsg] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState('nova-c');
  const rating = brandRating(g, 'nova');
  const factors = storeUxFactors(s, rating.count, rating.avg);
  const ux = factors.reduce((m, f) => m * f.mult, 1);
  const myProducts = g.products.filter((p) => p.brandId === 'nova');

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-4 p-4 max-w-7xl mx-auto">
      <div className="space-y-4">
        <Section title="Product page">
          <label className="label">Page headline</label>
          <input className="input" value={s.headline} onChange={(e) => updateStore({ headline: e.target.value })} />
          <div className="text-xs text-slate-500 mt-1">
            Message angles on page: {storeAngles(s).length ? storeAngles(s).map((a) => ANGLE_LABEL[a]).join(', ') : <i>none detected</i>}. Ads that promise the same thing convert better.
          </div>
          <label className="label mt-3">Description style</label>
          <div className="grid grid-cols-3 gap-1">
            {(['short', 'detailed', 'story'] as DescStyle[]).map((d) => (
              <button key={d} className={`btn ${s.descStyle === d ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300'}`} onClick={() => updateStore({ descStyle: d })}>
                {d === 'short' ? 'Short' : d === 'detailed' ? 'Ingredients' : 'Brand story'}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Pricing">
          {myProducts.map((p) => (
            <div key={p.id} className="flex items-center gap-2 mb-2">
              <span className="flex-1 text-sm">{p.short}</span>
              <span className="text-slate-500">€</span>
              <input type="number" min={5} max={150} className="input w-24" value={s.prices[p.id]} onChange={(e) => updateStore({ prices: { [p.id]: Math.max(5, Math.min(150, Number(e.target.value) || 0)) } })} />
            </div>
          ))}
          <label className="label mt-2">Sitewide discount: {s.discountPct}%</label>
          <input type="range" min={0} max={40} step={5} className="w-full" value={s.discountPct} onChange={(e) => updateStore({ discountPct: Number(e.target.value) })} />
        </Section>

        <Section title="Checkout & trust">
          <Toggle label="Show customer reviews" on={s.showReviews} set={(v) => updateStore({ showReviews: v })} />
          <Toggle label="Trust badges (secure payment, returns)" on={s.trustBadges} set={(v) => updateStore({ trustBadges: v })} />
          <Toggle label={`Free shipping (you pay €${SHIPPING_COST.toFixed(2)}/order either way)`} on={s.freeShipping} set={(v) => updateStore({ freeShipping: v })} />
          <label className="label mt-2">Checkout steps</label>
          <div className="grid grid-cols-3 gap-1">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} className={`btn ${s.checkoutSteps === n ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300'}`} onClick={() => updateStore({ checkoutSteps: n })}>{n} step{n > 1 ? 's' : ''}</button>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-1">Upgrading checkout is free in this version. In real stores it costs development time.</div>
        </Section>

        <Section title="Conversion health">
          {factors.map((f) => (
            <div key={f.label} className="flex justify-between text-sm py-0.5">
              <span>{f.label}</span>
              <span className={f.mult > 1.001 ? 'text-emerald-700' : f.mult < 0.999 ? 'text-red-600' : 'text-slate-400'}>{f.mult > 1.001 ? '+' : ''}{((f.mult - 1) * 100).toFixed(0)}%</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold border-t mt-1 pt-1"><span>Store UX multiplier</span><span>×{ux.toFixed(2)}</span></div>
          <div className="text-xs text-slate-500 mt-1">Price perception, message match and audience fit also change conversion. Those show up in results and comments.</div>
        </Section>

        <Section title="Inventory">
          {myProducts.map((p) => {
            const inc = g.incoming.filter((i) => i.productId === p.id);
            return (
              <div key={p.id} className="mb-3">
                <div className="flex justify-between text-sm"><span className="font-medium">{p.short}</span><span>{g.inventory[p.id] ?? 0} in stock</span></div>
                {inc.map((i, k) => <div key={k} className="text-xs text-slate-500">+{i.qty} arriving day {i.arrives}</div>)}
                <div className="flex gap-1 mt-1">
                  {[100, 250, 500].map((q) => {
                    const cost = Math.round(q * p.unitCost * (q >= 500 ? 0.85 : q >= 250 ? 0.92 : 1));
                    return <button key={q} className="btn-ghost text-xs flex-1" onClick={() => setMsg(orderStock(p.id, q) ?? `Ordered ${q} units.`)}>+{q} · {eur(cost)}</button>;
                  })}
                </div>
              </div>
            );
          })}
          <div className="text-xs text-slate-500">Lead time {RESTOCK_LEAD_DAYS} days. Bulk orders get 8–15% off. Running out loses sales and annoys customers.</div>
          {msg && <div className="text-xs mt-1 text-blue-700">{msg}</div>}
        </Section>

        <UnitEconomics />
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-slate-500">Live preview · novaskin.shop</div>
          {myProducts.length > 1 && (
            <select className="input w-auto" value={previewId} onChange={(e) => setPreviewId(e.target.value)}>
              {myProducts.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
            </select>
          )}
        </div>
        <div className="card overflow-hidden"><ProductPage productId={previewId} preview /></div>
      </div>
    </div>
  );
}

function UnitEconomics() {
  const { game } = useGame();
  const g = game!;
  const p = g.products.find((x) => x.id === 'nova-c')!;
  const price = g.store.prices[p.id] * (1 - g.store.discountPct / 100);
  const shipIn = g.store.freeShipping ? 0 : SHIPPING_FEE;
  const fees = (price + shipIn) * PAYMENT_FEE;
  const margin = price + shipIn - p.unitCost - SHIPPING_COST - fees;
  return (
    <Section title="Unit economics (serum)">
      <Row k="Price (after discount)" v={eur(price, 2)} />
      {shipIn > 0 && <Row k="Shipping charged to customer" v={`+${eur(shipIn, 2)}`} />}
      <Row k="Product cost" v={`−${eur(p.unitCost, 2)}`} />
      <Row k="Shipping (carrier)" v={`−${eur(SHIPPING_COST, 2)}`} />
      <Row k="Payment fees (2.9%)" v={`−${eur(fees, 2)}`} />
      <div className="border-t mt-1 pt-1"><Row k={<b>Contribution margin</b>} v={<b>{eur(margin, 2)}</b>} /></div>
      <div className="mt-2 rounded bg-amber-50 p-2 text-sm">
        <b>Break-even CPA ≈ {eur(margin, 2)}</b>: if a customer costs more than this in ads, that sale loses money (before fixed costs).
        Break-even ROAS ≈ <b>{((price + shipIn) / Math.max(0.01, margin)).toFixed(2)}×</b>.
      </div>
    </Section>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex justify-between text-sm py-0.5"><span>{k}</span><span>{v}</span></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-4"><div className="font-semibold mb-2">{title}</div>{children}</div>;
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1 text-sm cursor-pointer">
      <span>{label}</span>
      <button type="button" onClick={() => set(!on)} className={`w-10 h-5 rounded-full relative transition-colors ${on ? 'bg-blue-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`} />
      </button>
    </label>
  );
}
