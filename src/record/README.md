# record — a run's record, read back

`footprint-story/record` (Node only). StoryDeck and StoryReel each run a footprintjs chart for a check and keep the
run's record as a file. This door reads one back and says **where a value came from**:

```js
import { whyFromRecord, controlEdges } from 'footprint-story/record';

// when the run ends: which decision let each step run, saved beside the record
const control = controlEdges(executor.getSnapshot().commitLog, controlRecorder);

// later, from the files alone — nothing is run again
console.log(await whyFromRecord({ file: 'runs/x.record.jsonl', control, key: 'verdict', run: 'run 1' }));
// verdict = "fix"
// fix (fix#5) [wrote: verdict]
//   verdict (verdict#4) ← [control: there is something to fix] [wrote: why]
//     add (sum#2) ← via errors [wrote: errors]
//       count a (a#0) ← via a [wrote: a]
// (a stage also uses what it is given from outside the run's own state: the record holds what stages read and wrote, and no more)
```

**Why here.** A run's words say what happened in order; they do not answer "why is this number so" without reading
all of them. The record does, and an agent that asks one question reads a few lines. One reader, so a deck and a film
answer alike and are hardened alike.

**What the run must keep.** Run the chart with `new FlowChartExecutor(chart, { sink: fileSink(file), writeProvenance:
'reads-prefix' })` (the record, with the keys each stage had read when it wrote) and attach `controlDepRecorder()`
(footprintjs/trace). Two things follow from how a record is written:

- **A stage's reads are kept with what it writes.** A decider that writes nothing leaves no reads: have it write its
  reason (`s.why = …`), and the walk goes on through it.
- **A cause shown is everything the stage had read by then.** Give each value that is added up a stage of its own, and
  the path is exact. What a stage takes from outside the run's own state (a closure, a file) is in no record: every
  answer ends by saying so.

**The record is read as a file anyone may have written** (`WHY_LIMITS`): only as a plain file of at most 8 MB, never
through a link; it must hold one run (its own log, and one for each chart it mounted: the run's own is walked, and the answer says
when there are others); a name or a value in it starts no line of the answer; the value asked for is shown on one line up to 1000 characters (`WHY_LIMITS.asked`: it is the answer, asked of one key to be seen whole) and every other name up to 200 (`WHY_LIMITS.value`); a step keeps at most 200
rows and 200 keys read (more are cut, and the answer says so); a saved decision is used only when it names an earlier
step of this record. A record that is not whole says so first, and a value it lacks is then "not found in what could
be read", never "never written". A record written without the reads (before a tool kept them) says so under its answer.

`footprintjs` (14) and `foottrace` (2) are peer dependencies, optional: only this door needs them, and both tools
have them. The walk is foottrace's (`sliceForKey`, `formatSlice`); the one-line rule is `oneLine` (the root door).
