// summary — what a map flow's record keeps of a paint list: its counts and a digest, never its points.
//
//   paintSummary(map.paints)   → {pieces, items, byItem: {polygon, stroke, …}, points, perPiece: [n, …], digest: 'fnv1a32:…'}
//   paintDigest(value)         → 'fnv1a32:9f3c01ab': FNV-1a over the value's canonical JSON (keys sorted)
//
// WHY: the record keeps what must be EXPLAINED; what is merely derived is not. A paint list (every polygon, and every
// hand-drawn stroke with all its points) is a pure function of the spec, the policy and the tool's choices, and those the
// record already keeps (the `read` stage's writes; `style.row` names the choices). Kept whole it was most of the record:
// a 64-block hatched map wrote 12 MB of points. So the `style` stage writes this summary under the same keys
// (`paints`, `floorPaints`), and the full lists go to the caller's map only (flow.js · runMapFlow). The digest says the
// two are one: a map whose lists digest to the record's is the map that run made (test/mapflow-record-size.test.js).
//
// The digest is FNV-1a (32 bits, src/seed/seeded.js · fnv1a, the seed's own hash) over the value's JSON with every
// object's keys sorted, fed piece by piece, so a 12 MB list is never built as one text. It names a drift, it is no
// guard against a forged list: 32 bits are enough to tell two honest compositions apart.
import { fnv1a } from '../seed/seeded.js';

/** The state keys written as a summary: the `style` step's paint lists, read by no later step (a test pins it). */
export const SUMMARISED = Object.freeze(['paints', 'floorPaints']);

/** Feed a plain value's canonical JSON to the hash: keys sorted, undefined members left out (as JSON does). */
function feed(v, h) {
  if (v === null || v === undefined || typeof v === 'function' || typeof v === 'symbol') return fnv1a('null', h);
  if (typeof v !== 'object') return fnv1a(JSON.stringify(v) ?? 'null', h);
  if (Array.isArray(v)) {
    h = fnv1a('[', h);
    for (let i = 0; i < v.length; i += 1) { if (i) h = fnv1a(',', h); h = feed(v[i], h); }
    return fnv1a(']', h);
  }
  h = fnv1a('{', h);
  let first = true;
  for (const k of Object.keys(v).sort()) {
    if (v[k] === undefined || typeof v[k] === 'function' || typeof v[k] === 'symbol') continue;
    h = fnv1a(`${first ? '' : ','}${JSON.stringify(k)}:`, h);
    first = false;
    h = feed(v[k], h);
  }
  return fnv1a('}', h);
}

/** 'fnv1a32:' and the 8 hex digits of FNV-1a over the value's canonical JSON. */
export function paintDigest(value) {
  return `fnv1a32:${feed(value, undefined).toString(16).padStart(8, '0')}`;
}

/**
 * A paint list per piece ([[item, …], …]) as the record keeps it: how many pieces and items, the items by kind (`item`:
 * polygon, ellipse, path, lines, stroke), how many points their `points` hold, each piece's item count, and the digest of
 * the whole. A value that is not a list of lists (the step refused before it painted) is kept as it is.
 */
export function paintSummary(lists) {
  if (!Array.isArray(lists) || !lists.every(Array.isArray)) return lists;
  const byItem = {};
  let items = 0, points = 0;
  for (const list of lists) {
    for (const it of list) {
      items += 1;
      const kind = typeof it?.item === 'string' ? it.item : 'other';
      byItem[kind] = (byItem[kind] ?? 0) + 1;
      if (Array.isArray(it?.points)) points += it.points.length;
    }
  }
  return { pieces: lists.length, items, byItem, points, perPiece: lists.map((l) => l.length), digest: paintDigest(lists) };
}
