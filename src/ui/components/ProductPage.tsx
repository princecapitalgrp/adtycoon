import { useState } from 'react';
import { reviewText } from '../../engine/feed';
import { makeRng } from '../../engine/rng';
import { displayPrice } from '../../engine/search';
import { brandRating } from '../../engine/sim';
import { SHIPPING_FEE } from '../../engine/data';
import type { DescStyle } from '../../engine/types';
import { useGame } from '../../store/game';
import { ProductImage } from './Bottle';
import { eur } from '../format';

const COMP_STORE: Record<string, { steps: number; freeShipping: boolean; badges: boolean }> = {
  lumiere: { steps: 2, freeShipping: true, badges: true },
  glowgo: { steps: 1, freeShipping: false, badges: false },
  verde: { steps: 2, freeShipping: true, badges: true },
};

const NOVA_DESC: Record<string, Record<DescStyle, string[]>> = {
  'nova-c': {
    short: ['Brightening 15% vitamin C serum for a radiant glow. Vegan & cruelty-free.'],
    detailed: ['15% L-ascorbic acid + 1% vitamin E + 0.5% ferulic acid', 'pH 3.2 for stability · airless opaque bottle', 'Dermatologist tested · fragrance-free · vegan', '30 ml · use 3–4 drops each morning before SPF'],
    story: ['NOVA was founded by two chemists in Lyon tired of serums that turned orange in a month.', 'We spent 18 months building a stable, gentle 15% vitamin C you can actually finish before it oxidizes.'],
  },
  'nova-h': {
    short: ['Lightweight hyaluronic moisturizer for plump, dewy skin. Vegan.'],
    detailed: ['3 weights of hyaluronic acid + 5% squalane', 'Non-comedogenic · fragrance-free · vegan', 'Dermatologist tested · 50 ml jar'],
    story: ['Hydra Boost is the partner our vitamin C serum always needed: hydration that layers without pilling.'],
  },
};
const COMP_DESC: Record<string, string[]> = {
  'lum-c': ['20% vitamin C in a precious Parisian formula. Visibly refines fine lines and brightens.', 'Developed with dermatologists. 30 ml glass bottle.'],
  'gg-c': ['The viral vitamin C serum! Brighter skin for less. 30 ml.'],
  'vb-c': ['Organic citrus-derived vitamin C with 12 plant extracts.', 'Vegan, cruelty-free, plastic-free packaging.'],
  'lum-r': ['A luxurious night retinol for smoother skin by morning.'],
  'gg-r': ['Tasty gummies with vitamin C & biotin. 60 per jar.'],
  'vb-r': ['Bakuchiol: the plant-based retinol alternative. Gentle, vegan.'],
};

export function ProductPage({ productId, preview = false }: { productId: string; preview?: boolean }) {
  const { game } = useGame();
  const g = game!;
  const p = g.products.find((x) => x.id === productId)!;
  const brand = g.brands.find((b) => b.id === p.brandId)!;
  const isNova = p.brandId === 'nova';
  const cfg = isNova
    ? { steps: g.store.checkoutSteps, freeShipping: g.store.freeShipping, badges: g.store.trustBadges }
    : COMP_STORE[p.brandId];
  const showReviews = isNova ? g.store.showReviews : true;
  const price = displayPrice(g, p);
  const list = isNova ? g.store.prices[p.id] : p.price;
  const rating = brandRating(g, p.brandId);
  const [stage, setStage] = useState<number>(0); // 0 product, 1 cart, 2..n checkout steps, -1 done
  const desc = isNova ? NOVA_DESC[p.id]?.[g.store.descStyle] ?? [] : COMP_DESC[p.id] ?? [];
  const title = isNova && p.id === 'nova-c' ? g.store.headline || p.name : p.name;

  const reviews = isNova
    ? g.reviews.slice(-6).reverse()
    : (() => {
        const r = makeRng(g.seed, 'compreviews', p.id);
        return [0, 1, 2].map((i) => {
          const rt = Math.max(1, Math.min(5, Math.round(rating.avg + r.normal(0, 0.9))));
          return { rating: rt, ...reviewText(g.seed, -1, i + p.id.length, rt) };
        });
      })();

  if (stage !== 0) {
    const stepNames = cfg.steps === 1 ? ['Checkout'] : cfg.steps === 2 ? ['Shipping', 'Payment'] : ['Create account', 'Shipping', 'Payment'];
    const shipping = cfg.freeShipping ? 0 : SHIPPING_FEE;
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="text-sm text-slate-500 mb-3">{brand.domain} › {stage === 1 ? 'Cart' : stage === -1 ? 'Confirmation' : `Checkout ${stage - 1}/${cfg.steps}: ${stepNames[stage - 2]}`}</div>
        {stage === -1 ? (
          <div className="card p-6 text-center">
            <div className="text-3xl">✅</div>
            <div className="font-semibold mt-2">Order placed (demo)</div>
            <p className="text-sm text-slate-500 mt-1">This is a walkthrough of the funnel your customers experience — no order was recorded.</p>
            <button className="btn-ghost mt-4" onClick={() => setStage(0)}>Back to product</button>
          </div>
        ) : stage === 1 ? (
          <div className="card p-4 space-y-3">
            <div className="flex justify-between"><span>{p.name}</span><span>{eur(price, 2)}</span></div>
            <div className="text-xs text-slate-500">{cfg.freeShipping ? 'Free shipping' : 'Shipping calculated at checkout'}</div>
            <button className="btn-primary w-full" onClick={() => setStage(2)}>Checkout</button>
          </div>
        ) : (
          <div className="card p-4 space-y-3">
            {stepNames[stage - 2] === 'Create account' && <><input className="input" placeholder="Email" /><input className="input" placeholder="Password" type="password" /><p className="text-xs text-slate-500">An account is required to order.</p></>}
            {(stepNames[stage - 2] === 'Shipping' || stepNames[stage - 2] === 'Checkout') && <><input className="input" placeholder="Full name" /><input className="input" placeholder="Address" /></>}
            {(stepNames[stage - 2] === 'Payment' || stepNames[stage - 2] === 'Checkout') && (
              <>
                <input className="input" placeholder="Card number" />
                <div className="text-sm border-t pt-2 space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>{eur(price, 2)}</span></div>
                  <div className={`flex justify-between ${shipping ? 'text-red-600 font-medium' : ''}`}><span>Shipping</span><span>{shipping ? eur(shipping, 2) : 'Free'}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total</span><span>{eur(price + shipping, 2)}</span></div>
                </div>
              </>
            )}
            <button className="btn-primary w-full" onClick={() => setStage(stage - 1 >= cfg.steps ? -1 : stage + 1)}>{stage - 1 >= cfg.steps ? 'Place order' : 'Continue'}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: brand.color }}>
        <div className="font-black tracking-wider" style={{ color: brand.color }}>{brand.name.toUpperCase()}</div>
        <div className="text-xs text-slate-500">{cfg.freeShipping ? '🚚 Free shipping' : `Shipping ${eur(SHIPPING_FEE, 2)}`}</div>
      </div>
      <div className="grid md:grid-cols-2 gap-6 p-6">
        <div className="rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
          <ProductImage color={p.color} brand={brand.name.split(' ')[0].toUpperCase()} label={p.short} size={300} jar={p.id === 'nova-h'} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {showReviews && (
            <div className="text-sm mt-1">
              {rating.count > 0 ? <><span className="text-amber-500">{'★'.repeat(Math.round(rating.avg))}</span> {rating.avg.toFixed(1)} ({rating.count} reviews)</> : <span className="text-slate-400">No reviews yet</span>}
            </div>
          )}
          <div className="mt-3 text-2xl font-semibold">
            {eur(price, 2)} {price < list - 0.01 && <span className="text-base text-slate-400 line-through ml-1">{eur(list, 2)}</span>}
          </div>
          <div className="mt-3 text-sm text-slate-700 space-y-1">
            {desc.length > 1 && (isNova ? g.store.descStyle === 'detailed' : false) ? <ul className="list-disc pl-5">{desc.map((d) => <li key={d}>{d}</li>)}</ul> : desc.map((d) => <p key={d}>{d}</p>)}
          </div>
          <button className="btn-primary mt-4 w-full py-2.5" style={{ background: brand.color }} onClick={() => !preview && setStage(1)} disabled={isNova && (g.inventory[p.id] ?? 0) <= 0}>
            {isNova && (g.inventory[p.id] ?? 0) <= 0 ? 'Sold out' : 'Add to cart'}
          </button>
          {cfg.badges && <div className="mt-3 flex gap-3 text-xs text-slate-500"><span>🔒 Secure checkout</span><span>↩️ 30-day returns</span><span>✔ Dermatologist tested</span></div>}
          <div className="mt-2 text-xs text-slate-400">{cfg.steps}-step checkout</div>
        </div>
      </div>
      {showReviews && reviews.length > 0 && (
        <div className="px-6 pb-6">
          <h2 className="font-semibold mb-2">Customer reviews</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {reviews.map((r, i) => (
              <div key={i} className="card p-3 text-sm">
                <div className="text-amber-500">{'★'.repeat(r.rating)}<span className="text-slate-300">{'★'.repeat(5 - r.rating)}</span></div>
                <p className="mt-1">{r.text}</p>
                <div className="text-xs text-slate-400 mt-1">— {r.author}, verified buyer</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
