// Simple vector product shot, reused in creatives, shop pages and listings.
export function BottleShape({ color, brand, label, x = 0, y = 0, scale = 1, tilt = 0, jar = false }: { color: string; brand: string; label: string; x?: number; y?: number; scale?: number; tilt?: number; jar?: boolean }) {
  const id = `g${color.replace('#', '')}${jar ? 'j' : ''}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) rotate(${tilt} 50 110)`}>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="0.45" stopColor={color} stopOpacity="0.7" />
          <stop offset="1" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="214" rx="44" ry="7" fill="#000" opacity="0.12" />
      {jar ? (
        <>
          <rect x="4" y="110" width="92" height="22" rx="6" fill="#e5e7eb" stroke="#cbd5e1" />
          <rect x="0" y="130" width="100" height="82" rx="14" fill={`url(#${id})`} />
          <rect x="14" y="148" width="72" height="44" rx="4" fill="#fff" opacity="0.92" />
          <text x="50" y="166" textAnchor="middle" fontSize="11" fontWeight="700" fill="#111" fontFamily="system-ui">{brand}</text>
          <text x="50" y="181" textAnchor="middle" fontSize="7.5" fill="#444" fontFamily="system-ui">{label}</text>
        </>
      ) : (
        <>
          <ellipse cx="50" cy="16" rx="11" ry="14" fill="#1f2937" />
          <rect x="34" y="26" width="32" height="34" rx="4" fill="#111827" />
          <rect x="10" y="58" width="80" height="154" rx="16" fill={`url(#${id})`} />
          <rect x="16" y="66" width="8" height="120" rx="4" fill="#fff" opacity="0.35" />
          <rect x="18" y="104" width="64" height="70" rx="4" fill="#fff" opacity="0.93" />
          <text x="50" y="126" textAnchor="middle" fontSize="12" fontWeight="800" fill="#111" fontFamily="system-ui" letterSpacing="1">{brand}</text>
          <line x1="28" y1="133" x2="72" y2="133" stroke="#999" strokeWidth="0.6" />
          {label.split(' ').slice(0, 3).map((w, i) => (
            <text key={i} x="50" y={146 + i * 10} textAnchor="middle" fontSize="7.5" fill="#444" fontFamily="system-ui">{w}</text>
          ))}
        </>
      )}
    </g>
  );
}

export function ProductImage({ color, brand, label, size = 160, jar = false, bg = '#f8fafc' }: { color: string; brand: string; label: string; size?: number; jar?: boolean; bg?: string }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`${brand} ${label}`}>
      <rect width="200" height="200" fill={bg} />
      <circle cx="100" cy="110" r="70" fill={color} opacity="0.12" />
      <BottleShape color={color} brand={brand} label={label} x={58} y={-28} scale={0.8} jar={jar} />
    </svg>
  );
}
