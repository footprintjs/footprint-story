/**
 * A paper's grain over a piece's faces: an isometric style choice (`texture`, named `human:grain`), handed in under
 * `choices` as `human:hatch` is. Fine, short, faint marks laid in each face — the tooth of a printed page — as one
 * `lines` item a face (role `grain`), so a painter that draws a floor's tile lines draws them: no new kind of item.
 *
 *   isoStyle({ look: 'paper-grain' }, { choices: [grainTexture] })   (the look is `{texture: 'human:grain'}`)
 *
 * How the marks are laid, in each face (top, left, right, a cylinder's side) that has room: GRAIN.sets sets of lines,
 * each at a seeded angle, `spacing` px apart across (fills.js · hatchLines — the hatch's own clipper, so a mark is
 * exactly inside its face and out of every face painted after it); along each line, a seeded gap, then a mark
 * GRAIN.mark px long, then a gap GRAIN.gap px, to its end. Seeded by the style, the piece's name and the column (the
 * `random` a style hands each choice), so the same piece has the same grain in a deck and in a film. No timing: a
 * grain is printed, not drawn, so nothing of it waits on a pen and nothing of it is left out of the seed.
 *
 * Its colour is the map's ink (null when the page decides it) at GRAIN.alpha: the page's ink, faint. WHY `lines` and
 * not `stroke` items: a mark is a printed fleck, not a pen's line — it has no pace and no taper — and one item a face
 * keeps a piece's list short (a block: 3 items more). Both tools' stroke budgets count `stroke` items: a grain adds none.
 *
 * Refused: a spacing, width or alpha out of range (once, when the style is made); a face whose grain would pass
 * MOST_GRAIN_MARKS (an item's most segments), naming a spacing that fits about four fifths of it; a palette "duotone" (the texture runs after
 * the palette, so its marks would print in the map's ink, a third ink beside the duotone's two).
 */
import { refuse, shown, finite } from '../read.js';
import { hatchLines, MOST_HATCH_LINES } from './fills.js';
import { ringOf } from './paint.js';

const SOLID = new Set(['top', 'left', 'right', 'side']);
/**
 * The grain's numbers. All ours, chosen by eye on the README's still (src/isometric/look-paper-grain.svg) and held to
 * the tools' budgets (a test pins a 64-block world's count):
 *   spacing 16    px across between one set's lines: with three sets, a line about every 5 px across a face, each
 *                 broken into marks — fine enough to read as a surface, not as a pattern
 *   sets 3        three directions, each seeded: one or two read as hatching; three read as fibre
 *   mark [1, 3]   px, a mark's length, seeded between: a fleck, never a line
 *   gap [12, 36]  px, the gap after a mark, seeded between (and the first, from a line's start): about one mark in
 *                 140 px² of a face, so the grain shows as a texture, not as noise — and a 64-block world at a film's
 *                 tile (96 px) lays about 13,000 marks, 0.33 MB written as SVG path data (a test pins it under 2 MB)
 *   width 0.75    px: under the thinnest line a map draws (the folds' 1.25 in line art), so it never reads as an edge
 *   alpha 0.22    of the ink: low contrast — a mark, as a painter blends it, stands about 1.5 : 1 against the face it
 *                 lies on (under 1.6 on today's tones: a test pins it), where a name needs 4.5
 */
export const GRAIN = Object.freeze({ spacing: 16, sets: 3, mark: Object.freeze([1, 3]), gap: Object.freeze([12, 36]), width: 0.75, alpha: 0.22,
  least: Object.freeze({ spacing: 4, width: 0.25, alpha: 0.02 }), most: Object.freeze({ spacing: 200, width: 4, alpha: 1 }) });
/** The most marks one face's grain item holds: the isometric MOST_PAINT_POINTS (an item's most segments; a test pins the two equal). */
export const MOST_GRAIN_MARKS = 4096;

const area = (ring) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const between = (random, [lo, hi]) => lo + (hi - lo) * random();

function checkGrain(options) {
  for (const key of ['spacing', 'width', 'alpha']) {
    const v = options[key], lo = GRAIN.least[key], hi = GRAIN.most[key];
    if (v !== undefined && !(finite(v) && v >= lo && v <= hi)) refuse(`the style's texture "human:grain" takes a ${key} from ${lo} to ${hi}${key === 'alpha' ? ' (of the ink)' : ' px'} — not ${shown(v)}`);
  }
}

/** How far across a ring reaches at `angle` (degrees): what hatchLines spaces its lines over. */
function spanAt(ring, angle) {
  const rad = (angle * Math.PI) / 180, n = [-Math.sin(rad), Math.cos(rad)], across = ring.map((p) => p[0] * n[0] + p[1] * n[1]);
  return Math.max(...across) - Math.min(...across);
}

/** One face's marks: GRAIN.sets sets of lines at seeded angles, each line broken into seeded marks and gaps. */
function marksIn(ring, holes, spacing, random) {
  const out = [];
  for (let s = 0; s < GRAIN.sets; s += 1) {
    const angle = random() * 180;
    // past hatchLines' most lines, the marks would pass an item's most long before: said with the grain's own fix
    if (spanAt(ring, angle) / spacing > MOST_HATCH_LINES) return null;
    for (const { a, b } of hatchLines(ring, { angle, spacing, holes }).segments) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / length, uy = (b[1] - a[1]) / length;
      for (let t = between(random, [0, GRAIN.gap[1]]); t < length; ) {
        const end = Math.min(length, t + between(random, GRAIN.mark));
        out.push([a[0] + ux * t, a[1] + uy * t, a[0] + ux * end, a[1] + uy * end]);
        if (out.length > MOST_GRAIN_MARKS) return null;
        t = end + between(random, GRAIN.gap);
      }
    }
  }
  return out;
}

/**
 * A spacing that lays about four fifths of MOST_GRAIN_MARKS on the piece's biggest face, from its area: the marks go as area · sets /
 * (spacing · (a mark + a gap)), each at its mean. Seeded, so an estimate with room, never a promise; at least one more
 * than the spacing refused, and null when even GRAIN's widest would not do.
 */
function fitting(faces, spacing) {
  const most = Math.max(...faces.map((f) => area(f.ring))), period = (GRAIN.mark[0] + GRAIN.mark[1] + GRAIN.gap[0] + GRAIN.gap[1]) / 2;
  const fit = Math.max(spacing + 1, Math.ceil((most * GRAIN.sets) / (period * MOST_GRAIN_MARKS * 0.8)));
  return fit > GRAIN.most.spacing ? null : fit;
}

function grain(items, { piece, colours, options, random }) {
  const faces = items.map((it, index) => ({ it, index, ring: SOLID.has(it.role) ? ringOf(it) : [] })).filter((f) => f.ring.length >= 3 && area(f.ring) > 1e-9);
  const spacing = options.spacing ?? GRAIN.spacing, stroke = { colour: colours.ink, alpha: options.alpha ?? GRAIN.alpha, width: options.width ?? GRAIN.width, join: 'round', cap: 'round' };
  const added = [];
  for (const f of faces) {
    // kept out of every face painted after it: a later face covers what is under it (as the hatch is)
    const holes = faces.filter((g) => g.index > f.index).slice(0, 16).map((g) => g.ring);
    const segments = marksIn(f.ring, holes, spacing, random);
    if (segments === null) {
      const fit = fitting(faces, spacing);
      refuse(`the style's texture "human:grain" on "${piece.name}": its ${f.it.role} face is too big for its grain at ${spacing} px (one face's grain holds at most ${MOST_GRAIN_MARKS} marks) — ${fit === null ? `no spacing up to ${GRAIN.most.spacing} px fits it: take the grain out (texture "none"), or draw the map at a smaller tile` : `give a wider spacing: texture: {name: 'human:grain', spacing: ${fit}}`}`);
    }
    if (segments.length) added.push({ item: 'lines', role: 'grain', of: piece.name, segments, fill: null, stroke });
  }
  return [...items, ...added];
}

/** The texture 'human:grain'. Hand it to isoStyle in `choices` (or the look "paper-grain"). */
export const grainTexture = Object.freeze({ column: 'texture', name: 'human:grain', options: Object.freeze(['spacing', 'width', 'alpha']), unseeded: Object.freeze([]), check: checkGrain,
  clashes: Object.freeze([Object.freeze({ column: 'palette', name: 'duotone', fix: 'the grain is laid after the palette, in the map\'s ink, so it would print a third ink beside the duotone\'s two — take the grain out (texture "none"), or keep the grain and the palette "theme"' })]),
  apply: grain });
