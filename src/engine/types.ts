// Core data model. Everything in GameState is plain JSON so it can be saved to IndexedDB as-is.

export type SegmentId = 'students' | 'young_pros' | 'clean' | 'mature' | 'deals';
export type Angle = 'glow' | 'science' | 'clean' | 'antiaging' | 'value';
export type Mood = 'white' | 'pastel' | 'bold' | 'green' | 'dark';
export type Layout = 'hero' | 'split' | 'ugc' | 'minimal';
export type Offer = 'none' | 'off10' | 'off20' | 'freeship' | 'bundle';
export type Cta = 'Shop Now' | 'Learn More' | 'Get Offer' | 'Discover';
export type DescStyle = 'short' | 'detailed' | 'story';
export type Channel = 'social' | 'search';
export type TrafficSource = 'paid_social' | 'paid_search' | 'organic_search' | 'organic_social' | 'direct' | 'returning';

export interface Segment {
  id: SegmentId;
  name: string;
  blurb: string;
  population: number;
  priceSensitivity: number; // 0..1
  refPrice: number; // € a typical member considers "fair" for a serum
  inMarket: number; // daily share actively shopping for skincare
  adResponsiveness: number; // multiplier on CTR
  baseTrust: number; // 0..1 – how much they believe ads
  socialInfluence: number; // how much they talk / share
  socialUsage: number; // share of attention on social vs search
  searchUsage: number;
  angles: Record<Angle, number>;
  moods: Record<Mood, number>;
  layouts: Record<Layout, number>;
  desc: Record<DescStyle, number>;
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  short: string;
  price: number;
  unitCost: number;
  quality: number; // 0..1, drives satisfaction and reviews
  claims: string[]; // claims the product can legitimately support
  color: string; // bottle color
  keywords: string[];
  launchedDay: number;
}

export interface Brand {
  id: string;
  name: string;
  domain: string;
  tagline: string;
  color: string;
  isPlayer: boolean;
}

export interface Creative {
  id: string;
  name: string;
  productId: string;
  layout: Layout;
  mood: Mood;
  headline: string;
  body: string;
  cta: Cta;
  offer: Offer;
  createdDay: number;
  brandId: string;
  bgImage?: string; // optional AI-generated background (data URL / https)
}

export interface Campaign {
  id: string;
  name: string;
  brandId: string;
  channel: Channel;
  status: 'active' | 'paused';
  dailyBudget: number;
  creativeId: string;
  segments: (SegmentId | 'retarget')[]; // social targeting
  keywords: string[]; // search targeting
  maxCpc: number; // search bid
  createdDay: number;
}

export interface StoreConfig {
  headline: string;
  descStyle: DescStyle;
  showReviews: boolean;
  trustBadges: boolean;
  checkoutSteps: 1 | 2 | 3;
  freeShipping: boolean;
  discountPct: number; // sitewide 0..40
  prices: Record<string, number>; // productId -> price
}

export interface Trend {
  id: string;
  tag: string;
  angle: Angle;
  mood?: Mood;
  startDay: number;
  peakDay: number;
  endDay: number;
  strength: number; // max angle boost (e.g. 0.5 = +50%)
  blurb: string;
}

export interface CompetitorState {
  brandId: string;
  style: 'premium' | 'budget' | 'clean';
  socialBudget: number;
  searchBudget: number;
  discountPct: number;
  discountUntil: number;
  lastShare: number;
  reserveProductLaunched: boolean;
  bidsOnNova: boolean;
}

// Per-segment dynamic market state
export interface SegmentState {
  awareness: Record<string, number>; // brandId -> 0..1
  sentiment: Record<string, number>; // brandId -> -1..1
}

export interface ExposureState {
  // creativeId -> segment -> rolling 7-day impressions (approx)
  [creativeId: string]: Partial<Record<SegmentId | 'retarget', number>>;
}

export type ReasonKind =
  | 'love_angle' | 'price_high' | 'want_discount' | 'claim_skeptic' | 'fatigue'
  | 'competitor_cheaper' | 'shipping' | 'stockout' | 'trend_match' | 'irrelevant'
  | 'happy_customer' | 'bad_experience' | 'ingredients_q' | 'offer_love';

export interface Signal {
  creativeId: string;
  segment: SegmentId | 'retarget';
  reason: ReasonKind;
  weight: number;
  extra?: string;
}

export interface CampaignDay {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number; // platform-reported (incl. view-through)
  clickConversions: number; // true click-driven orders
  revenue: number; // platform-reported revenue
  frequency: number;
  lostIsBudget?: number; // search: share of impressions lost to budget
  avgPosition?: number;
  qualityScore?: number;
}

export interface DayRecord {
  day: number;
  revenue: number;
  orders: number;
  newCustomers: number;
  repeatOrders: number;
  units: number;
  cogs: number;
  shipping: number;
  fees: number;
  adSpend: number;
  fixed: number;
  profit: number;
  cash: number;
  sessions: Record<TrafficSource, number>;
  ordersBySource: Record<TrafficSource, number>;
  ga4Sessions: Record<TrafficSource, number>; // what analytics "sees" (consent loss)
  ga4Orders: Record<TrafficSource, number>;
  ordersBySegment: Partial<Record<SegmentId | 'retarget', number>>;
  lostSales: number;
  awareness: number; // player population-weighted awareness
  sentiment: number;
  satisfaction: number;
  campaigns: Record<string, CampaignDay>;
  platformReported: { social: number; search: number };
  competitorShare: Record<string, number>; // share of category orders
  events: string[];
}

export interface ReviewItem { day: number; rating: number; segment: SegmentId | 'retarget'; productId: string; text: string; author: string }

export interface Milestone { id: string; title: string; desc: string; reward: string; done: boolean; doneDay?: number }

export interface Settings {
  consumerAdapter: 'local' | 'remote';
  remoteSimUrl: string;
  imageApiUrl: string;
  imageApiKey: string;
}

export interface GameState {
  version: 1;
  seed: number;
  day: number; // last completed day (0 = nothing simulated yet)
  cash: number;
  status: 'playing' | 'bankrupt' | 'won';
  brands: Brand[];
  products: Product[];
  creatives: Creative[];
  campaigns: Campaign[];
  store: StoreConfig;
  inventory: Record<string, number>;
  incoming: { productId: string; qty: number; arrives: number }[];
  segments: Record<SegmentId, SegmentState>;
  exposure: ExposureState;
  reachMemory: Record<string, Partial<Record<SegmentId | 'retarget', number>>>; // campaign -> unique reach so far (7d window approx)
  retargetPool: number; // visitors who didn't buy, last ~14 days
  competitors: CompetitorState[];
  trends: Trend[];
  history: DayRecord[];
  signals: Signal[]; // last day only, feeds comments
  reviews: ReviewItem[]; // most recent N
  creativeEngagement: Record<string, { likes: number; comments: number; shares: number }>;
  satisfaction: number; // rolling, 0..1
  totalCustomers: number;
  repeatCustomers: number;
  milestones: Milestone[];
  unlocks: { retargeting: boolean; product2: boolean; advancedMetrics: boolean; spendLimit: number };
  log: string[]; // recent event messages
  settings: Settings;
}
