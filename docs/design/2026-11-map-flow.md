# The map flow — building an isometric map as named steps, and as a footprintjs chart

Status: design, 2026-11-21; build-order step 1 done in footprint-story 0.24.0 (`ISO_MAP_STEPS`, `buildIsoMap`, `/mapflow`). Replaces steps 2–4 of `2026-11-iso-styles.md` (the painters now plug into this flow).

## Why

A map is built today as one opaque step inside each tool's compile: StoryDeck's `deck/iso.js` and StoryReel's
`src/kits/isometric/build.mjs` each place the blocks, lay the wires, fit the floors, choose the grid, shape the pieces,
fit the names and place the floor labels — the same order, written twice (StoryReel's is a copy of StoryDeck's rules,
its numbers already footprint-story's). What was decided is written into the record afterwards (`maps made`, the
world's `map`), not as stages, so `log --why` cannot follow "why does this block stand here" from step to step. The
owner's rule is to build every feature as a footprintjs flowchart, the run record being the debug log.

## The constraint that shapes it

A footprintjs run is asynchronous (`FlowChartExecutor.run` returns a promise; there is no synchronous run). Both tools
build their maps on a synchronous path: StoryDeck's `compileDeck` and StoryReel's kit `compile` are synchronous, and
called from many places. Making them asynchronous would touch every caller of both tools.

## The decision

1. **The steps are pure, synchronous functions in `footprint-story/isometric`**, in one list, `ISO_MAP_STEPS`, run in
   order by `buildIsoMap(spec, policy)` → the built map, plain data. This is the one copy of the algorithm.
2. **`footprint-story/mapflow`** (a new door; `footprintjs` an optional peer, as `/record` has it) builds a footprintjs
   chart from the same step functions: one stage per step, a decider where a step chooses (who places the blocks: the
   map, or the build from its wires; the grid: written, or fitted to the area), each decider writing its reason. Its
   result equals `buildIsoMap`'s for any map (a property test), so the two compositions cannot drift.
3. **A tool's synchronous compile calls `buildIsoMap`; its asynchronous run chart runs the map flow**, so the run's
   record holds a real run of the same steps — what each read, wrote and decided — and `whyFromRecord` answers from it.
   The work is done twice per build (once to draw, once on the record). Maps are built once per build, never per frame,
   so the cost is bounded; both are deterministic, and the property test keeps them equal.
4. **Drawing a frame stays plain code**: easing, rides, the painters. A chart per frame would bury the decisions.

## The spec and the policy

The **spec** is the map as data, already read by the tool from its own format (a deck's attributes, a film's recipe):

```js
{ blocks: [{ name, kind: 'block'|'cylinder', at: [c, r, lift]|null, size, label, small, rule, group, ports, who }],
  floors: [{ name, at|null, size|null, label, group, who }],
  wires:  [{ name, from: { block, port? }, to: { block, port? }, straight, who }],
  grid:   { tile, origin, rise } | null,   area: [x0, y0, x1, y1],   style: a row of choices }
```

`who` is the tool's own words for where a piece was written (`blocks[2] ("db")`, `data-iso="block" ("db")`): every
refusal names it, so a tool needs no rewording.

The **policy** is the tool's own numbers, where a deck and a film differ on purpose:

```js
{ fit: { most, least, grouped, inset, margin }, name: { size, least }, small: { size, least } | null, clear,
  hold: 'groups' | 'groups-and-labels' }   // which floors a fitted picture must hold
```

## The steps

| Step | Reads | Writes (on the record) | Decides |
|---|---|---|---|
| `place` | blocks, wires | each block's `at`; `placed: 'hand' \| 'build'` | the map placed them, or the build from its wires (by group when any has one) |
| `route` | blocks, wires | each wire's route (its `why` when it has no way) | — |
| `fitFloors` | blocks, routes | each floor's `at` and `size` when none was written | — |
| `grid` | blocks, routes, floors, area | the tile, the origin | written, or fitted to the area |
| `shape` | grid, blocks, style | each piece's box, centre, outline, faces (the style's `shape` column) | — |
| `names` | shapes, labels, policy | each name's lines, size, fits, rule; the small line | — |
| `order` | blocks | the paint order, furthest first | — |
| `floorLabels` | floors, shapes, routes | each label's place, fits, covered | — |
| `style` | shapes, colours | each piece's paint list (the style's other columns) | — |

Cables on the frame (their line, label, head, lead, packets) come in a later step: the two tools differ most there.

## Build order (one pull request each)

1. **footprint-story** (this): `ISO_MAP_STEPS`, `buildIsoMap`, the `/mapflow` door. Moved from StoryReel 0.38.0's
   `build.mjs`; pinned against a copy of it (the same built map, for random specs) and the chart against `buildIsoMap`.
2. **StoryReel** uses `buildIsoMap` in its kit and runs the map flow in its pipeline, its copies gone; golden frames
   unchanged. Then the canvas painter and `style` in a world's recipe.
3. **StoryDeck** feeds its read map to `buildIsoMap` (its policy: `hold: 'groups'`); its deck-only parts (footprints,
   keep-clear, callouts) stay its own, around the steps; pages unchanged. Then the SVG painter and `data-style`.
4. New looks, one or two per pull request, each with a still from a real map.
