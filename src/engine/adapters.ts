// Pluggable external integrations. The game never depends on these: the local adapter is the
// default and the fallback. Remote results are validated and clamped before touching game state.
import { creativeAppeal } from './creative';
import { SEGMENTS } from './data';
import { clamp, makeRng } from './rng';
import type { Creative, GameState, SegmentId, Settings } from './types';

export interface PretestRow { segment: SegmentId; resonance: number; note: string }
export interface ConsumerSimAdapter {
  id: string;
  label: string;
  pretest(state: GameState, creative: Creative): Promise<PretestRow[]>;
}

const NOTES: Record<string, string> = {
  angleFit: 'message angle', visualFit: 'visual style', offerFit: 'offer', copyMult: 'copy craft', claimMult: 'claims',
};

/** Local panel: the engine's own appeal model + survey noise (a panel is never perfectly accurate). */
export const localAdapter: ConsumerSimAdapter = {
  id: 'local',
  label: 'Local audience panel',
  async pretest(state, creative) {
    const r = makeRng(state.seed, 'pretest', creative.id, state.day);
    return SEGMENTS.map((seg) => {
      const a = creativeAppeal(creative, seg.id, state.trends, state.day);
      const resonance = clamp(Math.round((a.score / 2) * 100 + r.normal(0, 7)), 0, 100);
      const factors = (['angleFit', 'visualFit', 'offerFit', 'copyMult', 'claimMult'] as const).map((k) => ({ k, v: a[k] }));
      const best = factors.reduce((x, y) => (y.v > x.v ? y : x));
      const worst = factors.reduce((x, y) => (y.v < x.v ? y : x));
      const note = worst.v < 0.9 ? `Put off by the ${NOTES[worst.k]}` : best.v > 1.15 ? `Responds to the ${NOTES[best.k]}` : 'Lukewarm';
      return { segment: seg.id, resonance, note };
    });
  },
};

/** Validate an untrusted payload into PretestRows. Throws on anything unusable. */
export function normalizeRemotePretest(payload: unknown): PretestRow[] {
  const rows = (payload as { segments?: unknown })?.segments;
  if (!Array.isArray(rows)) throw new Error('Response missing "segments" array');
  const known = new Set(SEGMENTS.map((s) => s.id));
  const out: PretestRow[] = [];
  for (const row of rows) {
    const id = (row as { id?: unknown })?.id;
    let v = Number((row as { resonance?: unknown })?.resonance);
    if (typeof id !== 'string' || !known.has(id as SegmentId) || !Number.isFinite(v)) continue;
    if (v <= 1) v *= 100; // accept 0..1 or 0..100
    const note = String((row as { note?: unknown }).note ?? '').slice(0, 80);
    out.push({ segment: id as SegmentId, resonance: clamp(Math.round(v), 0, 100), note });
  }
  if (!out.length) throw new Error('No valid segment rows in response');
  return out;
}

/** Optional multi-agent service (e.g. a MiroFish deployment behind a small HTTP shim). */
export function remoteAdapter(url: string): ConsumerSimAdapter {
  return {
    id: 'remote',
    label: 'Remote multi-agent simulation',
    async pretest(state, creative) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            task: 'creative_pretest',
            creative: { headline: creative.headline, body: creative.body, cta: creative.cta, offer: creative.offer, layout: creative.layout, mood: creative.mood },
            segments: SEGMENTS.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb })),
            trends: state.trends.filter((t) => t.endDay >= state.day).map((t) => t.tag),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return normalizeRemotePretest(await res.json());
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function getConsumerAdapter(settings: Settings): ConsumerSimAdapter {
  return settings.consumerAdapter === 'remote' && settings.remoteSimUrl ? remoteAdapter(settings.remoteSimUrl) : localAdapter;
}

/** Optional AI background generation. Expects `{ image: "data:image/..." | "https://..." }`. */
export async function generateBackground(settings: Settings, prompt: string): Promise<string> {
  if (!settings.imageApiUrl) throw new Error('No image API configured');
  const res = await fetch(settings.imageApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(settings.imageApiKey ? { Authorization: `Bearer ${settings.imageApiKey}` } : {}) },
    body: JSON.stringify({ prompt, size: '512x512' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { image?: unknown };
  const img = typeof data.image === 'string' ? data.image : '';
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(img) && !/^https:\/\//.test(img)) throw new Error('Response did not contain a usable image');
  if (img.length > 2_000_000) throw new Error('Image too large (keep under ~1.5 MB)');
  return img;
}
