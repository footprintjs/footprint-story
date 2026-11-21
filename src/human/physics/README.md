# human/physics — light physics and secondary motion

**Why:** a ball thrown on a slide, a sign swinging on its rope, a box dropped onto a floor. Tuned by hand, each takes
many tries and comes out different every time. Here the author writes the intent (`{do: 'throw', from, to}`) and the
physics decides the rest: how long it takes, how it is spaced, where it lands, how long it swings. The same intent gives
the same plan in a deck and in a film. Nothing here draws: a plan and its samples are plain numbers, and each tool paints
them (design: `docs/design/2026-11-human-motion.md`, Round 1 · B).

| file | holds |
|---|---|
| `step.js` | the fixed step (1/240 s, frames kept at 60 a second), position Verlet, the simulation loop |
| `flight.js` | ballistic flight in closed form: a launch to a target with an apex or a time, a fall's time |
| `bounce.js` | a bounce on a floor with restitution, in closed form, resting on the floor exactly |
| `chain.js` | ropes and chains: Verlet points, links held to their length, a pinned end that may move |
| `collide.js` | a floor line and axis-aligned boxes: reading them, pushing a point out, how deep a body is |
| `settle.js` | settling back on the package's own spring (`src/motion/spring.js`), exactly at rest at the end |
| `models.js` | the five models, one interface: `throw`, `fall`, `hang` |
| `wrap.js` | the wrappers: anticipate, follow-through, hold, overshoot, over any model's plan |
| `critics.js` | the critics: spacing, volume, contact; `trackOf` samples a plan into a track |
| `read.js` | the shared readers: stored values only, refusals naming the entry and the fix, frozen output, seeded numbers |

## Models

One interface, the design's: `{family, name, options, check, plan(intent, context), sample(plan, t), checks}`.
`context` is `{who, random}`: the entry in its own words (every refusal and finding names it) and seeded numbers.

| family · name | intent | gives |
|---|---|---|
| `throw · ballistic` | `from, to, apex? or seconds?, gravity?` | through the air, ending on `to`; `angle` is the heading |
| `throw · bounce` | the same, `restitution?, keep?, squash?` | lands on the floor at `to`, then bounces to rest |
| `fall · ballistic` | `from, floor, velocity?` | down to the floor |
| `fall · bounce` | the same, `restitution?, keep?, squash?` | then bounces to rest; `squash` flattens it at each landing, area kept |
| `hang · verlet` | `from, to? or length?, links?, path?, seconds?, damping?, jitter?` | a chain pinned at `from`, swinging until it settles |

Every model also takes `floor` and `boxes` (and the flights take `radius`): what the contact critic checks against,
and what a chain collides with. `PHYSICS_MODELS` lists them for the registry.

```js
import { PHYSICS_MODELS } from 'footprint-story/human';

const ball = PHYSICS_MODELS.find((m) => m.family === 'throw' && m.name === 'ballistic');
const plan = ball.plan({ do: 'throw', from: [100, 600], to: [700, 600] }, { who: 'blocks[2] ("ball")' });
plan.duration;                 // 0.78 s: up 150 px (a 45° throw) and down again, under 1960 px/s²
ball.sample(plan, plan.duration / 2);   // { x: 400, y: 450, angle: 0 }: the top of the flight
```

The usual apex is a quarter of the distance across: for two ends at one height that is a 45° launch, the angle that
reaches furthest for a given speed. A hanging chain's time is how long it swings: it ends once every point has stayed
slower than 4 px/s for half a swing (π√(L/g)), never a guessed number.

```js
const rope = PHYSICS_MODELS.find((m) => m.family === 'hang');
const sign = rope.plan({ from: [400, 100], to: [600, 100], links: 10 }, { who: 'the sign' });
rope.sample(sign, sign.duration);   // { x: 399.4, y: 300.1, angle: ≈π/2, points: [[400, 100], …] }: hanging below its pin after 9.5 s
```

## Wrappers

The animation principles as a plan → a plan, over any plan with a `duration` (a hand-written one too). A wrapped plan is
plain data, the inner plan inside it unchanged: `{wrapper, duration, inner, …its numbers}`.

| wrapper | its numbers | adds |
|---|---|---|
| `anticipate(plan, {share, by})` | a pull back opposite the first direction of travel, released into the move | `share × d` before |
| `followThrough(plan, {share, by})` | carries on past the end and swings back | `share × d` after |
| `hold(plan, {at, seconds})` | stops at the inner's time `at` | `seconds` |
| `overshoot(plan, {by, share, feel})` | arrives `by` px past the end, settles back on the spring `feel` | `settleTime(feel)` |

`by` left out is 8% of the move's straight distance. Every wrapper keeps the inner's start and end exactly. Read a
wrapped plan with `sampleWrapped(plan, t, model.sample)`.

```js
import { overshoot, anticipate, sampleWrapped } from 'footprint-story/human';

const lively = overshoot(anticipate(plan, { share: 0.2 }), { by: 12 });
sampleWrapped(lively, 0.5, ball.sample);   // the throw with a wind-up first, landing 12 px past and settling back
```

## Critics

`{name, limit, measure(track), finding(value, who)}`. `finding` gives `{level, message, fix}`, or null when the value is
within the limit. The fix names the intent's keys.

| critic | measures | says |
|---|---|---|
| `spacing` | how much the speed varies (under 5%: even spacing) | it reads as linear, not falling: `do: 'fall'` or `'throw'` |
| `volume` | the largest area change `sx · sy − 1` (over 10%) | it reads as rubber: keep `sy = 1 / sx` |
| `contact` | how deep a body goes into the floor or a box (over 0.5 px) | it passes through: give `floor`, `boxes`, or raise `apex` |

```js
import { contact, trackOf } from 'footprint-story/human';

const blocked = ball.plan({ from: [0, 500], to: [600, 500], boxes: [{ x: 250, y: 300, w: 100, h: 100 }] }, { who: 'blocks[2] ("ball")' });
contact.finding(contact.measure(trackOf(blocked, ball.sample)), blocked.who);
// { level: 'error', message: 'blocks[2] ("ball"): it goes 43.9 px into the floor or a box — …', fix: 'give what it meets in the intent (floor: <y>, boxes: [...]) …' }
```

## The laws it keeps

- A fixed step, never a clock: 1/240 s, frames kept at 60 a second. The same input gives the same frames anywhere.
- Restitution is at most 1, so a bounce never gains energy (tested bounce by bounce).
- A chain keeps every link within 5% of its length with nothing in the way (a relaxation pass per link: 16 passes let
  a 64-link chain stretch 13%); its pin never moves off its place; links are at least 4 px.
- After every step no free point is inside a box or below the floor. Boxes may touch but not overlap, and stand on or
  above the floor: then one push suffices.
- Plans, samples, tracks and findings are frozen plain data; a getter in an intent is never run; every refusal starts
  `human:` and names the entry and the fix.

## Sources

- Thomas Jakobsen, "Advanced Character Physics", Game Developers Conference 2001: position Verlet, constraints by
  relaxation, collisions by projection (`step.js`, `chain.js`, `collide.js`).
- Projectile motion and the coefficient of restitution as any first-year mechanics text gives them, e.g. Halliday,
  Resnick & Walker, *Fundamentals of Physics*, chapters 4 and 9 (`flight.js`, `bounce.js`); the 45° launch reaches
  furthest for a given speed (the range R = v² sin 2θ / g).
- The pendulum's period T = 2π√(L/g) (the same texts, chapter 15), for when a chain has settled (`chain.js`).
- Anticipation, follow-through, holds and overshoot: Frank Thomas & Ollie Johnston, *The Illusion of Life* (1981),
  the principles of animation (`wrap.js`). Squash that keeps volume is theirs too (`models.js` · bounce, `critics.js` · volume).
- Seeded numbers: FNV-1a (Fowler, Noll, Vo) and mulberry32 (Tommy Ettinger), as the isometric styles seed (`read.js`).
