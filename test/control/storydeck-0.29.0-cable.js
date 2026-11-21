// storydeck deck/cable.js at d683b08 (0.29.0): lines 22, 24 and 169–253 (SAMPLE, WALK_MOST, cablePoint … labelPlace). Unchanged.
const SAMPLE = 6;   // px between the points asked: of a cable, whether it is under a label; of a label, whether a block is over it
export const WALK_MOST = 512;
export const cablePoint = (way, t) => way.at(t);

/** A cable's line walked from its start to its end: points SAMPLE px apart at most (further on one longer than WALK_MOST of them). */
export function cableWalk(way) {
  const steps = Math.min(WALK_MOST, Math.max(1, Math.ceil(way.length / SAMPLE)));
  return Array.from({length: steps + 1}, (_, k) => way.at(k / steps));
}

/** Whether a slide point is inside an outline (its points in order round it). */
function inside(outline, [x, y]) {
  let odd = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
}

/**
 * Points, with the box that holds them: {points, left, top, right, bottom}. What may be in the way is asked by its
 * box first, so on a map of hundreds of cables each one looks only at the few things near it.
 */
export function held(points) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of points) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  return {points, left, top, right, bottom};
}
/** Those of `things` (each held) whose box reaches within `far` px of the box round `at`. */
const near = (things, at, half, far = 0) => things.filter((t) => t.right > at[0] - half[0] - far && t.left < at[0] + half[0] + far && t.bottom > at[1] - half[1] - far && t.top < at[1] + half[1] + far);

/** Where a label may stand along its cable: the middle first, then a twentieth further to each side by turns, a fifth to four fifths of the way. */
export const LABEL_PLACES = Object.freeze(Array.from({length: 13}, (_, k) => +(0.5 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.05).toFixed(2)));
const EDGE = 3;     // px a cable's line keeps off a label's box: half the line and a little air
const TIP = 16;     // px round a cable's tip that its label keeps off: the arrow's head
/**
 * The looks one map's labels may spend between them (labelPlace): a look is one point of a label asked against one
 * side of an outline, or one point of another cable asked against a label. WHY a limit: a deck is text someone
 * wrote, and a build runs on every save — a map of thousands of labelled cables, or a label thousands of letters
 * long, must cost no more than this (about a third of a second), where a careful search of it would take minutes.
 * A map of sixty labelled cables spends a twentieth of it; three hundred on a crowded floor, nearly all.
 */
export const LABEL_LOOKS = 60_000_000;

/**
 * Where a cable's label stands: on the cable itself, as near its middle as it can be with nothing in its way. A cable
 * lies on the floor, so a block standing nearer the viewer is drawn over it and over its label, and beside the middle
 * of a cable there is often a block's face, or the cable's twin. `half`: half the label's width and height; `hides`:
 * what hides a label, each an outline held (`held`) — what each block draws on the slide, and the labels placed
 * before this one; `runs`: the map's cables, each walked (cableWalk), held, and marked with the cable it is (`of`) —
 * this cable's own is passed over. Gives [x, y], the label's middle: the first of LABEL_PLACES where no outline
 * reaches it and no other cable runs through it. Where there is none: the place where the least of it is hidden, of
 * those the one the least of another cable runs through, and of those the earliest.
 *
 * A label keeps off its own cable's two ends as it keeps off a block: its plate over the arrow's head would hide
 * where the cable goes (TIP px round `tip`, half that round the line's start). `cable` is the cable's line (cableWay).
 *
 * `looks`: {left}, the looks the map has left (LABEL_LOOKS at its start); each place asked spends its own. A place
 * that would cost more than is left is not asked, nor any after it: the label takes the best place asked so far, or
 * the cable's middle when none was.
 */
export function labelPlace(cable, half, hides, runs = [], looks = {left: LABEL_LOOKS}, tip = cable.at(1)) {
  const across = Math.max(1, Math.ceil((2 * half[0]) / SAMPLE)), down = Math.max(1, Math.ceil((2 * half[1]) / SAMPLE));
  const round = ([x, y], far) => held([[x - far, y - far], [x + far, y - far], [x + far, y + far], [x - far, y + far]]);
  const ends = [round(tip, TIP), round(cable.start, TIP / 2)];
  let best = null;
  for (const t of LABEL_PLACES) {
    if (hides.length + runs.length > looks.left) break;   // finding what is near is a look at each thing
    const at = cablePoint(cable, t), over = [...near(hides, at, half), ...near(ends, at, half)], lines = near(runs, at, half, EDGE).filter((run) => run.of !== cable);
    const sides = over.reduce((sum, outline) => sum + outline.points.length, 0), steps = lines.reduce((sum, run) => sum + run.points.length, 0);
    const cost = (across + 1) * (down + 1) * sides + steps + hides.length + runs.length;
    if (cost > looks.left) break;
    looks.left -= cost;
    let hidden = 0, crossed = 0;
    for (let i = 0; over.length && i <= across; i++) {
      for (let j = 0; j <= down; j++) {
        const point = [at[0] - half[0] + (2 * half[0] * i) / across, at[1] - half[1] + (2 * half[1] * j) / down];
        if (over.some((outline) => inside(outline.points, point))) hidden += 1;
      }
    }
    for (const run of lines) for (const [x, y] of run.points) if (Math.abs(x - at[0]) < half[0] + EDGE && Math.abs(y - at[1]) < half[1] + EDGE) crossed += 1;
    if (!hidden && !crossed) return at;
    if (!best || hidden < best.hidden || (hidden === best.hidden && crossed < best.crossed)) best = {at, hidden, crossed};
  }
  return best ? best.at : cablePoint(cable, 0.5);
}
