// footprint-story/human · hand-drawn strokes (src/human/strokes/README.md): the declarations of what the human door
// hands out for strokes, kept beside their code so human.d.ts stays one screenful a section. human.d.ts re-exports all.
import type { HumanPoint } from '../../../human.js';

export type SketchLayer = 'outline' | 'detail';
export type FillKind = 'hatch' | 'cross-hatch' | 'scribble';
/** A fill: parallel lines at `angle` degrees (from the x axis toward y, which runs down), `spacing` px apart. */
export interface SketchFill { readonly kind: FillKind; readonly angle?: number; readonly spacing?: number }
/** What a hand is asked to draw: points, closed or not; its layer (outline first, then detail) and piece (`group`); a fill on a closed shape, kept out of its holes; edge: false draws only the fill. */
export interface SketchShape { readonly points: readonly HumanPoint[]; readonly closed?: boolean; readonly layer?: SketchLayer; readonly group?: string; readonly edge?: boolean; readonly fill?: SketchFill; readonly holes?: readonly (readonly HumanPoint[])[] }
/** A stroke as the hand draws it: its corners (`path`), then its points with widths and times (seconds from the sketch's start), its smooth line and the room its tremor had. */
export interface SketchStroke {
  readonly layer: SketchLayer | 'fill'; readonly group: string; readonly kind: 'line' | FillKind; readonly shape: number; readonly set: number | null;
  readonly path: readonly HumanPoint[]; readonly start: number; readonly seconds: number; readonly length: number; readonly amplitude: number; readonly hooks: number; readonly step: number;
  readonly xs: readonly number[]; readonly ys: readonly number[]; readonly ws: readonly number[]; readonly ts: readonly number[];
  readonly sx: readonly number[]; readonly sy: readonly number[]; readonly rs: readonly number[];
}
/** A set of fill lines: its shape, kind, angle and spacing, and how far across the shape reaches (lo to hi, along the normal). */
export interface SketchSet { readonly shape: number; readonly kind: FillKind; readonly angle: number; readonly spacing: number; readonly lo: number; readonly hi: number; readonly lines: number; readonly ring: readonly HumanPoint[]; readonly holes: readonly (readonly HumanPoint[])[] }
/** A sketch planned: the strokes in order, the lifts between them, where each stroke starts and the rule that put it there. */
export interface SketchPlan {
  readonly seconds: number; readonly natural: number; readonly strokes: readonly SketchStroke[];
  readonly lifts: readonly { readonly after: number; readonly seconds: number; readonly distance: number }[];
  readonly order: readonly { readonly stroke: number; readonly layer: SketchLayer | 'fill'; readonly group: string; readonly rule: 'first' | 'odd' | 'nearest' | 'fill'; readonly at: HumanPoint }[];
  readonly sets: readonly SketchSet[]; readonly least: { readonly outline: number; readonly detail: number }; readonly boilSeed: number; readonly rule: string;
  readonly step: number; readonly tremor: number; readonly wavelength: number; readonly width: number; readonly overshoot: number; readonly hooks: number; readonly shapes: number; readonly points: number;
}
export interface SketchSettings { readonly random?: () => number; readonly seed?: string; readonly who?: string; readonly speed?: number; readonly fillSpeed?: number; readonly width?: number; readonly tremor?: number; readonly wavelength?: number; readonly overshoot?: number; readonly seconds?: number }
/** A drawing planned as a hand draws it: piece by piece from the top left; outline, detail, fills; as few strokes as the corners allow (ORDER_RULE). */
export function planSketch(shapes: readonly SketchShape[], settings: SketchSettings): SketchPlan;
/** Where the pen is at t: drawing (down 1, the width it lays) or in the air between strokes (down 0, width 0). */
export function sampleSketch(plan: SketchPlan, t: number): { readonly x: number; readonly y: number; readonly width: number; readonly down: number; readonly stroke: number; readonly progress: number };
/** The finished sketch redrawn for a frame: a fresh seeded tremor every `every` frames (3), within each stroke's room. */
export function boilSketch(plan: SketchPlan, frame: number, options?: { readonly every?: number; readonly amplitude?: number }): { readonly frame: number; readonly held: number; readonly strokes: readonly { readonly xs: readonly number[]; readonly ys: readonly number[] }[] };
/** One set of hatch lines over a ring, outside its holes: pieces exactly inside, `spacing` apart across, centred. */
export function hatchLines(ring: readonly HumanPoint[], options: { readonly angle: number; readonly spacing: number; readonly holes?: readonly (readonly HumanPoint[])[] }): { readonly segments: readonly { readonly a: HumanPoint; readonly b: HumanPoint; readonly line: number }[]; readonly normal: HumanPoint; readonly direction: HumanPoint; readonly lo: number; readonly hi: number; readonly offsets: readonly number[] };
/** The fewest strokes that draw a graph's edges, each once (Euler): one per connected part, or half its odd corners. */
export function leastStrokes(graph: { readonly corners: readonly HumanPoint[]; readonly edges: readonly { readonly a: number; readonly b: number }[] }): number;
/** Corners with a hook past each turn of CORNER.angle or more: out along the line it came in on, and back. */
export function withOvershoot(points: readonly HumanPoint[], most?: number): HumanPoint[];
/** An isometric paint list's faces as sketch shapes: an edge one face has is the outline, one two share is detail; an edge a later face hides is left out. */
export function shapesOfPaint(items: readonly { readonly item: string; readonly role: string; readonly [key: string]: unknown }[], options?: { readonly roles?: readonly string[]; readonly group?: string }): SketchShape[];
/** A plan's strokes as isometric paint items: {item: 'stroke', points: [[x, y, width, t], …]}. */
export function strokeItems(plan: SketchPlan, options: { readonly of: string; readonly role: string; readonly colour?: string | null; readonly alpha?: number; readonly width: number; readonly at?: number; readonly strokes?: readonly SketchStroke[] }): { readonly item: 'stroke'; readonly role: string; readonly of: string; readonly points: (readonly [number, number, number, number])[]; readonly fill: null; readonly stroke: { readonly colour: string | null; readonly alpha: number; readonly width: number; readonly join: 'round'; readonly cap: 'round' } }[];
/** The caps a stroke's end takes: 'round', 'butt', 'square' (the paint list's, SVG's and canvas's names). */
export const STROKE_CAPS: readonly ('round' | 'butt' | 'square')[];
/** The segments of a round cap's half circle (12, ours: within 0.09 px of the circle at a 20 px stroke). */
export const CAP_STEPS: number;
/**
 * One ring round a stroke of changing width (points [x, y, width, …]), its two ends capped by `cap` (round when left out,
 * as `strokeItems` writes it; a stroke item's `stroke.cap`): what a painter fills, drawing no cap of its own. A stroke
 * of one point is a dot (a circle, a square, or nothing for butt). Fill it by the non-zero rule: the ring can cross
 * itself at a round cap on a short, sharply turning stroke.
 */
export function strokeOutline(points: readonly (readonly number[])[], options?: { readonly cap?: 'round' | 'butt' | 'square' } | null): [number, number][];
/**
 * The stroke as drawn by time `t` (seconds on the points' own clock, from the piece's start): every point at or before
 * `t`, then the pen's place at `t` between the two around it (x, y and width linear). [] before the first point; every
 * point at or after the last (Infinity: the whole stroke). The partial ring is `strokeOutline(strokeAt(points, t), {cap})`.
 */
export function strokeAt(points: readonly (readonly [number, number, number, number])[], t: number): [number, number, number, number][];
/** An isometric style choice, as src/isometric/style.js takes a tool's own (handed in under `choices`). */
export interface StrokeStyleChoice { readonly column: 'line' | 'texture'; readonly name: string; readonly options: readonly string[]; readonly unseeded: readonly string[]; check(options: Readonly<Record<string, unknown>>): void; readonly clashes: readonly { readonly column: 'shape' | 'shading' | 'line' | 'palette' | 'texture' | 'effects'; readonly name: string; readonly fix: string }[]; apply(items: readonly any[], context: any): any[] }
/** The line 'human:sketchy': a piece's edges drawn by hand (silhouette, then inner edges). Hand it to isoStyle in choices. */
export const sketchyLine: StrokeStyleChoice;
/** The texture 'human:hatch': left faces and sides hatched, right faces cross-hatched, after the line's strokes. */
export const hatchTexture: StrokeStyleChoice;
/**
 * The texture 'human:grain' (0.35.0, the look "paper-grain"): a paper's grain — fine, faint, seeded marks laid in each
 * face with the hatch's clipper, one `lines` item a face (role `grain`; `grain-thinned` where a big face was laid
 * wider, to about GRAIN.cap marks — never refused), in the ink at GRAIN.alpha. Options: spacing, width, alpha. Refused
 * beside the palette "duotone" (a third ink).
 */
export const grainTexture: StrokeStyleChoice;
/** The grain's numbers (ours): spacing between one set's lines, the sets, a mark's and a gap's length, the width and alpha, and the options' ranges. */
export const GRAIN: Readonly<{ spacing: number; sets: number; mark: readonly [number, number]; gap: readonly [number, number]; width: number; alpha: number; cap: number; wider: number; least: Readonly<{ spacing: number; width: number; alpha: number }>; most: Readonly<{ spacing: number; width: number; alpha: number }> }>;
/** The most marks one face's grain item holds (the paint list's MOST_PAINT_POINTS); a big face is thinned under it. */
export const MOST_GRAIN_MARKS: number;
/** Every isometric style choice this door ships, in one list, to hand in under `choices`: sketchyLine, hatchTexture, grainTexture. */
export const HUMAN_STYLE_CHOICES: readonly StrokeStyleChoice[];
export const ROLE_FILLS: Readonly<Record<string, FillKind>>;
export const SKETCH: Readonly<{ speed: number; fillSpeed: number; width: number; fillTremor: number }>;
export const WIDTH_SHARE: Readonly<{ outline: number; detail: number; fill: number }>;
export const LIFT: Readonly<{ seconds: number; speed: number }>;
export const MOST_SKETCH_POINTS: number;
/** The most points one stroke holds (the paint list's MOST_PAINT_POINTS): a long stroke's step grows to keep under it. */
export const MOST_STROKE_POINTS: number;
/** The widest tremor a stroke keeps room for (8 px): the most a pen's tremor and a boil's amplitude may be. */
export const ROOM_MOST: number;
/** The most items one piece's paint list holds (the paint list's MOST_PAINT_ITEMS). */
export const MOST_PIECE_ITEMS: number;
/** The least a line across must cross of a shape for a band there to count as a gap (1 px). */
export const REGION_LEAST: number;
export const BOIL: Readonly<{ every: number; most: number }>;
export const MOST_BOIL_FRAME: number;
export const MIN_PIECE: number;
export const MOST_HATCH_LINES: number;
export const CROSS_TURN: number;
export const ORDER_RULE: string;
export const MOST_BRIDGE_EDGES: number;
export const MERGE: number;
export const CORNER: Readonly<{ angle: number; share: number; most: number }>;
export const PEN_WIDTH: Readonly<{ thin: number; taper: number; taperShare: number; tip: number }>;
export const STROKE_STEP: number;
export const SKETCH_LAYERS: readonly SketchLayer[];
export const FILL_KINDS: readonly FillKind[];
export const HATCH: Readonly<{ angle: number; spacing: number; least: number; most: number }>;
export const MOST_SHAPES: number;
export const MOST_SHAPE_POINTS: number;
export const MOST_SKETCH_INPUT: number;
export const ELLIPSE_POINTS: number;
export const HIDDEN: number;
export const SKETCH_KEYS: readonly string[];
/** The most extra strokes over the least (0), the most strokes drawn before their outline (0), the widest band in a hatch over its spacing (1.5). */
export const PEN_LIFTS_MOST: number;
export const STROKE_ORDER_MOST: number;
export const HATCH_GAP_MOST: number;
