import { memo } from 'react';
import { OFFER_LABEL } from '../../engine/creative';
import type { Brand, Creative, Mood, Product } from '../../engine/types';
import { BottleShape } from './Bottle';

const BG: Record<Mood, { a: string; b: string; ink: string; sub: string; btn: string; btnInk: string }> = {
  white: { a: '#ffffff', b: '#eef2f7', ink: '#0f172a', sub: '#475569', btn: '#0f172a', btnInk: '#fff' },
  pastel: { a: '#fde2e4', b: '#e0e7ff', ink: '#3b0764', sub: '#6b21a8', btn: '#7c3aed', btnInk: '#fff' },
  bold: { a: '#f97316', b: '#db2777', ink: '#ffffff', sub: '#ffe4e6', btn: '#ffffff', btnInk: '#be185d' },
  green: { a: '#ecfdf5', b: '#86efac', ink: '#14532d', sub: '#166534', btn: '#15803d', btnInk: '#fff' },
  dark: { a: '#1c1917', b: '#44403c', ink: '#fde68a', sub: '#e7e5e4', btn: '#fbbf24', btnInk: '#1c1917' },
};

function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = kept[lines - 1].replace(/.{0,2}$/, '…');
    return kept;
  }
  return out;
}

function Lines({ x, y, lines, size, color, weight = 400, anchor = 'start', lh = 1.2 }: { x: number; y: number; lines: string[]; size: number; color: string; weight?: number; anchor?: 'start' | 'middle'; lh?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fill={color} fontWeight={weight} textAnchor={anchor} fontFamily="system-ui, -apple-system, sans-serif">
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * lh}>{l}</tspan>
      ))}
    </text>
  );
}

const offerShort: Record<string, string> = { off10: '10% OFF', off20: '20% OFF', freeship: 'FREE SHIP', bundle: '2 FOR 1.7×' };

/** Square ad image rendered as SVG (scales crisply, ~2 KB of DOM, no image assets). */
export const AdCreative = memo(function AdCreative({ creative: c, product, brand, size = 360 }: { creative: Creative; product: Product; brand: Brand; size?: number | string }) {
  const t = BG[c.mood];
  const gid = `bg-${c.id}-${c.mood}`;
  const brandShort = brand.name.split(' ')[0].toUpperCase();
  const jar = product.id === 'nova-h';
  const Btn = ({ x, y, w = 150, anchor = 'start' }: { x: number; y: number; w?: number; anchor?: 'start' | 'middle' }) => {
    const left = anchor === 'middle' ? x - w / 2 : x;
    return (
      <g>
        <rect x={left} y={y} width={w} height={34} rx={17} fill={t.btn} />
        <text x={left + w / 2} y={y + 22} textAnchor="middle" fontSize={14} fontWeight={700} fill={t.btnInk} fontFamily="system-ui">{c.cta}</text>
      </g>
    );
  };
  const Badge = ({ x, y }: { x: number; y: number }) =>
    c.offer === 'none' ? null : (
      <g transform={`translate(${x} ${y}) rotate(-12)`}>
        <circle r={36} fill="#facc15" stroke="#fff" strokeWidth={3} />
        {offerShort[c.offer].split(' ').map((w, i, arr) => (
          <text key={i} y={(i - (arr.length - 1) / 2) * 15 + 5} textAnchor="middle" fontSize={c.offer === 'bundle' ? 11 : 13} fontWeight={900} fill="#111" fontFamily="system-ui">{w}</text>
        ))}
      </g>
    );

  return (
    <svg viewBox="0 0 400 400" width={size} height={size} role="img" aria-label={`${c.headline} — ${OFFER_LABEL[c.offer]}`} style={{ display: 'block', maxWidth: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.a} />
          <stop offset="1" stopColor={t.b} />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill={`url(#${gid})`} />
      {c.bgImage && <image href={c.bgImage} width="400" height="400" preserveAspectRatio="xMidYMid slice" opacity={0.85} />}

      {c.layout === 'hero' && (
        <>
          <Lines x={200} y={52} lines={wrap(c.headline, 26, 2)} size={26} weight={800} color={t.ink} anchor="middle" />
          <circle cx="200" cy="215" r="88" fill="#fff" opacity="0.18" />
          <BottleShape color={product.color} brand={brandShort} label={product.short} x={152} y={95} scale={0.95} jar={jar} />
          <Lines x={200} y={330} lines={wrap(c.body, 46, 1)} size={13} color={t.sub} anchor="middle" />
          <Btn x={200} y={348} anchor="middle" />
          <Badge x={330} y={140} />
        </>
      )}
      {c.layout === 'split' && (
        <>
          <rect width="170" height="400" fill={product.color} opacity="0.22" />
          <BottleShape color={product.color} brand={brandShort} label={product.short} x={40} y={80} scale={1.05} jar={jar} />
          <Lines x={190} y={90} lines={wrap(c.headline, 16, 4)} size={24} weight={800} color={t.ink} />
          <Lines x={190} y={230} lines={wrap(c.body, 26, 4)} size={13} color={t.sub} lh={1.35} />
          <Btn x={190} y={334} w={170} />
          <Badge x={130} y={60} />
        </>
      )}
      {c.layout === 'ugc' && (
        <>
          <circle cx="80" cy="90" r="90" fill="#fff" opacity="0.15" />
          <circle cx="330" cy="320" r="120" fill="#000" opacity="0.08" />
          <BottleShape color={product.color} brand={brandShort} label={product.short} x={150} y={110} scale={1} tilt={-10} jar={jar} />
          <ellipse cx="205" cy="335" rx="70" ry="22" fill="#f1c7a8" opacity="0.9" />
          {wrap(c.headline, 24, 2).map((l, i) => (
            <g key={i}>
              <rect x={200 - l.length * 6.4} y={40 + i * 36} width={l.length * 12.8} height={30} rx={6} fill="#fff" />
              <text x={200} y={61 + i * 36} textAnchor="middle" fontSize={19} fontWeight={800} fill="#111" fontFamily="system-ui">{l}</text>
            </g>
          ))}
          <text x={18} y={385} fontSize={12} fill={t.ink} opacity={0.85} fontFamily="system-ui">@{brand.domain.split('.')[0]} · #ad</text>
          <Badge x={340} y={200} />
        </>
      )}
      {c.layout === 'minimal' && (
        <>
          <text x={32} y={52} fontSize={12} letterSpacing={4} fill={t.sub} fontFamily="system-ui">{brand.name.toUpperCase()}</text>
          <Lines x={32} y={100} lines={wrap(c.headline, 20, 3)} size={28} weight={300} color={t.ink} />
          <BottleShape color={product.color} brand={brandShort} label={product.short} x={250} y={150} scale={0.95} jar={jar} />
          <Lines x={32} y={250} lines={wrap(c.body, 26, 3)} size={12} color={t.sub} lh={1.4} />
          <text x={32} y={360} fontSize={15} fontWeight={600} fill={t.ink} fontFamily="system-ui" textDecoration="underline">{c.cta} →</text>
          <Badge x={340} y={70} />
        </>
      )}
    </svg>
  );
});
