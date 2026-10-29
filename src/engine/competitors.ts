// Rule-based competitor brains and market-trend lifecycle.
import { COMPETITOR_CREATIVES, COMPETITOR_PROFILE, RESERVE_PRODUCTS, TREND_POOL } from './data';
import { trendIntensity } from './creative';
import type { Rng } from './rng';
import type { GameState } from './types';

const OFFSET: Record<string, number> = { lumiere: 1, glowgo: 3, verde: 5 };
const NAME: Record<string, string> = { lumiere: 'Lumière Paris', glowgo: 'GlowGo', verde: 'Verde Botanics' };
const BASE: Record<string, [number, number]> = { lumiere: [110, 90], glowgo: [170, 50], verde: [70, 40] };

function recentShare(s: GameState, brandId: string, days: number): number {
  const h = s.history.slice(-days);
  if (!h.length) return 0;
  return h.reduce((a, d) => a + (d.competitorShare[brandId] ?? 0), 0) / h.length;
}

export function updateTrends(s: GameState, day: number, rng: Rng, events: string[]) {
  s.trends = s.trends.filter((t) => t.endDay >= day - 30); // keep a short memory for search results
  const live = s.trends.filter((t) => t.endDay >= day);
  if (live.length < 2 && rng.chance(0.13)) {
    const options = TREND_POOL.filter((p) => !live.some((t) => t.tag === p.tag));
    const p = rng.pick(options);
    const peak = day + rng.int(3, 7);
    s.trends.push({ id: `t${day}`, tag: p.tag, angle: p.angle, mood: p.mood, blurb: p.blurb, startDay: day, peakDay: peak, endDay: peak + rng.int(8, 15), strength: rng.range(0.3, 0.6) });
    events.push(`Trend emerging on social: ${p.tag}`);
  }
}

export function competitorTurn(s: GameState, day: number, rng: Rng, events: string[]) {
  const novaAwareness = Object.values(s.segments).reduce((a, x) => a + x.awareness.nova, 0) / 5;
  const liveTrends = s.trends.filter((t) => trendIntensity(t, day) > 0.3);

  for (const c of s.competitors) {
    const name = NAME[c.brandId];
    const profile = COMPETITOR_PROFILE[c.brandId];
    const [baseSocial, baseSearch] = BASE[c.brandId];
    if (c.discountPct > 0 && day > c.discountUntil) c.discountPct = 0;

    if (day % 7 === OFFSET[c.brandId] && day > 3) {
      const share = recentShare(s, c.brandId, 7);
      const novaShare = recentShare(s, 'nova', 7);
      if (c.lastShare > 0 && share < c.lastShare * 0.9) {
        if (c.style === 'budget') {
          c.discountPct = 20;
          c.discountUntil = day + 5;
          events.push(`${name} launched a 20% flash sale (losing share).`);
        } else if (c.style === 'premium') {
          c.socialBudget *= 1.2;
          events.push(`${name} increased its ad spend.`);
        } else {
          c.socialBudget *= 1.15;
          c.discountPct = 10;
          c.discountUntil = day + 4;
          events.push(`${name} is running a 10% promo and spending more on ads.`);
        }
      } else if (share > c.lastShare * 1.1) {
        c.socialBudget *= 1.08;
      }
      if (!c.bidsOnNova && c.style !== 'premium' && novaShare > 0.12 && novaAwareness > 0.06 && rng.chance(0.5)) {
        c.bidsOnNova = true;
        events.push(`${name} started bidding on your brand keyword “nova skincare”.`);
      }
      c.lastShare = share;
    }

    // Lean into trends that fit the brand
    const trendFit = liveTrends.some((t) => profile.angles.includes(t.angle));
    const socialBudget = Math.min(c.socialBudget * (trendFit ? 1.15 : 1), baseSocial * 3);
    c.socialBudget = Math.max(baseSocial * 0.7, Math.min(c.socialBudget, baseSocial * 3));

    // Launch a reserve product once
    if (!c.reserveProductLaunched && day >= 16 + OFFSET[c.brandId] * 2 && rng.chance(0.12)) {
      c.reserveProductLaunched = true;
      s.products.push({ ...RESERVE_PRODUCTS[c.brandId], launchedDay: day });
      const cr = COMPETITOR_CREATIVES.find((x) => x.productId === RESERVE_PRODUCTS[c.brandId].id)!;
      s.creatives.push({ ...cr, createdDay: day });
      events.push(`${name} launched a new product: ${RESERVE_PRODUCTS[c.brandId].name}.`);
    }

    // Rotate creatives every ~9 days (favor newest product briefly)
    const own = s.creatives.filter((x) => x.brandId === c.brandId);
    const social = s.campaigns.find((x) => x.id === `cmp-${c.brandId}-social`)!;
    const search = s.campaigns.find((x) => x.id === `cmp-${c.brandId}-search`)!;
    if (day % 9 === OFFSET[c.brandId] || own.some((x) => x.createdDay === day)) {
      const fresh = own.find((x) => x.createdDay === day);
      social.creativeId = fresh ? fresh.id : own[Math.floor(rng.next() * own.length)].id;
      search.creativeId = social.creativeId;
    }
    social.dailyBudget = socialBudget;
    search.dailyBudget = baseSearch * (c.discountPct ? 1.3 : 1);
    search.keywords = c.bidsOnNova ? [...profile.keywords, 'nova skincare'] : profile.keywords;
  }
}
