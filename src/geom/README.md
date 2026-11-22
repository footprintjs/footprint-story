# geom/ — angles, turns and places on a sphere, as numbers

**Why:** a camera's move, a joint's bend and a body's twist all need the same few pieces of geometry, and each piece has
a careless form that breaks at the edges: an angle by acos loses its digits near 0 and π, three angles (yaw, pitch, roll)
lock up looking straight down and blend badly, a turn written as a number jumps at ±π, and a slerp goes the long way round
unless told. So the careful forms are here once, a leaf that imports nothing outside itself, handed out by its own door,
`footprint-story/geometry`: camera moves use it (the shot door reaches this folder for them), and so will joint angles and
rolling, which are not camera work. test/doors.test.js names every door that may reach it. Pure: the same
numbers in, the same numbers out. Every public function refuses what is not a finite number, or a list of the right
length, with a TypeError that names it.

| file | holds |
|---|---|
| `vec.js` | vectors as plain lists of 2 or 3 numbers, and the one input check |
| `angles.js` | `angleAt`, `dihedral`, `wrapAngle`, `shortestTurn`, `unwrapAngles` |
| `quat.js` | quaternions `[w, x, y, z]`: `quatFromAxisAngle`, `quatMultiply`, `quatNormalize`, `quatRotate`, `quatAngle`, `quatLook`, `quatForward`, `quatFromAxes` |
| `slerp.js` | `slerp`, `squad` |
| `sphere.js` | `toSpherical`, `fromSpherical`, `greatCircle` |
| `look.js` | `lookAt`, `horizonRoll` |
| `REFERENCES.md` | the papers, and what was taken from each |

## Angles between points

```js
import { angleAt, dihedral } from 'footprint-story/geometry';

angleAt([1, 0], [0, 0], [0, 1]);           // π/2: the angle at the middle point; 2D or 3D
angleAt([1, 1e-10], [0, 0], [1, 0]);       // 1e-10 exactly (acos would say 0 or 1.5e-8)
angleAt([0, 0], [0, 0], [1, 0]);           // null: a point on b has no angle
dihedral([1, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]);   // π/2: d is turned a quarter, right-handed about b→c
dihedral([0, 0, 0], [0, 0, 1], [0, 0, 2], [1, 0, 3]);   // null: three in a line leave no plane
```

`angleAt` is atan2(|u×v|, u·v) on unit vectors: every digit near 0 and π, and no overflow in a huge scene. `dihedral`'s sign
is IUPAC's (positive: seen along b→c, a–b turns clockwise to cover c–d); a mirror flips it and reading the four backwards
keeps it.

## Angles that wrap round

```js
import { wrapAngle, shortestTurn, unwrapAngles } from 'footprint-story/geometry';

wrapAngle(3 * Math.PI);                    // π: always in (−π, π]
shortestTurn(170 * DEG, -170 * DEG);       // +20° (DEG = π/180), not −340°; exactly half a turn is +π
unwrapAngles([3.1, -3.1]);                 // [3.1, 3.18…]: a spin across ±π continues instead of jumping back
```

## Quaternions

```js
import { quatFromAxisAngle, quatMultiply, quatRotate, quatAngle, quatNormalize, quatLook, quatForward, quatFromAxes } from 'footprint-story/geometry';

const yaw = quatFromAxisAngle([0, 1, 0], Math.PI / 2);   // a quarter turn about +y, right hand
quatRotate(yaw, [0, 0, -1]);               // [-1, 0, 0]
quatMultiply(yaw, pitch);                  // pitch, then yaw
quatAngle(q, q.map((c) => -c));            // 0: q and −q are one turn
quatNormalize([2, 0, 0, 0]);               // [1, 0, 0, 0]
quatForward(quatLook([3, -4, 0]));         // [0.6, -0.8, 0]: a camera aimed there, horizon level
quatLook([0, -1, 0]);                      // straight down: no level, so it takes +x's side, the same every time
quatFromAxes(right, up, back);             // the turn whose axes land there (Shepperd's method)
```

A camera's own axes are the graphics ones: it looks along −z, x is the frame's right, y its top. `quatAngle` is the size of
the one turn between two, 0 to π: the honest measure of how much a picture turns, even looking straight down, where two
cameras can look the same way and still differ by a half turn about the view.

## Even turns

```js
import { slerp, squad } from 'footprint-story/geometry';

slerp(a, b, 0.25);                         // a quarter of the angle, at constant speed, the shorter way round
slerp(q, q.map((c) => -c), 0.5);           // q: the same turn written two ways goes nowhere
squad([q0, q1, q2, q3], 1 / 3);            // q1, exactly: squad passes through every key, smooth (C¹) at each
```

`squad` is Shoemake's spherical cubic: each gap is slerp(slerp(qᵢ, qᵢ₊₁, h), slerp(sᵢ, sᵢ₊₁, h), 2h(1 − h)) with inner
controls sᵢ = qᵢ·exp(−(log(qᵢ⁻¹qᵢ₊₁) + log(qᵢ⁻¹qᵢ₋₁)) / 4). Its turning speed matches on both sides of a key, where slerps
joined end to end jerk (a test measures both). Keys written as q and −q are aligned first. No move uses it yet: a camera's
fly through several shots will (two shots need only slerp).

## Places on a sphere

```js
import { toSpherical, fromSpherical, greatCircle } from 'footprint-story/geometry';

toSpherical([1, 1, 0]);                    // {azimuth: π/2, elevation: π/4, distance: √2}
fromSpherical({ azimuth: -Math.PI / 2, elevation: 0, distance: 2 });   // [-2, 0, 0]: left is −x
greatCircle([0, 0, 1], [1, 0, 0], 0.5);    // [0.707, 0, 0.707]: half way round, at one angular speed
greatCircle([0, 0, 1], [0, 0, -1], 0.5);   // [0, 1, 0]: opposite ways have no one circle, so it goes over the top
```

The convention is the shot camera's (`src/shot/lens.js · aim`): azimuth from +z towards +x, elevation up, +y up. So
`fromSpherical` of a camera's angles is the way from its target to its eye.

## A camera's look

```js
import { lookAt, horizonRoll } from 'footprint-story/geometry';

lookAt([0, 2, 10], [0, 2, 0]);             // [1, 0, 0, 0]: aimed at the target, horizon level
horizonRoll(rolled);                       // 0.3: the frame's right side raised 0.3 rad
horizonRoll(lookAt([0, 9, 0], [0, 0, 0])); // null: looking straight down, no horizon is in the picture
```

`horizonRoll` is atan2(right·up, top·up). With yaw, pitch p and roll φ these are sin φ cos p and cos φ cos p, so it reads φ
exactly until cos p is rounding (within about 0.06° of straight up or down, where it says null).

**How sure it is:** every function is tested against a closed form or an independent form of its law (the law of
cosines, Rodrigues' formula, Shoemake's endpoints) and by property on any input (test/geom.test.js,
test/geom.property.test.js). Results agree to a tolerance, not to the bit: sin, cos and sqrt differ in their last digits
across engines, so nothing that must match exactly (a rule's choice) is decided on a raw angle.
