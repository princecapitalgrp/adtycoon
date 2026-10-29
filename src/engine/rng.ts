// Seeded PRNG utilities. Every random draw in the simulation flows through an Rng derived
// from (seed, day, stream) so outcomes are reproducible and independent of UI interactions.

export interface Rng {
  next(): number; // [0,1)
  range(a: number, b: number): number;
  int(a: number, b: number): number; // inclusive
  pick<T>(arr: readonly T[]): T;
  normal(mean?: number, sd?: number): number;
  poisson(lambda: number): number;
  chance(p: number): boolean;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: number, ...stream: (string | number)[]): Rng {
  let a = (seed ^ hashString(stream.join('|'))) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mean = 0, sd = 1) => {
    const u = Math.max(next(), 1e-9);
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    normal,
    poisson(lambda) {
      if (lambda <= 0) return 0;
      if (lambda > 40) return Math.max(0, Math.round(normal(lambda, Math.sqrt(lambda))));
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > L);
      return k - 1;
    },
    chance: (p) => next() < p,
  };
}

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
