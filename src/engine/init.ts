import { BRANDS, COMPETITOR_CREATIVES, COMPETITOR_PROFILE, PRODUCTS, SEGMENTS } from './data';
import type { Campaign, GameState, SegmentId, SegmentState } from './types';

const START_AWARENESS: Record<string, number> = { nova: 0.01, lumiere: 0.22, glowgo: 0.18, verde: 0.1 };
const START_SENTIMENT: Record<string, number> = { nova: 0.1, lumiere: 0.3, glowgo: 0.0, verde: 0.25 };

export function competitorCampaigns(brandId: string, socialBudget: number, searchBudget: number, day: number, creativeId: string): Campaign[] {
  const p = COMPETITOR_PROFILE[brandId];
  return [
    { id: `cmp-${brandId}-social`, name: `${brandId} social`, brandId, channel: 'social', status: 'active', dailyBudget: socialBudget, creativeId, segments: p.segments, keywords: [], maxCpc: 0, createdDay: day },
    { id: `cmp-${brandId}-search`, name: `${brandId} search`, brandId, channel: 'search', status: 'active', dailyBudget: searchBudget, creativeId, segments: [], keywords: p.keywords, maxCpc: p.cpc, createdDay: day },
  ];
}

export function newGame(seed = Math.floor(Math.random() * 1e9)): GameState {
  const segments = {} as Record<SegmentId, SegmentState>;
  for (const s of SEGMENTS) {
    segments[s.id] = { awareness: { ...START_AWARENESS }, sentiment: { ...START_SENTIMENT } };
  }
  const competitors = [
    { brandId: 'lumiere', style: 'premium' as const, socialBudget: 110, searchBudget: 90 },
    { brandId: 'glowgo', style: 'budget' as const, socialBudget: 170, searchBudget: 50 },
    { brandId: 'verde', style: 'clean' as const, socialBudget: 70, searchBudget: 40 },
  ];
  const firstCreative = (b: string) => COMPETITOR_CREATIVES.find((c) => c.brandId === b)!.id;
  return {
    version: 1,
    seed,
    day: 0,
    cash: 5000,
    status: 'playing',
    brands: BRANDS,
    products: PRODUCTS.map((p) => ({ ...p })),
    creatives: [
      ...COMPETITOR_CREATIVES.filter((c) => !c.productId.endsWith('-r')),
      {
        id: 'cr-starter', name: 'Starter ad', brandId: 'nova', productId: 'nova-c', layout: 'hero', mood: 'white',
        headline: 'Meet NOVA Vitamin C Serum', body: 'Our new serum. Try it today.', cta: 'Shop Now', offer: 'none', createdDay: 0,
      },
    ],
    campaigns: competitors.flatMap((c) => competitorCampaigns(c.brandId, c.socialBudget, c.searchBudget, 0, firstCreative(c.brandId))),
    store: {
      headline: 'NOVA Vitamin C Serum',
      descStyle: 'short',
      showReviews: true,
      trustBadges: false,
      checkoutSteps: 3,
      freeShipping: false,
      discountPct: 0,
      prices: { 'nova-c': 49 },
    },
    inventory: { 'nova-c': 250 },
    incoming: [],
    segments,
    exposure: {},
    reachMemory: {},
    retargetPool: 0,
    competitors: competitors.map((c) => ({ ...c, discountPct: 0, discountUntil: -1, lastShare: 0, reserveProductLaunched: false, bidsOnNova: false })),
    trends: [{ id: 't0', tag: '#vitaminCszn', angle: 'glow', mood: 'bold', startDay: -3, peakDay: 5, endDay: 16, strength: 0.45, blurb: 'Autumn = vitamin C season for post-summer dark spots.' }],
    history: [],
    signals: [],
    reviews: [],
    creativeEngagement: {},
    satisfaction: 0.75,
    totalCustomers: 0,
    repeatCustomers: 0,
    milestones: [
      { id: 'first_sale', title: 'First sale', desc: 'Get your first order.', reward: 'Ad spending limit raised to €150/day', done: false },
      { id: 'rev_1k', title: '€1,000 revenue', desc: 'Reach €1,000 in total revenue.', reward: 'Retargeting audiences unlocked', done: false },
      { id: 'profit_week', title: 'Profitable week', desc: 'Make a profit over 7 days on at least €1,500 of revenue.', reward: 'Advanced metrics + €400/day limit', done: false },
      { id: 'rev_10k', title: '€10,000 revenue', desc: 'Reach €10,000 in total revenue.', reward: 'New product: Hydra Boost Moisturizer + €1,000/day limit', done: false },
      { id: 'win', title: 'Sustainable brand', desc: 'Grow cash to €15,000.', reward: 'Scenario complete', done: false },
    ],
    unlocks: { retargeting: false, product2: false, advancedMetrics: false, spendLimit: 75 },
    log: ['Welcome to NOVA Skincare. You have €5,000 and 250 serums. New ad accounts start with a €75/day spending limit.'],
    settings: { consumerAdapter: 'local', remoteSimUrl: '', imageApiUrl: '', imageApiKey: '' },
  };
}
