# Styles for isometric maps — one design for a deck and a film

Status: design, 2026-11-21. Step 1 built in footprint-story 0.23.0 (`isoStyle`, `paintPiece`). Steps 2–4 are now planned in `2026-11-map-flow.md`: the painters plug into the map flow. Step 4's first looks, outlined and line art, built in 0.34.0 as named looks (`ISO_LOOKS`: a row under a name, `{look: 'outlined'}`) over two new choices, line `contour` and shading `paper` (src/isometric/README.md).

## The idea

An isometric map can be drawn in many cartoon styles — flat, outlined, line art, sketchy, paper-cut, pastel, pixel,
neon, voxel. The geometry is the same in all of them: where a block stands, its faces, its outline. What changes is a
handful of independent choices. So a **style is a row of named choices**, one per column, written as data:

```js
{ shape: 'box', shading: 'tones', line: 'ink', palette: 'theme', texture: 'none', effects: [] }
```

A new look is a new row, or one new choice in one column. Each choice is a **strategy** behind one interface for its
column; footprint-story ships the common ones, and a tool may add its own under a name.

## The columns, in order

Each column reads only what the one before it gave. The order is fixed, because each step needs the last one's output
(shading needs the faces; a line needs the edges; texture needs the filled faces).

| # | Column | Takes | Gives | First choices | Later |
|---|---|---|---|---|---|
| 1 | `shape` | a thing (`at`, `size`, kind) and the grid | faces (each with a role: `top`, `left`, `right`, `side`, `ground`) and edges | `box` (today's `grid.block` / `grid.cylinder`) | `rounded`, `lowpoly`, `voxel` |
| 2 | `shading` | the faces and a base colour | a fill per face | `tones` (today: top +20% white, left +6% black, right +18% black) | `gradient`, `hatch`, `halftone` |
| 3 | `line` | the edges | strokes | `ink` (today: the ink colour, 2.5 px, round joins), `none` | `thin`, `wobble`, `glow` |
| 4 | `palette` | the fills and strokes | the same, recoloured | `theme` (today: the film's theme / the deck's CSS) | `pastel`, `duotone`, `pixel` (a fixed small set) |
| 5 | `texture` | the filled faces | marks over them | `none` | `grain`, `pencil`, `paper` |
| 6 | `effects` | the whole list | items added under or over it | none | `shadow`, `slab` (a diorama base), `tiltshift` |

What a style covers first: blocks, cylinders and floors. Cables, packets and labels keep today's look until the
first four styles are in; `line` is then the natural column for cables too.

## What a choice gives back: a paint list, as data

No choice draws. Each gives back a **paint list**: plain, cloneable items, in paint order.

```js
{ item: 'polygon', points: [[x, y], …], role: 'left', of: 'server', fill: '#c9d4e3', stroke: { colour: '#14181f', width: 2.5, join: 'round' } }
{ item: 'ellipse', cx, cy, rx, ry, role: 'top', of: 'db', fill: '…' }
{ item: 'path', d: [[x, y], …], role: 'hatch', of: 'server', stroke: { … } }
```

Each item names the piece it belongs to (`of`) and its role. Two small **painters**, one per tool, draw a list:

- StoryReel's canvas painter (`fill`, `stroke`, `ellipse` on a 2D context).
- StoryDeck's SVG painter. For the `theme` palette it keeps writing today's classes (`iso-left`, `iso-right`, `iso-top`)
  from each item's role, so a deck's CSS still colours its blocks and today's pages stay byte for byte.

WHY a list and not pixels: the deck and the film draw the same list, so they look the same; tests compare lists, not
screenshots; and footprint-story stays free of drawing code (numbers in the package, painting in the app).

## The interface of a choice

```js
// footprint-story/isometric (a sketch: names may change in the first pull request)
const ink = {
  column: 'line',
  name: 'ink',
  needs: ['edges'],          // what it reads from the step before
  gives: ['strokes'],        // what it adds
  apply(input, options) { … return output; },   // pure: same input, same output
};
```

- Pure and seeded: anything that looks random (a wobble, grain, low-poly facets) is seeded from the piece's name and
  the style, so a frame is the same however often it is drawn, and a deck and a film agree.
- Bounded: every choice states its limits (the most items it adds per face) and refuses past them.
- Plain data out: a function or a live object in the output is refused, as a record must clone.

## Naming, the record, and a tool's own choices

- Every choice has a name; a style is the names, so the record can say **which choices drew each map** (a deck's run
  chart `maps made · style`, a film world's `map.style`), as the break rules are named today.
- footprint-story's choices are tested in footprint-story. A tool registers its own choice under its own prefix
  (`'reel:chalk'`), with the same interface; the record names it, so "why does this block look so" is still answered
  from the record. A name that is not registered is refused, naming the ones that are.
- A style with no `style` given is today's look: `{shape: 'box', shading: 'tones', line: 'ink', palette: 'theme',
  texture: 'none', effects: []}`.

## Combinations that do not work are refused, before anything is drawn

Each choice says what it needs and what it cannot sit with. Examples:

| Combination | Why | The fix the refusal names |
|---|---|---|
| `palette: 'pixel'` with `shading: 'gradient'` | a small fixed palette has no in-between colours | `shading: 'tones'` or `'halftone'` |
| `line: 'none'` with `shading: 'none'` | nothing would show | a shading, or a line |
| `texture: 'pencil'` with `line: 'glow'` | marks drawn over a glow muddy it | `line: 'ink'` or `'wobble'` |
| `shape: 'voxel'` with a cylinder | a voxel solid has no round top | `shape: 'box'` for that piece, or a block |

The check runs once per style (not per frame), and its words go where a tool's other refusals go.

## Where each part lives

| Part | Place | Why |
|---|---|---|
| columns, interfaces, the paint list, the compatibility check, the built-in choices | footprint-story `/isometric` | the numbers a deck and a film must share |
| the canvas painter, `style` in a recipe | StoryReel | painting is the app's |
| the SVG painter, `data-style` on a map | StoryDeck | painting is the app's |

## Cases to pin before building

| Case | Expected |
|---|---|
| a map with no style | today's frames (StoryReel golden) and today's pages (StoryDeck examples) byte for byte |
| the default style written out in full | the same as no style |
| `line: 'none'` | today's faces, no strokes |
| outlined (`line: 'ink'`, width 5) | the same faces, thicker strokes; nothing moves |
| the same map in a deck and a film | the same paint list, item for item |
| a seeded choice drawn twice, and drawn after another map | the same list |
| an unknown name, a bad combination, a choice that returns a function | refused, naming the choice and the fix |
| the most pieces a map holds (256) with the costliest choice | finishes within the stated bound |

## Build order (one pull request each)

1. footprint-story: the interfaces, the paint list, the check, and today's look as choices (`box`, `tones`, `ink`,
   `none`, `theme`). Pinned: today's geometry gives today's list.
2. StoryReel: the canvas painter draws that list; golden frames unchanged. Then `style` in a world's recipe.
3. StoryDeck: the SVG painter; example pages unchanged. Then `data-style` on a map.
4. New choices, one or two per pull request, each with a still from a real map: outlined, line art, sketchy (`wobble`
   + `hatch`), paper grain, duotone. Shape choices (`rounded`, `lowpoly`, `voxel`) last: every later column reads
   their faces.

## Not in this design

Animation styles (a squash on arrival, a hand-drawn boil frame to frame), cables and labels in a style, and lighting
from a chosen direction. Each is a later column or option, added through the same interface.
