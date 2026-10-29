import { useMemo, useState } from 'react';
import { generateFeed, type FeedAd, type FeedPost } from '../../engine/feed';
import { useGame } from '../../store/game';
import { AdCreative } from '../components/AdCreative';
import { ProductImage } from '../components/Bottle';
import { num } from '../format';

const avatarColor = (s: string) => `hsl(${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 60% 70%)`;
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.4 }}>{name[0]?.toUpperCase()}</div>;
}

export function Social() {
  const { game, runSearch } = useGame();
  const g = game!;
  // The feed is derived from state for the current day; nothing is stored.
  const feed = useMemo(() => generateFeed(g), [g]);
  const last = g.history.at(-1);
  const followers = Math.round(Object.values(g.segments).reduce((a, s) => a + s.awareness.nova, 0) * 9000 + g.totalCustomers * 0.6);
  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[220px_1fr_260px] gap-4 p-4">
      <aside className="hidden md:block space-y-3">
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center font-black text-white">N</div>
            <div><div className="font-semibold">NOVA Skincare</div><div className="text-xs text-slate-500">@novaskin · Your brand</div></div>
          </div>
          <div className="mt-3 grid grid-cols-2 text-center text-xs">
            <div><div className="font-bold text-base">{num(followers)}</div>followers</div>
            <div><div className="font-bold text-base">{last ? (last.sentiment >= 0 ? '+' : '') + last.sentiment.toFixed(2) : '—'}</div>sentiment</div>
          </div>
        </div>
        <div className="card p-3 text-xs text-slate-500">
          Tip: tap <b>comments</b> on your ads. That’s where shoppers tell you about price, claims, fatigue and what they want.
        </div>
      </aside>

      <main className="space-y-4 min-w-0">
        {g.day === 0 && <div className="card p-3 text-sm text-slate-600">It’s launch day. Competitor ads and trend chatter are already running. Your ads will show up here once you launch a campaign.</div>}
        {feed.items.map((it) => (it.kind === 'ad' ? <AdCard key={it.id} ad={it} /> : <PostCard key={it.id} post={it} />))}
      </main>

      <aside className="hidden lg:block space-y-3">
        <div className="card p-3">
          <div className="font-semibold mb-2">Trending</div>
          {feed.trends.length === 0 && <div className="text-sm text-slate-500">Nothing trending right now.</div>}
          {feed.trends.map((t) => (
            <button key={t.tag} className="block w-full text-left py-1.5 hover:bg-slate-50 rounded" onClick={() => runSearch(t.tag.slice(1))}>
              <div className="font-medium text-blue-700">{t.tag}</div>
              <div className="text-xs text-slate-500">{num(t.posts)} posts · {t.blurb}</div>
            </button>
          ))}
        </div>
        <div className="card p-3 text-sm">
          <div className="font-semibold mb-2">Brands in your space</div>
          {g.brands.filter((b) => !b.isPlayer).map((b) => {
            const c = g.competitors.find((x) => x.brandId === b.id)!;
            return (
              <button key={b.id} className="flex w-full items-center gap-2 py-1 hover:bg-slate-50 rounded" onClick={() => runSearch(b.name)}>
                <span className="w-6 h-6 rounded-full" style={{ background: b.color }} />
                <span className="flex-1 text-left">{b.name}</span>
                {c.discountPct > 0 && <span className="text-xs rounded bg-red-100 text-red-700 px-1">-{c.discountPct}%</span>}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function AdCard({ ad }: { ad: FeedAd }) {
  const { game, openSite, openStudio } = useGame();
  const [open, setOpen] = useState(ad.isPlayer);
  const g = game!;
  const brand = g.brands.find((b) => b.id === ad.creative.brandId)!;
  const product = g.products.find((p) => p.id === ad.creative.productId)!;
  return (
    <article className={`card overflow-hidden ${ad.isPlayer ? 'ring-2 ring-amber-300' : ''}`}>
      <header className="flex items-center gap-2 p-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold" style={{ background: brand.color }}>{brand.name[0]}</div>
        <div className="flex-1"><div className="font-semibold text-sm">{brand.name}</div><div className="text-xs text-slate-500">Sponsored</div></div>
        {ad.isPlayer && <button className="text-xs text-blue-700 hover:underline" onClick={() => openStudio(ad.creative.id)}>Your ad · edit</button>}
      </header>
      <p className="px-3 pb-2 text-sm">{ad.creative.body}</p>
      <AdCreative creative={ad.creative} product={product} brand={brand} size="100%" />
      <button className="w-full flex justify-between items-center bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200" onClick={() => openSite({ type: 'product', productId: product.id })}>
        <span><span className="text-xs text-slate-500 uppercase">{brand.domain}</span><br /><b>{ad.creative.headline}</b></span>
        <span className="btn-ghost">{ad.creative.cta}</span>
      </button>
      <Engagement likes={ad.likes} comments={ad.commentCount} shares={ad.shares} onComments={() => setOpen(!open)} />
      {open && <Comments list={ad.comments} empty={ad.isPlayer ? 'No reactions yet — advance a day after launching.' : 'No comments.'} />}
    </article>
  );
}

function PostCard({ post }: { post: FeedPost }) {
  const { game, runSearch } = useGame();
  const [open, setOpen] = useState(false);
  const product = post.productId ? game!.products.find((p) => p.id === post.productId) : undefined;
  return (
    <article className="card p-3">
      <header className="flex items-center gap-2">
        <Avatar name={post.author} />
        <div className="flex-1">
          <div className="font-semibold text-sm">{post.author} {post.verified && <span className="text-blue-500">✔</span>}</div>
          <div className="text-xs text-slate-500">{post.verified ? 'Creator' : 'Pulse user'}{post.badge && <span className="ml-1 rounded bg-pink-100 text-pink-700 px-1">{post.badge}</span>}</div>
        </div>
      </header>
      {post.rating && <div className="mt-2 text-amber-500 text-sm">{'★'.repeat(post.rating)}<span className="text-slate-300">{'★'.repeat(5 - post.rating)}</span></div>}
      <p className="mt-2 text-sm">
        {post.text.split(/(#\w+)/).map((part, i) => part.startsWith('#') ? <button key={i} className="text-blue-700 hover:underline" onClick={() => runSearch(part.slice(1))}>{part}</button> : part)}
      </p>
      {product && (
        <div className="mt-2 rounded-lg overflow-hidden bg-slate-50 inline-block">
          <ProductImage color={product.color} brand={product.name.split(' ')[0].toUpperCase()} label={product.short} size={140} jar={product.id === 'nova-h'} />
        </div>
      )}
      <Engagement likes={post.likes} comments={post.comments.length} shares={post.shares} onComments={() => setOpen(!open)} />
      {open && <Comments list={post.comments} empty="No comments." />}
    </article>
  );
}

function Engagement({ likes, comments, shares, onComments }: { likes: number; comments: number; shares: number; onComments: () => void }) {
  return (
    <div className="flex gap-4 px-3 py-2 text-sm text-slate-600 border-t border-slate-100">
      <span>❤️ {num(likes)}</span>
      <button className="hover:text-blue-700" onClick={onComments}>💬 {num(comments)}</button>
      <span>↗ {num(shares)}</span>
    </div>
  );
}

function Comments({ list, empty }: { list: { author: string; text: string; likes: number }[]; empty: string }) {
  if (!list.length) return <div className="px-3 pb-3 text-xs text-slate-500">{empty}</div>;
  return (
    <ul className="px-3 pb-3 space-y-2">
      {list.map((c, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <Avatar name={c.author} size={26} />
          <div className="bg-slate-100 rounded-2xl px-3 py-1.5">
            <span className="font-semibold text-xs">{c.author}</span>
            <div>{c.text}</div>
          </div>
          <span className="text-xs text-slate-400 self-center">♥ {c.likes}</span>
        </li>
      ))}
    </ul>
  );
}
