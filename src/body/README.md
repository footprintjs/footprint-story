# body/ — a body as data: parts, poses, limits and two-bone IK

**Why:** `footprint-story/human` moves a point well, but a person is many points held together, and keying every joint
by hand comes out stiff, sliding or off balance, differently each try. So a body is data here — a rig (a tree of parts)
and a pose (the root's place and turn, and each part's angle) — and the maths that turns a target into joint angles is
here once, pure and closed form, for both tools and for the body moves the human door will plan from intents (round 1C
of `docs/design/2026-11-bodies.md`). Nothing here draws and nothing here reads an intent. The folder has its own door,
`footprint-story/body`; it may reach only the shared leaves (`src/geom/`, `src/timing/`, `src/seed/`) and never
`src/human/` — the human door will import this folder, never the reverse (test/doors.test.js).

| file | holds |
|---|---|
| `rig.js` | `readRig` (the rig checked and frozen, every refusal in words), `humanRig` (the usual person from a height) |
| `pose.js` | `restPose`, `placeParts` (forward kinematics), `centreOf` (the centre of mass) |
| `limits.js` | `windowAngle` (the window rule), `clampPose` (the one clamp), `mirrorPose` (the facing mirror) |
| `twoBone.js` | `twoBone`: an arm or a leg reaching a target, Kahan's triangle angles, the bend rule |
| `read.js` | reading what a caller hands in: stored fields only (a getter is never run), the name rule, bounded lists |
| `REFERENCES.md` | the sources, and what was taken from each |

## A person, standing, reaching

```js
import { humanRig, restPose, placeParts, centreOf, twoBone } from 'footprint-story/body';

const ana = humanRig({ name: 'ana', height: 350 });        // 17 parts; chains arm-n, arm-f, leg-n, leg-f (two-bone), spine (fabrik)
const pose = restPose(ana, { root: [400, 500] });          // the pelvis at [400, 500], arms down, legs straight, feet flat
placeParts(ana, pose)[13];                                 // { name: 'foot-n', start: [400, 671.85], end: [453.2, 671.85], angle: 0 }
centreOf(ana, placeParts(ana, pose));                      // [401.0, 490.5]: 0.557 of the height above the floor

const reach = twoBone(ana, pose, 'arm-n', [470, 420]);
reach.miss;                                                // 0: the wrist is on the target
reach.clamped;                                             // []: no joint had to be held at its limit
twoBone(ana, pose, 'arm-n', [600, 300]);                   // { miss: 107.05…, stretched: true, … }: past reach, said so
```

## Angles, limits and the mirror

Radians on the frame, y down, so a positive turn is clockwise on screen; 0 points along +x. A part's angle in a pose is
relative to its parent; `turn` is the root's world angle (so the root's own entry is 0). World angles are sums and are
never wrapped: a part that turns past ±π goes on turning, and a tool easing between samples never spins the long way.

A `limit: [min, max]` (within ±2π, narrower than a turn) is a window: an angle is read as itself plus the whole turns
that bring it nearest the window's middle, then clamped into it. WHY a window and not (−π, π]: a shoulder swings more
than half a turn. `clampPose` is the one clamp every solver ends in; it says which parts it clamped, by how much, and how
far each chain's point moved for it.

```js
import { windowAngle, clampPose, mirrorPose } from 'footprint-story/body';

windowAngle(-3, [0.5, 4.4]);        // 3.283…: the same direction, read in the shoulder's window
windowAngle(3.1, [0.5, 4.4]);       // 3.1, bit for bit: inside already
clampPose(ana, elbowBentBackwards); // { pose, clamped: [{ part: 'forearm-n', by: -0.5 }], moved: [{ chain: 'arm-n', by: 25.3 }] }
mirrorPose(ana, pose);              // the turn θ → π − θ, every angle → −angle: the same body facing the other way
```

A rig is written facing +x. `facing: -1` mirrors it about the vertical through the root: every world angle θ becomes
π − θ, so every relative angle and both ends of every limit change sign (and swap). `humanRig({..., facing: -1})` and
`restPose` give the mirrored body; a pose is always in the frame the body faces, and the mirror twice gives it back.

## Two-bone IK

`twoBone(rig, pose, chain, target)` solves the chain's two angles in closed form; every other angle stays as handed in.
The law of cosines on the triangle of the two parts (l1, l2) and the reach d, with d held in [|l1 − l2|, l1 + l2]; each
angle by Kahan's needle-triangle form, 2·atan(√(…)) on sorted sides, never acos — acos loses its digits near 0 and π,
which is full reach, where a leg most often is. The elbow's bend (π minus its inner angle) is taken as one angle, so a
limb almost straight keeps every digit of how far it bends (pinned against an exact-rational oracle).

- **The bend rule.** In the plane there are two answers, mirror images; the chain's `bend` picks one (knees `front`,
  elbows `back`, read as the rig is written). The answer never flips between frames.
- **What it guarantees:** a target in reach is met within `REACH_TOLERANCE` × (l1 + l2) = 1e-9 of the reach; lengths
  exact (a placed part is its length); no iteration.
- **What it reports:** `miss` (px, after the clamp), `stretched` (past reach: the chain points straight at the target),
  `folded` (inside |l1 − l2|: it folds as far as it goes), `clamped` and `moved` (from `clampPose`).
- **Pure.** The answer depends only on the pose handed in — a move's start pose, which its plan holds — never on the
  last answer, so a move sampled at any rate gives the same pose at the same time.
- **Degenerate targets are rules, never a division by zero:** a target within 0.5e-9 × (l1 + l2) of the chain's root
  has no direction, so the first part keeps its angle from the pose handed in; one within that of full reach is
  straight. (Half the guarantee, so a target on the edge of either rule is still met within it.) A joint with no limit
  takes the reading of its new angle nearest its angle in the pose handed in.

## The rig, as data

```js
{ name: 'arm', plane: 'side', facing: 1, footHeight: 0,
  parts: [                                              // parents before children: a cycle cannot be written
    { name: 'base',  parent: null,   length: 0,  mass: 1 },
    { name: 'upper', parent: 'base', length: 60, mass: 1, rest: 0.4, limit: [-1, 2.5], width: 12, layer: 'near' },
    { name: 'lower', parent: 'upper', length: 50, mass: 1 },          // no limit: a free joint
  ],
  chains: [{ name: 'reach', parts: ['upper', 'lower'], solver: 'two-bone', bend: 'back' }],
  feet: [], loose: [] }
```

Each part owns the joint at its start, so there is no joint list. `length` and `width` in px (the root may be 0, every
other part above 0, at most 10,000). `mass` is a share; the rig scales them to sum to 1. `rest` lies inside `limit`
(0 when left out); the root has neither. A two-bone chain is exactly two parts, a FABRIK chain 2 to 16 (its solver is
round 1B), each the child of the one before, and neither starts at the root (the root's turn moves the whole body).
Every refusal is an `Error` starting `body:` that names the rig, the part and the fix; at most 64 parts; a getter is
never run; names follow the human door's rule (lower case, `upper-arm-n`). Every answer is frozen plain data.

`humanRig({name, height, build?, facing?})`: lengths as shares of height (Drillis & Contini, as Winter tabulates them:
upper arm 0.186, forearm 0.146, hand 0.108, thigh 0.245, shin 0.246, foot 0.152, the ankle 0.039 up, the hip 0.530, the
shoulder 0.818, the chin 0.870) and mass shares (Dempster, via Winter). The joint windows and the widths are ours,
written beside each part; `build` (0.5 to 2) scales the widths only.
