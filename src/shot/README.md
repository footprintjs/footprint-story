# shot/ — a camera in 3D, as data and maths

**Why:** a film and a deck should say a shot in the same words, and whoever writes one, usually a model, should learn what the
camera really sees without reading a picture. Everything here is numbers in, numbers out. Each tool keeps its own drawing.

| file | holds |
|---|---|
| `views.js` | the words: eight places round the subject, three heights, sizes, lenses |
| `fields.js` | reading untrusted data: every problem at once, hidden characters stripped from names |
| `scene.js` | a scene: balls, points and cards, at most 256 |
| `readShot.js` | a shot: `on`, `from`, `focus`, `size`, `lens` |
| `camera.js` | a camera's numbers; `frameOf` turns a shot into one |
| `lens.js` | the camera's axes and where a point lands |
| `solid.js` | the box a thing fills, and where a ray meets it |
| `project.js` | `project`, `unproject`, `boxOf` |
| `polygon.js` | convex polygons cut exactly |
| `outline.js` | the polygon a thing fills on the frame |
| `nearer.js` | over the part two things share, how much the other reaches first |
| `sight.js` | how much of a subject is in frame and how much is covered |
| `check.js` | `checkShot`: the fault table and the report |
| `line.js` | `shotLine`: the report as one line of text |
| `moveRead.js` | a camera move's intent read: `{do: 'fly', from, to}` or `{do: 'orbit', around, by}`, an end a shot or a camera |
| `move.js` | `planCameraMove`, `sampleCameraMove`, `cameraTrack`: the rule table (slerp, arc, cut), the path, minimum-jerk timing |
| `moveCritics.js` | the four critics on a sampled path: `in-sight`, `turn-speed`, `line-of-action`, `horizon` |
| `moveCheck.js` | `checkCameraMove`: a planned move or a path made by hand, checked; findings with the fix |

The geometry the moves stand on (angles, quaternions, slerp, squad, spherical places, look-at) is the shared leaf
[`../geom/`](../geom/README.md), handed out by this door; the timing is the minimum-jerk law, the shared leaf
[`../timing/`](../timing/README.md), which the human door hands out.

**What the check does not know.** It knows the things it is given: not a bond, a caption, a panel, a flat layer laid over the
picture, or how see-through a thing is (every thing with a size is solid). The line says how many other things it was tested against,
and `no other things given` when there were none.
**How sure it is:** where things land, boxes and cut-off are exact. Shares are areas cut from outlines (`polygon.js`), so nothing thin
falls between samples; only a ball passing through something is sampled, and a clear result then says so. The measured errors are in the package README.
**Not here yet:** a caption's safe area, degrees in `from`. **Numbers:** the sizes, the lenses and "too small" are starting choices, not measurements.

## Camera moves between shots

**Why:** a film flies its camera from one shot to the next, and whoever writes the film, usually a model, should say only
where to go. Tuning a path until nothing is hidden and nothing swings too fast costs many tries; so a rule table picks the
move, a law sets its timing, and critics say in words what still looks wrong, with the fix in the intent's own keys.

```js
import { planCameraMove, sampleCameraMove, cameraTrack, checkCameraMove } from 'footprint-story/shot';

const move = planCameraMove({ do: 'fly', from: { on: 'db', from: 'front' }, to: { on: 'db', from: 'right' }, who: 'shots[2]' }, scene);
move.kind;      // 'arc'
move.reason;    // "do: 'fly' → arc: the look turns 90°, more than 45° and not past cutPast 150°, so it rises 10° over its middle
                //  to keep the subject in sight, over 4.42 s of minimum jerk, set so its fastest turn (40.4°/s) stays under 45°/s"
sampleCameraMove(move, 2);   // {t, progress, camera, eye, look}: a camera readCamera takes, its eye, its look as a quaternion
cameraTrack(move).samples;   // 60 a second, both ends exactly the cameras handed in
checkCameraMove(move, { scene, frame: [1280, 720] }).findings;   // [] — or what is wrong and the fix
planCameraMove({ do: 'orbit', around: ['db', 'cache'], by: -90, from: 'front-left high' }, scene);
```

An end is a shot (framed on the scene, as `frameOf` does) or a camera's numbers (an object with `target`). The choice is
data (`move.choice`: the rule, the kind, the turn) and `move.basis` holds the numbers it chose by; `reason` is their sentence.

| the look turns | kind | how it moves |
|---|---|---|
| past `cutPast` (150°), a fly only | `cut` | no path: the two views at 0 s — a swing that far turns the whole world round |
| at most 45° | `slerp` | the same height, one speed: a slerp about the vertical |
| more | `arc` | rises `lift` (10°) over its middle, so the subject stays above what stands round it; its middle at most 75° up |

"The look turns" is the angle between the two ends' looks as quaternions (`quatAngle`), decided to a millionth of a degree so
rounding never flips a named view's choice; an orbit's is its `by`, and an orbit never cuts. The target moves in a line, the
azimuth by the shorter way round, the distance and focal length by equal ratios. The timing is minimum jerk; the seconds,
unless given, are the fewest that keep the fastest turn at 90% of the comfort limit (at least 0.5 s).

| critic | measures | finds fault when | the fix it names |
|---|---|---|---|
| `in-sight` | the share of the subject seen (in frame × not covered, by `check.js · reportOf`) at the worst moment, against the worse end | it loses more than a tenth beyond what its shots show | `lift`, then `cutPast` |
| `turn-speed` | the fastest the look turns, °/s | over 45°/s | `seconds` |
| `line-of-action` | crossings of the line between two subjects (`line`, or the subjects when they are two), on the ground | a cut across: `warn`; a move across: `note` (the accepted way across, but they swap sides) | `cutPast: 180`; the other way round (`by`) |
| `horizon` | the most the horizon leans (`horizonRoll`), degrees | over 0.5° | plan it as a fly, whose every look keeps world up |

A path made by hand, `{samples: [{t, camera, look?, cut?}]}`, is checked the same way: a tool that flies its own camera
asks the same questions. **The numbers are ours,** starting choices and not measurements: 45° a small turn, 150° a cut, a
10° rise, 75° the highest, 45°/s the comfort limit (a cinematographer's slow pan is slower; a whip pan far faster), a tenth
of the subject, 0.5° of lean. **What it does not do yet:** a path through more than two shots (squad is here for it), a
dolly that avoids things in the way (the critic finds them; the move does not route round), a roll the author asks for.
