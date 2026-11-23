/**
 * Two-bone IK: an arm or a leg (a chain of exactly two parts) turned so its point, the end of its second part, reaches a
 * target (docs/design/2026-11-bodies.md §3). Closed form, no iteration.
 *
 *   twoBone(rig, pose, chain, target)   → {pose, miss, stretched, folded, clamped, moved}
 *
 * The law of cosines gives the triangle of the two parts (l1, l2) and the reach d from the chain's root to the target,
 * d held in [|l1 − l2|, l1 + l2]. Each angle of the triangle comes from Kahan's needle-triangle form, 2·atan(√(…)) on
 * sorted sides, never acos: acos loses its digits near 0 and π, which is full reach, where an arm or a leg most often is.
 * The middle joint's inner angle C gives the second part's relative angle ±(π − C) (taken as one angle, so a limb almost
 * straight keeps its digits); the sign puts the middle joint on
 * the chain's `bend` side of the line from its root to the target (knees "front", elbows "back", read as the rig is
 * written, so a body facing −1 bends the mirrored way). WHY a fixed side: in the plane there are two answers, mirror
 * images, and the answer must never flip between frames.
 *
 * Purity: the answer depends only on the pose handed in (the move's start pose, which its plan holds), never on a
 * previous answer. Degenerate targets are named rules with an epsilon, never a test for exact zero:
 *   - a target within NEAR × (l1 + l2) of the chain's root has no direction: the first part keeps its world angle in
 *     the pose handed in, and the chain folds as close as it can;
 *   - a target within NEAR × (l1 + l2) of full reach is straight.
 * NEAR is half of the guarantee (1e-9 × (l1 + l2)), so even a target at the edge of either rule is met within it.
 * The answer ends in the one clamp (limits.js · clampPose); what it clamped is reported, and `miss` is measured after it.
 */
import { readPoint, refuse, shown } from './read.js';
import { infoOf, rigOf } from './rig.js';
import { placeRead, readPose } from './pose.js';
import { clampRead, inWindow } from './limits.js';

/** The reach guarantee, as a share of l1 + l2: a target in reach is met within it (before any limit clamps). */
export const REACH_TOLERANCE = 1e-9;
const NEAR = REACH_TOLERANCE / 2;

/**
 * A triangle's angle from its sides (W. Kahan, "Miscalculating Area and Angles of a Needle-like Triangle", 2014): for the
 * angle between sides x and y, opposite side c, take a ≥ b the two adjacent sides, μ = c − (a − b) when b ≥ c, else
 * b − (a − c); then the angle is 2·atan(√(top / bottom)) with top = ((a − b) + c)·μ and bottom = (a + (b + c))·((a − c)
 * + b). The brackets are the formula: they keep every digit near 0 and π. Its outside angle, π minus it, is
 * 2·atan(√(bottom / top)) — taken directly, so a limb almost straight keeps every digit of how far it bends.
 */
function sides(x, y, c) {
  const a = Math.max(x, y), b = Math.min(x, y);
  const mu = b >= c ? c - (a - b) : b - (a - c);
  return [((a - b) + c) * mu, (a + (b + c)) * ((a - c) + b)];
}

/** The angle opposite side c, 0..π. A flat triangle is named, never divided by zero: c at or below |x − y| gives 0, at
 *  or past x + y gives π. Internal to src/body; the tests hold it to the law of cosines and an exact-rational oracle. */
export function angleOpposite(x, y, c) {
  const [top, bottom] = sides(x, y, c);
  if (!(top > 0)) return 0;
  if (!(bottom > 0)) return Math.PI;
  return 2 * Math.atan(Math.sqrt(top / bottom));
}

/** π minus the angle opposite c, from the same sides: 0 when c is at or past x + y (straight), π at or below |x − y|. */
export function angleOutside(x, y, c) {
  const [top, bottom] = sides(x, y, c);
  if (!(top > 0)) return Math.PI;
  if (!(bottom > 0)) return 0;
  return 2 * Math.atan(Math.sqrt(bottom / top));
}

/** The triangle of a two-bone chain at reach d (held in [|l1 − l2|, l1 + l2]): `root`, the angle at the chain's root
 *  between the line to the target and the first part; `bend`, how far the second part turns off the first's line
 *  (π − the inner angle at the middle joint; 0 is straight). Internal. */
export function twoBoneAngles(l1, l2, d) {
  const reach = Math.min(Math.max(d, Math.abs(l1 - l2)), l1 + l2);
  return { root: angleOpposite(l1, reach, l2), bend: angleOutside(l1, l2, reach) };
}

/**
 * The pose with the chain's two angles solved so its point reaches `target`; every other angle as handed in, then the
 * whole pose clamped (clampPose). Returns `{pose, miss, stretched, folded, clamped, moved}`: `miss` is how far the
 * chain's point ends from the target in px; `stretched` says the target was past reach (the chain points straight at
 * it), `folded` that it was inside |l1 − l2| (the chain folds as far as it goes). A joint with no limit takes the
 * reading of its angle nearest where it was in the pose handed in. Refused: a chain that is not one of the rig's
 * two-bone chains, a target that is not a point within ±1e6 px, and what readPose refuses.
 */
export function twoBone(rig, pose, chain, target) {
  const r = rigOf(rig), info = infoOf(r), p = readPose(r, pose);
  const twoBones = r.chains.filter((c) => c.solver === 'two-bone').map((c) => `"${c.name}"`).join(', ') || 'none';
  if (typeof chain !== 'string' || !info.chainIndex.has(chain)) refuse(`twoBone's chain is one of rig "${r.name}"'s two-bone chains (${twoBones}) — not ${shown(chain)}`);
  const c = r.chains[info.chainIndex.get(chain)];
  if (c.solver !== 'two-bone') refuse(`twoBone solves a two-bone chain, and "${chain}" is a ${c.solver} chain: use its own solver, or one of ${twoBones}`);
  const t = readPoint(target, `twoBone's target for chain "${chain}"`);
  const [i1, i2] = c.parts.map((n) => info.index.get(n));
  const placed = placeRead(r, p);
  const o = placed[i1].start, parentWorld = placed[info.parent[i1]].angle;
  const l1 = r.parts[i1].length, l2 = r.parts[i2].length, full = l1 + l2, short = Math.abs(l1 - l2);
  const dx = t[0] - o[0], dy = t[1] - o[1], d = Math.hypot(dx, dy);
  // s = +1 turns the first part clockwise (on screen, y down) off the line to the target: the middle joint goes to the
  // line's right, which is "back" for a body facing +x (down for a line along +x, −x for a line pointing down)
  const s = r.facing * (c.bend === 'back' ? 1 : -1);
  let upper, bend, stretched = false, folded = false;
  if (d <= NEAR * full) {
    upper = placed[i1].angle; bend = Math.PI; folded = d < short;
  } else {
    const towards = Math.atan2(dy, dx);
    if (full - d <= NEAR * full) { upper = towards; bend = 0; stretched = d > full; }
    else if (d <= short) { upper = towards + (l1 > l2 ? 0 : s * Math.PI); bend = Math.PI; folded = d < short; }
    else { const a = twoBoneAngles(l1, l2, d); upper = towards + s * a.root; bend = a.bend; }
  }
  const angles = [...p.angles];
  angles[i1] = upper - parentWorld;
  angles[i2] = -s * bend + 0;
  // a free joint (no window) takes the reading nearest where it was: the answer never jumps a whole turn for nothing
  for (const i of [i1, i2]) if (info.windows[i] === null) angles[i] = inWindow(angles[i], p.angles[i], p.angles[i]) + 0;
  const solved = clampRead(r, Object.freeze({ root: p.root, turn: p.turn, angles: Object.freeze(angles) }));
  const end = placeRead(r, solved.pose)[i2].end;
  return Object.freeze({ pose: solved.pose, miss: Math.hypot(end[0] - t[0], end[1] - t[1]), stretched, folded, clamped: solved.clamped, moved: solved.moved });
}
