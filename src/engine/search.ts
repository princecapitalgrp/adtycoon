// Seekr — the simulated search engine. Results come from game state: products, live prices,
// active ad campaigns, trends, and a few educational articles.
import { trendIntensity } from './creative';
import { brandRating, competitorPrice } from './sim';
import type { Creative, GameState, Product } from './types';

export interface Article { id: string; title: string; source: string; body: string[]; keywords: string[] }

export const ARTICLES: Article[] = [
  { id: 'roas', title: 'ROAS vs. profit: why a 2× ROAS can still lose money', source: 'growthnotes.blog', keywords: ['roas', 'profit', 'marketing', 'ads', 'return', 'margin', 'break', 'even'],
    body: ['ROAS (return on ad spend) is revenue ÷ ad spend. It ignores product cost, shipping, payment fees and overhead.', 'Your break-even ROAS = price ÷ contribution margin per order. If you keep €30 of a €49 sale before ads, break-even ROAS is about 1.6×.', 'Blended ROAS (also called MER) = total revenue ÷ total ad spend. It is harder to game than platform-reported ROAS.'] },
  { id: 'fatigue', title: 'Ad fatigue: when frequency starts to hurt', source: 'adweek-ish.com', keywords: ['frequency', 'fatigue', 'ads', 'ctr', 'creative', 'marketing', 'reach'],
    body: ['Frequency = impressions ÷ reach. Past roughly 2–3 views per week, click-through rates usually decline.', 'Symptoms: rising CPC, falling CTR, and annoyed comments (“stop showing me this”).', 'Fixes: rotate in new creatives, broaden the audience, or lower the budget on saturated audiences.'] },
  { id: 'attribution', title: 'Why platform conversions never add up to your sales', source: 'measure.school', keywords: ['attribution', 'conversions', 'analytics', 'ga4', 'view', 'through', 'marketing', 'tracking'],
    body: ['Social platforms count “view-through” conversions: someone saw your ad and later bought — even if they would have bought anyway.', 'Search platforms take credit for brand searches that might have reached you organically.', 'Meanwhile analytics tools lose visitors who decline cookies, so paid traffic shows up as “direct”.', 'Trust your store’s order count. Use platform numbers to compare campaigns with each other, not as truth.'] },
  { id: 'brand', title: 'Should you bid on your own brand name?', source: 'ppc.guide', keywords: ['brand', 'keyword', 'search', 'bidding', 'cannibalization', 'ppc', 'google', 'seekr'],
    body: ['Brand keywords are cheap and convert well — but many of those clicks would have come through your free organic listing.', 'If competitors bid on your name, defending it can be worth it. If nobody does, test pausing it and watch total sales.', 'Incrementality > reported ROAS.'] },
  { id: 'checkout', title: 'Every checkout step costs you customers', source: 'cro.lab', keywords: ['checkout', 'conversion', 'rate', 'cro', 'store', 'cart', 'shipping', 'trust'],
    body: ['Each extra step in a checkout loses shoppers. One-page checkouts typically convert best.', 'Surprise shipping costs are the #1 reason for cart abandonment.', 'Reviews and trust badges reduce perceived risk, especially for new brands.'] },
  { id: 'claims', title: 'Cosmetic ad claims that get you in trouble', source: 'beautylaw.eu', keywords: ['claims', 'compliance', 'ads', 'clinically', 'proven', 'miracle', 'skincare', 'regulation'],
    body: ['“Clinically proven”, “miracle”, “instant results”, and “#1” need evidence. Without it they are misleading.', 'Hype can lift clicks briefly, but skeptical buyers distrust it and disappointed customers leave bad reviews.', 'Claim what your product can support: ingredients, concentration, testing.'] },
  { id: 'segments', title: 'Same product, different buyers: segment-led creative', source: 'brandstrategy.io', keywords: ['audience', 'segment', 'targeting', 'creative', 'message', 'persona', 'marketing'],
    body: ['A 40+ shopper searching “dark spot serum” and a student scrolling #glassskin want different promises.', 'Match the angle (glow, science, clean, anti-aging, value) and visual style to the audience.', 'Then make the landing page repeat the promise — message match lifts conversion.'] },
  { id: 'retargeting', title: 'Retargeting 101: winning back almost-buyers', source: 'growthnotes.blog', keywords: ['retargeting', 'remarketing', 'visitors', 'audience', 'ads', 'conversion'],
    body: ['Most visitors leave without buying. Retargeting shows ads to people who already visited.', 'These audiences are small but convert several times better than cold audiences.', 'Watch frequency: small audiences saturate fast.'] },
  { id: 'vitc', title: 'Vitamin C serums explained: what actually matters', source: 'dermfacts.org', keywords: ['vitamin', 'c', 'serum', 'skincare', 'ingredients', 'dark', 'spot', 'brightening'],
    body: ['Look for 10–20% L-ascorbic acid or a stable derivative, in opaque packaging.', 'Benefits: brightening, evening tone, antioxidant protection. Results take 4–8 weeks.', 'More expensive is not always better — formulation and stability matter most.'] },
];

export type SearchTarget =
  | { type: 'product'; productId: string }
  | { type: 'site'; brandId: string }
  | { type: 'article'; articleId: string }
  | { type: 'bestof' }
  | { type: 'trend'; tag: string };

export interface OrganicResult { title: string; url: string; snippet: string; target: SearchTarget; rating?: { avg: number; count: number } }
export interface SearchAd { brandId: string; campaignId: string; creative: Creative; url: string; isPlayer: boolean }
export interface ShoppingItem { product: Product; price: number; listPrice: number; rating: { avg: number; count: number }; domain: string }

const tok = (s: string) => s.toLowerCase().replace(/[^a-z0-9%#éè ]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
const overlap = (q: string[], words: string[]) => q.filter((w) => words.some((x) => x.startsWith(w) || w.startsWith(x))).length / Math.max(1, q.length);

export function playerPrice(s: GameState, p: Product) {
  return s.store.prices[p.id] * (1 - s.store.discountPct / 100);
}
export function displayPrice(s: GameState, p: Product) {
  return p.brandId === 'nova' ? playerPrice(s, p) : competitorPrice(s, p);
}

/** Organic rank strength for the "best serums" listicle and product results. */
export function rankScore(s: GameState, brandId: string) {
  const r = brandRating(s, brandId);
  const aw = Object.values(s.segments).reduce((a, x) => a + x.awareness[brandId], 0) / 5;
  return aw * 2 + (r.avg ? (r.avg - 3) * 0.3 : 0) + Math.min(0.4, r.count / 3000);
}

export function search(s: GameState, query: string) {
  const q = tok(query);
  const brandsById = Object.fromEntries(s.brands.map((b) => [b.id, b]));
  const visibleProducts = s.products.filter((p) => p.brandId !== 'nova' || p.id === 'nova-c' || s.unlocks.product2);

  // Sponsored: active campaigns whose keywords match the query
  const ads: SearchAd[] = [];
  for (const c of s.campaigns.filter((c) => c.channel === 'search' && c.status === 'active')) {
    const hit = c.keywords.some((k) => {
      const kt = tok(k);
      return overlap(kt, q) >= 0.99 || (q.length >= 2 && overlap(q, kt) >= 0.66);
    });
    const cr = s.creatives.find((x) => x.id === c.creativeId);
    if (hit && cr) ads.push({ brandId: c.brandId, campaignId: c.id, creative: cr, url: brandsById[c.brandId].domain, isPlayer: c.brandId === 'nova' });
  }
  ads.sort((a, b) => (s.campaigns.find((c) => c.id === b.campaignId)!.maxCpc) - (s.campaigns.find((c) => c.id === a.campaignId)!.maxCpc));

  const shopping: ShoppingItem[] = visibleProducts
    .map((p) => ({ p, sc: overlap(q, [...p.keywords, ...tok(p.name)]) }))
    .filter((x) => x.sc >= 0.5)
    .sort((a, b) => b.sc - a.sc || rankScore(s, b.p.brandId) - rankScore(s, a.p.brandId))
    .slice(0, 5)
    .map(({ p }) => ({ product: p, price: displayPrice(s, p), listPrice: p.brandId === 'nova' ? s.store.prices[p.id] : p.price, rating: brandRating(s, p.brandId), domain: brandsById[p.brandId].domain }));

  const organic: { r: OrganicResult; score: number }[] = [];
  for (const p of visibleProducts) {
    const sc = overlap(q, [...p.keywords, ...tok(p.name), ...tok(brandsById[p.brandId].name)]);
    if (sc < 0.34) continue;
    const b = brandsById[p.brandId];
    organic.push({ score: sc + rankScore(s, p.brandId) * 0.5, r: { title: `${p.name} | ${b.name}`, url: `${b.domain}/products/${p.id}`, snippet: `${b.tagline} €${displayPrice(s, p).toFixed(2)} · Free returns · ${p.brandId === 'nova' && s.store.freeShipping ? 'Free shipping' : 'Ships in 2–3 days'}`, target: { type: 'product', productId: p.id }, rating: brandRating(s, p.brandId) } });
  }
  for (const b of s.brands) {
    const sc = overlap(q, tok(`${b.name} ${b.domain}`));
    if (sc >= 0.5) organic.push({ score: 2 + sc, r: { title: `${b.name} — Official Site`, url: b.domain, snippet: b.tagline, target: { type: 'site', brandId: b.id } } });
  }
  for (const a of ARTICLES) {
    const sc = overlap(q, a.keywords);
    if (sc >= 0.5) organic.push({ score: sc + 0.2, r: { title: a.title, url: `${a.source}/${a.id}`, snippet: a.body[0], target: { type: 'article', articleId: a.id } } });
  }
  if (overlap(q, ['best', 'vitamin', 'serum', 'top', 'review', 'reviews', 'compare', '2026']) >= 0.5) {
    organic.push({ score: 1.5, r: { title: 'The 5 best vitamin C serums of 2026 (tested)', url: 'beautyreviewer.net/best-vitamin-c', snippet: 'We compared prices, ingredients and thousands of customer reviews. Rankings update weekly.', target: { type: 'bestof' } } });
  }
  for (const t of s.trends) {
    const live = trendIntensity(t, s.day) > 0;
    if (overlap(q, [...tok(t.tag.replace('#', '')), 'trend', 'trends', 'trending', 'tiktok', 'skincare']) >= 0.5 && (live || t.endDay > s.day - 30)) {
      organic.push({ score: live ? 1.3 : 0.6, r: { title: `What is ${t.tag}? The skincare trend ${live ? 'taking over' : 'that just faded'}`, url: `trendwatch.social/${t.tag.slice(1)}`, snippet: t.blurb, target: { type: 'trend', tag: t.tag } } });
    }
  }
  return { ads: ads.slice(0, 3), shopping, organic: organic.sort((a, b) => b.score - a.score).slice(0, 8).map((x) => x.r) };
}

export function suggestedQueries(s: GameState): string[] {
  const live = s.trends.filter((t) => trendIntensity(t, s.day) > 0.2).map((t) => t.tag.slice(1));
  return [...live, 'best vitamin c serum', 'glowgo', 'skincare trends', 'roas', 'ad fatigue', 'checkout conversion'].slice(0, 7);
}

export function bestOfList(s: GameState) {
  return s.products
    .filter((p) => p.id.endsWith('-c'))
    .map((p) => ({ p, score: rankScore(s, p.brandId) + p.quality, rating: brandRating(s, p.brandId), price: displayPrice(s, p) }))
    .sort((a, b) => b.score - a.score);
}
