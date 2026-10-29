import { lazy, Suspense, useEffect, useState } from 'react';
import { useGame, type Tab } from '../store/game';
import { eur } from './format';
import { SettingsModal } from './components/Settings';
import { Social } from './tabs/Social';
import { SearchTab } from './tabs/Search';
import { StoreTab } from './tabs/Store';
import { AdsManager } from './tabs/AdsManager';
import { Studio } from './tabs/Studio';

// Recharts is the heaviest dependency; load it only when Analytics is opened.
const Analytics = lazy(() => import('./tabs/Analytics'));

const TABS: { id: Tab; label: string; icon: string; url: (q: string) => string }[] = [
  { id: 'social', label: 'Pulse', icon: '💬', url: () => 'pulse.social/feed' },
  { id: 'search', label: 'Seekr', icon: '🔎', url: (q) => (q ? `seekr.com/search?q=${encodeURIComponent(q)}` : 'seekr.com') },
  { id: 'store', label: 'My Store', icon: '🛍️', url: () => 'admin.novaskin.shop/store' },
  { id: 'ads', label: 'Ads Manager', icon: '📣', url: () => 'ads.pulse.social/manager' },
  { id: 'studio', label: 'Creative Studio', icon: '🎨', url: () => 'studio.novaskin.shop' },
  { id: 'analytics', label: 'Analytics', icon: '📈', url: () => 'analytics.novaskin.shop/reports' },
];

export function App() {
  const { game, hasSave, boot } = useGame();
  useEffect(() => { boot(); }, [boot]);
  if (!game) return <StartScreen hasSave={hasSave} />;
  return <Browser />;
}

function StartScreen({ hasSave }: { hasSave: boolean | null }) {
  const { startNew, continueSave, savedAt } = useGame();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-lg w-full p-8 shadow-xl">
        <div className="text-xs font-bold tracking-widest text-blue-600">ADTYCOON</div>
        <h1 className="text-3xl font-bold mt-1">NOVA Skincare</h1>
        <p className="mt-3 text-slate-600">
          You just launched a €49 Vitamin C Serum. You have <b>€5,000</b>, 250 bottles, and three established competitors.
          Use social ads, search ads, your store, and data to build a profitable brand. Reach <b>€15,000 cash</b> without going broke.
        </p>
        <ul className="mt-4 text-sm text-slate-600 space-y-1">
          <li>💬 <b>Pulse</b> — see what customers say and what’s trending</li>
          <li>🎨 <b>Creative Studio</b> → 📣 <b>Ads Manager</b> — make and launch ads</li>
          <li>⏭️ Advance time, then read <b>Analytics</b> and the comments</li>
        </ul>
        <div className="mt-6 flex gap-2">
          {hasSave && <button className="btn-primary" onClick={continueSave}>Continue{savedAt ? ` (saved ${new Date(savedAt).toLocaleString()})` : ''}</button>}
          <button className={hasSave ? 'btn-ghost' : 'btn-primary'} onClick={() => startNew()} disabled={hasSave === null}>New game</button>
        </div>
      </div>
    </div>
  );
}

function Browser() {
  const { game, tab, setTab, search } = useGame();
  const [settings, setSettings] = useState(false);
  const g = game!;
  const t = TABS.find((x) => x.id === tab)!;
  return (
    <div className="h-screen flex flex-col p-2 sm:p-3">
      <div className="flex-1 flex flex-col rounded-xl overflow-hidden shadow-2xl border border-slate-300 bg-white min-h-0">
        {/* tab strip */}
        <div className="flex items-end gap-1 bg-slate-200 px-2 pt-2 overflow-x-auto">
          <div className="hidden sm:flex gap-1.5 px-2 pb-3">
            <span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-yellow-400" /><span className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          {TABS.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-lg whitespace-nowrap ${tab === x.id ? 'bg-white text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
              <span>{x.icon}</span>{x.label}
            </button>
          ))}
        </div>
        {/* address bar + HUD */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          <div className="flex-1 min-w-[180px] flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            <span className="text-green-600">🔒</span><span className="truncate">{t.url(search.query)}</span>
          </div>
          <Hud onSettings={() => setSettings(true)} />
        </div>
        {g.day === 0 && g.campaigns.every((c) => c.brandId !== 'nova') && <GettingStarted />}
        <div className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
          {tab === 'social' && <Social />}
          {tab === 'search' && <SearchTab />}
          {tab === 'store' && <StoreTab />}
          {tab === 'ads' && <AdsManager />}
          {tab === 'studio' && <Studio />}
          {tab === 'analytics' && <Suspense fallback={<div className="p-8 text-slate-500">Loading reports…</div>}><Analytics /></Suspense>}
        </div>
      </div>
      <SummaryToast />
      <EndModal />
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}

function GettingStarted() {
  const { setTab } = useGame();
  const steps: [string, () => void][] = [
    ['Scroll Pulse to see what people want', () => setTab('social')],
    ['Make an ad in Creative Studio', () => setTab('studio')],
    ['Launch it in Ads Manager', () => setTab('ads')],
    ['Press “Next day” and watch what happens', () => {}],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 bg-blue-50 border-b border-blue-100 px-3 py-1.5 text-xs text-blue-900">
      <b>Start here:</b>
      {steps.map(([s, go], i) => (
        <button key={i} onClick={go} className="rounded-full bg-white border border-blue-200 px-2 py-0.5 hover:bg-blue-100">{i + 1}. {s}</button>
      ))}
    </div>
  );
}

function Hud({ onSettings }: { onSettings: () => void }) {
  const { game, advanceDays, busy, savedAt } = useGame();
  const [open, setOpen] = useState<null | 'log' | 'goals'>(null);
  const g = game!;
  const stock = g.inventory['nova-c'] ?? 0;
  const incoming = g.incoming.filter((i) => i.productId === 'nova-c').reduce((a, i) => a + i.qty, 0);
  const avgDaily = g.history.slice(-7).reduce((a, h) => a + h.units, 0) / Math.max(1, Math.min(7, g.history.length));
  const daysLeft = avgDaily > 0 ? stock / avgDaily : Infinity;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">Day {g.day}</span>
      <span className={`font-semibold ${g.cash < 500 ? 'text-red-600' : 'text-emerald-700'}`}>{eur(g.cash)}</span>
      <span className={`rounded px-1.5 py-0.5 text-xs ${daysLeft < 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`} title="Serum stock (incoming)">
        📦 {stock}{incoming ? ` (+${incoming})` : ''}{daysLeft < 5 && Number.isFinite(daysLeft) ? ` · ~${Math.max(0, Math.floor(daysLeft))}d left` : ''}
      </span>
      <div className="flex rounded-md overflow-hidden border border-blue-600">
        <button className="px-2.5 py-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" disabled={busy || g.status === 'bankrupt'} onClick={() => advanceDays(1)}>Next day</button>
        <button className="px-2 py-1 bg-white text-blue-700 hover:bg-blue-50 border-l border-blue-600 disabled:opacity-50" disabled={busy || g.status === 'bankrupt'} onClick={() => advanceDays(7)}>+7</button>
        <button className="px-2 py-1 bg-white text-blue-700 hover:bg-blue-50 border-l border-blue-600 disabled:opacity-50" disabled={busy || g.status === 'bankrupt'} onClick={() => advanceDays(30)}>+30</button>
      </div>
      <div className="relative">
        <button className="btn-ghost px-2" onClick={() => setOpen(open === 'goals' ? null : 'goals')} title="Goals">🏆 {g.milestones.filter((m) => m.done).length}/{g.milestones.length}</button>
        {open === 'goals' && (
          <Popover onClose={() => setOpen(null)}>
            {g.milestones.map((m) => (
              <div key={m.id} className={`py-2 border-b last:border-0 ${m.done ? 'opacity-60' : ''}`}>
                <div className="font-medium">{m.done ? '✅' : '⬜'} {m.title}</div>
                <div className="text-xs text-slate-500">{m.desc}</div>
                <div className="text-xs text-blue-700">Reward: {m.reward}</div>
              </div>
            ))}
          </Popover>
        )}
      </div>
      <div className="relative">
        <button className="btn-ghost px-2" onClick={() => setOpen(open === 'log' ? null : 'log')} title="Notifications">🔔</button>
        {open === 'log' && (
          <Popover onClose={() => setOpen(null)}>
            {g.log.length === 0 && <div className="text-slate-500">Nothing yet.</div>}
            {g.log.map((l, i) => <div key={i} className="py-1.5 border-b last:border-0 text-xs">{l}</div>)}
          </Popover>
        )}
      </div>
      <button className="btn-ghost px-2" onClick={onSettings} title={savedAt ? `Autosaved ${new Date(savedAt).toLocaleTimeString()}` : 'Settings'}>⚙️</button>
    </div>
  );
}

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 z-40 mt-1 w-80 max-h-96 overflow-y-auto card shadow-lg p-3 text-sm">{children}</div>
    </>
  );
}

function SummaryToast() {
  const { summary, dismissSummary } = useGame();
  useEffect(() => {
    if (!summary) return;
    const t = setTimeout(dismissSummary, 6000);
    return () => clearTimeout(t);
  }, [summary, dismissSummary]);
  if (!summary) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 card shadow-xl p-3 text-sm" onClick={dismissSummary}>
      <div className="flex justify-between font-semibold">
        <span>{summary.days === 1 ? '1 day' : `${summary.days} days`} simulated</span>
        <span className="text-xs text-slate-400 font-normal">{summary.ms.toFixed(0)} ms</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 mt-1 text-slate-600">
        <span>Orders: <b className="text-slate-900">{summary.orders}</b></span>
        <span>Revenue: <b className="text-slate-900">{eur(summary.revenue)}</b></span>
        <span>Ad spend: <b className="text-slate-900">{eur(summary.spend)}</b></span>
        <span>Profit: <b className={summary.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}>{eur(summary.profit)}</b></span>
      </div>
      {summary.events.length > 0 && <ul className="mt-2 text-xs text-slate-500 space-y-0.5">{summary.events.map((e, i) => <li key={i}>• {e}</li>)}</ul>}
    </div>
  );
}

function EndModal() {
  const { game, startNew } = useGame();
  const [dismissed, setDismissed] = useState(false);
  const g = game!;
  if (g.status === 'playing' || (g.status === 'won' && dismissed)) return null;
  const rev = g.history.reduce((a, h) => a + h.revenue, 0);
  const spend = g.history.reduce((a, h) => a + h.adSpend, 0);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-6">
        <h2 className="text-2xl font-bold">{g.status === 'won' ? '🎉 Sustainable brand achieved!' : '💸 Insolvent'}</h2>
        <p className="mt-2 text-slate-600">
          {g.status === 'won'
            ? `You grew NOVA to ${eur(g.cash)} in ${g.day} days.`
            : `NOVA ran out of cash on day ${g.day}. Ad spend can outrun revenue fast — watch your contribution margin and break-even CPA.`}
        </p>
        <div className="mt-3 text-sm text-slate-600">Total revenue {eur(rev)} · Ad spend {eur(spend)} · Customers {g.totalCustomers}</div>
        <div className="mt-5 flex gap-2">
          {g.status === 'won' && <button className="btn-primary" onClick={() => setDismissed(true)}>Keep playing</button>}
          <button className={g.status === 'won' ? 'btn-ghost' : 'btn-primary'} onClick={() => startNew()}>New game</button>
        </div>
      </div>
    </div>
  );
}
