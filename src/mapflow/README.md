# mapflow — an isometric map built as a footprintjs chart

`footprint-story/mapflow`. The map's steps (`footprint-story/isometric` · `ISO_MAP_STEPS`) as a flowchart, one stage
per step, so a run's record says what each step read, wrote and decided:

```
read → place? (hand | build) → route → fitFloors → grid? (written | fitted) → shape → names → order → floorLabels → style
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
//   read (read#0) ← via who [wrote: who, blocks, floors, wires, written, area, style, policy]
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
is the reason, so `controlEdges` saves the words and `whyFromRecord` shows them. The spec and the policy come in as the
run's input (`{mapSpec, mapPolicy}`), checked by the `read` stage; the record says that stage read the run's args.

**What it gives.** `mapFlow()` is the chart, to run as you like (input `{mapSpec, mapPolicy}`). `runMapFlow(spec,
policy, {sink, recorders})` runs it and gives `{map, snapshot}`: the map (frozen plain data, as `buildIsoMap` gives it)
and the run's snapshot. A spec or a policy it refuses rejects the run with `buildIsoMap`'s words. The sink is the
caller's to close.

`footprintjs` (14) is a peer dependency, optional: only this door and `/record` need it, and both tools have it. This
door reaches its own folder and the isometric files the steps compose — the one copy of the algorithm — and nothing
else (`test/doors.test.js`).
