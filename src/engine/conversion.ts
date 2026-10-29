// Store-side conversion factors: price perception, store UX, and landing/message consistency.
import { ANGLE_WORDS, SHIPPING_FEE } from './data';
import { clamp } from './rng';
import type { Angle, Offer, Segment, StoreConfig } from './types';

export function effectivePrice(store: StoreConfig, productId: string, offer: Offer = 'none'): number {
  let p = store.prices[productId] * (1 - store.discountPct / 100);
  if (offer === 'off10') p *= 0.9;
  if (offer === 'off20') p *= 0.8;
  if (offer === 'bundle') p *= 0.85;
  return p;
}

export function perceivedPrice(store: StoreConfig, productId: string, offer: Offer = 'none'): number {
  const freeShip = store.freeShipping || offer === 'freeship';
  return effectivePrice(store, productId, offer) + (freeShip ? 0 : SHIPPING_FEE);
}

/** Multiplier on purchase probability from price vs what the segment thinks is fair. */
export function priceFactor(seg: Pick<Segment, 'priceSensitivity' | 'refPrice'>, price: number): number {
  return clamp(Math.exp(-seg.priceSensitivity * 2.2 * (price / seg.refPrice - 1)), 0.08, 1.7);
}

export interface StoreFactor { label: string; mult: number }

/** Segment-independent store UX multiplier, with an explanation list for the Store tab. */
export function storeUxFactors(store: StoreConfig, reviewCount: number, avgRating: number): StoreFactor[] {
  const f: StoreFactor[] = [];
  if (store.showReviews) {
    if (reviewCount === 0) f.push({ label: 'Reviews widget is empty (no reviews yet)', mult: 0.97 });
    else f.push({ label: `Showing ${reviewCount} reviews (${avgRating.toFixed(1)}★)`, mult: clamp(1 + (avgRating - 3.4) * 0.12, 0.8, 1.22) });
  } else f.push({ label: 'Reviews hidden — shoppers can’t verify quality', mult: 0.9 });
  f.push(store.trustBadges ? { label: 'Trust badges & secure payment icons', mult: 1.06 } : { label: 'No trust badges', mult: 1 });
  f.push({ label: `${store.checkoutSteps}-step checkout`, mult: store.checkoutSteps === 1 ? 1.12 : store.checkoutSteps === 2 ? 1 : 0.84 });
  return f;
}

export function storeUxMult(store: StoreConfig, reviewCount: number, avgRating: number): number {
  return storeUxFactors(store, reviewCount, avgRating).reduce((m, x) => m * x.mult, 1);
}

export function storeAngles(store: StoreConfig): Angle[] {
  const t = store.headline.toLowerCase();
  return (Object.keys(ANGLE_WORDS) as Angle[]).filter((a) => ANGLE_WORDS[a].some((w) => t.includes(w)));
}

/** Ad promise ↔ landing page consistency ("message match"). */
export function messageMatch(adAngles: Angle[], store: StoreConfig): number {
  if (!adAngles.length) return 1;
  const sa = storeAngles(store);
  return adAngles.some((a) => a !== 'value' && sa.includes(a)) ? 1.12 : 0.95;
}
