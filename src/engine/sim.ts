// The daily simulation. One call = one business day. All KPIs are derived from the same
// underlying flows (impressions → clicks → visits → orders), never generated independently.
import { competitorTurn, updateTrends } from './competitors';
import { effectivePrice, messageMatch, perceivedPrice, priceFactor, storeUxMult } from './conversion';
import { reviewText } from './feed';
import { creativeAppeal, detectAngles, riskyClaims, trendBoosts, trendIntensity } from './creative';
import { FIXED_COST_PER_DAY, KEYWORDS, PAYMENT_FEE, PLAYER_PRODUCT_2, SEGMENTS, SEGMENT_BY_ID, SHIPPING_COST, SHIPPING_FEE, WIN_CASH } from './data';
import { clamp, makeRng, type Rng } from './rng';
import type {
  Campaign, CampaignDay, Creative, DayRecord, GameState, Offer, Product, ReasonKind, Segment, SegmentId, SegmentState, Signal, TrafficSource,
} from './types';

type Aud = SegmentId | 'retarget';
const SOURCES: TrafficSource[] = ['paid_social', 'paid_search', 'organic_search', 'organic_social', 'direct', 'returning'];
const zeroSources = () => Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<TrafficSource, number>;

// Retargeting behaves like a warm, mid-sensitivity blend of all segments
const RETARGET_SEG: Segment = { ...SEGMENT_BY_ID.young_pros, id: 'young_pros', name: 'Site visitors', priceSensitivity: 0.55, refPrice: 42, baseTrust: 0.65, adResponsiveness: 1.3 };
const segOf = (a: Aud): Segment => (a === 'retarget' ? RETARGET_SEG : SEGMENT_BY_ID[a]);

const SOURCE_CR: Record<TrafficSource, number> = { paid_social: 0.5, paid_search: 1.25, organic_search: 1.15, organic_social: 1.05, direct: 1.5, returning: 2 };

interface VisitBucket {
  seg: Aud;
  source: TrafficSource;
  visits: number;
  productId: string;
  offer: Offer;
  creative?: Creative;
  campaignId?: string;
  intent: number;
}

export interface DayContext {
  rng: Rng;
  events: string[];
}

function emptyCampDay(): CampaignDay {
  return { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, clickConversions: 0, revenue: 0, frequency: 0 };
}

export function competitorPrice(s: GameState, p: Product): number {
  const c = s.competitors.find((x) => x.brandId === p.brandId);
  return p.price * (1 - (c?.discountPct ?? 0) / 100);
}

export function brandRating(s: GameState, brandId: string): { avg: number; count: number } {
  if (brandId === 'nova') {
    const r = s.reviews;
    return { avg: r.length ? r.reduce((a, x) => a + x.rating, 0) / r.length : 0, count: r.length };
  }
  const p = s.products.find((x) => x.brandId === brandId)!;
  return { avg: clamp(2.4 + p.quality * 2.6, 1, 5), count: { lumiere: 1840, glowgo: 5210, verde: 920 }[brandId] ?? 300 };
}

export function simulateDay(s: GameState): DayRecord {
  const day = s.day + 1;
  const rng = makeRng(s.seed, 'day', day);
  const events: string[] = [];
  updateTrends(s, day, rng, events);
  competitorTurn(s, day, rng, events);

  // Inventory arrivals
  for (const inc of s.incoming.filter((i) => i.arrives <= day)) {
    s.inventory[inc.productId] = (s.inventory[inc.productId] ?? 0) + inc.qty;
    events.push(`Restock arrived: ${inc.qty} × ${s.products.find((p) => p.id === inc.productId)?.short}.`);
  }
  s.incoming = s.incoming.filter((i) => i.arrives > day);

  const productById = (id: string) => s.products.find((p) => p.id === id)!;
  const creativeById = (id: string) => s.creatives.find((c) => c.id === id);
  const novaRating = brandRating(s, 'nova');
  const ux = storeUxMult(s.store, novaRating.count, novaRating.avg);
  const camps: Record<string, CampaignDay> = {};
  const visits: VisitBucket[] = [];
  const signals: Signal[] = [];
  const dailyReach: Partial<Record<Aud, number>> = {}; // player reach by audience (for view-through + awareness)
  const compClicks: Record<string, Partial<Record<SegmentId, number>>> = {};

  // ---------- SOCIAL AUCTION ----------
  const playerActive = s.campaigns.filter((c) => c.brandId === 'nova' && c.status === 'active' && creativeById(c.creativeId));
  const playerBudget = playerActive.reduce((a, c) => a + c.dailyBudget, 0);
  const limitScale = playerBudget > s.unlocks.spendLimit ? s.unlocks.spendLimit / playerBudget : 1;
  if (limitScale < 1) events.push(`Ad account limit reached: budgets scaled to €${s.unlocks.spendLimit}/day.`);

  const social = s.campaigns.filter((c) => c.channel === 'social' && c.status === 'active' && creativeById(c.creativeId));
  const audPop = (a: Aud) => (a === 'retarget' ? Math.max(1, s.retargetPool) * 0.8 : SEGMENT_BY_ID[a].population * SEGMENT_BY_ID[a].socialUsage);
  type Alloc = { camp: Campaign; aud: Aud; budget: number; appeal: ReturnType<typeof creativeAppeal> };
  const allocs: Alloc[] = [];
  const demand: Partial<Record<Aud, number>> = {};
  for (const camp of social) {
    const cr = creativeById(camp.creativeId)!;
    const auds = camp.segments.filter((a) => a !== 'retarget' || (camp.brandId === 'nova' && s.unlocks.retargeting && s.retargetPool > 50));
    if (!auds.length) continue;
    const budget = camp.dailyBudget * (camp.brandId === 'nova' ? limitScale : 1);
    // The platform's delivery algorithm leans toward audiences that engage
    const parts = auds.map((a) => {
      const appeal = creativeAppeal(cr, a, s.trends, day);
      return { a, appeal, w: audPop(a) * appeal.score * (a === 'retarget' ? 4 : 1) };
    });
    const tw = parts.reduce((x, p) => x + p.w, 0);
    for (const p of parts) {
      const b = (budget * p.w) / tw;
      allocs.push({ camp, aud: p.a, budget: b, appeal: p.appeal });
      demand[p.a] = (demand[p.a] ?? 0) + b;
    }
  }
  for (const al of allocs) {
    const { camp, aud, appeal } = al;
    const seg = segOf(aud);
    const pop = audPop(aud);
    const cr = creativeById(camp.creativeId)!;
    const brand = camp.brandId;
    const segState = aud === 'retarget' ? null : s.segments[aud];
    const baseCpm = aud === 'retarget' ? 14 : 8.5;
    const cpm = (baseCpm * (1 + (demand[aud] ?? 0) / (pop * 0.01))) / clamp(Math.sqrt(appeal.score), 0.7, 1.4);
    let imps = (al.budget / cpm) * 1000;
    const cap = pop * 1.2;
    let spend = al.budget;
    if (imps > cap) { imps = cap; spend = (cap * cpm) / 1000; }
    // Frequency & fatigue use rolling 7-day exposure for this creative in this audience
    const expo = (s.exposure[cr.id] ??= {});
    const reachMem = (s.reachMemory[camp.id] ??= {});
    const reachToday = pop * (1 - Math.exp(-imps / pop));
    const prevReach = reachMem[aud] ?? 0;
    const newReach = Math.max(0, (pop - prevReach) * (1 - Math.exp(-imps / pop)));
    reachMem[aud] = prevReach * 0.86 + newReach;
    expo[aud] = (expo[aud] ?? 0) * 0.86 + imps;
    const freq7 = (expo[aud] ?? 0) / Math.max(1, reachMem[aud] ?? 1);
    const fatigue = 1 / (1 + 0.28 * Math.max(0, freq7 - 2));
    const aware = segState ? segState.awareness[brand] : 0.6;
    const senti = segState ? segState.sentiment[brand] : s.segments.young_pros.sentiment[brand];
    const ctr = 0.0085 * appeal.score * seg.adResponsiveness * fatigue * (0.85 + 0.6 * aware) * (1 + 0.3 * senti) * (aud === 'retarget' ? 1.6 : 1);
    const clicks = brand === 'nova' ? rng.poisson(imps * ctr) : imps * ctr;

    if (segState) {
      // ad recall builds awareness
      segState.awareness[brand] += (1 - segState.awareness[brand]) * (reachToday / pop) * 0.1 * (0.6 + 0.4 * appeal.score) * seg.socialUsage;
    }

    if (brand !== 'nova') {
      if (aud !== 'retarget') (compClicks[brand] ??= {})[aud] = (compClicks[brand]![aud] ?? 0) + clicks;
      continue;
    }
    const cd = (camps[camp.id] ??= emptyCampDay());
    cd.impressions += imps;
    cd.reach += reachToday;
    cd.clicks += clicks;
    cd.spend += spend;
    cd.frequency = Math.max(cd.frequency, freq7);
    dailyReach[aud] = (dailyReach[aud] ?? 0) + reachToday;
    visits.push({ seg: aud, source: 'paid_social', visits: Math.round(clicks * 0.9), productId: cr.productId, offer: cr.offer, creative: cr, campaignId: camp.id, intent: 1 });
    const eng = (s.creativeEngagement[cr.id] ??= { likes: 0, comments: 0, shares: 0 });
    const likes = rng.poisson(imps * 0.01 * appeal.score * fatigue);
    eng.likes += likes;
    eng.comments += rng.poisson(likes * 0.06);
    eng.shares += rng.poisson(likes * 0.035 * seg.socialInfluence);
    // Reaction signals – the raw material for comments in the feed
    const w = imps;
    const push = (reason: ReasonKind, weight: number, extra?: string) => signals.push({ creativeId: cr.id, segment: aud, reason, weight: weight * w, extra });
    const pf = priceFactor(seg, perceivedPrice(s.store, cr.productId, cr.offer));
    if (appeal.angleFit > 1.15) push('love_angle', appeal.angleFit - 1, appeal.angles[0]);
    if (appeal.score < 0.75) push('irrelevant', 0.8 - appeal.score + 0.2);
    if (pf < 0.7) push('price_high', 1 - pf);
    if (seg.priceSensitivity > 0.7 && cr.offer === 'none') push('want_discount', 0.5);
    if (cr.offer !== 'none' && seg.priceSensitivity > 0.6) push('offer_love', 0.6);
    if (appeal.risky.length) push('claim_skeptic', 0.6 * appeal.risky.length * (1.2 - seg.baseTrust), appeal.risky[0]);
    if (freq7 > 3.2) push('fatigue', (freq7 - 3) * 0.4);
    if (!s.store.freeShipping && cr.offer !== 'freeship' && seg.priceSensitivity > 0.5) push('shipping', 0.3);
    if (seg.desc.detailed > 1.2 && s.store.descStyle === 'short') push('ingredients_q', 0.35);
    const cheaper = s.competitors.find((c) => c.discountPct > 0 || (c.brandId === 'glowgo' && seg.priceSensitivity > 0.6));
    if (cheaper && seg.priceSensitivity > 0.55) push('competitor_cheaper', 0.35, cheaper.brandId);
    const t = s.trends.find((t) => trendIntensity(t, day) > 0.3 && appeal.angles.includes(t.angle));
    if (t) push('trend_match', 0.5, t.tag);
  }

  // ---------- SEARCH AUCTION ----------
  const searchCamps = s.campaigns.filter((c) => c.channel === 'search' && c.status === 'active' && creativeById(c.creativeId));
  const remaining: Record<string, number> = {};
  for (const c of searchCamps) remaining[c.id] = c.dailyBudget * (c.brandId === 'nova' ? limitScale : 1);
  const boosts = trendBoosts(s.trends, day);
  const searchStats: Record<string, { imps: number; lostBudget: number; posSum: number; qs: number }> = {};
  const avgAware = (b: string) => SEGMENTS.reduce((a, x) => a + s.segments[x.id].awareness[b] * x.population, 0) / SEGMENTS.reduce((a, x) => a + x.population, 0);
  const organicScore = (b: string) => {
    const r = brandRating(s, b);
    // Established domains have SEO authority; a new store has to earn it with reviews and awareness
    const authority = { lumiere: 0.25, glowgo: 0.2, verde: 0.15 }[b] ?? Math.min(0.08, r.count / 1500);
    return 0.003 + authority + avgAware(b) * 0.6 + (r.avg > 0 ? (r.avg - 3.5) * 0.02 : 0);
  };
  const orgScores = Object.fromEntries(s.brands.map((b) => [b.id, Math.max(0.01, organicScore(b.id))]));
  const orgTotal = Object.values(orgScores).reduce((a, b) => a + b, 0);

  for (const kw of KEYWORDS) {
    if (kw.kw === 'hyaluronic moisturizer' && !s.unlocks.product2) continue;
    let mix: Partial<Record<SegmentId, number>> = kw.mix;
    let vol: number;
    if (kw.brandId) {
      const parts = SEGMENTS.map((x) => ({ id: x.id, v: x.population * s.segments[x.id].awareness[kw.brandId!] * x.inMarket * x.searchUsage * 0.3 }));
      vol = parts.reduce((a, p) => a + p.v, 0);
      mix = Object.fromEntries(parts.map((p) => [p.id, p.v / Math.max(1, vol)]));
    } else {
      vol = kw.volume * (kw.angle ? boosts.angles[kw.angle] : 1);
    }
    vol = Math.max(0, Math.round(vol * rng.range(0.85, 1.15)));
    if (vol === 0) continue;

    const bidders = searchCamps
      .filter((c) => c.keywords.includes(kw.kw) && remaining[c.id] > 0.2)
      .map((c) => {
        const cr = creativeById(c.creativeId)!;
        const text = `${cr.headline} ${cr.body}`.toLowerCase();
        const words = kw.kw.split(' ');
        const textMatch = words.filter((w) => text.includes(w)).length / words.length;
        const prod = productById(cr.productId);
        const landing = words.filter((w) => prod.keywords.some((k) => k.startsWith(w) || w.startsWith(k))).length / words.length;
        let qs = clamp(Math.round(2 + 4 * textMatch + 3 * landing + (c.brandId === 'nova' ? (ux - 0.9) * 3 : 0.5)), 1, 10);
        if (kw.brandId) qs = kw.brandId === c.brandId ? 10 : 3;
        return { c, cr, qs, rank: c.maxCpc * qs };
      })
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 4);

    const POS_CTR = [0.065, 0.035, 0.022, 0.015];
    let organicPool = 1;
    bidders.forEach((b, i) => {
      const next = bidders[i + 1];
      const cpc = Math.min(b.c.maxCpc, (next ? next.rank / b.qs : 0.25) + 0.01);
      let ctr = POS_CTR[i] * (0.7 + 0.06 * b.qs);
      if (kw.brandId === b.c.brandId) ctr = 0.32; // people searching your name click your ad
      organicPool -= ctr * 0.9;
      const wanted = vol * ctr;
      const affordable = remaining[b.c.id] / cpc;
      const clicks = Math.min(wanted, affordable);
      remaining[b.c.id] -= clicks * cpc;
      if (b.c.brandId !== 'nova') {
        for (const [sid, m] of Object.entries(mix)) {
          (compClicks[b.c.brandId] ??= {})[sid as SegmentId] = (compClicks[b.c.brandId]![sid as SegmentId] ?? 0) + clicks * (m ?? 0) * kw.intent;
        }
        return;
      }
      const st = (searchStats[b.c.id] ??= { imps: 0, lostBudget: 0, posSum: 0, qs: 0 });
      const shownShare = wanted > 0 ? clicks / wanted : 1;
      st.imps += vol * shownShare;
      st.lostBudget += vol * (1 - shownShare);
      st.posSum += (i + 1) * vol * shownShare;
      st.qs = Math.max(st.qs, b.qs);
      const cd = (camps[b.c.id] ??= emptyCampDay());
      const n = rng.poisson(clicks);
      cd.clicks += n;
      cd.spend += n * cpc;
      cd.impressions += vol * shownShare;
      for (const [sid, m] of Object.entries(mix)) {
        const v = Math.round(n * (m ?? 0) + rng.next() - 0.5);
        if (v > 0) visits.push({ seg: sid as SegmentId, source: 'paid_search', visits: v, productId: b.cr.productId, offer: b.cr.offer, creative: b.cr, campaignId: b.c.id, intent: kw.intent });
      }
    });
    // Organic results
    organicPool = Math.max(0.15, organicPool);
    const isPlayerProductQuery = kw.kw !== 'hyaluronic moisturizer' || s.unlocks.product2;
    let novaOrganicCtr = 0;
    if (kw.brandId === 'nova') novaOrganicCtr = 0.62 * organicPool;
    else if (!kw.brandId && isPlayerProductQuery) novaOrganicCtr = 0.3 * organicPool * (orgScores.nova / orgTotal);
    const orgClicks = rng.poisson(vol * novaOrganicCtr);
    for (const [sid, m] of Object.entries(mix)) {
      const v = Math.round(orgClicks * (m ?? 0) + rng.next() - 0.5);
      if (v > 0) visits.push({ seg: sid as SegmentId, source: 'organic_search', visits: v, productId: kw.kw.includes('moistur') ? PLAYER_PRODUCT_2.id : 'nova-c', offer: 'none', intent: kw.intent });
    }
  }
  for (const [cid, st] of Object.entries(searchStats)) {
    const cd = camps[cid];
    cd.lostIsBudget = st.imps + st.lostBudget > 0 ? st.lostBudget / (st.imps + st.lostBudget) : 0;
    cd.avgPosition = st.imps > 0 ? st.posSum / st.imps : undefined;
    cd.qualityScore = st.qs;
    cd.reach = cd.impressions * 0.92;
    cd.frequency = 1.1;
  }

  // ---------- ORGANIC: direct + word of mouth ----------
  const recentBySeg: Partial<Record<Aud, number>> = {};
  for (const h of s.history.slice(-7)) for (const [k, v] of Object.entries(h.ordersBySegment)) recentBySeg[k as Aud] = (recentBySeg[k as Aud] ?? 0) + (v ?? 0);
  const pickProduct = (r: Rng) => (s.unlocks.product2 && r.chance(0.3) ? PLAYER_PRODUCT_2.id : 'nova-c');
  for (const seg of SEGMENTS) {
    const st = s.segments[seg.id];
    const direct = rng.poisson(seg.population * st.awareness.nova * seg.inMarket * 0.09);
    if (direct) visits.push({ seg: seg.id, source: 'direct', visits: direct, productId: pickProduct(rng), offer: 'none', intent: 1 });
    const wom = rng.poisson((recentBySeg[seg.id] ?? 0) * 0.35 * seg.socialInfluence * clamp(0.6 + st.sentiment.nova, 0.1, 1.6));
    if (wom) visits.push({ seg: seg.id, source: 'organic_social', visits: wom, productId: pickProduct(rng), offer: 'none', intent: 1 });
  }

  // ---------- PURCHASE DECISIONS ----------
  const rec: DayRecord = {
    day, revenue: 0, orders: 0, newCustomers: 0, repeatOrders: 0, units: 0, cogs: 0, shipping: 0, fees: 0, adSpend: 0, fixed: FIXED_COST_PER_DAY,
    profit: 0, cash: 0, sessions: zeroSources(), ordersBySource: zeroSources(), ga4Sessions: zeroSources(), ga4Orders: zeroSources(),
    ordersBySegment: {}, lostSales: 0, awareness: 0, sentiment: 0, satisfaction: s.satisfaction, campaigns: camps,
    platformReported: { social: 0, search: 0 }, competitorShare: {}, events,
  };
  const competitorUtility = (seg: Segment, segState: SegmentState | null) =>
    s.products.filter((p) => p.brandId !== 'nova' && p.id.endsWith('-c')).reduce((a, p) => {
      const aw = segState ? segState.awareness[p.brandId] : 0.3;
      const sen = segState ? segState.sentiment[p.brandId] : 0.1;
      return a + aw * priceFactor(seg, competitorPrice(s, p) + 3) * (0.5 + p.quality) * (1 + 0.5 * sen);
    }, 0);
  let stockoutToday = false;
  const satSamples: number[] = [];
  const riskyActive = playerActive.some((c) => riskyClaims(`${creativeById(c.creativeId)!.headline} ${creativeById(c.creativeId)!.body}`).length > 0);

  const fulfill = (b: VisitBucket, orders: number, regularPrice: boolean) => {
    if (orders <= 0) return 0;
    const unitsPer = b.offer === 'bundle' ? 2 : 1;
    const stock = s.inventory[b.productId] ?? 0;
    const can = Math.min(orders, Math.floor(stock / unitsPer));
    if (can < orders) { rec.lostSales += orders - can; stockoutToday = true; }
    if (can <= 0) return 0;
    const prod = productById(b.productId);
    const price = regularPrice ? effectivePrice(s.store, b.productId) : effectivePrice(s.store, b.productId, b.offer);
    const freeShip = s.store.freeShipping || b.offer === 'freeship';
    const units = can * unitsPer;
    s.inventory[b.productId] = stock - units;
    const revenue = price * units + (freeShip ? 0 : SHIPPING_FEE * can);
    rec.revenue += revenue;
    rec.orders += can;
    rec.units += units;
    rec.cogs += units * prod.unitCost;
    rec.shipping += can * SHIPPING_COST;
    rec.ordersBySource[b.source] += can;
    rec.ordersBySegment[b.seg] = (rec.ordersBySegment[b.seg] ?? 0) + can;
    if (b.campaignId) {
      const cd = camps[b.campaignId];
      cd.clickConversions += can;
      cd.conversions += can;
      cd.revenue += revenue;
    }
    // satisfaction: product quality vs expectations set by price and hype
    const expectation = 0.55 + 0.003 * (price - 40) + (riskyActive ? 0.12 : 0);
    for (let i = 0; i < Math.min(can, 6); i++) satSamples.push(clamp(0.55 + (prod.quality - expectation) * 1.6 + rng.normal(0, 0.12), 0, 1));
    return can;
  };

  for (const b of visits) {
    if (b.visits <= 0) continue;
    rec.sessions[b.source] += b.visits;
    const seg = segOf(b.seg);
    const segState = b.seg === 'retarget' ? null : s.segments[b.seg];
    const price = perceivedPrice(s.store, b.productId, b.offer);
    const pf = priceFactor(seg, price);
    const senti = segState ? segState.sentiment.nova : 0.2;
    const novaU = pf * (0.5 + productById(b.productId).quality) * (1 + 0.5 * senti);
    const choice = clamp((novaU / (novaU + competitorUtility(seg, segState) * 0.6)) * 1.7, 0.25, 1.35);
    const angles = b.creative ? detectAngles(`${b.creative.headline} ${b.creative.body}`, b.offer) : [];
    const risky = b.creative ? riskyClaims(`${b.creative.headline} ${b.creative.body}`).length : 0;
    const trust = clamp(0.75 + 0.5 * seg.baseTrust + 0.3 * senti - 0.08 * risky * (1 - seg.baseTrust), 0.4, 1.4);
    const desc = seg.desc[s.store.descStyle];
    const match = b.creative ? messageMatch(angles, s.store) : 1;
    const srcMult = b.seg === 'retarget' ? 2.4 : SOURCE_CR[b.source];
    const cr = clamp(0.024 * b.intent * srcMult * pf * ux * trust * desc * match * choice, 0, 0.4);
    const orders = fulfill(b, rng.poisson(b.visits * cr), false);
    rec.newCustomers += orders;
    if (b.seg !== 'retarget' && b.source !== 'returning') s.retargetPool += Math.max(0, b.visits - orders);
  }
  s.retargetPool = Math.round(s.retargetPool * 0.93); // ~14-day window

  // Repeat purchases from customers ~4–6 weeks ago
  const cohort = s.history.slice(-45, -25).reduce((a, h) => a + h.newCustomers, 0);
  const repeatOrders = rng.poisson(cohort * 0.016 * Math.pow(s.satisfaction / 0.7, 2));
  if (repeatOrders > 0) {
    const n = fulfill({ seg: 'young_pros', source: 'returning', visits: repeatOrders, productId: pickProduct(rng), offer: 'none', intent: 1 }, repeatOrders, true);
    rec.sessions.returning += Math.round(repeatOrders * 1.6);
    rec.repeatOrders = n;
    s.repeatCustomers += n;
  }
  s.totalCustomers += rec.newCustomers;
  if (stockoutToday) events.push(`Out of stock! ${rec.lostSales} orders lost today.`);

  // ---------- SATISFACTION, REVIEWS, SENTIMENT, AWARENESS ----------
  if (satSamples.length) {
    const avg = satSamples.reduce((a, b) => a + b, 0) / satSamples.length;
    s.satisfaction = s.satisfaction * 0.85 + avg * 0.15;
    for (const sat of satSamples) {
      if (!rng.chance(0.22)) continue;
      const rating = clamp(Math.round(1 + 4 * sat + rng.normal(0, 0.5)), 1, 5);
      const segIds = Object.keys(rec.ordersBySegment) as Aud[];
      s.reviews.push({ day, rating, segment: rng.pick(segIds), productId: 'nova-c', ...reviewText(s.seed, day, s.reviews.length + s.totalCustomers, rating) });
    }
    if (s.reviews.length > 200) s.reviews = s.reviews.slice(-200);
  }
  for (const seg of SEGMENTS) {
    const st = s.segments[seg.id];
    for (const b of s.brands) {
      st.awareness[b.id] = clamp(st.awareness[b.id] * (b.id === 'nova' ? 0.995 : 0.998), b.id === 'nova' ? 0 : 0.05, 0.95);
    }
    // Word of mouth spreads awareness from customers
    st.awareness.nova = clamp(st.awareness.nova + (recentBySeg[seg.id] ?? 0) * 0.00002 * seg.socialInfluence * (1 + st.sentiment.nova), 0, 0.95);
    // Sentiment drifts toward what people experience (product) and see (ads)
    const segSignals = signals.filter((x) => x.segment === seg.id);
    const neg = segSignals.filter((x) => ['claim_skeptic', 'fatigue', 'irrelevant'].includes(x.reason)).reduce((a, x) => a + x.weight, 0);
    const pos = segSignals.filter((x) => ['love_angle', 'trend_match'].includes(x.reason)).reduce((a, x) => a + x.weight, 0);
    const exposure = Math.max(1, dailyReach[seg.id] ?? 0);
    const adTone = clamp((pos - neg * 1.3) / exposure, -0.6, 0.6);
    const target = clamp((s.satisfaction - 0.6) * 1.8 + adTone * 0.8 - (stockoutToday ? 0.15 : 0), -1, 1);
    const k = 0.03 + Math.min(0.08, (dailyReach[seg.id] ?? 0) / seg.population);
    st.sentiment.nova = st.sentiment.nova * (1 - k) + target * k;
  }

  // ---------- COMPETITOR SALES (for market share) ----------
  const brandOrders: Record<string, number> = { nova: rec.orders };
  for (const c of s.competitors) {
    const p = s.products.find((x) => x.brandId === c.brandId && x.id.endsWith('-c'))!;
    let o = 0;
    for (const seg of SEGMENTS) {
      const st = s.segments[seg.id];
      const base = seg.population * seg.inMarket * st.awareness[c.brandId] * 0.012;
      const paid = compClicks[c.brandId]?.[seg.id] ?? 0;
      o += (base + paid * 0.025) * priceFactor(seg, competitorPrice(s, p) + 3) * (0.6 + p.quality);
    }
    brandOrders[c.brandId] = o;
  }
  const totalOrders = Object.values(brandOrders).reduce((a, b) => a + b, 0) || 1;
  for (const [b, o] of Object.entries(brandOrders)) rec.competitorShare[b] = o / totalOrders;

  // ---------- SIGNALS for comments ----------
  if (stockoutToday) for (const c of playerActive) signals.push({ creativeId: c.creativeId, segment: 'young_pros', reason: 'stockout', weight: 5000 });
  const sat = s.satisfaction;
  signals.push({ creativeId: '', segment: 'young_pros', reason: sat > 0.62 ? 'happy_customer' : 'bad_experience', weight: rec.orders });
  s.signals = signals.sort((a, b) => b.weight - a.weight).slice(0, 60);

  // ---------- ATTRIBUTION & FINANCE ----------
  const organicOrdersBySeg: Partial<Record<Aud, number>> = {};
  // We don't track per-segment organic orders separately; approximate from total share
  const organicOrders = rec.ordersBySource.direct + rec.ordersBySource.organic_search + rec.ordersBySource.organic_social + rec.ordersBySource.returning;
  for (const seg of SEGMENTS) organicOrdersBySeg[seg.id] = organicOrders * (seg.population / 430000);
  for (const camp of playerActive) {
    const cd = camps[camp.id];
    if (!cd) continue;
    if (camp.channel === 'social') {
      // Platform claims view-through conversions: organic buyers who merely saw the ad
      let vt = 0;
      for (const a of camp.segments) {
        if (a === 'retarget') { vt += rec.ordersBySource.direct * 0.15; continue; }
        const r = (s.reachMemory[camp.id]?.[a] ?? 0) / audPop(a);
        vt += (organicOrdersBySeg[a] ?? 0) * clamp(r, 0, 1) * 0.7;
      }
      const vtN = Math.round(vt + rng.next() * 0.5);
      cd.conversions += vtN;
      cd.revenue += vtN * effectivePrice(s.store, 'nova-c');
      rec.platformReported.social += cd.conversions;
    } else {
      rec.platformReported.search += cd.conversions;
    }
    rec.adSpend += cd.spend;
  }
  rec.fees = rec.revenue * PAYMENT_FEE;
  rec.profit = rec.revenue - rec.cogs - rec.shipping - rec.fees - rec.adSpend - rec.fixed;
  s.cash += rec.profit;
  rec.cash = s.cash;

  // GA4-style view: cookie-consent loss pushes some paid/social traffic into "direct"
  for (const src of SOURCES) {
    const lossRate = src === 'paid_social' ? 0.28 : src === 'paid_search' ? 0.15 : src === 'organic_social' ? 0.35 : 0;
    const lostS = Math.round(rec.sessions[src] * lossRate);
    const lostO = Math.round(rec.ordersBySource[src] * lossRate);
    rec.ga4Sessions[src] += rec.sessions[src] - lostS;
    rec.ga4Sessions.direct += lostS;
    rec.ga4Orders[src] += rec.ordersBySource[src] - lostO;
    rec.ga4Orders.direct += lostO;
  }
  const totalPop = SEGMENTS.reduce((a, x) => a + x.population, 0);
  rec.awareness = SEGMENTS.reduce((a, x) => a + s.segments[x.id].awareness.nova * x.population, 0) / totalPop;
  rec.sentiment = SEGMENTS.reduce((a, x) => a + s.segments[x.id].sentiment.nova * x.population, 0) / totalPop;
  rec.satisfaction = s.satisfaction;

  s.day = day;
  s.history.push(rec);
  checkMilestones(s, rec, events);
  if (s.cash < 0 && s.status !== 'bankrupt') {
    s.status = 'bankrupt';
    events.push('Your cash went negative. NOVA Skincare is insolvent.');
  }
  s.log = [...events.map((e) => `Day ${day}: ${e}`), ...s.log].slice(0, 40);
  return rec;
}

function checkMilestones(s: GameState, rec: DayRecord, events: string[]) {
  const totalRevenue = s.history.reduce((a, h) => a + h.revenue, 0);
  const last7 = s.history.slice(-7);
  const done = (id: string, apply: () => void) => {
    const m = s.milestones.find((x) => x.id === id)!;
    if (m.done) return;
    m.done = true;
    m.doneDay = rec.day;
    apply();
    events.push(`🏆 Milestone: ${m.title} — ${m.reward}`);
  };
  if (rec.orders > 0) done('first_sale', () => (s.unlocks.spendLimit = Math.max(s.unlocks.spendLimit, 150)));
  if (totalRevenue >= 1000) done('rev_1k', () => (s.unlocks.retargeting = true));
  if (last7.length === 7 && last7.reduce((a, h) => a + h.profit, 0) > 0 && last7.reduce((a, h) => a + h.revenue, 0) >= 1500) done('profit_week', () => {
    s.unlocks.advancedMetrics = true;
    s.unlocks.spendLimit = Math.max(s.unlocks.spendLimit, 400);
  });
  if (totalRevenue >= 10000) done('rev_10k', () => {
    s.unlocks.product2 = true;
    s.unlocks.spendLimit = Math.max(s.unlocks.spendLimit, 1000);
    if (!s.products.some((p) => p.id === PLAYER_PRODUCT_2.id)) {
      s.products.push({ ...PLAYER_PRODUCT_2, launchedDay: rec.day });
      s.store.prices[PLAYER_PRODUCT_2.id] = PLAYER_PRODUCT_2.price;
      s.inventory[PLAYER_PRODUCT_2.id] = 150;
    }
  });
  if (s.cash >= WIN_CASH) done('win', () => (s.status = 'won'));
}

export interface AdvanceResult { state: GameState; days: DayRecord[]; ms: number }

export function advance(state: GameState, days: number): AdvanceResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const s = structuredClone(state);
  const out: DayRecord[] = [];
  for (let i = 0; i < days && s.status !== 'bankrupt'; i++) out.push(simulateDay(s));
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { state: s, days: out, ms };
}
