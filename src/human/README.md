# human/ — how people move and draw, as numbers

**Why:** a deck or a film moves things between poses well (`footprint-story/motion`), but a hand that reaches, a pen
that draws and a letter being written look human only when they follow how bodies move. Tuning curves until it looks
right costs many tries and differs run to run. So the laws are here once, an author writes only the intent
(`{do: 'reach', from, to}`), a named model plans the move from a law, and critics say in words what still looks
wrong. Same input, same output: anything that looks random is seeded from the entry. Nothing here draws — a tool
paints the samples. Design: `docs/design/2026-11-human-motion.md`.

| folder · file | holds |
|---|---|
| `laws/minJerk.js` | minimum jerk: a purposeful move's path in time, one smooth bell of speed (`minJerk`, `minJerkSpeed`, `minJerkAccel`) |
| `laws/fitts.js` | Fitts's law: a move's seconds from its distance and its target's width (`fittsIndex`, `fittsSeconds`, `FITTS`) |
| `laws/powerLaw.js` | the two-thirds power law: slower where a line bends (`powerLawSpeed`, `powerLawTimes`, `powerLawFit`) |
| `laws/sigmaLognormal.js` | sigma-lognormal strokes: overlapping lognormal pushes, added up into a pen's path (`sigmaLognormalAt`, `strokeBetween`, …) |
| `laws/tremor.js` | a seeded tremor that swings to and fro across a line, nothing at its ends (`tremorKnots`, `tremorAt`) |
| `paths/arcLength.js` | a line's length table, and share ↔ distance (`arcTable`, `pointAt`, `shareToDistance`, `distanceToShare`) |
| `paths/catmullRom.js` | a centripetal Catmull-Rom line through points: no cusp, no loop (`catmullRom`) |
| `paths/curvature.js` | the curvature at each point (`curvatures`; a hairpin is the sharpest bend, never straight), and over a width (`curvaturesOver`, what the pen and its critic read) |
| `paths/resample.js` | points again, evenly by distance (`resample`) |
| `paths/gap.js` | the room beside a line: the gap to another stretch of it, a hairpin's other leg (`legGaps`) |
| `physics/` | light physics on a fixed step: ballistic flight, bounces, hanging chains (Jakobsen 2001), a floor and boxes, settling on the motion spring — see [physics/README.md](physics/README.md) |
| `models/` | the model interface and registry (`registry.js`), how a model is chosen as data (`rules.js` · `CHOOSE_RULES`), this package's seven models, the wrappers (`wrap.js`), and `planMove` / `sampleMove` / `sampleTrack` (`move.js`) |
| `intents/` | the intent decider: an author's list of intents in, every move decided by steps in one list (`HUMAN_STEPS`, `planIntents` in `steps.js`; the reader `read.js`; the bounded track summary `summary.js`) — see below |
| `critics/` | the critic interface and registry, `jerk`, `pen-speed`, `arc`, `spacing`, `volume`, `contact`, `stretch`, and `checkMove` (`check.js`) |
| `read.js`, `plain.js`, `names.js` | reading what a caller hands in; plain frozen data checked; the strategies' names (seeded numbers: the shared leaf `src/seed/seeded.js`) |
| `REFERENCES.md` | the papers, and what was taken from each |

## The laws

```js
import { minJerk, fittsSeconds, powerLawSpeed, strokeBetween, sigmaLognormalAt, strokeEnd } from 'footprint-story/human';

minJerk(0.5);                         // 0.5: half way at half time, fastest there (1.875 × the mean speed)
fittsSeconds(500, 40);                // 0.85 s: 0.1 + 0.2 × log2(500 / 40 + 1) bits
powerLawSpeed(0.01) / powerLawSpeed(0.08);  // ≈ 1.98: a bend 8× as tight is taken about half as fast
const s = strokeBetween([0, 0], [60, 0], { bend: 0.6 });
sigmaLognormalAt([s], strokeEnd(s), [0, 0], strokeEnd(s));   // { x: 60, y: 0, vx, vy }: lands on its point, to the last bit
```

Every default is a named constant with its source, or marked ours (`REFERENCES.md`).

## The paths

```js
import { catmullRom, arcTable, pointAt, curvatures, resample } from 'footprint-story/human';

const line = catmullRom([[100, 100], [300, 180], [420, 90]], { spacing: 4 });   // through all three, exactly
const table = arcTable(line);
pointAt(table, table.length / 2);     // the point half way along by distance, not by count
curvatures(resample(line, { spacing: 8 }));   // 1 / radius at each point
```

## Models: an intent in, a plan and samples out

A model is a named strategy, one interface for all (`models/registry.js`):
`{family, name, options, check?, plan(intent, context) → plan, sample(plan, t) → {x, y, …}, checks}`; `family` is one
family or a list of them (a ballistic flight is a throw and a fall alike: one strategy, one name). This package's:

| do | family | model (the usual) | the intent's keys | options (under `model: {name, …}`) |
|---|---|---|---|---|
| `reach` | `reach` | `min-jerk`: minimum jerk, seconds from Fitts unless given | `from`, `to`, `target` (px, 40), `seconds` | `bend` (0.06, at most 0.3), `a`, `b` |
| `draw` | `pen` | `power-law`: a Catmull-Rom line traced slower in the bends (the law read on the smooth line, before the tremor), with a tremor that swings to and fro, never larger than half the gap to another leg of the line | `path`, `seconds`, `speed` (400 px a second) | `tremor` (0.8 px), `wavelength`, `ramp`, `floor` |
| `write` | `letter` | `sigma-lognormal`: one lognormal stroke a point, overlapping | `points`, or `strokes` and `at`; `seconds` | `mu`, `sigma`, `gap`, `bend` |
| `throw` | `throw` | `ballistic`: through the air in closed form, the usual apex a 45° throw; or `bounce`: lands on the floor at `to` and bounces to rest | `from`, `to`, `apex` or `seconds`, `floor`, `boxes`, `radius` | `gravity` (1960 px/s²); bounce: `restitution` (0.5, at most 1), `keep`, `squash` |
| `fall` | `fall` | `ballistic`: down to the floor; or `bounce` | `from`, `floor`, `velocity`, `boxes`, `radius` | as for a throw |
| `hang` | `hang` | `verlet`: a chain pinned at `from`, swinging until it has been still for half a swing | `from`, `to` or `length`, `path` (the pin's moves), `seconds`, `floor`, `boxes` | `gravity` (at most 1e5), `links` (8, or as many as fit), `damping` (0.9), `jitter` (0, seeded) |
| `settle` | `settle` | `spring`: to rest on the motion spring, its seconds the feel's | `from`, `to` | `feel` (default), or `k` and `d` |

Every intent may also hold `name` (its piece: part of the seed), `who` (its words for where it was written, named in
every refusal and finding) and `model`. Every family has a usual model.

```js
import { planMove, sampleMove, checkMove } from 'footprint-story/human';

const move = planMove({ do: 'reach', name: 'hand', who: 'blocks[2] ("hand")', from: [200, 600], to: [500, 200] });
move.reason;   // "do: 'reach' → min-jerk, the usual for do: 'reach' — over 0.85 s from Fitts's law: 500 px to a 40 px target (the usual: none was given), 3.75 bits, bowed 6% of its length"
sampleMove(move, 0.4);   // { x, y, progress }: frozen; the same t, the same answer
```

`move` is frozen plain data, so a record keeps it whole and a structured copy samples the same. Beside the words it
carries the data: `move.choice` (`{by: 'named' | 'usual'}`) and `move.plan.basis`, a flat record of the numbers the
plan chose by — for a reach `{distance, target, targetDefaulted, bits, a, b, seconds, secondsGiven, bend}` — so a
decider records data, and `reason` is their sentence. A sample is `{x, y, …}`: more numbers, or lists of at most
`MOST_SAMPLE_LIST` numbers or points (a hanging chain's links), still plain and frozen. A tool's own model
is named under its prefix and handed in, to `planMove` and again to `sampleMove` (a record keeps no code):

```js
const chalk = { family: 'pen', name: 'reel:chalk', options: ['grit'], checks: ['pen-speed'],
  plan: (intent, { random, who }) => ({ seconds: 1, … }), sample: (plan, t) => ({ x, y, width }) };
const move = planMove({ do: 'draw', path, model: { name: 'reel:chalk', grit: 2 } }, { models: [chalk] });
sampleMove(move, t, { models: [chalk] });
```

The model's `random()` is seeded from its name, its options, the piece's `name` and the intent's shape (FNV-1a, then
mulberry32: `src/seed/seeded.js`, the one leaf the isometric styles use too) — never from `who` (moving an entry in its list keeps its wobble) nor the
timing keys `seconds` and `speed` (a slower draw keeps its wobble's shape): `UNSEEDED_KEYS`. The same entry wobbles
the same way, another piece another way. A model's plan and
samples are checked as plain data (`plain.js`); what its own code throws comes out as it is.

## Critics: what still looks wrong, in words

A critic is `{name, measure(track) → number | {value, basis} | null, limit, finding(value, who, basis) → {level,
message, fix} | null}`. `checkMove(move)` samples the move (120 a second), runs the critics its model names, and gives
`{measures, bases, findings}`:

| critic | measures | finds fault when |
|---|---|---|
| `jerk` | speed peaks beyond the pushes the plan was made of | any extra: it stops and starts |
| `arc` | the most the move bows from its straight line, over its length | under 2%: a straight slide |
| `pen-speed` | how far the speed is off the two-thirds power law (log RMS against the curvature of the line as drawn, read over one tremor wavelength either side, plus the 0.00025 floor; ends left out); its basis has the free fit's exponent | over 0.2: a plotter |

```js
checkMove(planMove({ do: 'reach', who: 'b1', from: [0, 0], to: [300, 0], model: { name: 'min-jerk', bend: 0 } })).findings;
// [{ critic: 'arc', level: 'warn', message: 'b1: its move runs straight (it bows 0.0% of its length) — …', fix: "bow it: model: {name: 'min-jerk', bend: 0.06}", basis: null }]
```

A tool's own critic is handed in `critics` under its prefix, as a model is.

## Physics and wrappers

`do: 'throw'`, `'fall'`, `'hang'` and `'settle'` plan from physics: the duration is the flight's, the bounces', the swing's
or the spring's, never a guess, and the plan's basis carries the numbers (a throw's apex, launch angle and speed; a
bounce's count; a chain's link length and whether it settled). The wrappers reshape any move — a reach as well as a
throw — and `sampleMove` reads the wrapped move like any other:

```js
import { planMove, sampleMove, checkMove, anticipate, overshoot } from 'footprint-story/human';

const ball = planMove({ do: 'throw', who: 'blocks[2] ("ball")', from: [100, 600], to: [700, 600] });
ball.reason;   // "do: 'throw' → ballistic, the usual for do: 'throw' — a throw over 0.78 s, up 150 px above its higher end (the usual: a quarter of the 600 px across), launched at 45° under 1960 px/s²"
const lively = overshoot(anticipate(ball, { share: 0.2 }), { by: 12 });
lively.wrappers;                         // ['anticipate', 'overshoot']; lively.reason says each
sampleMove(lively, lively.plan.seconds); // { x: 700, y: 600, angle }: the throw's own end, exactly
checkMove(planMove({ do: 'throw', who: 'b', from: [0, 500], to: [600, 500], boxes: [{ x: 250, y: 300, w: 100, h: 100 }] })).findings;
// [{ critic: 'contact', level: 'warn', message: 'b: at 0.39 s it goes 49.7 px into a box — it passes through something solid', fix: "raise its path (apex: …", basis: { at, into } }]
```

The critics `spacing` (a fall or a throw that accelerates down at under half its gravity reads as slid, not falling),
`volume` (a squash that changes the area reads as rubber), `contact` (a body that passes into the floor or a box) and
`stretch` (a chain's link drawn over 5% long) are measured on the track. Each wrapper adds the speed bells it makes to
the plan's `pushes` (`ADDED_BELLS`), so `jerk` reads a wrapped reach as meant; `sampleTrack` keeps each sample whole (a squash's `sx` and `sy`, a chain's `points`) and the plan, whose `world`
the contact critic reads. Details, the laws each part keeps and their sources: [physics/README.md](physics/README.md).

## The intent decider: a list of intents, every move decided

**Why:** the author writes intents, the tool decides the rest. A scene is many moves; an author — a person or a model —
should write each as what happens (`{do: 'reach', from, to}`) and get back every model, duration, curve and finding,
with why. `planIntents` runs the decider as named, pure steps in one list (`HUMAN_STEPS`), the shape of the map's steps
(docs/design/2026-11-map-flow.md), so `footprint-story/humanflow` runs the same list as a footprintjs chart and a run's
record answers why ([../humanflow/README.md](../humanflow/README.md)).

```
read → choose? (ours | own: plan) → wrap → sample → check → findings
```

```js
import { planIntents } from 'footprint-story/human';

const r = planIntents([
  { do: 'reach', name: 'hand', from: [200, 600], to: [500, 200] },
  { do: 'throw', who: 'blocks[2] ("ball")', from: [100, 600], to: [700, 600], wrap: [{ wrapper: 'anticipate', share: 0.2 }] },
  { do: 'reach', from: [0, 0], to: [300, 0], model: { name: 'min-jerk', bend: 0 } },
]);
r.choices[0];    // { who: 'intents[0] ("hand")', do: 'reach', family: 'reach', model: 'min-jerk', by: 'usual', rule: "the intent names none: its family's usual", own: false }
r.durations[0];  // { seconds: 0.85…, model: 'min-jerk', basis: { distance: 500, target: 40, targetDefaulted: true, bits: 3.75…, … }, wrappers: [], who: … }
r.findings;      // [{ intent: 2, who: 'intents[2]', model: 'min-jerk', critic: 'arc', level: 'warn', message: 'intents[2]: its move runs straight …', fix: "bow it: model: {name: 'min-jerk', bend: 0.06}" }]
```

- **read** — at most `MOST_INTENTS` (256) intents, each copied by its own stored fields (a getter is never run), named
  (its `who`, else `intents[i]` with its piece's name), its `wrap` taken apart (`wraps[i]`, at most 4 wrappers).
- **choose** — by rules as data: the family by `do` (`HUMAN_DOS`), then the first rule of `CHOOSE_RULES` that holds,
  in the shape of footprintjs `decide()` rules: `{when: {named: {eq: true}}, then: 'named'}` (the model the intent
  names), else `{when: {usual: {ne: null}}, then: 'usual'}` (its family's usual). `planMove` reads the same table
  (`registry.js` · `chooseModel`), so the two never choose apart. It writes `choices` (each with its rule's words),
  and one choice for the list — `chose: 'ours'` when this package's models plan every move, `'own'` when a tool's own
  plans one, whose code no record holds — and its reason `choseWhy`.
- **plan** — the branch chosen: `planMove` per intent, its model checked to be the one chosen; `plans` keep the reason
  and `plan.basis`.
- **wrap** — each plan wrapped as asked, innermost first (`moves`), and `durations`: each move's seconds beside its
  model's basis and the wrappers' names.
- **sample** — `tracks`: each move's track summed up in a bounded record (`summary.js`: seconds, sample count, distance,
  peak speed, bounds, and at most `SUMMARY_POINTS` (16) samples, both ends in).
- **check** — `checks`: `checkMove` per move.
- **findings** — every intent's findings in one list, each naming its intent (by place and by `who`), its model, the
  critic and the fix.

Each step reads only the keys it names and gives back the keys it names (a test hands each only those). A tool's own
`models` and `critics` go in the settings as for `planMove` (`planIntents(intents, {models, critics, frame})`): code is
never state, so each step is handed them beside it. The result is frozen plain data, the same for the same intents.

## For the next builders

- A new model: an object with the interface, in `models/`, added to `models/builtIn.js` (`BUILT_IN_MODELS`, and
  `USUAL_MODELS` if it is its family's usual). Its family must be in `HUMAN_FAMILIES` (`models/registry.js`).
- A new critic: in `critics/`, added to `critics/builtIn.js` (`BUILT_IN_CRITICS`); a model names it in `checks`.
- Each new file goes behind the door (`human.js`) with its types (`human.d.ts`); `test/doors.test.js` refuses one that is not.
- A list of models or critics is read once and kept beside a copy of what it held; a list changed since is read again.
- A new step of the intent decider: a pure function in `intents/steps.js` with the keys it reads and writes, in `HUMAN_STEPS`;
  the chart (`src/humanflow/`) builds itself from the list, and its property test checks the two still agree.
