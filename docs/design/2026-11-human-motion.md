# Human movement and hand drawing — the laws, the strategies, the checks

Status: design, 2026-11-21. Round 1 · A (laws, paths, the `reach`/`pen`/`letter` models, critics `jerk`, `pen-speed`, `arc`, the `footprint-story/human` door) built in footprint-story 0.26.0 (`src/human/README.md`); Round 1 · B builds in parallel (see "Build order"). Round 2 · C (hand-drawn strokes: the order, the pen, fills, boil, the `hand-sketch` model, critics `pen-lifts`, `stroke-order`, `hatch-gaps`, the paint list's `stroke` item and the style choices `human:sketchy`, `human:hatch`) built: `src/human/strokes/README.md`.

## Why

A deck or a film moves things between poses well (`footprint-story/motion`: easing, springs, moves, rides, the
camera). What is missing is what makes movement look like a hand drew it or a body did it. Today an author — a person
or a model — gets "human" by tuning curves and durations until it looks right: many tries, many tokens, a result that
differs run to run. The tools should know how people move and draw, pick the right model for each move, and say in
words what still looks wrong.

## Five rules this design keeps

1. **The author writes intent, the tool decides the rest.** An entry says `{do: 'reach', from, to}` or
   `{do: 'draw', path}`; the tool picks the model, the duration (from a law, never a guess), the curve and the strokes.
   An author never tunes a curve. WHY: the cheapest model call is the one that is not needed.
2. **Same input, same output.** Every model is pure; anything that looks random (a tremor, a wobble, a boil) is seeded
   from the piece's name and the entry, as the styles are. A frame is the same however often it is drawn, in a deck and
   in a film.
3. **Named strategies behind one interface, never a plugged-in function.** A tool adds its own under a prefix
   (`'reel:chalk-pen'`), with the same interface. The record names the strategy used.
4. **Numbers in the package, painting in the tool.** A model gives a plan and samples as plain data; StoryReel paints a
   canvas, StoryDeck writes SVG or CSS.
5. **Every model comes with its checks,** each a measured number and a finding in words with the fix in the entry's own
   keys. A model run that is "not human" is said, never hidden.

## The parts

### Laws (pure maths, `footprint-story/human`)

| Law | What it gives | Source |
|---|---|---|
| minimum jerk | a purposeful move's path in time: one smooth bell of speed | Flash & Hogan 1985 |
| Fitts's law | a move's duration from its distance and its target's size | Fitts 1954 |
| two-thirds power law | a hand's speed along a curve: slower where it bends (speed ∝ curvature^−1/3) | Lacquaniti, Terzuolo & Viviani 1983 |
| sigma-lognormal strokes | handwriting as overlapping lognormal speed pulses | Plamondon 1995 |
| seeded tremor | a small low-frequency wobble along the line's normal | — (value noise, seeded) |

### Paths (pure maths)

Arc-length tables (so a share of time means a share of distance), centripetal Catmull-Rom through points (no loops or
cusps; Yuksel, Schaefer & Keyser 2011), curvature along a path (for the power law), and a stroke path's resampling.

### Physics, light (pure maths, a fixed time step)

Ballistic flight, a bounce with restitution, settling (the existing `spring`), Verlet ropes and chains for what hangs
or trails (Jakobsen 2001), and simple collisions with the floor and boxes. Fixed step and seeded: deterministic.

### Hand-drawn strokes (built on the laws and paths; round 2)

Stroke order (outline before detail, top-left to bottom-right, few pen lifts), pen dynamics (width from speed,
tapered ends, a small overshoot at a corner), wobble and boil (seeded), hatching and scribble fills. Plugs into the
styles' `line` and `texture` columns (`sketchy`, `hatch`) with real timing.

### Bodies (later rounds)

A skeleton with joint limits; two-bone IK and FABRIK chains (Aristidou & Lasenby 2011); a walk planned from its foot
contacts; follow-through from spring chains; squash and stretch that keeps area; idle life (breath, blinks, glances).
Lip sync: the voice's word times → phonemes → mouth shapes.

## The interfaces

### A model (the strategy)

```js
{ family: 'reach' | 'settle' | 'fall' | 'throw' | 'hang' | 'pen' | 'letter' | …,   // what kind of move it serves
  name: 'min-jerk',                                   // this package's names have no prefix; a tool's: 'reel:…'
  options: ['amplitude'], check(options)?,           // what it takes, checked once
  plan(intent, context) → plan,                       // plain data: duration, the numbers sample() needs
  sample(plan, t) → { x, y, angle?, width?, … },      // pure: the same t, the same answer
  checks: ['jerk', 'arc'] }                           // the critics that measure what it made
```

`context` holds the seeded `random()`, the frame's size and the entry's `who` (its words for where it was written).

### A wrapper (a plan → a plan)

The animation principles as transforms over any plan: `anticipate(plan, {share})`, `followThrough(plan, {share})`,
`hold(plan, {at, seconds})`, `overshoot(plan, {by})`. A wrapper is a named strategy too, recorded with the plan.

### A critic (a check)

```js
{ name: 'jerk', measure(track) → number, limit, finding(number, who) → { level, message, fix } }
```

Measured on the sampled track: speed peaks (`jerk`), the power law's fit error (`pen-speed`), a foot's slide during
contact (`foot-slide`), straight-line moves of a head or a hand (`arc`), even spacing on a fall (`spacing`), area
change under squash (`volume`). A finding names the entry and the fix in the entry's keys
("blocks[2] ("hand"): its move has 3 speed peaks — it reads as twitchy: use do: 'reach'").

### An adapter (the tool's side)

The tool turns its own words (a recipe entry, a deck attribute) into an intent, hands it in, and paints the samples.
It never re-derives a duration or a curve.

## The decider: picking a model by intent (round 2)

The same shape as the map flow (`docs/design/2026-11-map-flow.md`): pure, synchronous steps in one list, and a door
with `footprintjs` as an optional peer that builds a chart of the same steps.

`read intents → choose model (decider, writes its reason) → plan → wrap → sample → check → findings`

The decider's rules are data, as `decide()` rules are: a reach → `min-jerk` with Fitts's duration; a settle →
`spring`; a throw or a fall → `ballistic`; something that hangs → `verlet`; a pen line → `power-law`; lettering →
`sigma-lognormal`. Its reason lands on the record ("a reach: min-jerk over 0.62 s, from Fitts with a 40 px target"),
so `log --why` answers why a hand moves as it does. Each frame's sampling stays plain code; the choice is once per entry.

## What this saves a model author

- No curve tuning: one intent instead of a duration, an ease and keyframes.
- No looking at frames to judge "human": the checks say what is wrong and the fix, in a line.
- No drift between tries: the same entry gives the same motion, so a fix is checked once.

## Build order

**Round 1, in parallel (one pull request each, separate folders):**
- **A — laws and paths** (`src/human/laws/`, `src/human/paths/`): minimum jerk, Fitts, the power law, sigma-lognormal,
  seeded tremor; arc length, centripetal Catmull-Rom, curvature, resampling; the model interface for `reach`, `pen` and
  `letter`; critics `jerk`, `pen-speed`, `arc`. Creates the `footprint-story/human` door.
- **B — light physics and secondary motion** (`src/human/physics/`): ballistic, bounce, Verlet chains, floor and box
  collisions, fixed step; models for `throw`, `fall`, `hang`; critics `spacing`, `volume`; wrappers `anticipate`,
  `followThrough`, `hold`, `overshoot`. Adds its exports to the same door.

**Round 2:** C — hand-drawn strokes (on A); D — the intent decider and its chart (on A and B).

**Later:** bodies (rigs, walk, foot contacts), lip sync, gaze. Then each tool's adapter and painter, as the maps had.
