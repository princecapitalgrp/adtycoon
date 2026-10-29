import { create } from 'zustand';
import { getConsumerAdapter, localAdapter, type PretestRow } from '../engine/adapters';
import { RESTOCK_LEAD_DAYS } from '../engine/data';
import { newGame } from '../engine/init';
import { advance } from '../engine/sim';
import type { Campaign, Creative, DayRecord, GameState, Settings, StoreConfig } from '../engine/types';
import { loadGame, saveGame } from './db';

export type Tab = 'social' | 'search' | 'store' | 'ads' | 'studio' | 'analytics';
export type SiteRoute =
  | { type: 'product'; productId: string }
  | { type: 'site'; brandId: string }
  | { type: 'article'; articleId: string }
  | { type: 'bestof' }
  | { type: 'trend'; tag: string };

interface Summary { days: number; ms: number; revenue: number; orders: number; spend: number; profit: number; events: string[] }

interface GameStore {
  game: GameState | null;
  hasSave: boolean | null;
  savedAt: number | null;
  tab: Tab;
  search: { query: string; site: SiteRoute | null; history: SiteRoute[] };
  studioCreativeId: string | null;
  adsDraftCreativeId: string | null;
  summary: Summary | null;
  pretest: Record<string, { rows: PretestRow[]; source: string; error?: string }>;
  busy: boolean;

  boot(): Promise<void>;
  startNew(seed?: number): void;
  continueSave(): Promise<void>;
  advanceDays(n: number): void;
  setTab(t: Tab): void;
  runSearch(q: string): void;
  openSite(r: SiteRoute | null): void;
  backSite(): void;
  openStudio(creativeId: string | null): void;
  launchCreative(creativeId: string): void;
  upsertCreative(c: Creative): void;
  deleteCreative(id: string): string | null;
  upsertCampaign(c: Campaign): void;
  deleteCampaign(id: string): void;
  updateStore(patch: Partial<StoreConfig>): void;
  orderStock(productId: string, qty: number): string | null;
  runPretest(creativeId: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;
  dismissSummary(): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(get: () => GameStore, set: (p: Partial<GameStore>) => void) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const g = get().game;
    if (!g) return;
    try {
      await saveGame(g);
      set({ savedAt: Date.now() });
    } catch (e) {
      console.warn('Save failed', e);
    }
  }, 400);
}

export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useGame = create<GameStore>((set, get) => {
  const mutate = (fn: (g: GameState) => GameState) => {
    const g = get().game;
    if (!g) return;
    set({ game: fn(g) });
    scheduleSave(get, set);
  };
  return {
    game: null,
    hasSave: null,
    savedAt: null,
    tab: 'social',
    search: { query: '', site: null, history: [] },
    studioCreativeId: null,
    adsDraftCreativeId: null,
    summary: null,
    pretest: {},
    busy: false,

    async boot() {
      try {
        const row = await loadGame();
        set({ hasSave: !!row, savedAt: row?.savedAt ?? null });
      } catch {
        set({ hasSave: false });
      }
    },
    startNew(seed) {
      set({ game: newGame(seed), tab: 'social', summary: null, pretest: {}, search: { query: '', site: null, history: [] }, studioCreativeId: null });
      scheduleSave(get, set);
    },
    async continueSave() {
      const row = await loadGame();
      if (row) set({ game: row.state, savedAt: row.savedAt });
    },
    advanceDays(n) {
      const g = get().game;
      if (!g || g.status === 'bankrupt' || get().busy) return;
      set({ busy: true });
      const r = advance(g, n);
      const sum = (k: keyof Pick<DayRecord, 'revenue' | 'orders' | 'adSpend' | 'profit'>) => r.days.reduce((a, d) => a + d[k], 0);
      set({
        game: r.state,
        busy: false,
        summary: { days: r.days.length, ms: r.ms, revenue: sum('revenue'), orders: sum('orders'), spend: sum('adSpend'), profit: sum('profit'), events: r.days.flatMap((d) => d.events.map((e) => `Day ${d.day}: ${e}`)).slice(-6) },
      });
      scheduleSave(get, set);
    },
    setTab(tab) { set({ tab }); },
    runSearch(query) { set({ tab: 'search', search: { query, site: null, history: [] } }); },
    openSite(site) {
      const s = get().search;
      set({ tab: 'search', search: { ...s, site, history: s.site ? [...s.history, s.site] : s.history } });
    },
    backSite() {
      const s = get().search;
      const history = [...s.history];
      const site = history.pop() ?? null;
      set({ search: { ...s, site, history } });
    },
    openStudio(id) { set({ tab: 'studio', studioCreativeId: id }); },
    launchCreative(id) { set({ tab: 'ads', adsDraftCreativeId: id }); },
    upsertCreative(c) {
      mutate((g) => ({ ...g, creatives: g.creatives.some((x) => x.id === c.id) ? g.creatives.map((x) => (x.id === c.id ? c : x)) : [...g.creatives, c] }));
    },
    deleteCreative(id) {
      const g = get().game!;
      if (g.campaigns.some((c) => c.brandId === 'nova' && c.creativeId === id)) return 'This creative is used by a campaign. Switch or delete that campaign first.';
      mutate((g) => ({ ...g, creatives: g.creatives.filter((c) => c.id !== id) }));
      return null;
    },
    upsertCampaign(c) {
      mutate((g) => ({ ...g, campaigns: g.campaigns.some((x) => x.id === c.id) ? g.campaigns.map((x) => (x.id === c.id ? c : x)) : [...g.campaigns, c] }));
      set({ adsDraftCreativeId: null });
    },
    deleteCampaign(id) { mutate((g) => ({ ...g, campaigns: g.campaigns.filter((c) => c.id !== id) })); },
    updateStore(patch) { mutate((g) => ({ ...g, store: { ...g.store, ...patch, prices: { ...g.store.prices, ...(patch.prices ?? {}) } } })); },
    orderStock(productId, qty) {
      const g = get().game!;
      const p = g.products.find((x) => x.id === productId)!;
      const discount = qty >= 500 ? 0.85 : qty >= 250 ? 0.92 : 1;
      const cost = Math.round(qty * p.unitCost * discount);
      if (cost > g.cash) return `Not enough cash (need €${cost}).`;
      mutate((g) => ({
        ...g,
        cash: g.cash - cost,
        incoming: [...g.incoming, { productId, qty, arrives: g.day + RESTOCK_LEAD_DAYS }],
        log: [`Day ${g.day}: Ordered ${qty} × ${p.short} for €${cost}. Arrives day ${g.day + RESTOCK_LEAD_DAYS}.`, ...g.log].slice(0, 40),
      }));
      return null;
    },
    async runPretest(creativeId) {
      const g = get().game!;
      const c = g.creatives.find((x) => x.id === creativeId)!;
      const COST = 100;
      if (g.cash < COST) return;
      mutate((g) => ({ ...g, cash: g.cash - COST, log: [`Day ${g.day}: Audience pre-test for “${c.name}” (€${COST}).`, ...g.log].slice(0, 40) }));
      const adapter = getConsumerAdapter(g.settings);
      try {
        const rows = await adapter.pretest(g, c);
        set({ pretest: { ...get().pretest, [creativeId]: { rows, source: adapter.label } } });
      } catch (e) {
        const rows = await localAdapter.pretest(g, c);
        set({ pretest: { ...get().pretest, [creativeId]: { rows, source: localAdapter.label, error: `${adapter.label} failed (${(e as Error).message}); used local panel.` } } });
      }
    },
    updateSettings(patch) { mutate((g) => ({ ...g, settings: { ...g.settings, ...patch } })); },
    dismissSummary() { set({ summary: null }); },
  };
});
