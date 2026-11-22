# humanflow — the intent decider built as a footprintjs chart

`footprint-story/humanflow`. The intent decider's steps (`footprint-story/human` · `HUMAN_STEPS`) as a flowchart, one
stage per step, so a run's record says why each move got its model and its duration:

```
read → choose? (ours | own: plan) → wrap → sample → check → findings
```

```js
import { runHumanFlow } from 'footprint-story/humanflow';
import { whyFromRecord, controlEdges } from 'footprint-story/record';
import { fileSink } from 'footprintjs/sinks';
import { controlDepRecorder } from 'footprintjs/trace';

const intents = [
  { do: 'reach', name: 'hand', from: [200, 600], to: [500, 200] },
  { do: 'throw', name: 'ball', from: [100, 600], to: [700, 600], wrap: [{ wrapper: 'anticipate', share: 0.2 }] },
];
const sink = fileSink('runs/moves.record.jsonl'), control = controlDepRecorder();
const { result, snapshot } = await runHumanFlow(intents, { sink, recorders: [control] });
await sink.close();

console.log(await whyFromRecord({ file: 'runs/moves.record.jsonl', control: controlEdges(snapshot.commitLog, control), key: 'durations' }));
// durations = [{"seconds":0.8509775004326937,"model":"min-jerk","basis":{"distance":500,"target":40,"targetDefaulted":true,"bits":3.7548875021634687,"a":0.1,"b":0.2,"seconds":0.8509775004326937,"secondsGiven":fals…
// wrap (wrap#3) [wrote: moves, durations]
//   plan: ours (ours#2) ← via plans [wrote: plans]
//     read (read#0) ← via intents [wrote: intents, wraps, frame]
//       ⚠ also consumed args — slice may be incomplete here
//     choose (choose#1) ← via choices ← [control: this package's models plan every move — intents[0] ("hand"): reach → min-jerk (usual); intents[1] ("ball"): throw → ballistic (usual)] [wrote: choices, chose, choseWhy]
//       ↳ read#0 (see above)
//   ↳ read#0 (see above)
// (a stage also uses what it is given from outside the run's own state: the record holds what stages read and wrote, and no more)
```

The hand's 0.85 s is Fitts's law over 500 px to a 40 px target (3.75 bits; the target is the usual one, none was
given); the plan was made by the model the decider chose, by the rule its control edge names. `key: 'choices'` answers
why a model was chosen: each choice carries the rule that held (`"rule":"the intent names none: its family's usual"`).

**Why.** The author writes intents; the tool decides the rest — the model, the duration from a law, the curve — and says
why. The owner's rule is to build every feature as a footprintjs flowchart, because the run's record is its debug log.
A decider run in one step leaves only its result; run as stages, "why does the hand take 0.85 s" is walked back from
the duration to the plan, to the decision and to the intent, from the file alone.

**Why a second composition, not a second copy.** A footprintjs run is asynchronous, and a tool plans its moves on a
synchronous path. So a tool's compile calls `planIntents` to draw, and its asynchronous run chart runs this flow for the
record. Each stage calls the very function `planIntents` runs: handed the keys the step names (each read through the
scope, `$getValue`, so the record keeps it), writing back the keys it names. The result a run gives equals
`planIntents`' for the same intents — a property test over random lists of every family, named and usual models, wraps,
and intents an author gets wrong (both refuse in the same words) (`test/humanflow.test.js`) — so the two cannot drift.

**What the record keeps.** `runHumanFlow` runs with `writeProvenance: 'reads-prefix'` (the keys each stage had read when
it wrote). `choose` is a decider: it writes each intent's choice (`choices`) and the list's one choice and reason
(`chose`, `choseWhy`) — a decider that wrote nothing would leave no reads — and hands footprintjs a `decide()` whose
label is the reason, so `controlEdges` saves the words. The list's choice is `ours` when this package's models plan every
move, `own` when a tool's own model plans one: that plan comes from code no record holds, and the control edge says so
("a tool's own model plans 1 of 2 moves, from code this record does not hold — …"). The plan is the branch either way.
The wrap step writes `durations`: each move's seconds beside the basis its model chose by, so the answer to "why so
long" carries the numbers. Two runs of the same intents write the same entries, apart from the run's id and the clock.

**What it gives.** `humanFlow({models, critics})` is the chart, to run as you like (input `{humanIntents, humanFrame}`).
A tool's own models and critics are code, so they are never the run's state: the chart is built with them, and the
record names the model each move used. `runHumanFlow(intents, {models, critics, frame, sink, recorders})` runs it and
gives `{result, snapshot}`: the result (frozen plain data, as `planIntents` gives it) and the run's snapshot. Intents it
refuses reject the run with `planIntents`' words; it reads the intents and the frame itself before the run, by own stored
fields, and hands footprintjs a plain copy, because footprintjs copies a run's input before any stage sees it, and that
copy would run a getter. `humanFlow()` run by hand has that gap: hand it plain data. The sink is the caller's to close.

`footprintjs` (14) is a peer dependency, optional: only this door, `/mapflow` and `/record` need it, and both tools have
it. This door reaches its own folder and the human files the steps compose — the one copy of the decider — and nothing
else (`test/doors.test.js`).
