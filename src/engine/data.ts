// Static scenario content for "NOVA Skincare". Tunable numbers live here, not in the engine.
import type { Angle, Brand, Creative, Mood, Product, Segment, SegmentId } from './types';

const A = (glow: number, science: number, clean: number, antiaging: number, value: number): Record<Angle, number> =>
  ({ glow, science, clean, antiaging, value });
const M = (white: number, pastel: number, bold: number, green: number, dark: number): Record<Mood, number> =>
  ({ white, pastel, bold, green, dark });

export const SEGMENTS: Segment[] = [
  {
    id: 'students', name: 'Gen-Z Students', blurb: '18–24, new to skincare, trend-driven, tight budget.',
    population: 120000, priceSensitivity: 0.8, refPrice: 28, inMarket: 0.011, adResponsiveness: 1.15,
    baseTrust: 0.45, socialInfluence: 1.4, socialUsage: 0.85, searchUsage: 0.35,
    angles: A(1.35, 0.8, 0.9, 0.35, 1.3), moods: M(0.9, 1.25, 1.25, 0.9, 0.7),
    layouts: { hero: 1, split: 0.85, ugc: 1.4, minimal: 0.8 }, desc: { short: 1.15, detailed: 0.85, story: 1.05 },
  },
  {
    id: 'young_pros', name: 'Young Professionals', blurb: '25–34, routine-minded, will pay for results.',
    population: 90000, priceSensitivity: 0.45, refPrice: 48, inMarket: 0.012, adResponsiveness: 1.0,
    baseTrust: 0.55, socialInfluence: 1.0, socialUsage: 0.65, searchUsage: 0.65,
    angles: A(1.2, 1.2, 1.0, 0.85, 0.8), moods: M(1.3, 1.1, 0.85, 1.0, 1.05),
    layouts: { hero: 1.1, split: 1.1, ugc: 1.0, minimal: 1.2 }, desc: { short: 1.0, detailed: 1.1, story: 1.0 },
  },
  {
    id: 'clean', name: 'Clean-Beauty Fans', blurb: 'Ingredient-label readers. Love vegan, hate hype.',
    population: 50000, priceSensitivity: 0.4, refPrice: 50, inMarket: 0.013, adResponsiveness: 0.9,
    baseTrust: 0.35, socialInfluence: 1.25, socialUsage: 0.7, searchUsage: 0.6,
    angles: A(0.95, 0.75, 1.65, 0.6, 0.7), moods: M(1.1, 1.0, 0.6, 1.5, 0.8),
    layouts: { hero: 1, split: 1.05, ugc: 1.1, minimal: 1.15 }, desc: { short: 0.85, detailed: 1.25, story: 1.15 },
  },
  {
    id: 'mature', name: 'Mature Skin 40+', blurb: 'Anti-aging focus, research before buying, search-heavy.',
    population: 70000, priceSensitivity: 0.3, refPrice: 62, inMarket: 0.012, adResponsiveness: 0.85,
    baseTrust: 0.5, socialInfluence: 0.7, socialUsage: 0.45, searchUsage: 0.9,
    angles: A(0.75, 1.4, 0.9, 1.65, 0.6), moods: M(1.15, 0.85, 0.7, 0.95, 1.4),
    layouts: { hero: 1.1, split: 1.15, ugc: 0.7, minimal: 1.05 }, desc: { short: 0.8, detailed: 1.3, story: 0.95 },
  },
  {
    id: 'deals', name: 'Deal Hunters', blurb: 'Coupon-clippers. Will switch brands for €5.',
    population: 100000, priceSensitivity: 0.95, refPrice: 24, inMarket: 0.01, adResponsiveness: 1.0,
    baseTrust: 0.4, socialInfluence: 0.9, socialUsage: 0.7, searchUsage: 0.6,
    angles: A(0.8, 0.6, 0.6, 0.6, 1.9), moods: M(0.8, 0.9, 1.35, 0.8, 0.7),
    layouts: { hero: 1.1, split: 1.0, ugc: 1.0, minimal: 0.75 }, desc: { short: 1.15, detailed: 0.85, story: 0.85 },
  },
];

export const SEGMENT_BY_ID = Object.fromEntries(SEGMENTS.map((s) => [s.id, s])) as Record<SegmentId, Segment>;

export const BRANDS: Brand[] = [
  { id: 'nova', name: 'NOVA Skincare', domain: 'novaskin.shop', tagline: 'Science you can feel.', color: '#f59e0b', isPlayer: true },
  { id: 'lumiere', name: 'Lumière Paris', domain: 'lumiere-paris.com', tagline: 'L’excellence anti-âge.', color: '#a16207', isPlayer: false },
  { id: 'glowgo', name: 'GlowGo', domain: 'glowgo.co', tagline: 'Glow for less.', color: '#ec4899', isPlayer: false },
  { id: 'verde', name: 'Verde Botanics', domain: 'verdebotanics.eu', tagline: 'Plants, not promises.', color: '#16a34a', isPlayer: false },
];

export const PRODUCTS: Product[] = [
  {
    id: 'nova-c', brandId: 'nova', name: 'NOVA Vitamin C Serum', short: 'Vitamin C Serum', price: 49, unitCost: 9,
    quality: 0.78, color: '#f59e0b', launchedDay: 0,
    claims: ['vitamin c', '15%', 'brighten', 'glow', 'vegan', 'cruelty', 'dermatologist tested', 'radiant', 'dark spot'],
    keywords: ['vitamin', 'serum', 'brightening', 'glow', 'vegan', 'dark', 'spot', 'nova', 'skincare'],
  },
  {
    id: 'lum-c', brandId: 'lumiere', name: 'Lumière Éclat C20', short: 'Éclat C20 Serum', price: 68, unitCost: 11,
    quality: 0.82, color: '#ca8a04', launchedDay: 0, claims: [],
    keywords: ['vitamin', 'serum', 'anti', 'aging', 'luxury', 'lumiere', 'wrinkle'],
  },
  {
    id: 'gg-c', brandId: 'glowgo', name: 'GlowGo C-Boost', short: 'C-Boost Serum', price: 22, unitCost: 5,
    quality: 0.55, color: '#ec4899', launchedDay: 0, claims: [],
    keywords: ['vitamin', 'serum', 'cheap', 'glow', 'glowgo', 'budget'],
  },
  {
    id: 'vb-c', brandId: 'verde', name: 'Verde Citrus Glow Serum', short: 'Citrus Glow Serum', price: 44, unitCost: 8,
    quality: 0.72, color: '#16a34a', launchedDay: 0, claims: [],
    keywords: ['vitamin', 'serum', 'clean', 'vegan', 'natural', 'verde', 'organic'],
  },
];

// Unlockable / reserve products (added to state when launched)
export const PLAYER_PRODUCT_2: Product = {
  id: 'nova-h', brandId: 'nova', name: 'NOVA Hydra Boost Moisturizer', short: 'Hydra Boost', price: 35, unitCost: 6,
  quality: 0.8, color: '#38bdf8', launchedDay: 0,
  claims: ['hyaluronic', 'hydrat', 'vegan', 'cruelty', 'dermatologist tested', 'glow', 'plump'],
  keywords: ['moisturizer', 'hyaluronic', 'hydrating', 'cream', 'nova', 'skincare', 'vegan'],
};

export const RESERVE_PRODUCTS: Record<string, Product> = {
  lumiere: { id: 'lum-r', brandId: 'lumiere', name: 'Lumière Retinol Nuit', short: 'Retinol Nuit', price: 79, unitCost: 13, quality: 0.84, color: '#78350f', launchedDay: 0, claims: [], keywords: ['retinol', 'night', 'anti', 'aging', 'wrinkle', 'lumiere'] },
  glowgo: { id: 'gg-r', brandId: 'glowgo', name: 'GlowGo Glow Gummies', short: 'Glow Gummies', price: 19, unitCost: 4, quality: 0.45, color: '#f472b6', launchedDay: 0, claims: [], keywords: ['gummies', 'glow', 'supplement', 'cheap', 'glowgo'] },
  verde: { id: 'vb-r', brandId: 'verde', name: 'Verde Bakuchiol Oil', short: 'Bakuchiol Oil', price: 39, unitCost: 7, quality: 0.76, color: '#15803d', launchedDay: 0, claims: [], keywords: ['bakuchiol', 'retinol', 'alternative', 'clean', 'oil', 'verde'] },
};

// Message angle detection: words in ad copy → angle
export const ANGLE_WORDS: Record<Angle, string[]> = {
  glow: ['glow', 'radiant', 'bright', 'luminous', 'dewy', 'glass skin', 'shine', 'brighten'],
  science: ['dermatolog', 'clinical', 'science', 'proven', '15%', 'formula', 'study', 'tested', 'stable', 'research'],
  clean: ['vegan', 'clean', 'natural', 'plant', 'cruelty', 'organic', 'non-toxic', 'fragrance-free', 'sustainable'],
  antiaging: ['wrinkle', 'aging', 'ageing', 'fine line', 'firm', 'youth', 'age', 'dark spot', 'collagen'],
  value: ['€', 'off', 'save', 'deal', 'sale', 'free', 'price', 'bundle', 'discount', 'cheap', 'affordable'],
};

// Phrases that are risky unless the product genuinely supports them
export const RISKY_CLAIMS = ['clinically proven', 'miracle', 'instant', 'guaranteed', 'erase', 'cure', '#1', 'best serum', 'overnight results', 'reverse aging', 'botox'];

export const MOOD_LABEL: Record<Mood, string> = { white: 'Clean White', pastel: 'Soft Pastel', bold: 'Bold Gradient', green: 'Botanical Green', dark: 'Luxury Dark' };

export interface Keyword {
  kw: string;
  volume: number; // base daily searches
  intent: number; // conversion multiplier
  mix: Partial<Record<SegmentId, number>>;
  brandId?: string;
  angle?: Angle;
}

export const KEYWORDS: Keyword[] = [
  { kw: 'vitamin c serum', volume: 650, intent: 1.0, mix: { students: 0.2, young_pros: 0.3, clean: 0.15, mature: 0.25, deals: 0.1 } },
  { kw: 'best vitamin c serum', volume: 380, intent: 1.15, mix: { young_pros: 0.4, mature: 0.35, clean: 0.15, students: 0.1 } },
  { kw: 'brightening serum', volume: 240, intent: 0.95, mix: { students: 0.35, young_pros: 0.4, clean: 0.1, mature: 0.15 }, angle: 'glow' },
  { kw: 'dark spot serum', volume: 220, intent: 1.05, mix: { mature: 0.5, young_pros: 0.35, clean: 0.15 }, angle: 'antiaging' },
  { kw: 'anti aging serum', volume: 360, intent: 0.9, mix: { mature: 0.75, young_pros: 0.25 }, angle: 'antiaging' },
  { kw: 'vegan skincare', volume: 210, intent: 0.75, mix: { clean: 0.65, young_pros: 0.2, students: 0.15 }, angle: 'clean' },
  { kw: 'clean beauty serum', volume: 150, intent: 0.95, mix: { clean: 0.8, young_pros: 0.2 }, angle: 'clean' },
  { kw: 'cheap skincare', volume: 420, intent: 0.45, mix: { deals: 0.6, students: 0.4 }, angle: 'value' },
  { kw: 'skincare routine', volume: 900, intent: 0.2, mix: { students: 0.45, young_pros: 0.35, clean: 0.1, mature: 0.1 } },
  { kw: 'glass skin', volume: 90, intent: 0.6, mix: { students: 0.65, young_pros: 0.35 }, angle: 'glow' },
  { kw: 'hyaluronic moisturizer', volume: 260, intent: 0.9, mix: { young_pros: 0.4, mature: 0.3, clean: 0.15, students: 0.15 } },
  { kw: 'nova skincare', volume: 0, intent: 1.6, mix: {}, brandId: 'nova' },
  { kw: 'lumiere serum', volume: 0, intent: 1.5, mix: {}, brandId: 'lumiere' },
  { kw: 'glowgo', volume: 0, intent: 1.4, mix: {}, brandId: 'glowgo' },
  { kw: 'verde botanics', volume: 0, intent: 1.5, mix: {}, brandId: 'verde' },
];

export const TREND_POOL: { tag: string; angle: Angle; mood?: Mood; blurb: string }[] = [
  { tag: '#glassskin', angle: 'glow', mood: 'pastel', blurb: 'Dewy, poreless “glass skin” looks are everywhere.' },
  { tag: '#skinimalism', angle: 'clean', mood: 'white', blurb: 'Fewer products, cleaner routines.' },
  { tag: '#dermtok', angle: 'science', mood: 'white', blurb: 'Dermatologists explaining ingredients go viral.' },
  { tag: '#dupeculture', angle: 'value', mood: 'bold', blurb: 'Everyone is hunting cheaper “dupes” of luxury skincare.' },
  { tag: '#cleangirl', angle: 'clean', mood: 'green', blurb: 'Natural, minimal, plant-powered aesthetics.' },
  { tag: '#prejuvenation', angle: 'antiaging', mood: 'dark', blurb: 'Twenty-somethings starting anti-aging early.' },
  { tag: '#vitaminCszn', angle: 'glow', mood: 'bold', blurb: 'Autumn = vitamin C season for post-summer dark spots.' },
];

// Pre-written competitor creatives (they "rotate" through these)
export const COMPETITOR_CREATIVES: Creative[] = [
  { id: 'c-lum-1', name: 'Éclat', brandId: 'lumiere', productId: 'lum-c', layout: 'minimal', mood: 'dark', headline: 'Visibly firmer skin in 4 weeks', body: '20% Vitamin C, dermatologist developed in Paris. Fine lines, refined.', cta: 'Discover', offer: 'none', createdDay: 0 },
  { id: 'c-lum-2', name: 'Éclat Gift', brandId: 'lumiere', productId: 'lum-c', layout: 'hero', mood: 'dark', headline: 'The anti-aging ritual, perfected', body: 'Luxury formula. Complimentary gift with every order.', cta: 'Shop Now', offer: 'freeship', createdDay: 0 },
  { id: 'c-gg-1', name: 'Cheap glow', brandId: 'glowgo', productId: 'gg-c', layout: 'ugc', mood: 'bold', headline: 'Glow for €22?! 😱', body: 'Same vitamin C glow as the €60 brands. TikTok made me buy it.', cta: 'Get Offer', offer: 'off10', createdDay: 0 },
  { id: 'c-gg-2', name: 'Dupe', brandId: 'glowgo', productId: 'gg-c', layout: 'hero', mood: 'bold', headline: 'The viral vitamin C dupe', body: 'Bright skin, tiny price. Bundle & save 20%.', cta: 'Shop Now', offer: 'bundle', createdDay: 0 },
  { id: 'c-vb-1', name: 'Plants', brandId: 'verde', productId: 'vb-c', layout: 'split', mood: 'green', headline: 'Glow, the natural way', body: 'Organic citrus vitamin C. Vegan, cruelty-free, plastic-free bottle.', cta: 'Learn More', offer: 'none', createdDay: 0 },
  { id: 'c-vb-2', name: 'Clean', brandId: 'verde', productId: 'vb-c', layout: 'minimal', mood: 'green', headline: 'Clean skincare that actually works', body: '12 plant ingredients. Nothing to hide.', cta: 'Shop Now', offer: 'freeship', createdDay: 0 },
  { id: 'c-lum-r', name: 'Retinol', brandId: 'lumiere', productId: 'lum-r', layout: 'hero', mood: 'dark', headline: 'New: Retinol Nuit', body: 'Wake up to smoother skin. Parisian night ritual.', cta: 'Discover', offer: 'none', createdDay: 0 },
  { id: 'c-gg-r', name: 'Gummies', brandId: 'glowgo', productId: 'gg-r', layout: 'ugc', mood: 'pastel', headline: 'Glow from the inside 🍬', body: 'Tasty vitamin gummies. €19, 2 for €30.', cta: 'Get Offer', offer: 'bundle', createdDay: 0 },
  { id: 'c-vb-r', name: 'Bakuchiol', brandId: 'verde', productId: 'vb-r', layout: 'split', mood: 'green', headline: 'The plant retinol alternative', body: 'Bakuchiol oil — gentle, vegan, and pregnancy-safe.', cta: 'Learn More', offer: 'none', createdDay: 0 },
];

export const COMPETITOR_PROFILE: Record<string, { segments: SegmentId[]; keywords: string[]; cpc: number; angles: Angle[] }> = {
  lumiere: { segments: ['mature', 'young_pros'], keywords: ['anti aging serum', 'best vitamin c serum', 'dark spot serum', 'vitamin c serum', 'lumiere serum'], cpc: 1.6, angles: ['antiaging', 'science'] },
  glowgo: { segments: ['students', 'deals'], keywords: ['cheap skincare', 'vitamin c serum', 'brightening serum', 'glowgo', 'skincare routine', 'glass skin'], cpc: 0.7, angles: ['value', 'glow'] },
  verde: { segments: ['clean', 'young_pros'], keywords: ['vegan skincare', 'clean beauty serum', 'vitamin c serum', 'verde botanics'], cpc: 1.1, angles: ['clean'] },
};

export const FIXED_COST_PER_DAY = 35; // shop platform, apps, tools
export const SHIPPING_COST = 4.5; // what we pay the carrier per order
export const SHIPPING_FEE = 4.9; // what the customer pays if no free shipping
export const PAYMENT_FEE = 0.029;
export const RESTOCK_LEAD_DAYS = 4;
export const WIN_CASH = 15000;
