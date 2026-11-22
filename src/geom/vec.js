/**
 * Vectors as plain lists of 2 or 3 numbers, and the one check every public function here makes on what it is handed.
 * WHY its own file: every other file of the leaf needs these few lines, and one copy keeps them alike.
 */

export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const size = (a) => Math.hypot(...a);

/**
 * The lists scaled together by one power of two, so their largest coordinate is about 1. WHY: a difference of points near
 * ±1e308 overflows and a length of subnormal numbers loses its digits; a power of two scales exactly, and an angle does
 * not change when every point is scaled alike. Done in two halves, so the factor itself never overflows.
 */
export function together(...lists) {
  const most = Math.max(...lists.flat().map(Math.abs));
  if (!(most > 0) || !Number.isFinite(most)) return lists;
  const e = Math.floor(Math.log2(most)), half = Math.trunc(-e / 2), f1 = 2 ** half, f2 = 2 ** (-e - half);
  return lists.map((v) => v.map((c) => c * f1 * f2));
}

/** The vector scaled to length 1, each coordinate divided by the length (never times 1/length, which a subnormal length makes
 *  Infinity); null when it has no length. */
export const unit = (a) => { const [v] = together(a), n = size(v); return n > 0 && Number.isFinite(n) ? v.map((c) => c / n) : null; };

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
/** A value as a refusal shows it: numbers as JavaScript writes them (NaN as NaN, never JSON's null), lists of them too. */
export function shown(v, depth = 0) {
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v) && depth < 2) return `[${v.slice(0, 8).map((x) => shown(x, depth + 1)).join(',')}${v.length > 8 ? ',…' : ''}]`.slice(0, 80);
  try { return JSON.stringify(v)?.slice(0, 60) ?? String(v); } catch { return typeof v; }
}

/** A list of finite numbers of one of the `lengths`, copied; throws a TypeError naming `what`. */
export function vectorOf(v, lengths, what) {
  if (!Array.isArray(v) || !lengths.includes(v.length) || !v.every(finite)) throw new TypeError(`${what} is a list of ${lengths.join(' or ')} finite numbers — not ${shown(v)}`);
  return [...v];
}

/** A finite number; throws a TypeError naming `what`. */
export function numberOf(v, what) {
  if (!finite(v)) throw new TypeError(`${what} is a finite number — not ${shown(v)}`);
  return v;
}
