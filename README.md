# AdTycoon — NOVA Skincare

A lightweight, offline, single-player digital-marketing simulation. You run a skincare DTC brand inside a miniature internet:
a social feed (**Pulse**), a search engine (**Seekr**), your **store admin**, an **Ads Manager**, a **Creative Studio**, and **Analytics**.

No backend, no Docker, no local AI models. Everything runs in the browser; saves go to IndexedDB.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build (what you should measure performance on):

```bash
npm run build && npm run preview   # http://localhost:4173
```

Tests (determinism, finance identity, strategy ordering, insolvency, perf budget):

```bash
npm test
```

## Measuring the performance targets on your Mac

Treat these as things to measure, not promises. Numbers from the cloud build container (not your hardware):

| Target | Measured in container | How to check on your MacBook Air |
|---|---|---|
| 30 simulated days < 2 s | 33–72 ms engine time (10 campaigns); ~170 ms click→render | The toast after **+30** shows engine ms. Or `npm run bench` |
| Initial load < 5 s | ~130 ms to start screen (local preview) | Chrome DevTools → Network/Performance on `npm run preview` |
| < 200 MB app memory | JS heap ≈ 6–7 MB after 37 days | Chrome → ⋮ → More tools → Task Manager (look at the tab’s *Memory footprint*, not just JS heap) |
| Startup JS | 122 KB gzipped; Recharts (114 KB gz) loads only when Analytics opens | `npm run build` output |

The JS heap is not the whole tab footprint: Chrome’s renderer process will be larger (typically tens of MB). Check the Task Manager number before quoting it.

## How the simulation works

`src/engine/` is plain TypeScript with no React, and it is fully deterministic: every random draw comes from `makeRng(seed, 'day', n)`.

One `simulateDay()` call:
1. Trends start, peak, and fade. Competitors run their rules (flash sales, budget changes, bidding on your brand name, new launches).
2. **Social auction.** Each audience's CPM rises with total demand from you and competitors. Budget goes to the audiences that engage. Impressions turn into reach, frequency, fatigue, CTR, and clicks.
3. **Search auction.** Keyword volume depends on trends, and brand-keyword volume depends on awareness. Ad rank = bid × Quality Score, and clicks are capped by budget. Organic clicks depend on SEO authority, reviews, and awareness.
4. Direct and word-of-mouth visits come from awareness and recent customers.
5. **Purchase decision** for each visit bucket: price vs. the segment's reference price × store UX × trust/sentiment × description fit × ad→landing message match × competitor choice share.
6. Inventory, stockouts, repeat purchases, satisfaction, reviews, sentiment, awareness.
7. Attribution: what the platforms report (with view-through and brand credit), what GA4 sees (cookie-consent loss), and the store's real numbers.
8. Finance: revenue − COGS − shipping − fees − ad spend − fixed costs, then milestones and the insolvency check.

The feed (`feed.ts`) and search results (`search.ts`) are **views of state**. Comments are sampled from the day's reaction signals, e.g. `price_high`, `claim_skeptic`, `fatigue`, `ingredients_q`. So when a comment says "where's the study?", that is the engine telling you your claims cost you trust.

Tunable numbers live in `src/engine/data.ts`.

## Optional integrations

The game never depends on these. Configure them under ⚙️:

- **Audience pre-test adapter** (`adapters.ts`): local panel by default. Can be pointed at an HTTP shim in front of MiroFish or any multi-agent simulator. The response is validated and clamped, and failures fall back to local.
- **AI background generator**: any endpoint returning `{ image: dataURL | https URL }`.

Neither has been tested against a real MiroFish or image API. The contracts are documented in the Settings modal.

## Known gaps / next steps

- Calibration is a first pass, sanity-checked by the tests rather than by real benchmark data.
- Not built yet: geographic markets, Google-Shopping-style campaigns, LLM-written comments, dark mode.
- The pre-test fee (€100) comes out of cash but not out of daily P&L "profit".
- Checkout and store changes are free and instant. Real stores pay for them in time or money.
