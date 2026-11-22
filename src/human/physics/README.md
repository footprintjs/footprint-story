# human/physics — light physics and secondary motion

**Why:** a ball thrown on a slide, a sign swinging on its rope, a box dropped onto a floor. Tuned by hand, each takes
many tries and comes out different every time. Here the author writes the intent (`{do: 'throw', from, to}`) and the
physics decides the rest: how long it takes, how it is spaced, where it lands, how long it swings. The same intent gives
the same plan in a deck and in a film. Nothing here draws (design: `docs/design/2026-11-human-motion.md`, Round 1 · B).

This folder holds the maths, as `laws/` does for a reach and a pen; the models that plan from it are in `../models/`
(`ballistic.js`, `bounce.js`, `verlet.js`, `spring.js`, `roll.js`, `slide.js`, `tumble.js` and `ground.js`, what a roll
and a slide share), the wrappers in `../models/wrap.js`, the critics in `../critics/` (`spacing.js`, `volume.js`,
`contact.js`, `stretch.js`, `rollSlip.js`, `spin.js`). All of it is on the door `footprint-story/human`.

| file | holds |
|---|---|
| `step.js` | the fixed step (`PHYSICS_STEP`, 1/240 s; frames kept every `STEPS_PER_FRAME` = 4 steps, 60 a second), position Verlet (`verletStep`), the simulation loop (`simulate`), `GRAVITY` |
| `flight.js` | ballistic flight in closed form: a launch to a target with an apex or a time (`launch`), where it is (`flightAt`, `headingAt`), a fall's time (`fallSeconds`) |
| `bounce.js` | a bounce on a floor with restitution, in closed form, resting on the floor exactly (`bounces`, `bounceAt`) |
| `chain.js` | ropes and chains: Verlet points, links held to their length, a pinned end that may move (`runChain`, `relaxChain`, `pinAt`) |
| `collide.js` | a floor line and axis-aligned boxes: reading them (`readWorld`, `makeWorld`), pushing a point out (`pushOut`, `collide`), how deep a body is (`depthIn`), how far a body goes along a line before it touches a box (`touchAlong`, the slab test) |
| `settle.js` | settling back on the package's own spring (`src/motion/spring.js`), exactly at rest at the end (`settleLeft`, `settleSeconds`) |
| `glide.js` | a thing moving along a straight line on a floor, in closed form: pieces of constant acceleration, a stop at its exact distance (`glide`, `glideAt`, `restSpeed`) — what a roll and a slide both run on |
| `rolling.js` | rolling without slipping: the turn is distance / radius (`rollTurn`), a slope's push and rolling resistance shared with the turn (`rollingPush`), the speed it rolls on with after a spinning landing (`landRoll`), the shapes (`ROLL_SHAPES`) |
| `friction.js` | Coulomb friction: kinetic slowing and a static hold (`slidingPush`), a level slide's distance v² / (2 μ g) (`slideDistance`) |
| `spin.js` | a spin kept in flight (`spinAt`), and the spin nearest a given one that lands a thing on a face (`faceSpin`) |

## The models

| do | model | gives |
|---|---|---|
| `throw` | `ballistic` (the usual) | through the air, ending on `to`; `angle` is the heading |
| `throw` | `bounce` | lands on the floor at `to`, then bounces to rest |
| `fall` | `ballistic` (the usual) | down to the floor |
| `fall` | `bounce` | then bounces to rest; `squash` flattens it at each landing, its area kept |
| `hang` | `verlet` (the usual) | a chain pinned at `from`, swinging until it settles; the pin may move along a `path` |
| `settle` | `spring` (the usual) | to rest on the motion spring, its seconds the feel's |
| `roll` | `no-slip` (the usual) | a round thing rolling without slipping, side on or on a floor seen from above; `angle` its turn, distance / radius |
| `slide` | `coulomb` (the usual) | a thing sliding to rest under kinetic friction; its `angle` kept |
| `tumble` | `free-spin` (the usual) | a ballistic flight spinning at one rate, handed over at the landing to a roll or a slide |

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

## Rolling, sliding and tumbling

**Why:** a ball rolled across a slide, a crate pushed along a floor, a die tossed onto a table. Each is easy to get
almost right by hand and hard to get right: a wheel that turns too fast for its size skids, a slide that slows at the
wrong rate floats, a die that spins faster in the air was pushed by nothing. Here the turn, the slowing and the spin
come from the laws, so the author writes only where it goes.

```js
import { planMove, sampleMove, checkMove } from 'footprint-story/human';

const ball = planMove({ do: 'roll', who: 'blocks[3] ("ball")', from: [100, 480], to: [660, 480], radius: 20 });
ball.reason;                  // "… a ball of radius 20 px rolling 560 px on a level floor from 280 px a second (the speed that
                              //  brings it to rest at to under rolling resistance 0.05), to rest at to after 4 s, turning 4.46 turns: distance / radius"
sampleMove(ball, 2);          // { x: 520, y: 480, angle: 21, spin: 7 }: 420 px along, 420 / 20 radians turned
sampleMove(ball, 4);          // { x: 660, y: 480, angle: 28, spin: 0 }: on `to` exactly, at rest

planMove({ do: 'slide', who: 'crate', from: [100, 480], speed: 560 }).plan.basis.distance;   // 400: v² / (2 μ g), μ 0.2
planMove({ do: 'roll', from: [0, 0], to: [394, 69.5], radius: 10, slope: 10 }).reason;
// "… rolling 400.1 px on a floor sloping 10° down the way it starts from rest (the slope starts it), reaching to after 2.14 s, still at 373 px a second, …"
sampleMove(planMove({ do: 'roll', plane: 'floor', from: [0, 0], to: [300, 400], radius: 10 }), 1);
// { x: 137.7, y: 183.7, angle: 22.96, spin: 19.46, heading: 0.927 }: on a floor seen from above, its turn about the line across its heading

const die = planMove({ do: 'tumble', who: 'die', from: [100, 300], to: [500, 500], radius: 20, shape: 'box', boxes: [{ x: 700, y: 400, w: 50, h: 120 }] });
die.plan.basis.landingRule;   // 'a box slides on'; its landAngle is 13 quarter turns: it lands on a face
die.reason;                   // "… spinning at 23.4 rad/s (the usual: the spin nearest v / r that lands it on a face), 3.25 turns in the air with
                              //  no torque on it; it lands at 0.87 s and slides on at 458 px a second, its spin stopped by the floor (a box slides
                              //  on), then goes 180 px until its boxes[0] stops it dead, 1.37 s in all"
```

- **A roll** (`no-slip`) turns by distance / radius, so `angle` is the ground covered over the radius, unwrapped (it
  never jumps back at ±π); side on, + is clockwise on the frame (y down), so a roll to the right turns +. Down a slope
  the push is g sin θ / (1 + k) and rolling resistance slows it by C_rr g cos θ / (1 + k), k = I / (m r²) of its
  `shape` (a ball 2/5, a disc 1/2, a ring 1): a ball gets 5/7 of what a sliding block would. On a level floor it stops
  after v²(1 + k) / (2 C_rr g).
- **A slide** (`coulomb`) is slowed by μ_k g cos θ whatever its speed and, once stopped, held while the slope's push is
  within μ_s g cos θ (static is never under kinetic). On a level floor it stops after v² / (2 μ_k g).
- **Both** run along a straight line on the glide law (`glide.js`): `to` with no `speed` picks the start speed that
  brings it to rest exactly there (√(2·a·d)), or starts it from rest when the slope runs it down; a climb that stops
  rolls or slides back when the slope beats its hold (`basis.rolledBack`, `slidBack`); a box in the way stops it dead
  at the box's side (no bounce: that is the bounce model's work), `basis.box` naming it. Side on (`plane: 'side'`, the
  usual) the floor is the line through `from` at `slope` degrees and `speed`'s sign is the way; on a floor seen from
  above (`plane: 'floor'`, the isometric door's own floor in px — the tool projects), it is level and goes toward `to`
  or along `heading`. What never stops within 30 s, stops short of `to`, or is not moved at all is refused in words;
the 30 s refusal names the resistance or friction that does stop it (above tan θ on a slope, at least (1 + k)·v / (g ·
30 s) on the level for a roll, v / (g · 30 s) for a slide; `stoppingCoefficient`), and following it plans.
- **A tumble** (`free-spin`) flies the ballistic arc to `to` (the floor `radius` below it), its spin kept: nothing
  touches it, so no torque. **The hand-over rule** is data, `LANDING_RULES` (first match, decide()'s shape): the
  `then` the intent names, else a round shape rolls on and a box slides on. At the landing its fall stops and its
  speed across goes on — a roll keeps its turning about the contact point, v′ = (v + k r ω) / (1 + k) (a ball landing
  with no spin rolls on at 5/7 of its speed; the usual spin, v / r, lands it already rolling), a slide keeps v and the
  floor stops its spin (the usual spin is the nearest to v / r that lands it on a face; a spin the intent gives is kept, so
it may land at a slant, which `basis.slant` and the reason say). The skid that takes a landing
  ball to rolling is not drawn: it is over at the landing (ours). Samples say `air: 1` in flight and `rolls: 1` while it
  rolls, so the critics read each part apart.

## Wrappers

`anticipate(move, {share, by})`, `followThrough(move, {share, by})`, `hold(move, {at, seconds})` and
`overshoot(move, {by, share, feel})` take any move and give a move: its plan wrapped (`{wrapper, seconds, inner, pushes,
why, basis, …its numbers}`), its reason carrying the wrapper's words, `wrappers` naming each. They add
`share × seconds`, `share × seconds`, `seconds` and `settleSeconds(feel)`; each keeps the move's start and end exactly.
`by` left out is 8% of the move's straight distance. `sampleMove` reads a wrapped move like any other. A plan that names
`turnVector` [Tx, Ty] (a roll's) is turned as it is moved: its angle gains T · the offset, so a wrapped roll still rolls.

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

A roll, a slide and a tumble are checked by `roll-slip` (the drawn angle's change against distance / radius, step by
step, over the steps that roll: Σ|drawn − owed| / Σ|owed| over 5% finds a wheel skidding, sliding without turning or
turning the wrong way; the basis's `rate` says which, and the fix names the radius, or the radius it is drawn at) and
`spin` (a drawn angle that jumps between two samples, one step standing over 10% off both neighbours the same way; and in
flight, a spin that changes by over 10%, where nothing can change it), with `contact` and, for a tumble's flight,
`spacing`. A drawn angle wrapped into (−π, π] is no fault for either (`src/geom/angles.js` · `wrapAngle`). A fast spin,
over half a turn between samples, is read as it turns: `roll-slip` takes the drawn turn nearest the one the drawn
distance owes, and `spin` the one nearest its samples' own `spin` × the step. A hand-drawn track with no `spin` is read
the short way (`shortestTurn`), and `spin`'s basis says the fastest spin that can tell (`mostReadable`, half a turn a
sample: π × the rate); `checkMove(move, {rate})` samples more densely to read faster. A flick is a step off both its
neighbours the same way — a flick of any length, a kept jump and a stutter all make one — measured against at least a
turn a second (`SPIN_FLOOR`). The one peak that is not a flick, a spin sped up and then stopped dead, is let off only
when it lies on the trend of three smooth steps beyond it on one side, so a flick's own steps never vouch for it. With
that floor a slow spin may drift a little in flight unflagged: 3 → 3.5 rad/s is 8% of a turn a second.

A wrapped roll stays a roll: the `no-slip` plan names `turnVector` (its turn per px of travel), and every wrapper turns
it by that over the way it moves it, its spin by that over the offset's speed. So `overshoot(roll)` still turns
distance / radius and `roll-slip` passes it. A tumble that lands into a roll names one too, from its landing
(`turnFrom`): its rolling samples turn with the wrapper, its flight and a slide keep their own angle. While a wrapper
holds a model still (a wind-up, after the end, a hold) its own spin stops and a sample in flight is marked `air: 0`.
A wrapper respects its plan's world: each offset is cut back along itself to where the body (its middle, `radius`
wide) first touches the floor or a box the model's plan names — cut, never turned aside, so a wind-up still pulls
against the move it winds up for. So the default anticipation over a tumble, whose release runs through its landing,
stops at the floor, and a roll between boxes winds up and overshoots only to their sides. A body already in
something keeps its offset (the contact critic says so).

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
- A roll's turn is distance / radius at every sample, to rounding (a property over generated rolls), and a roll, a
  slide or a tumble ends on `to` exactly: a stop is written at its distance, never summed up to it.
- Every piece of a glide is constant acceleration, so v² = v₀² + 2a·d holds piece by piece; a start speed picked for
  `to` lands within rounding of its stop, and that stop is taken as the end (speed exactly 0).
- No roll goes into a box it was given (the slab test finds the first touch exactly, a property checks every sample).

## Sources

- Thomas Jakobsen, "Advanced Character Physics", Game Developers Conference 2001: position Verlet, constraints by
  relaxation, collisions by projection (`step.js`, `chain.js`, `collide.js`).
- Projectile motion and the coefficient of restitution as any first-year mechanics text gives them, e.g. Halliday,
  Resnick & Walker, *Fundamentals of Physics*, chapters 4 and 9 (`flight.js`, `bounce.js`); the 45° launch reaches
  furthest for a given speed (the range R = v² sin 2θ / g).
- The pendulum's period T = 2π√(L/g) (the same texts, chapter 15), for when a chain has settled (`chain.js`); a damped
  spring's overshoot e^(−πζ/√(1 − ζ²)) (`../models/spring.js`).
- Rolling without slipping, a = g sin θ / (1 + I/mr²) down a ramp, the rotational inertias (2/5, 1/2, 1) and angular
  momentum kept about the contact point through a landing: Halliday, Resnick & Walker, chapters 10 and 11
  (`rolling.js`, `spin.js`). Rolling resistance as the normal force a little ahead of the contact: Hibbeler,
  *Engineering Mechanics: Statics*; a tyre's C_rr of 0.01 to 0.015: Gillespie, *Fundamentals of Vehicle Dynamics* (1992).
  The usual 0.05 is ours, larger than life so a roll stops within a frame.
- Coulomb friction and wood on wood's coefficients (kinetic 0.2, static 0.25 to 0.5): Serway & Jewett, *Physics for
  Scientists and Engineers*, chapter 5 (`friction.js`).
- The slab test for a line's first touch of a box: Kay & Kajiya, "Ray Tracing Complex Scenes", SIGGRAPH 1986
  (`collide.js` · `touchAlong`).
- Anticipation, follow-through, holds, overshoot and squash that keeps volume: Frank Thomas & Ollie Johnston, *The
  Illusion of Life* (1981), the principles of animation (`../models/wrap.js`, `../critics/`).
