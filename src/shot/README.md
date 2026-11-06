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
| `sight.js` | how much of a subject is in frame and how much is covered, sampled by rays |
| `check.js` | `checkShot`: the fault table and the report |
| `line.js` | `shotLine`: the report as one line of text |

**What the check does not know.** It knows the things it is given: not a bond, a caption, a panel, a flat layer laid over the
picture, or how see-through a thing is (every thing with a size is solid). Shares are sampled, good to a few percent.
**Not here yet:** the fly between shots, a caption's safe area, degrees in `from`. **Numbers:** the sizes, the lenses and "too small" are starting choices, not measurements.
