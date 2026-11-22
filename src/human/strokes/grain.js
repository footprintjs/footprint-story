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
 * A big face is never refused: its grain is thinned — laid at a wider spacing, so its marks come to about GRAIN.cap —
 * and its item's role says so (`grain-thinned`), so a list, and a tool's build note, can tell. Refused: a spacing,
 * width or alpha out of range (once, when the style is made); a palette "duotone" (the texture runs after the palette,
 * so its marks would print in the map's ink, a third ink beside the duotone's two). No face is ever too big or too
 * small to refuse: a face too small for a mark gets none, and the piece's other faces carry the grain.
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
 *   cap 2048      marks on one face at most, about: half an item's most (MOST_GRAIN_MARKS), so the seeded spread of a
 *                 face's count never reaches it; a face bigger than about 284,000 px² is thinned to it, evenly (a
 *                 10 × 10 slab fitted to 1920 × 1080: its top, about 578,000 px², is laid at about twice the spacing)
 *                 — the grain gets sparser there, and never refuses a map
 *   wider 1.25    how much wider a face's spacing is laid again if its seeded count still passes the most (rare)
 *   alpha 0.22    of the ink: low contrast — a mark, as a painter blends it, stands about 1.5 : 1 against the face it
 *                 lies on (under 1.6 on today's tones: a test pins it), where a name needs 4.5
 */
export const GRAIN = Object.freeze({ spacing: 16, sets: 3, mark: Object.freeze([1, 3]), gap: Object.freeze([12, 36]), width: 0.75, alpha: 0.22, cap: 2048, wider: 1.25,
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

/** The mean length of a mark and the gap after it, px: what one mark costs along a line. */
const PERIOD = (GRAIN.mark[0] + GRAIN.mark[1] + GRAIN.gap[0] + GRAIN.gap[1]) / 2;

/**
 * The spacing a face's grain is laid at: the style's, or wider when the face is big — so that its marks come to about
 * GRAIN.cap (they go as area · sets / (spacing · PERIOD)), and its lines across stay under hatchLines' most (a span is
 * at most the box's diagonal). Decided from the face alone, before a number is drawn, so a face that is not thinned is
 * seeded as it would be with no cap.
 */
function spacingFor(ring, spacing) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.max(spacing, (area(ring) * GRAIN.sets) / (PERIOD * GRAIN.cap), diagonal / MOST_HATCH_LINES);
}

/** One face's marks at a spacing: GRAIN.sets sets of lines at seeded angles, each broken into seeded marks and gaps; null past MOST_GRAIN_MARKS. */
function marksIn(ring, holes, spacing, random) {
  const out = [];
  for (let s = 0; s < GRAIN.sets; s += 1) {
    const angle = random() * 180;
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

function grain(items, { piece, colours, options, random }) {
  const faces = items.map((it, index) => ({ it, index, ring: SOLID.has(it.role) ? ringOf(it) : [] })).filter((f) => f.ring.length >= 3 && area(f.ring) > 1e-9);
  const spacing = options.spacing ?? GRAIN.spacing, stroke = { colour: colours.ink, alpha: options.alpha ?? GRAIN.alpha, width: options.width ?? GRAIN.width, join: 'round', cap: 'round' };
  const added = [];
  for (const f of faces) {
    // kept out of every face painted after it: a later face covers what is under it (as the hatch is)
    const holes = faces.filter((g) => g.index > f.index).slice(0, 16).map((g) => g.ring);
    let at = spacingFor(f.ring, spacing), segments = marksIn(f.ring, holes, at, random);
    // the cap is an estimate, at half an item's most: a seeded face that still passes the most is laid again, wider
    while (segments === null) { at *= GRAIN.wider; segments = marksIn(f.ring, holes, at, random); }
    // a face laid wider than the style's spacing says so in its role: the list (and a tool's note) can tell it thinned
    if (segments.length) added.push({ item: 'lines', role: at > spacing ? 'grain-thinned' : 'grain', of: piece.name, segments, fill: null, stroke });
  }
  return [...items, ...added];
}

/** The texture 'human:grain'. Hand it to isoStyle in `choices` (or the look "paper-grain"). */
export const grainTexture = Object.freeze({ column: 'texture', name: 'human:grain', options: Object.freeze(['spacing', 'width', 'alpha']), unseeded: Object.freeze([]), check: checkGrain,
  clashes: Object.freeze([Object.freeze({ column: 'palette', name: 'duotone', fix: 'the grain is laid after the palette, in the map\'s ink, so it would print a third ink beside the duotone\'s two — take the grain out (texture "none"), or keep the grain and the palette "theme"' })]),
  apply: grain });
