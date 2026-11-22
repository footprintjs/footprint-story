# human/strokes/ — a drawing drawn as a hand draws it

**Why:** a sketched look made by jittering a finished outline reads as a filter, not a hand. A hand draws in an order
(the outline, then what is inside it, then the shading), lifts the pen as little as it can, slows into a bend, lays a
thinner line when it moves fast, lands and lifts each stroke, overshoots a sharp corner a little, wobbles, and redraws
a little differently each time. All of that is numbers. So an author hands in shapes (`{do: 'sketch', shapes}`) and gets
back every stroke — its order and why, its timed points and widths — as plain data, the same for the same piece, with
critics that say when an order is not a hand's. Nothing here draws: a tool paints the points.
Design: `docs/design/2026-11-human-motion.md` · "Hand-drawn strokes".

| file | holds |
|---|---|
| `shapes.js` | what a hand is asked to draw: shapes as data, read and checked (`readShapes`, `HATCH`, `FILL_KINDS`, `SKETCH_LAYERS`) |
| `graph.js` | the lines as a graph: corners merged within `MERGE` (0.5 px), transitively, after each path's own points closer than that are folded; a shared line once; the fewest strokes (`leastStrokes`, Euler); Fleury's bridge test |
| `order.js` | the order: piece by piece, outline → detail → fills, each layer walked into strokes (`ORDER_RULE`, `walkLines`) |
| `pen.js` | one stroke as the pen draws it: hooks at sharp corners, pace by the power law, width from speed, tapered ends, the capped tremor (`penStroke`, `withOvershoot`, `CORNER`, `PEN_WIDTH`) |
| `fills.js` | hatch lines clipped exactly to a shape and out of its holes (`hatchLines`); hatch, cross-hatch and scribble as strokes (`fillStrokes`) |
| `plan.js` | the drawing planned: order, pen, lifts, times (`planSketch`, `SKETCH`, `WIDTH_SHARE`, `LIFT`) |
| `sample.js` | where the pen is at t: down and drawing, or in the air (`sampleSketch`) |
| `boil.js` | a finished drawing redrawn each held frame, within its rooms (`boilSketch`, `BOIL`) |
| `model.js` | the `hand-sketch` model, family `sketch`, for `do: 'sketch'` |
| `critique.js`, `penLifts.js`, `strokeOrder.js`, `hatchGaps.js` | the critics `pen-lifts`, `stroke-order`, `hatch-gaps` |
| `geometry.js` | inside a ring, the distance to its edge, where a segment crosses it — one answer each |
| `paint.js` | strokes and the isometric paint list: faces → shapes (`shapesOfPaint`), strokes → `stroke` items (`strokeItems`) |
| `outline.js` | a stroke as a painter fills it: the ring round it with its caps (`strokeOutline`, `STROKE_CAPS`, `CAP_STEPS`), the stroke as drawn by a time (`strokeAt`) |
| `styleChoices.js` | two isometric style choices on strokes, handed in, never built in: `sketchyLine` (`human:sketchy`), `hatchTexture` (`human:hatch`) |
| `grain.js` | the texture `human:grain` (`grainTexture`, `GRAIN`): a paper's grain, fine faint marks clipped into each face with `hatchLines`, one `lines` item a face — the look "paper-grain" (0.35.0) |
| `choices.js` | every style choice above in one list, `HUMAN_STYLE_CHOICES`, for a tool to hand in whole |

The shared tremor cap is `../paths/wobble.js` (`wobbleRooms`, `wobbleAcross`), the same code the `power-law` pen uses.

## The order

```js
import { planSketch } from 'footprint-story/human';

const box = [
  { points: [[100, 100], [300, 100], [300, 300], [100, 300]], closed: true, group: 'box', fill: { kind: 'hatch', spacing: 10 } },
  { points: [[100, 200], [300, 200]], layer: 'detail', group: 'box' },
];
const sketch = planSketch(box, { seed: 'box' });
sketch.order[0];   // { stroke: 0, layer: 'outline', group: 'box', rule: 'first', at: [100, 100] }: the top-left corner
sketch.order[1];   // { stroke: 1, layer: 'detail', group: 'box', rule: 'odd', at: [100, 200] }: the nearest end of the line left
sketch.least;      // { outline: 1, detail: 1 }: the fewest strokes each layer allows — and drawn in that many
```

`ORDER_RULE`, the rule each plan records:

1. Piece by piece (`group`), from the top left: the piece whose points reach the least x + y first.
2. In each piece: its outline, then its detail, then its fills.
3. In a layer of lines, the lines are a graph — a line two shapes share is drawn once. Each stroke starts at the corner
   nearest the pen (the page's top left for the first), among the corners that meet an odd number of lines left when
   there are any, and goes on along the straightest line left that does not cut the rest in two (Fleury's rule); its
   first line is the one heading most toward the bottom right. A stroke ends where no line is left.
4. Ties go to the least x + y, then the least y, then the order the shapes were given in.

WHY odd corners first: the fewest strokes that draw a set of lines, each once, is one per connected part, or half the
corners that meet an odd number of lines (Euler) — and only a stroke that starts at such a corner can reach it. WHY
Fleury: a stroke that crosses a bridge too early strands the lines behind it. A property test draws thousands of random
line drawings and finds every line drawn once, in exactly the fewest strokes (`test/human-strokes.property.test.js`).
Past `MOST_BRIDGE_EDGES` (2048) lines in a layer the bridge test is left out (each walks the layer) and the walk is
plain greedy; the `pen-lifts` critic then says if it lifts more. Lines that cross or touch without sharing a corner
are not joined: give them the corner.

## The pen

```js
import { withOvershoot } from 'footprint-story/human';

withOvershoot([[0, 0], [100, 0], [100, 100]]);   // [[0, 0], [100, 0], [103, 0], [100, 0], [100, 100]]: a 3 px hook
sketch.strokes[0].seconds;                       // 2.045: the square and its three hooks, 818 px at 400 px a second
```

| what | the numbers (ours) | why |
|---|---|---|
| hook | at a turn of 60° or more, out past the corner along the line it came in on by 15% of the shorter line, at most 3 px, and back (`CORNER`); none at a stroke's ends | a fast hand runs past a sharp turn before it turns |
| pace | walked every 2 px (`STROKE_STEP`, corners kept exactly), slower in the bends by the two-thirds power law read over one tremor wavelength, from rest and back over a tenth at each end; mean speed `speed` (400 px a second lines, 800 fills) | the `power-law` pen's law, and its reading |
| width | `width` (2.5 px) where slowest, thinning to 65% at top speed (`PEN_WIDTH.thin` 0.35); tapered over min(8 px, a quarter of the stroke) from 30% (`PEN_WIDTH.tip`), eased; detail 70% and fills 40% of it (`WIDTH_SHARE`) | ink laid down for less time is thinner; a stroke lands and lifts |
| tremor | the seeded tremor (0.8 px, 24 px wavelength), at most half the gap to another leg of the stroke, and for a fill at most the distance to its shape's edge; half of it on hatching (`SKETCH.fillTremor`) | a wobble never wider than the room it has; a hatch reads by its even spacing |
| lift | 0.06 s plus the distance at 1500 px a second (`LIFT`), the pen moving by minimum jerk in the air | a hand lifts, reaches and lands |

`seconds` on the intent (or in `planSketch`'s settings) scales every time so the sketch takes it; the strokes stay the
same. Each stroke keeps its corners (`path`), its drawn points `xs`, `ys`, widths `ws` and times `ts` (seconds from the
sketch's start), and beside them its smooth line (`sx`, `sy`) and the room its tremor had (`rs`), which the boil reads.

## Fills by hand

```js
import { hatchLines } from 'footprint-story/human';

hatchLines([[0, 0], [100, 0], [100, 100], [0, 100]], { angle: 0, spacing: 10 }).segments.slice(0, 2);
// [{ a: [0, 5], b: [100, 5], line: 0 }, { a: [0, 15], b: [100, 15], line: 1 }]: ten lines, 5 px in from each side
```

Lines at `angle` (degrees from the x axis toward y, which runs down; −45 unless given: "/", a right hand's hatch) whose
distance across is `spacing` exactly (8 unless given, 3 to 200), as many as fit, centred — the margin at each side above
0 and at most half a spacing, so no line grazes a corner. Each is cut where it crosses the shape and its holes, the
pieces inside kept (even-odd; a crossing at a corner by the half-open rule). Every piece lies inside, its ends on an
edge — a property test over random simple shapes. Then, by hand: `hatch` — each line a stroke, all drawn the same way
(one flick of the wrist), line by line from the side nearer the pen; `cross-hatch` — a second set at +90° (`CROSS_TURN`);
`scribble` — back and forth without a lift wherever the link to the next line stays inside (the link cut at every crossing
and every corner it passes, each piece's middle inside or on an edge: a link along a comb's tips never crosses its gaps),
a lift where it would not. A line that runs along an edge of the shape is cut at the corners on it and kept where the
shape is beside it.
A drawn fill, tremor and all, stays inside its shape: its tremor's room is capped by the distance to the edge.

## Boil

```js
import { boilSketch } from 'footprint-story/human';

boilSketch(sketch, 7).held;   // 2: frames 6, 7 and 8 are one drawing; frame 9 the next
```

A fresh seeded tremor over each stroke's smooth line each held frame (`BOIL.every`, 3: "on threes", 8 a second at 24
frames a second), within the rooms the plan kept — each stroke keeps the room a tremor of up to 8 px would have
(`ROOM_MOST`), whatever tremor it was drawn with, so `amplitude` is as loud as asked where there is room, and a sketch
drawn with no tremor boils when asked to. Every boiled point is within the amplitude and its room of its line, so within
twice that of the same point on any other frame. Seeded by the plan's `boilSeed` and the held frame's
number: the same frame, the same drawing.

## The model and its critics

```js
import { planMove, checkMove, planIntents } from 'footprint-story/human';

const move = planMove({ do: 'sketch', name: 'box', who: 'blocks[1] ("box")', shapes: box });
move.reason;              // "do: 'sketch' → hand-sketch, the usual for do: 'sketch' — 2 shapes drawn in 31 strokes (2 of lines, the least the corners allow being 2; 1 set of fill lines) over 12.16 s — outline, then detail, then fills, from the top left; …"
checkMove(move).findings; // []
planIntents([{ do: 'sketch', shapes: box }])['duration-0'].leastStrokes;   // 2
```

`hand-sketch` takes `shapes`, `seconds` and `speed` (400 px a second for lines; fills at twice it), and the options `tremor` (0 to 8), `wavelength`,
`width` (0.25 to 20) and `overshoot` (0 to 12 px; 0 for no hooks). Its sample is `{x, y, width, down, stroke,
progress}`. Its random is seeded as every model's is (the piece's `name` and the shapes, never `who` or the timing).

| critic | measures | finds fault when |
|---|---|---|
| `pen-lifts` | a sketch's line strokes over the fewest that draw each piece's outline and its detail, each line once (`PEN_LIFTS_MOST` 0) | any more: a line drawn twice, or shapes traced piece by piece where they meet |
| `stroke-order` | detail or fill strokes that start before their piece's outline is finished (`STROKE_ORDER_MOST` 0) | any |
| `hatch-gaps` | the widest band across a set of fill lines no drawn point passes through, over its spacing — an edge band counted twice, since the margin is at most half a spacing; a band that would be faulted is measured again as its widest stretch where the shape is (a line across would cross at least `REGION_LEAST`, 1 px, of it, holes left out) (`HATCH_GAP_MOST` 1.5) | over 1.5: a missed line |

They read the plan (a tool's own sketch model may give `strokes` with `layer`, `group`, `start`, `seconds`, `path`,
`set`, `xs`, `ys`, and `sets`), and say null for what is not there. Each finding names `who` and the fix in the intent's
keys (`layer`, `group`, `fill: {spacing}`, `model: 'hand-sketch'`).

## Strokes in a map's paint list, and two style choices

```js
import { isoStyle, paintPiece } from 'footprint-story/isometric';
import { sketchyLine, hatchTexture } from 'footprint-story/human';

const style = isoStyle({ line: 'human:sketchy', texture: 'human:hatch' }, { choices: [sketchyLine, hatchTexture] });
paintPiece(style, { name: 'server', kind: 'block', at: [1, 1], size: [2, 2, 1] }, grid, { ink: '#111111' }).items;
// the three faces (fills kept, no ink line), 3 `stroke` items (the silhouette in one stroke, the inner Y in two), then the hatch
```

The paint list has a kind of item for a hand-drawn line: `{item: 'stroke', role, of, points: [[x, y, width, t], …],
fill: null, stroke}` — each point's width (0 to the stroke's `width`) and time (seconds from the piece's start, rising),
checked by `checkPaint`. WHY a kind of its own and not `lines` or `path` with a width per point: a painter that does
not know it refuses it by name, rather than drawing it at one width; and its points are checked as what they are. A
painter that cannot vary a line's width fills `strokeOutline(points, {cap})` (below).

`shapesOfPaint` reads a piece's faces as shapes: an edge one face has is the silhouette (outline), one two faces share
an inner edge (detail), and an edge whose middle lies inside a face painted later is hidden (the straight close of a
cylinder's side, across its top) and left out. `human:sketchy` keeps the faces' fills, drops their ink line and adds the
edges drawn by hand; a floor keeps its tile lines as `ink` does. `human:hatch` hatches a left face and a cylinder's side,
cross-hatches a right face and leaves the top clear (`ROLE_FILLS`), each kept out of the faces painted over it, its
strokes timed after the line's. The two are named under `human:` and handed in: the isometric door never loads
`src/human`, and a tool turns them on once its painter draws `stroke` items.

**A paper's grain** (`grainTexture`, `human:grain`, 0.35.0 — the look `paper-grain`) is a texture of `lines`, not
strokes: a printed fleck has no pace and no taper. In each face, three sets of lines at seeded angles, `spacing` (16 px)
apart across, from `hatchLines` — so a mark is exactly inside its face and out of the faces painted over it, by the
hatch's own clipper, never a second one — each line broken into seeded marks (1 to 3 px) and gaps (12 to 36 px); one
`lines` item a face (role `grain`), the ink at 22%, 0.75 px (`GRAIN`, ours: the numbers and their WHY are in grain.js
and the isometric README). No option is timing, so `unseeded` is empty. Refused: an option out of range; a face whose
grain passes `MOST_GRAIN_MARKS` (4096, an item's most segments), naming a spacing estimated to fit (or that none up to 200 px does); and the grain, or the
hatch, beside the palette `duotone` (the texture runs after the palette, in the map's ink: a third ink).
`HUMAN_STYLE_CHOICES` is `[sketchyLine, hatchTexture, grainTexture]`: a tool that hands it in takes each new choice
as it comes.

## A stroke as a painter fills it: the ring, its caps, and the stroke drawn so far

```js
import { strokeAt, strokeOutline } from 'footprint-story/human';

// a piece's stroke item, drawn at `now`, its piece started drawing at `start`:
const ring = strokeOutline(strokeAt(item.points, now - start), { cap: item.stroke.cap });
// one ring [[x, y], …]: fill it (an SVG path's d, a canvas fill) — no cap of the painter's own, no circles

strokeAt([[0, 0, 1, 1], [10, 0, 3, 2]], 1.5);   // [[0, 0, 1, 1], [5, 0, 2, 1.5]]: the pen half way, half as wide again
strokeOutline([[0, 0, 2, 0], [10, 0, 4, 1]], { cap: 'butt' });     // [[0, -1], [10, -2], [10, 2], [0, 1]]
strokeOutline([[0, 0, 2, 0], [10, 0, 4, 1]], { cap: 'square' });   // … [10, -2], [12, -2], [12, 2], [10, 2] … [-1, 1], [-1, -1]
```

`strokeAt(points, t)` gives the points at or before `t` (seconds on the points' own clock: from the piece's start), then
— when `t` falls between two — the pen's place at `t` on the line between them, its width and time taken as far along
as `t` is. Nothing before the first point; every point at or after the last (`Infinity`: the whole stroke, and
`strokeOutline(strokeAt(p, Infinity))` is `strokeOutline(p)` exactly — a property test). `strokeOutline(points, {cap})`
gives one ring: up the left side, round the far end by its cap, down the right side, round the near end. The caps are
the paint list's (`STROKE_CAPS`):

| cap | what the ring does at each end | numbers (ours) |
|---|---|---|
| `round` (left out: `strokeItems` writes it, a pen's end is round) | a half circle of the end's width round the end point, out past it the way the stroke runs | `CAP_STEPS` 12 segments a half circle: within 0.09 px of the circle at a 20 px stroke (10 (1 − cos(π / 24))), 0.011 px at 2.5 px |
| `butt` | flat across the end point | — |
| `square` | half the end's width out past it, square | — |

A stroke of one point is a dot: a circle, a square, or nothing (butt) — as SVG and a canvas draw a line of no length.
An end of no width takes no cap; an end whose last chord has no length (the pen held still) takes its heading from the
first point that is not in its place.

**WHY the caps are in the ring.** A painter that fills a ring draws no cap of its own: StoryDeck's SVG path drew flat
ends, and StoryReel worked out its own end circles — the same picture computed twice, and differently. A cap is
geometry, so it is here, once. **WHY one ring and not a ring and two discs:** one fill, one path, no seam where a disc
meets the ring. **WHY a point between, not a cut at the last point before `t`:** the stroke then grows smoothly, frame
by frame, at the pen's own speed; a cut at the last point jumps a whole step at a time (2 px, more on a long stroke).
The cut end is capped as the finished stroke's end is, so a stroke being drawn looks like a pen, not a sawn-off line.

## Strokes on a whole map

```js
import { buildIsoMap, ISO_MAP_POLICIES } from 'footprint-story/isometric';
import { sketchyLine, hatchTexture } from 'footprint-story/human';

const map = buildIsoMap({ ...spec, style: { line: 'human:sketchy', texture: 'human:hatch' } }, ISO_MAP_POLICIES.deck, { choices: [sketchyLine, hatchTexture] });
map.paints[0];   // the block's faces, its edges and its hatch as `stroke` items — the same for a film (ISO_MAP_POLICIES.film)
```

The choices are code, so they are handed beside the spec and the policy, never in them (the isometric README: *A whole
map*). The seed is the style's (its choices and options) and the piece's name, never `who`; `human:sketchy` names its
`speed` as `unseeded` — timing, as the human door's `UNSEEDED_KEYS` leave `seconds` and `speed` out — so a faster pen
draws the same wobble sooner. The pen's points of a pinned map are held to 1e-6 (`test/hand-drawn-map.test.js`).

## Limits

At most `MOST_SHAPES` (1024) shapes of `MOST_SHAPE_POINTS` (1024) points, `MOST_SKETCH_INPUT` (8192) points in all,
16 holes a shape, `MOST_HATCH_LINES` (1024) lines a set; the drawn points stay under `MOST_SKETCH_POINTS` (16000), and
each stroke's under `MOST_STROKE_POINTS` (4096, one paint item's) — the step grows for a long drawing or a long stroke,
and a stroke of more corners than that allows (1365) is refused. A piece's paint list holds at most `MOST_PIECE_ITEMS`
(512) items: `human:hatch` refuses a face hatched too close for it, naming the spacing that fits.

## Sources

- L. Euler, "Solutio problematis ad geometriam situs pertinentis", 1736 (the Königsberg bridges): a set of lines drawn
  without lifting needs at most two corners that meet an odd number — taken as the fewest strokes, `graph.js · leastStrokes`.
- M. Fleury, "Deux problèmes de géométrie de situation", *Journal de mathématiques élémentaires*, 1883: never cross a
  bridge unless there is no other way — `graph.js · isBridge`, `order.js · walkLines`.
- P. Van Sommers, *Drawing and Cognition: Descriptive and Experimental Studies of Graphic Production Processes*,
  Cambridge University Press, 1984: drawers start at the top left, start a line at an end, and chain lines that meet
  without lifting — the order's rules 1, 3 and 4.
- F. Lacquaniti, C. Terzuolo, P. Viviani, 1983 (the two-thirds power law), and the seeded tremor: as for the `power-law`
  pen, `../REFERENCES.md`.
- Ours: every number in the tables above — the hook, the thinning and taper, the widths by layer, the lift, the fill
  speed and tremor, the hatch's usual angle and spacing, the boil's hold, the critics' limits, a round cap's segments — each a named constant
  beside its reason, and a test pins it.
