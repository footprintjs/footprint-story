/**
 * A pose, and where it puts every part (docs/design/2026-11-bodies.md §1).
 *
 *   restPose(rig, {root?})          every part at its rest angle, the root at `root` ([0, 0]), as the rig faces
 *   placeParts(rig, pose)           forward kinematics: each part's start, end and world angle, in rig order
 *   centreOf(rig, placed)           the centre of mass of the placed parts
 *
 * A pose is `{root: [x, y], turn, angles}`: `turn` is the root part's world angle, and `angles` holds each part's angle
 * relative to its parent, in the rig's part order (the root's entry is 0: its turn is `turn`). WHY a list and not an
 * object keyed by name: no key can reach a prototype, and the list is exactly as long as the rig.
 *
 * World angles are sums of relative angles and are never wrapped (§3, continuity): a part that turns past ±π goes on
 * turning, so a tool that eases between two samples never spins the long way round.
 */
import { ANGLE_FAR, readList, readPoint, readRecord, refuse, shown, stored } from './read.js';
import { infoOf, rigOf } from './rig.js';

/** The pose checked against its rig and frozen. Refused: other keys, a root that is not a point within ±1e6 px, a turn
 *  or an angle that is not finite or is past ±1e6 rad, an angle list not as long as the rig, a root entry other than 0. */
export function readPose(rig, pose) {
  const r = rigOf(rig), { rootIndex } = infoOf(r);
  const what = `the pose of rig "${r.name}"`;
  readRecord(pose, ['root', 'turn', 'angles'], what);
  const root = readPoint(stored(pose, 'root', `${what}'s root`), `${what}'s root`);
  const turn = angleOf(stored(pose, 'turn', `${what}'s turn`), `${what}'s turn`);
  const raw = readList(stored(pose, 'angles', `${what}'s angles`), `${what}'s angles (one a part, in the rig's order)`, { least: r.parts.length, most: r.parts.length });
  const angles = raw.map((a, i) => angleOf(a, `${what}'s angles[${i}] (part "${r.parts[i].name}")`));
  if (angles[rootIndex] !== 0) refuse(`${what}'s angles[${rootIndex}] is the root "${r.root}", whose turn is the pose's turn: give 0 here and the turn in turn — not ${angles[rootIndex]}`);
  return Object.freeze({ root, turn, angles: Object.freeze(angles) });
}

function angleOf(a, what) {
  if (!(typeof a === 'number' && Number.isFinite(a) && Math.abs(a) <= ANGLE_FAR)) refuse(`${what} is an angle in radians, a number within ±${ANGLE_FAR} — not ${shown(a)}`);
  return a + 0;
}

/** Every part at its rest angle, the root at `root`; a rig facing −1 mirrored (each angle's sign changed, the turn π). */
export function restPose(rig, options = {}) {
  const r = rigOf(rig);
  readRecord(options, ['root'], `restPose's options`);
  const given = stored(options, 'root', `restPose's root`);
  const root = given === undefined ? Object.freeze([0, 0]) : readPoint(given, `restPose's root`);
  return Object.freeze({ root, turn: r.facing === 1 ? 0 : Math.PI, angles: Object.freeze(r.parts.map((p) => r.facing * p.rest + 0)) });
}

/** Forward kinematics on a pose already read (internal to src/body): no check, the same numbers as placeParts. */
export function placeRead(r, pose) {
  const { parent } = infoOf(r), out = [];
  r.parts.forEach((p, i) => {
    const up = parent[i] === -1 ? null : out[parent[i]];
    const start = up ? up.end : pose.root;
    const angle = up ? up.angle + pose.angles[i] : pose.turn;
    const end = Object.freeze([start[0] + p.length * Math.cos(angle), start[1] + p.length * Math.sin(angle)]);
    out.push(Object.freeze({ name: p.name, start, end, angle }));
  });
  return Object.freeze(out);
}

/** Each part's start (its parent's end; the root's at pose.root), end and world angle (its parent's plus its own), in
 *  rig order. Pure: the same pose, the same numbers. */
export const placeParts = (rig, pose) => { const r = rigOf(rig); return placeRead(r, readPose(r, pose)); };

/**
 * The centre of mass: each part's share at its middle. WHY the middle: the ragdoll (§6) splits a part's share half to
 * each end, and half at each end is the same centre as all of it at the middle, so the two can never disagree. Refused:
 * a placed list that is not one {start, end} a part, in rig order, each point within ±1e6 px.
 */
export function centreOf(rig, placed) {
  const r = rigOf(rig);
  const list = readList(placed, `centreOf's placed parts (placeParts' answer for rig "${r.name}")`, { least: r.parts.length, most: r.parts.length });
  let x = 0, y = 0;
  list.forEach((q, i) => {
    const at = `centreOf's placed[${i}]`;
    if (q === null || typeof q !== 'object') refuse(`${at} is a placed part {start, end} — not ${shown(q)}`);
    const name = stored(q, 'name', `${at}'s name`);
    if (name !== undefined && name !== r.parts[i].name) refuse(`${at} is part "${r.parts[i].name}" (rig order) — not ${shown(name)}: hand in placeParts' answer as it is`);
    const s = readPoint(stored(q, 'start', `${at}'s start`), `${at}'s start`), e = readPoint(stored(q, 'end', `${at}'s end`), `${at}'s end`);
    const m = r.parts[i].mass;
    x += m * (s[0] + e[0]) / 2; y += m * (s[1] + e[1]) / 2;
  });
  return Object.freeze([x + 0, y + 0]);
}
