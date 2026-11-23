/**
 * Joint limits and the facing mirror (docs/design/2026-11-bodies.md §1, §3).
 *
 *   windowAngle(angle, [min, max])  the window rule: the angle plus the whole turns that bring it nearest the window's middle
 *   clampPose(rig, pose)            every relative angle read in its window and clamped into it; what was clamped, by how much,
 *                                   and how far each chain's point moved for it
 *   mirrorPose(rig, pose)           the pose seen in a mirror about the vertical through its root: θ → π − θ for every world
 *                                   angle, so every relative angle changes sign (twice gives the pose back)
 *
 * WHY a window and not (−π, π]: a shoulder swings more than half a turn, so a window inside (−π, π] could not hold it.
 * A window is narrower than a turn, so an angle has one reading in it (or none, and is clamped to the nearer end).
 * WHY clampPose is the one clamp: every solver and every model ends in it, so "every angle within its limit" is one
 * rule in one place, and what it changed is always reported, never hidden.
 */
import { readList, refuse, shown } from './read.js';
import { infoOf, rigOf } from './rig.js';
import { placeRead, readPose } from './pose.js';

const TURN = 2 * Math.PI;

/** Half away from zero, so a window mirrored reads the mirrored angle (Math.round sends −0.5 up, 0.5 up too). */
const roundOdd = (x) => Math.sign(x) * Math.round(Math.abs(x));

/** The window rule on numbers already checked (internal to src/body). An angle already inside comes back unchanged. */
export function inWindow(a, lo, hi) {
  if (a >= lo && a <= hi) return a;
  return a + roundOdd(((lo + hi) / 2 - a) / TURN) * TURN;
}

/** The angle plus the multiple of 2π nearest the window's middle (not clamped). Refused: an angle that is not finite,
 *  a window that is not [min, max] of finite numbers with min ≤ max, narrower than 2π. */
export function windowAngle(angle, limit) {
  if (!(typeof angle === 'number' && Number.isFinite(angle))) refuse(`windowAngle's angle is a finite number — not ${shown(angle)}`);
  const ends = readList(limit, 'windowAngle\'s limit [min, max]', { least: 2, most: 2 });
  const [lo, hi] = ends;
  if (!(ends.every((n) => typeof n === 'number' && Number.isFinite(n)) && lo <= hi && hi - lo < TURN)) refuse(`windowAngle's limit is [min, max], finite, min ≤ max, narrower than 2π — not [${ends.map(shown).join(', ')}]`);
  return inWindow(angle, lo, hi) + 0;
}

/** clampPose on a pose already read (internal to src/body). */
export function clampRead(r, pose) {
  const { windows, parent, index } = infoOf(r);
  const clamped = [];
  const angles = pose.angles.map((a, i) => {
    const w = windows[i];
    if (w === null) return a;
    const read = inWindow(a, w[0], w[1]);
    const c = Math.min(Math.max(read, w[0]), w[1]);
    if (c !== read) clamped.push(Object.freeze({ part: r.parts[i].name, by: c - read }));
    return c + 0;
  });
  const out = Object.freeze({ root: pose.root, turn: pose.turn, angles: Object.freeze(angles) });
  const moved = [];
  if (clamped.length) {
    const hit = new Set(clamped.map((c) => index.get(c.part)));
    const before = placeRead(r, pose), after = placeRead(r, out);
    for (const chain of r.chains) {
      const last = index.get(chain.parts[chain.parts.length - 1]);
      let reached = false;
      for (let i = last; i !== -1 && !reached; i = parent[i]) reached = hit.has(i);
      if (!reached) continue;
      const [a, b] = [before[last].end, after[last].end];
      moved.push(Object.freeze({ chain: chain.name, by: Math.hypot(b[0] - a[0], b[1] - a[1]) }));
    }
  }
  return Object.freeze({ pose: out, clamped: Object.freeze(clamped), moved: Object.freeze(moved) });
}

/**
 * Every relative angle read in its window (as the rig faces) and clamped into it; a joint with no limit is left as it is.
 * Returns `{pose, clamped: [{part, by}], moved: [{chain, by}]}`: `by` is the clamp in radians (signed) and, for each
 * chain whose point a clamp moved, how far it moved in px. Pure; refuses what readPose refuses.
 */
export function clampPose(rig, pose) {
  const r = rigOf(rig);
  return clampRead(r, readPose(r, pose));
}

/** The pose mirrored about the vertical through its root: the turn θ becomes π − θ, every relative angle −a. It is the
 *  same body seen facing the other way, so it is read against the rig facing the other way. */
export function mirrorPose(rig, pose) {
  const r = rigOf(rig), p = readPose(r, pose);
  return Object.freeze({ root: p.root, turn: Math.PI - p.turn + 0, angles: Object.freeze(p.angles.map((a) => -a + 0)) });
}
