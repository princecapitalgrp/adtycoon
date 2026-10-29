export const eur = (n: number, d = 0) => `€${n.toLocaleString('en-IE', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const num = (n: number) => Math.round(n).toLocaleString('en-IE');
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
export const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
