# human/physics — light physics and secondary motion

**Why:** a ball thrown on a slide, a sign swinging on its rope, a box dropped onto a floor. Tuned by hand, each takes
many tries and comes out different every time. Here the author writes the intent (`{do: 'throw', from, to}`) and the
physics decides the rest: how long it takes, how it is spaced, where it lands, how long it swings. The same intent gives
the same plan in a deck and in a film. Nothing here draws (design: `docs/design/2026-11-human-motion.md`, Round 1 · B).

This folder holds the maths, as `laws/` does for a reach and a pen; the models that plan from it are in `../models/`
(`ballistic.js`, `bounce.js`, `verlet.js`, `spring.js`), the wrappers in `../models/wrap.js`, the critics in `../critics/`
(`spacing.js`, `volume.js`, `contact.js`, `stretch.js`). All of it is on the door `footprint-story/human`.

| file | holds |
|---|---|
| `step.js` | the fixed step (`PHYSICS_STEP`, 1/240 s; frames kept every `STEPS_PER_FRAME` = 4 steps, 60 a second), position Verlet (`verletStep`), the simulation loop (`simulate`), `GRAVITY` |
| `flight.js` | ballistic flight in closed form: a launch to a target with an apex or a time (`launch`), where it is (`flightAt`, `headingAt`), a fall's time (`fallSeconds`) |
| `bounce.js` | a bounce on a floor with restitution, in closed form, resting on the floor exactly (`bounces`, `bounceAt`) |
| `chain.js` | ropes and chains: Verlet points, links held to their length, a pinned end that may move (`runChain`, `relaxChain`, `pinAt`) |
| `collide.js` | a floor line and axis-aligned boxes: reading them (`readWorld`, `makeWorld`), pushing a point out (`pushOut`, `collide`), how deep a body is (`depthIn`) |
| `settle.js` | settling back on the package's own spring (`src/motion/spring.js`), exactly at rest at the end (`settleLeft`, `settleSeconds`) |

## The models

| do | model | gives |
|---|---|---|
| `throw` | `ballistic` (the usual) | through the air, ending on `to`; `angle` is the heading |
| `throw` | `bounce` | lands on the floor at `to`, then bounces to rest |
| `fall` | `ballistic` (the usual) | down to the floor |
| `fall` | `bounce` | then bounces to rest; `squash` flattens it at each landing, its area kept |
| `hang` | `verlet` (the usual) | a chain pinned at `from`, swinging until it settles; the pin may move along a `path` |
| `settle` | `spring` (the usual) | to rest on the motion spring, its seconds the feel's |

```js
import { planMove, sampleMove } from 'footprint-story/human';

const ball = planMove({ do: 'throw', who: 'blocks[2] ("ball")', from: [100, 600], to: [700, 600] });
ball.plan.seconds;                          // 0.78: up 150 px (a 45° throw) and down again, under 1960 px/s²
sampleMove(ball, ball.plan.seconds / 2);    // { x: 400, y: 450, angle: 0 }: the top of the flight
ball.plan.basis;                            // { across: 600, apex: 150, apexDefaulted: true, angle: 45, speed: 1084.4, gravity: 1960, seconds: 0.78, secondsGiven: false }

const sign = planMove({ do: 'hang', name: 'sign', from: [400, 100], to: [600, 100], model: { name: 'verlet', links: 10 } });
sampleMove(sign, sign.plan.seconds);        // { x: 399.4, y: 300.1, angle: ≈π/2, points: [[400, 100], …] }: hanging below its pin after 9.5 s
```

The usual apex is a quarter of the distance across: for two ends at one height that is a 45° launch, the angle that
reaches furthest for a given speed. A hanging chain's time is how long it swings: it ends once every point has stayed
slower than 4 px/s for half a swing (π√(L/g)), at most 10 s. A chain's `jitter` is seeded by planMove from the entry
(its name and its shape, never `who`), so the same entry wobbles the same way.

## Wrappers

`anticipate(move, {share, by})`, `followThrough(move, {share, by})`, `hold(move, {at, seconds})` and
`overshoot(move, {by, share, feel})` take any move and give a move: its plan wrapped (`{wrapper, seconds, inner, pushes,
why, basis, …its numbers}`), its reason carrying the wrapper's words, `wrappers` naming each. They add
`share × seconds`, `share × seconds`, `seconds` and `settleSeconds(feel)`; each keeps the move's start and end exactly.
`by` left out is 8% of the move's straight distance. `sampleMove` reads a wrapped move like any other.

```js
import { anticipate, overshoot } from 'footprint-story/human';

const lively = overshoot(anticipate(ball, { share: 0.2 }), { by: 12 });
sampleMove(lively, 0.5);   // the throw with a wind-up first, landing 12 px past and settling back
```

## Critics

`spacing` (vertical acceleration under half the plan's gravity: it reads as slid, not falling — measured on the vertical
second difference, so a fast sideways throw that falls as it should is never taken for a slide), `volume` (over 10%
change of area: rubber), `contact` (over 0.5 px into the floor or a box: it passes through; the fix in the family's own
keys), `stretch` (a drawn chain's link over 5% past its length: elastic). `checkMove(move)` runs the ones the model names.

## The laws it keeps

- A fixed step, never a clock: 1/240 s, frames kept at 60 a second. The same input gives the same frames anywhere.
- Restitution is at most 1, so a bounce never gains energy (tested bounce by bounce, and the restitution law itself).
- A chain keeps every link within 5% of its length with nothing in the way, over the accepted ranges (up to 64 links,
  gravity up to 1e5 px/s², jitter up to 100 px): a relaxation pass per link (16 passes let a 64-link chain stretch 13%),
  a step cut into sub-steps so gravity moves a point at most 0.005 of a link in each (without them, 3e4 px/s² left a
  link 12% long), and the jittered layout relaxed before its first frame. `basis.stretch` says the worst; its pin never
  moves off its place, nor along its path into the floor or a box; links are at least 4 px.
- A chain left to settle uses damping 0.9 (90% of its speed lost a second): at 0.7, 23 of 40 random hangs were still
  swinging at 10 s; at 0.9, all 40 settled, the longest in 8.2 s.
- A bounce that the most bounces (24) or the longest plan (30 s) cuts short says so (`basis.stoppedBy`), never "at rest".
- Each wrapper adds the speed bells it makes to `pushes` (anticipate 2, follow-through 2, overshoot 1, a hold inside
  the move 1, none when `by` is 0); a wrapped move is at most 3600 s.
- After every step no free point is inside a box or below the floor. Boxes may touch but not overlap, and stand on or
  above the floor: then one push suffices.
- A wrapper reads a direction only from at least a hundredth of a pixel of travel (`MIN_TRAVEL`): a settled chain's
  millionth-of-a-pixel drift is noise, not a direction.

## Sources

- Thomas Jakobsen, "Advanced Character Physics", Game Developers Conference 2001: position Verlet, constraints by
  relaxation, collisions by projection (`step.js`, `chain.js`, `collide.js`).
- Projectile motion and the coefficient of restitution as any first-year mechanics text gives them, e.g. Halliday,
  Resnick & Walker, *Fundamentals of Physics*, chapters 4 and 9 (`flight.js`, `bounce.js`); the 45° launch reaches
  furthest for a given speed (the range R = v² sin 2θ / g).
- The pendulum's period T = 2π√(L/g) (the same texts, chapter 15), for when a chain has settled (`chain.js`); a damped
  spring's overshoot e^(−πζ/√(1 − ζ²)) (`../models/spring.js`).
- Anticipation, follow-through, holds, overshoot and squash that keeps volume: Frank Thomas & Ollie Johnston, *The
  Illusion of Life* (1981), the principles of animation (`../models/wrap.js`, `../critics/`).
