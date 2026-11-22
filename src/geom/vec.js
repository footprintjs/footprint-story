/**
 * Vectors as plain lists of 2 or 3 numbers, and the one check every public function here makes on what it is handed.
 * WHY its own file: every other file of the leaf needs these few lines, and one copy keeps them alike.
 */

export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map((v) => v * k);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const size = (a) => Math.hypot(...a);
/** The vector scaled to length 1; null when it has no length (or one too small to divide by). */
export const unit = (a) => { const n = size(a); return n > 0 && Number.isFinite(n) ? mul(a, 1 / n) : null; };

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const shown = (v) => { try { return JSON.stringify(v)?.slice(0, 60) ?? String(v); } catch { return typeof v; } };

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
