// Builds the Pulse social feed from simulation state. Nothing here invents KPIs: comments are
// rendered from the day's reaction signals, mentions from reviews/sentiment, trends from state.
import { trendIntensity } from './creative';
import { SEGMENT_BY_ID } from './data';
import { makeRng, type Rng } from './rng';
import type { Creative, GameState, ReasonKind, SegmentId, Signal } from './types';

export interface FeedComment { author: string; text: string; likes: number; reason?: ReasonKind }
export interface FeedAd { kind: 'ad'; id: string; creative: Creative; isPlayer: boolean; likes: number; shares: number; commentCount: number; comments: FeedComment[] }
export interface FeedPost {
  kind: 'post'; id: string; author: string; handle: string; verified?: boolean; text: string; likes: number; shares: number;
  comments: FeedComment[]; tag?: string; productId?: string; rating?: number; badge?: string;
}
export type FeedItem = FeedAd | FeedPost;

const FIRST = ['zoe', 'maya', 'lena', 'sofia', 'emma', 'chloe', 'ines', 'clara', 'nina', 'jade', 'lucas', 'alex', 'marta', 'giulia', 'anaïs', 'noah', 'sara', 'eva', 'lea', 'tom', 'amira', 'yuki', 'priya', 'olga'];
const SUFFIX: Record<SegmentId | 'retarget', string[]> = {
  students: ['.glows', '_uni', 'xo', '.daily', '_2006', '.skin'],
  young_pros: ['.works', '_mtl', '.routine', '_paris', '.cph', ''],
  clean: ['.greenlife', '_vegan', '.plantmama', '.organic', '_zerowaste'],
  mature: ['_50', '.since74', '.m', '_grace', '.classic'],
  deals: ['.saves', '_coupons', '.deals', '_bargain', '.thrifty'],
  retarget: ['_', '.x', '.b'],
};
const name = (r: Rng, seg: SegmentId | 'retarget' = 'young_pros') => `${r.pick(FIRST)}${r.pick(SUFFIX[seg])}${r.chance(0.3) ? r.int(1, 99) : ''}`;

const BRAND_NAME: Record<string, string> = { nova: 'NOVA', lumiere: 'Lumière', glowgo: 'GlowGo', verde: 'Verde' };
const ANGLE_WORD: Record<string, string> = { glow: 'glow', science: 'formula', clean: 'vegan ingredients', antiaging: 'anti-aging angle', value: 'price' };

const T: Record<ReasonKind, string[]> = {
  love_angle: ['Okay the {angle} pitch actually speaks to me 😍', 'Finally an ad that gets what I want — {angle}!', 'This is exactly the {angle} I’ve been looking for', 'saving this, need that {angle} in my life ✨'],
  price_high: ['€{price}?? for a serum?? 💀', 'Looks nice but {price}€ is way out of my budget', 'Wish it was cheaper tbh', 'Pricey… is it really better than the drugstore ones?'],
  want_discount: ['Any discount code? 👀', 'I’ll wait for a sale', 'Drop a promo code and I’m in', 'Is there a student discount?'],
  offer_love: ['Okay that deal is tempting 👀', 'Just ordered with the offer, let’s see!', 'The discount got me lol', 'Tagging my sister, we need this deal'],
  claim_skeptic: ['“{claim}”? Where’s the study though?', 'Every brand says {claim}. Proof please.', 'Reported for misleading claims 🙄', 'Nothing is “{claim}”, come on'],
  fatigue: ['This is the 5th time I see this ad today 😩', 'Okay I GET IT, stop showing me this', 'My feed is literally just this ad now', 'Hide ad. Seen it 100 times.'],
  shipping: ['Shipping costs extra? Instant no.', 'Free shipping or I’m out', '€4.90 shipping on top… nah', 'Why is shipping not free in 2026'],
  ingredients_q: ['What’s the full ingredient list? Any fragrance?', 'Is it L-ascorbic acid or a derivative?', 'What’s the pH? Need more info before buying', 'Website doesn’t list INCI 🤔'],
  competitor_cheaper: ['{comp} has one for half the price', 'Just get {comp}, it’s on sale rn', 'Isn’t this just a {comp} dupe at double the price?', '{comp} works for me and costs less 🤷‍♀️'],
  stockout: ['It says sold out?? 😭', 'Why advertise if it’s out of stock', 'Tried to buy, out of stock. Ugh.', 'Restock when??'],
  trend_match: ['Perfect for my {tag} routine!', '{tag} girlies this is for you', 'Adding to my {tag} shelf', 'This would go viral on {tag}'],
  irrelevant: ['Why am I seeing this?', 'Not really my thing', 'Algorithm is confused lol', 'Skip.'],
  happy_customer: ['I’ve been using this for 3 weeks — my skin is so much brighter!', 'Bought it, love it, rebuying 💛', 'Honestly worth it. Texture is so nice.', 'My dark spots are fading 🥹'],
  bad_experience: ['Bought it, didn’t notice any difference', 'Meh. Expected more for the price.', 'Broke me out a little 😕', 'Not as good as the ad says'],
};

function fill(t: string, r: Rng, s: GameState, sig?: Signal) {
  const comp = sig?.extra && BRAND_NAME[sig.extra] ? BRAND_NAME[sig.extra] : r.pick(['GlowGo', 'Verde', 'Lumière']);
  return t
    .replace('{price}', String(Math.round(s.store.prices['nova-c'] * (1 - s.store.discountPct / 100))))
    .replace('{angle}', ANGLE_WORD[sig?.extra ?? 'glow'] ?? 'glow')
    .replace(/\{claim\}/g, sig?.extra ?? 'miracle')
    .replace('{comp}', comp)
    .replace('{tag}', sig?.extra ?? '#skincare');
}

/** Comments for one player creative, sampled in proportion to the day's reaction signals. */
export function commentsFor(s: GameState, creativeId: string, r: Rng, n: number): FeedComment[] {
  const sigs = s.signals.filter((x) => x.creativeId === creativeId);
  const extra = s.signals.filter((x) => x.creativeId === '' && x.weight > 0);
  const pool: Signal[] = [...sigs];
  // customers chime in on ads too
  for (const e of extra) pool.push({ ...e, creativeId, weight: Math.max(...sigs.map((x) => x.weight), 1) * 0.25 * Math.min(1, e.weight / 5) });
  const total = pool.reduce((a, x) => a + x.weight, 0);
  if (!total) return [];
  const out: FeedComment[] = [];
  for (let i = 0; i < n; i++) {
    let x = r.next() * total;
    const sig = pool.find((p) => (x -= p.weight) <= 0) ?? pool[0];
    out.push({ author: name(r, sig.segment), text: fill(r.pick(T[sig.reason]), r, s, sig), likes: r.int(0, 40), reason: sig.reason });
  }
  // dedupe identical texts
  return out.filter((c, i) => out.findIndex((d) => d.text === c.text) === i);
}

const REVIEW_TEXT: Record<number, string[]> = {
  5: ['Holy grail! Skin is glowing after 2 weeks.', 'Best serum I’ve tried, and I’ve tried many.', 'Gorgeous texture, no stickiness, visible results.', 'My dark spots are finally fading. Rebuying.', 'Absorbs fast, layers well under SPF. Love it.', 'Noticeably brighter skin — friends asked what changed!'],
  4: ['Really nice, subtle brightening. Would buy again.', 'Good product, a bit pricey but works.', 'Nice glow, fast delivery.', 'Works well, wish the bottle was bigger.', 'Gentle and effective. Took 3 weeks to see results.', 'Solid serum, slight tingle at first.'],
  3: ['It’s okay. Not sure it’s worth it yet.', 'Average. Expected more based on the ads.', 'Fine but nothing special.', 'Some brightening, but my old one was similar.', 'Decent, a little sticky.'],
  2: ['Didn’t see much difference after a month.', 'Smells a bit off, mediocre results.', 'Overhyped.', 'Not worth the price for me.', 'Pilled under my moisturizer.'],
  1: ['Broke me out. Returning.', 'Total waste of money.', 'Nothing like advertised.', 'Irritated my skin from day one.'],
};
export function reviewText(seed: number, day: number, idx: number, rating: number) {
  const r = makeRng(seed, 'review', day, idx);
  return { text: r.pick(REVIEW_TEXT[rating]), author: `${r.pick(FIRST)} ${String.fromCharCode(65 + r.int(0, 25))}.` };
}

export function generateFeed(s: GameState): { items: FeedItem[]; trends: { tag: string; posts: number; blurb: string }[] } {
  const r = makeRng(s.seed, 'feed', s.day);
  const last = s.history.at(-1);
  const posts: FeedPost[] = [];
  const ads: FeedAd[] = [];

  // Player ads currently delivering
  for (const c of s.campaigns.filter((c) => c.brandId === 'nova' && c.channel === 'social' && c.status === 'active')) {
    const cr = s.creatives.find((x) => x.id === c.creativeId);
    if (!cr || ads.some((a) => a.creative.id === cr.id)) continue;
    const eng = s.creativeEngagement[cr.id] ?? { likes: 0, comments: 0, shares: 0 };
    const comments = s.day > 0 ? commentsFor(s, cr.id, r, Math.min(8, 2 + Math.round(eng.comments / 20))) : [];
    ads.push({ kind: 'ad', id: `ad-${cr.id}`, creative: cr, isPlayer: true, likes: eng.likes, shares: eng.shares, commentCount: Math.max(eng.comments, comments.length), comments });
  }
  // Competitor ads
  for (const c of s.campaigns.filter((c) => c.brandId !== 'nova' && c.channel === 'social')) {
    const cr = s.creatives.find((x) => x.id === c.creativeId)!;
    const comp = s.competitors.find((x) => x.brandId === c.brandId)!;
    const likes = Math.round(c.dailyBudget * r.range(3, 7) * (s.day + 5));
    const comments: FeedComment[] = [];
    const ctext = comp.style === 'budget'
      ? ['ordered 3 lol', 'is it actually good tho?', 'cheap but kinda sticky', 'my fav dupe 💕', 'broke me out ngl']
      : comp.style === 'premium'
        ? ['Expensive but my skin loves it', 'Classic. My mom uses this.', 'Too pricey for me', 'The packaging is so elegant']
        : ['Love that it’s plastic-free 🌿', 'Smells like oranges!', 'Gentle on my sensitive skin', 'Wish it was stronger'];
    if (comp.discountPct) ctext.push(`${comp.discountPct}% off?? running 🏃‍♀️`, 'Sale ends when??');
    for (let i = 0; i < 3; i++) comments.push({ author: name(r, comp.style === 'budget' ? 'students' : comp.style === 'clean' ? 'clean' : 'mature'), text: r.pick(ctext), likes: r.int(0, 30) });
    ads.push({ kind: 'ad', id: `ad-${cr.id}`, creative: cr, isPlayer: false, likes, shares: Math.round(likes * 0.04), commentCount: Math.round(likes * 0.05), comments: comments.filter((c, i) => comments.findIndex((d) => d.text === c.text) === i) });
  }

  // Trend & influencer posts
  const live = s.trends.filter((t) => trendIntensity(t, s.day) > 0.05);
  for (const t of live) {
    const k = trendIntensity(t, s.day);
    const influencer = r.pick(['glowwithmia', 'dr.skinfacts', 'lenaloves', 'thebudgetbeauty', 'skinbyjules', 'paris.derm']);
    const lines: Record<string, string[]> = {
      glow: [`My ${t.tag} morning routine: vitamin C → moisturizer → SPF. That’s it. ✨`, `How to get the ${t.tag} look in 3 steps 👇`],
      clean: [`Decluttered my shelf for ${t.tag}. Only kept 4 products 🌿`, `Reading labels so you don’t have to ${t.tag}`],
      science: [`Derm here: vitamin C needs to be 10–20% and stable to work. ${t.tag}`, `Stop buying serums without % on the label. ${t.tag}`],
      value: [`Found a €20 dupe for a €70 serum ${t.tag} 😱`, `${t.tag}: you do NOT need luxury skincare`],
      antiaging: [`Started retinol + vitamin C at 26. ${t.tag} is real.`, `${t.tag}: SPF is the best anti-aging product, period.`],
    };
    posts.push({
      kind: 'post', id: `trend-${t.id}`, author: influencer, handle: `@${influencer}`, verified: true, tag: t.tag,
      text: r.pick(lines[t.angle]), likes: Math.round(8000 * k * r.range(0.6, 1.4)), shares: Math.round(600 * k),
      comments: [{ author: name(r, 'students'), text: r.pick(['Which serum do you use??', 'Need product recs!', 'Trying this tomorrow', 'Obsessed 😍']), likes: r.int(5, 200) },
        { author: name(r, 'young_pros'), text: r.pick(['Link please', 'Does this work for oily skin?', 'Ok but what brand?']), likes: r.int(5, 120) }],
      badge: k > 0.6 ? 'Trending' : undefined,
    });
  }

  // NOVA customer posts (from real reviews) and brand mentions (from sentiment)
  const recent = s.reviews.slice(-6);
  recent.forEach((rv, i) => {
    posts.push({ kind: 'post', id: `rv-${rv.day}-${i}`, author: name(r, rv.segment), handle: '', text: `${rv.text} #novaskincare`, rating: rv.rating, productId: rv.productId, likes: r.int(2, 60) * rv.rating, shares: r.int(0, 5), comments: [] });
  });
  if (last && last.lostSales > 0) posts.push({ kind: 'post', id: 'stockout', author: name(r, 'students'), handle: '', text: 'NOVA serum sold out?? I wanted to order today 😭 @novaskin restock pls', likes: r.int(10, 90), shares: r.int(1, 10), comments: [] });
  if (last && last.sentiment < -0.15) posts.push({ kind: 'post', id: 'neg', author: name(r, 'clean'), handle: '', text: 'Is it just me or are NOVA ads kind of misleading? Not buying the hype.', likes: r.int(20, 140), shares: r.int(2, 20), comments: [] });

  // Competitor chatter
  for (const c of s.competitors) {
    if (c.discountPct) posts.push({ kind: 'post', id: `sale-${c.brandId}`, author: name(r, 'deals'), handle: '', text: `${BRAND_NAME[c.brandId]} is ${c.discountPct}% off right now!! stocking up 🛒`, likes: r.int(30, 300), shares: r.int(5, 40), comments: [] });
    const np = s.products.find((p) => p.brandId === c.brandId && p.launchedDay > 0 && s.day - p.launchedDay < 10);
    if (np) posts.push({ kind: 'post', id: `np-${np.id}`, author: name(r, 'young_pros'), handle: '', text: `Has anyone tried the new ${np.name}? Thinking of getting it`, likes: r.int(10, 120), shares: r.int(0, 10), comments: [], productId: np.id });
  }
  const filler = ['Skincare is self care 🧴', 'SPF every day, even in winter. Non-negotiable.', 'What’s your one holy-grail product?', 'Trying to simplify my routine, any advice?', 'Hydration > everything', 'Does vitamin C actually do anything or is it marketing?'];
  for (let i = 0; i < 4; i++) {
    const seg = r.pick(Object.keys(SEGMENT_BY_ID) as SegmentId[]);
    posts.push({ kind: 'post', id: `f${i}`, author: name(r, seg), handle: '', text: r.pick(filler), likes: r.int(3, 400), shares: r.int(0, 20), comments: [] });
  }

  // Interleave: posts shuffled, an ad roughly every 3rd slot, player ads appear early
  for (let i = posts.length - 1; i > 0; i--) { const j = r.int(0, i); [posts[i], posts[j]] = [posts[j], posts[i]]; }
  ads.sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer) || r.next() - 0.5);
  const items: FeedItem[] = [];
  let ai = 0;
  posts.forEach((p, i) => {
    items.push(p);
    if (i % 3 === 1 && ai < ads.length) items.push(ads[ai++]);
  });
  while (ai < ads.length) items.push(ads[ai++]);

  const trends = s.trends
    .filter((t) => trendIntensity(t, s.day) > 0.05)
    .map((t) => ({ tag: t.tag, posts: Math.round(trendIntensity(t, s.day) * 42000 * t.strength), blurb: t.blurb }))
    .sort((a, b) => b.posts - a.posts);
  return { items, trends };
}
