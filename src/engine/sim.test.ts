import { describe, expect, test } from 'vitest';
import { newGame } from './init';
import { advance } from './sim';
import type { GameState } from './types';

function setup(kind: 'idle' | 'starter' | 'good' | 'hype', seed = 42): GameState {
  const s = newGame(seed);
  if (kind === 'starter') {
    s.campaigns.push({ id: 'p1', name: 'x', brandId: 'nova', channel: 'social', status: 'active', dailyBudget: 60, creativeId: 'cr-starter', segments: ['students', 'young_pros', 'clean', 'mature', 'deals'], keywords: [], maxCpc: 0, createdDay: 0 });
  }
  if (kind === 'good') {
    s.creatives.push({ id: 'g', name: 'g', brandId: 'nova', productId: 'nova-c', layout: 'split', mood: 'white', headline: 'Bright, glowing skin — vegan', body: '15% vitamin C serum, dermatologist tested. Fades dark spots.', cta: 'Shop Now', offer: 'none', createdDay: 0 });
    s.store = { ...s.store, headline: 'Radiant glow, 15% vitamin C', checkoutSteps: 1, freeShipping: true, trustBadges: true, descStyle: 'detailed' };
    s.campaigns.push({ id: 'p1', name: 'x', brandId: 'nova', channel: 'social', status: 'active', dailyBudget: 50, creativeId: 'g', segments: ['young_pros', 'clean'], keywords: [], maxCpc: 0, createdDay: 0 });
    s.campaigns.push({ id: 'p2', name: 'y', brandId: 'nova', channel: 'search', status: 'active', dailyBudget: 25, creativeId: 'g', segments: [], keywords: ['vitamin c serum', 'best vitamin c serum', 'brightening serum', 'nova skincare'], maxCpc: 1.2, createdDay: 0 });
  }
  if (kind === 'hype') {
    s.creatives.push({ id: 'h', name: 'h', brandId: 'nova', productId: 'nova-c', layout: 'hero', mood: 'bold', headline: 'Miracle serum: erase wrinkles!', body: 'Clinically proven instant results. 20% off today.', cta: 'Get Offer', offer: 'off20', createdDay: 0 });
    s.campaigns.push({ id: 'p1', name: 'x', brandId: 'nova', channel: 'social', status: 'active', dailyBudget: 75, creativeId: 'h', segments: ['deals', 'students'], keywords: [], maxCpc: 0, createdDay: 0 });
  }
  return s;
}
const profit = (s: GameState) => s.history.reduce((a, d) => a + d.profit, 0);

describe('simulation', () => {
  test('is deterministic for a given seed', () => {
    const a = advance(setup('good', 7), 30).state;
    const b = advance(setup('good', 7), 30).state;
    expect(a.cash).toBe(b.cash);
    expect(a.history.map((h) => h.orders)).toEqual(b.history.map((h) => h.orders));
  });

  test('doing nothing loses money (fixed costs)', () => {
    expect(profit(advance(setup('idle'), 30).state)).toBeLessThan(0);
  });

  test('strategy matters across seeds: good > starter > hype', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const good = profit(advance(setup('good', seed), 30).state);
      const starter = profit(advance(setup('starter', seed), 30).state);
      const hype = profit(advance(setup('hype', seed), 30).state);
      expect(good).toBeGreaterThan(starter);
      expect(starter).toBeGreaterThan(hype);
    }
  });

  test('hype claims damage sentiment relative to honest ads', () => {
    const hype = advance(setup('hype'), 30).state.history.at(-1)!.sentiment;
    const good = advance(setup('good'), 30).state.history.at(-1)!.sentiment;
    expect(hype).toBeLessThan(good);
  });

  test('platforms over-report vs. true paid orders; GA4 under-reports paid', () => {
    const s = advance(setup('good'), 30).state;
    const platform = s.history.reduce((a, d) => a + d.platformReported.social + d.platformReported.search, 0);
    const truePaid = s.history.reduce((a, d) => a + d.ordersBySource.paid_social + d.ordersBySource.paid_search, 0);
    const gaPaid = s.history.reduce((a, d) => a + d.ga4Orders.paid_social + d.ga4Orders.paid_search, 0);
    expect(platform).toBeGreaterThan(truePaid);
    expect(gaPaid).toBeLessThan(truePaid);
  });

  test('finance identity holds every day', () => {
    const s = advance(setup('good'), 30).state;
    let cash = 5000;
    for (const d of s.history) {
      expect(d.profit).toBeCloseTo(d.revenue - d.cogs - d.shipping - d.fees - d.adSpend - d.fixed, 6);
      cash += d.profit;
      expect(d.cash).toBeCloseTo(cash, 6);
    }
  });

  test('overspending leads to insolvency', () => {
    const s = setup('starter');
    s.unlocks.spendLimit = 5000;
    s.campaigns.find((c) => c.id === 'p1')!.dailyBudget = 900;
    expect(advance(s, 30).state.status).toBe('bankrupt');
  });

  test('30 simulated days run fast (perf budget)', () => {
    const s = setup('good');
    for (let i = 0; i < 8; i++) s.campaigns.push({ ...s.campaigns.find((c) => c.id === 'p1')!, id: `extra${i}`, segments: ['students', 'young_pros', 'clean', 'mature', 'deals'] });
    s.unlocks.spendLimit = 2000;
    const r = advance(s, 30);
    console.log(`30 days with 10 player campaigns: ${r.ms.toFixed(1)} ms`);
    expect(r.ms).toBeLessThan(500); // target hardware goal is <2000ms; leave headroom
  });
});
