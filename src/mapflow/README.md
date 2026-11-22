# mapflow — an isometric map built as a footprintjs chart

`footprint-story/mapflow`. The map's steps (`footprint-story/isometric` · `ISO_MAP_STEPS`) as a flowchart, one stage
per step, so a run's record says what each step read, wrote and decided:

```
read → place? (hand | build) → route → fitFloors → grid? (written | fitted | usual) → shape → names → order → floorLabels → style
```

```js
import { runMapFlow } from 'footprint-story/mapflow';
import { ISO_MAP_POLICIES } from 'footprint-story/isometric';
import { whyFromRecord, controlEdges } from 'footprint-story/record';
import { fileSink } from 'footprintjs/sinks';
import { controlDepRecorder } from 'footprintjs/trace';

const sink = fileSink('runs/map.record.jsonl'), control = controlDepRecorder();
const { map, snapshot } = await runMapFlow(spec, ISO_MAP_POLICIES.film, { sink, recorders: [control] });
await sink.close();

console.log(await whyFromRecord({ file: 'runs/map.record.jsonl', control: controlEdges(snapshot.commitLog, control), key: 'at' }));
// at = [[0,3,0],[3,0,0]]
// place: build (build#2) [wrote: at]
//   read (read#0) ← via who [wrote: who, blocks, floors, wires, obstacles, keep, written, usualGrid, area, style, policy]
//     ⚠ also consumed args — slice may be incomplete here
//   place (place#1) ← [control: no block has an at: the build places them from their wires, across the frame] [wrote: placed, placedWhy]
```

**Why.** The owner's rule is to build every feature as a footprintjs flowchart: the run's record is its debug log. A
map built in one step leaves only its result; built as stages, "why does this block stand here" is walked back from
step to step — the place step read the blocks and the wires, a decision let it run, and the decision says why.

**Why a second composition, not a second copy.** A footprintjs run is asynchronous, and both tools build their maps on
a synchronous path. So a tool's compile calls `buildIsoMap` to draw, and its asynchronous run chart runs this flow for
the record. Each stage calls the very function `buildIsoMap` runs: handed the keys the step names (each read through
the scope, `$getValue`, so the record keeps it), writing back the keys it names. The map a run makes equals
`buildIsoMap`'s for the same spec and policy — a property test over random maps, styles and both policies
(`test/mapflow.test.js`) — so the two cannot drift. The work is done twice per build, never per frame.

**What the record keeps.** `runMapFlow` runs with `writeProvenance: 'reads-prefix'` (the keys each stage had read when
it wrote). A step that chooses is a decider: it writes its choice and its reason (`placed`/`placedWhy`,
`grid`/`gridWhy`) — a decider that wrote nothing would leave no reads — and hands footprintjs a `decide()` whose label
is the reason, so `controlEdges` saves the words and `whyFromRecord` shows them. The grid's reason says which of five it
was: written in numbers; asked fitted (`grid: 'fit'`); fitted, no grid being written and no usual grid handed in;
fitted because the build placed the blocks; or the usual grid the tool handed in (`usualGrid`, 0.25.0), said apart for
a map that placed its blocks and one that has none — so a deck's record never says "written" of a grid nobody wrote, nor
"placed" of blocks it does not have. The spec and the policy come in as the
run's input (`{mapSpec, mapPolicy}`), checked by the `read` stage; the record says that stage read the run's args.

**The paint lists are kept as a summary (0.33.1).** The record keeps what must be explained; what is merely derived
is not. A paint list — every polygon, and with `human:sketchy`/`human:hatch` every hand-drawn stroke with all its points —
is a pure function of the spec, the policy and the tool's choices (seeded), and the record already keeps those: the
`read` stage's writes, and the choices' names in `style.row`. Kept whole it was most of the record: a 64-block hatched
world wrote 12.4 MB of commit log, and footprintjs's file sink refused the `style` entry outright (over its 8 MB entry
bound), so the record file had no style stage at all. So the `style` stage writes, under the same keys `paints` and
`floorPaints`, a summary (`summary.js` · `paintSummary`):

```js
{ pieces: 64, items: 3839, byItem: { path: 13, ellipse: 13, stroke: 3660, polygon: 153 }, points: 157605, perPiece: [22, 69, 84, …], digest: 'fnv1a32:4636302c' }
```

— the counts, and FNV-1a (`src/seed/seeded.js` · `fnv1a`, the seed's own hash) over the lists' JSON with keys sorted. The
full lists never enter the run's state: `runMapFlow` hands the stages a place of its own for them and gives them back in
the map, so the map is still `buildIsoMap`'s whole, and the drift properties check both — the map equal, and the
record's summary the summary of the built lists. The keys are the steps' own, so `log --why paints` answers as before,
now with the summary. That world's record is 90.8 KB (`test/mapflow-record-size.test.js` pins it under 300 KB, and a
plain world's under 0.33.0's 144 KB). `mapFlow()` run by hand keeps the summary only. No later step reads a paint list
(a test pins it), so a summary never feeds a step.

**A hand-drawn map.** A tool's own style choices (`sketchyLine`, `hatchTexture` from footprint-story/human) are code,
so never the run's input or state: `mapFlow({choices})` builds the chart with them and each stage hands them to its
step, as `buildIsoMap(spec, policy, {choices})` does; `runMapFlow(spec, policy, {choices, sink, recorders})` reads them
once and builds that chart. The record keeps the names the map's style chose (`style.row.line: 'human:sketchy'`,
written by `read`, read by `shape` and `style`). WHY bound into the chart (the humanflow way): footprintjs copies a
run's input, and a function does not copy. The drift property holds with them: for random maps, hand-drawn rows and
both policies, the run's map equals `buildIsoMap`'s, or both refuse in one set of words (`test/hand-drawn-map.test.js`).

**What it gives.** `mapFlow({choices})` is the chart, to run as you like (input `{mapSpec, mapPolicy}`). `runMapFlow(spec,
policy, {choices, sink, recorders})` runs it and gives `{map, snapshot}`: the map (frozen plain data, as `buildIsoMap` gives it)
and the run's snapshot (its `paints`/`floorPaints` the summaries above). A spec or a policy it refuses rejects the run with `buildIsoMap`'s words; it reads the spec
itself before the run and hands footprintjs a plain copy, because footprintjs copies a run's input before any stage sees
it, and that copy would run a getter. `mapFlow()` run by hand has that gap: hand it plain data. The sink is the
caller's to close.

`footprintjs` (14) is a peer dependency, optional: only this door and `/record` need it, and both tools have it. This
door reaches its own folder and the isometric files the steps compose — the one copy of the algorithm — and nothing
else (`test/doors.test.js`).
