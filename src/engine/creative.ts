// Creative scoring: how much a given segment responds to an ad. Shared by the simulation,
// the creative pre-test, and competitor ads so they all obey the same rules.
import { ANGLE_WORDS, RISKY_CLAIMS, SEGMENTS } from './data';
import { clamp } from './rng';
import type { Angle, Creative, Mood, Offer, Segment, SegmentId, Trend } from './types';

export const ANGLES: Angle[] = ['glow', 'science', 'clean', 'antiaging', 'value'];
export const ANGLE_LABEL: Record<Angle, string> = { glow: 'Glow', science: 'Science', clean: 'Clean/Vegan', antiaging: 'Anti-aging', value: 'Value' };

export const OFFER_VALUE: Record<Offer, number> = { none: 0, off10: 0.1, off20: 0.2, freeship: 0.08, bundle: 0.12 };
export const OFFER_LABEL: Record<Offer, string> = { none: 'No offer', off10: '10% off', off20: '20% off', freeship: 'Free shipping', bundle: 'Bundle: 2 for 1.7×' };

export function detectAngles(text: string, offer: Offer = 'none'): Angle[] {
  const t = text.toLowerCase();
  const found = ANGLES.filter((a) => ANGLE_WORDS[a].some((w) => t.includes(w)));
  if (offer !== 'none' && !found.includes('value')) found.push('value');
  return found;
}

export function riskyClaims(text: string): string[] {
  const t = text.toLowerCase();
  return RISKY_CLAIMS.filter((c) => t.includes(c));
}

export interface CopyIssue { level: 'warn' | 'ok'; text: string }

export function copyChecks(c: Pick<Creative, 'headline' | 'body' | 'cta' | 'offer'>): { mult: number; issues: CopyIssue[] } {
  let mult = 1;
  const issues: CopyIssue[] = [];
  const h = c.headline.trim();
  if (h.length < 8) { mult *= 0.85; issues.push({ level: 'warn', text: 'Headline is very short — it may not communicate a benefit.' }); }
  else if (h.length > 45) { mult *= 0.88; issues.push({ level: 'warn', text: `Headline is ${h.length} chars; long headlines get truncated in feeds (aim ≤ 40).` }); }
  else issues.push({ level: 'ok', text: 'Headline length is feed-friendly.' });
  if (!c.body.trim()) { mult *= 0.92; issues.push({ level: 'warn', text: 'No body copy — you lose a chance to handle objections.' }); }
  else if (c.body.length > 140) { mult *= 0.9; issues.push({ level: 'warn', text: 'Body copy over 140 chars; most people won’t tap “more”.' }); }
  if (c.cta === 'Get Offer' && c.offer === 'none') { mult *= 0.85; issues.push({ level: 'warn', text: '“Get Offer” CTA with no offer feels like bait.' }); }
  if (c.offer !== 'none' && c.cta === 'Learn More') { mult *= 0.95; issues.push({ level: 'warn', text: 'You have an offer but a passive CTA — consider “Get Offer” or “Shop Now”.' }); }
  const angles = detectAngles(`${c.headline} ${c.body}`, c.offer);
  if (angles.length === 0) issues.push({ level: 'warn', text: 'No clear message angle detected — generic ads rarely stand out.' });
  if (angles.length >= 4) { mult *= 0.92; issues.push({ level: 'warn', text: 'Trying to say everything at once dilutes the message.' }); }
  return { mult, issues };
}

export function trendIntensity(t: Trend, day: number): number {
  if (day < t.startDay || day > t.endDay) return 0;
  if (day <= t.peakDay) return (day - t.startDay + 1) / (t.peakDay - t.startDay + 1);
  return 1 - (day - t.peakDay) / (t.endDay - t.peakDay + 1);
}

export function trendBoosts(trends: Trend[], day: number) {
  const angles: Record<Angle, number> = { glow: 1, science: 1, clean: 1, antiaging: 1, value: 1 };
  const moods: Record<Mood, number> = { white: 1, pastel: 1, bold: 1, green: 1, dark: 1 };
  for (const t of trends) {
    const k = trendIntensity(t, day) * t.strength;
    if (k <= 0) continue;
    angles[t.angle] += k;
    if (t.mood) moods[t.mood] += k * 0.5;
  }
  return { angles, moods };
}

export interface Appeal {
  score: number;
  angleFit: number;
  visualFit: number;
  offerFit: number;
  copyMult: number;
  claimMult: number;
  angles: Angle[];
  risky: string[];
}

function appealFor(c: Creative, seg: Segment, boosts: ReturnType<typeof trendBoosts>): Appeal {
  const angles = detectAngles(`${c.headline} ${c.body}`, c.offer);
  let angleFit = 0.75;
  if (angles.length) {
    angleFit = angles.reduce((s, a) => s + seg.angles[a] * boosts.angles[a], 0) / angles.length;
    // focused messages hit harder than the average of their parts
    const best = Math.max(...angles.map((a) => seg.angles[a] * boosts.angles[a]));
    angleFit = 0.6 * best + 0.4 * angleFit;
  }
  const visualFit = Math.pow(seg.moods[c.mood] * boosts.moods[c.mood] * seg.layouts[c.layout], 0.7);
  const offerFit = 1 + seg.priceSensitivity * OFFER_VALUE[c.offer] * 3;
  const { mult: copyMult } = copyChecks(c);
  const risky = riskyClaims(`${c.headline} ${c.body}`);
  // Hype grabs attention but skeptical segments punish it
  const claimMult = risky.length ? (1 + 0.07 * risky.length) * (1 - (1 - seg.baseTrust) * 0.22 * risky.length) : 1;
  const score = clamp(angleFit * visualFit * offerFit * copyMult * claimMult, 0.15, 3);
  return { score, angleFit, visualFit, offerFit, copyMult, claimMult, angles, risky };
}

export function creativeAppeal(c: Creative, segment: SegmentId | 'retarget', trends: Trend[], day: number): Appeal {
  const boosts = trendBoosts(trends, day);
  if (segment !== 'retarget') return appealFor(c, SEGMENTS.find((s) => s.id === segment)!, boosts);
  // Retargeting audience: a population-weighted blend of everyone who visited
  const total = SEGMENTS.reduce((s, x) => s + x.population, 0);
  const parts = SEGMENTS.map((s) => ({ w: s.population / total, a: appealFor(c, s, boosts) }));
  const first = parts[0].a;
  const blend = (k: keyof Appeal) => parts.reduce((s, p) => s + p.w * (p.a[k] as number), 0);
  return { ...first, score: blend('score'), angleFit: blend('angleFit'), visualFit: blend('visualFit'), offerFit: blend('offerFit'), claimMult: blend('claimMult') };
}
