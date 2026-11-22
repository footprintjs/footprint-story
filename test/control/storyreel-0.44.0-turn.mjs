// footprint-storyreel src/kits/isometric/turn.mjs at 6c8eeb4 (0.44.0), lines 32–54 (UNTURNED, dot, cross, unit, apply, turnAxis, turning), 69–83 (towardViewer, centreOf, onFrame), 121–141 (ROUND, ballPicture) and 159–172 (ballPaint); and draw.mjs lines 34 (ISO_LOOK).
/** The turn that leaves a body as it was built. */
export const UNTURNED = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const n = Math.hypot(...a); return a.map((v) => v / n); };
/** A 3×3 matrix (nine numbers, row by row) applied to a vector. */
export const apply = (m, [x, y, z]) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];

/**
 * The line a body rolling along `heading` ([dc, dr], a unit on the floor) turns about: up × heading, so a turn by a
 * positive angle carries its top forward along the way — footprint-story's sign (a roll to +x turns +, clockwise side on).
 */
export const turnAxis = ([dc, dr]) => [-dr, dc, 0];

/** The turn by `angle` (radians) about `axis` (a unit, in tiles), as a matrix: Rodrigues' formula. */
export function turning([ax, ay, az], angle) {
  const c = Math.cos(angle), s = Math.sin(angle), k = 1 - c;
  return [c + ax * ax * k, ax * ay * k - az * s, ax * az * k + ay * s,
    ay * ax * k + az * s, c + ay * ay * k, ay * az * k - ax * s,
    az * ax * k - ay * s, az * ay * k + ax * s, c + az * az * k];
}


/**
 * The way to the viewer in tiles, a unit: the direction the grid draws as a point (the null of its projection), the
 * one with height (the viewer looks down). A face whose outward normal leans toward it is seen. Read from the grid's
 * own numbers only, so a grid written with another rise or tile still says what it shows.
 */
export function towardViewer(grid) {
  const o = grid.at(0, 0, 0), [a, b, c] = [grid.at(1, 0, 0), grid.at(0, 1, 0), grid.at(0, 0, 1)].map((p) => [p.x - o.x, p.y - o.y]);
  const n = cross([a[0], b[0], c[0]], [a[1], b[1], c[1]]);
  return unit(n[2] < 0 ? n.map((v) => -v) : n);
}

/** A block's middle in tiles, standing at its corner `at` (its built `at` when left out). */
export const centreOf = (b, at = b.at) => [at[0] + b.size[0] / 2, at[1] + b.size[1] / 2, (at[2] ?? 0) + b.size[2] / 2];

const onFrame = (grid, [c, r, z]) => { const p = grid.at(c, r, z); return [p.x, p.y]; };

/** How many points a ball's outline and each mark are drawn with: far finer than a pixel at any size a frame shows. */
const ROUND = 72;

/**
 * A ball of `radius` (tiles) with its middle at `centre`, turned by `m`: its outline (the great circle across the way to
 * the viewer, put on the frame: a circle on the usual grid), its middle on the frame, and its two marks — the great
 * circles that lie, as built, level and upright along the rows — each the arc of its half that faces the viewer.
 */
export function ballPicture(grid, centre, radius, m) {
  const view = towardViewer(grid);
  const across = Math.abs(view[2]) < 1 - 1e-9 ? unit(cross(view, [0, 0, 1])) : [1, 0, 0], up = cross(view, across);
  const at = (a, b, t) => [0, 1, 2].map((k) => centre[k] + radius * (Math.cos(t) * a[k] + Math.sin(t) * b[k]));
  const outline = Array.from({length: ROUND}, (_, n) => onFrame(grid, at(across, up, (2 * Math.PI * n) / ROUND)));
  // a great circle's seen half is one arc: the half round the point that leans most toward the viewer (edge on, a line)
  const marks = [[[1, 0, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, 1]]].map(([u, v]) => {
    const a = apply(m, u), b = apply(m, v), facing = Math.atan2(dot(b, view), dot(a, view));
    return Array.from({length: ROUND / 2 + 1}, (_, n) => onFrame(grid, at(a, b, facing - Math.PI / 2 + (Math.PI * n) / (ROUND / 2))));
  });
  return {outline, centre: onFrame(grid, centre), marks};
}


/**
 * A ball's paint list: its outline filled as a top is (20% toward white: its name is ink on it, as on a top), its marks
 * in the ink at `look.mark`, `look.markLine` wide, then its edge in the ink `look.line` wide — every point put where `at`
 * says (the pose's move and squash).
 */
export function ballPaint(picture, at, look) {
  const outline = picture.outline.map(at), path = (line) => [['move', ...line[0]], ...line.slice(1).map((p) => ['line', ...p])];
  return [
    {item: 'polygon', points: outline, fill: {mix: ['#ffffff', 0.2], colour: null}, stroke: null},
    ...picture.marks.map((mark) => ({item: 'path', segments: path(mark.map(at)), fill: null, stroke: {colour: null, alpha: look.mark, width: look.markLine, join: 'round', cap: 'round'}})),
    {item: 'polygon', points: outline, fill: null, stroke: {colour: null, alpha: 1, width: look.line, join: 'round', cap: 'butt'}},
  ];
}


export const ISO_LOOK = Object.freeze({tone: '#d9e4f3', glow: '#e8a33d', line: 2.5, grid: 0.16, cable: 4, label: 1, smallInk: 0.68, appear: 0.35, rope: 2.5, mark: 0.5, markLine: 2});
