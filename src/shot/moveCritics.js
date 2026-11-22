/**
 * The camera move's critics: what still looks wrong on a sampled path, measured and said in words with the fix in the
 * intent's own keys. Each is {name, limit, measure(track, world) → {value, basis} | null, finding(value, who, basis, hint)}:
 * null from `measure` means it cannot say (no scene, no subject, no line); null from `finding` means within its limit.
 *
 *   in-sight       how much more of the subject the move loses, at its worst moment, than its two shots show: the share
 *                  in frame times the share not covered, read by the shot check (`check.js · reportOf`, the same outlines)
 *   turn-speed     the fastest the look turns, in degrees a second, against CAMERA_MOVES.comfort (45°/s, ours)
 *   line-of-action how often the camera crosses the line between two subjects (the 180° rule): on a cut, a fault; while
 *                  the viewer watches, the accepted way across, noted
 *   horizon        the most the horizon leans, in degrees (`geom/look.js · horizonRoll`), against 0.5°
 *
 * WHY the sight critic counts only what the move adds: a shot that is half hidden is that shot's fault, and checkShot says
 * so; a move that hides its subject on the way is the move's. Two blockers over one part count twice: it says more is
 * hidden, never less.
 */
import { quatAngle } from '../geom/quat.js';
import { horizonRoll } from '../geom/look.js';
import { reportOf } from './check.js';
import { CAMERA_MOVES } from './move.js';
import { MOST_LIFT, MOST_ORBIT } from './moveRead.js';

const DEG = Math.PI / 180;
const one = (v) => Number(v.toFixed(1));
const pct = (v) => `${Math.round(v * 100)}%`;

/** The most the move may lose of its subject beyond what its shots show: a tenth. Ours. */
export const SIGHT_DROP = 0.1;
/** The most the horizon may lean, in degrees: about what a level eye notices on a wide frame. Ours. */
export const HORIZON_MOST = 0.5;

/** The share of the subjects the camera sees at one sample (the least of them), and what hides it most. */
function seenAt(world, on, sample) {
  const report = reportOf(world.scene, sample.camera, world.frame, on);
  let worst = { seen: 1, inFrame: 1, blocker: null };
  for (const row of report.rows) {
    const covered = Math.min(1, row.blockers.reduce((sum, b) => sum + b.share, 0)), inFrame = row.state === 'seen' ? row.inFrame : 0, seen = inFrame * (1 - covered);
    if (seen < worst.seen) worst = { seen, inFrame, blocker: row.blockers[0]?.name ?? null };
  }
  return worst;
}

const inSight = {
  name: 'in-sight',
  limit: SIGHT_DROP,
  measure(track, world) {
    if (!world.scene || !world.frame || !track.on?.length) return null;
    const s = track.samples, ends = Math.min(seenAt(world, track.on, s[0]).seen, seenAt(world, track.on, s[s.length - 1]).seen);
    let worst = { seen: ends, inFrame: null, blocker: null, at: null };
    for (let i = 1; i < s.length - 1; i++) { const w = seenAt(world, track.on, s[i]); if (w.seen < worst.seen) worst = { ...w, at: s[i].t }; }
    return { value: Math.max(0, ends - worst.seen), basis: { worst: worst.seen, ends, at: worst.at, inFrame: worst.inFrame, blocker: worst.blocker } };
  },
  finding(drop, who, basis, hint) {
    if (!(drop > SIGHT_DROP)) return null;
    const what = basis.blocker ? `"${basis.blocker}" covers it` : 'it leaves the frame';
    const message = `${who}: at ${one(basis.at)} s it shows ${pct(basis.worst)} of its subject, against ${pct(basis.ends)} at its ends — ${what} on the way`;
    const higher = hint && (hint.lift ?? 0) < MOST_LIFT;
    const fix = basis.blocker && higher ? `lift it over: lift: ${Math.min(MOST_LIFT, (hint.lift ?? 0) + 15)}`
      : hint?.do === 'fly' && hint.turn > 0 ? `cut instead: cutPast: ${Math.max(0, Math.floor(hint.turn) - 1)}`
        : hint?.do === 'orbit' ? "start from a higher or wider view: from: {from: 'front high', size: 'wide'}"
          : basis.blocker ? `take the path over or round "${basis.blocker}", or cut` : 'keep the subject in frame on the way, or cut';
    return { level: 'warn', message, fix };
  },
};

const turnSpeed = {
  name: 'turn-speed',
  limit: CAMERA_MOVES.comfort,
  measure(track) {
    const s = track.samples;
    let most = 0, at = null;
    for (let i = 1; i < s.length; i++) {
      const dt = s[i].t - s[i - 1].t;
      if (s[i].cut || !(dt > 0)) continue;
      const rate = quatAngle(s[i - 1].look, s[i].look) / DEG / dt;
      if (rate > most) { most = rate; at = s[i].t; }
    }
    return { value: most, basis: { at, seconds: s[s.length - 1].t - s[0].t } };
  },
  finding(rate, who, basis) {
    if (!(rate > CAMERA_MOVES.comfort)) return null;
    const need = Math.ceil((basis.seconds * rate) / CAMERA_MOVES.comfort * 10) / 10;
    return { level: 'warn', message: `${who}: its look turns ${one(rate)}°/s at ${one(basis.at)} s, past ${CAMERA_MOVES.comfort}°/s — the picture smears and the viewer loses their place`,
      fix: `slow it: seconds: ${need}` };
  },
};

/** Which side of the line a to b (on the ground: x and z) a point is: 1, −1, or 0 on it. */
const sideOf = (a, b, p) => Math.sign((b[0] - a[0]) * (p[2] - a[2]) - (b[2] - a[2]) * (p[0] - a[0]));

const lineOfAction = {
  name: 'line-of-action',
  limit: 0,
  measure(track, world) {
    if (!world.scene || !track.line) return null;
    const [a, b] = track.line.map((n) => world.scene.things.find((t) => t.name === n).at);
    if (a[0] === b[0] && a[2] === b[2]) return null;   // one above the other: no line on the ground to keep to one side of
    let last = 0, first = 0, crossings = 0, onCut = false, at = null;
    for (const s of track.samples) {
      const side = sideOf(a, b, s.eye);
      if (side && last && side !== last) { crossings += 1; onCut ||= Boolean(s.cut); at ??= s.t; }
      if (side) { last = side; first ||= side; }
    }
    // ends on opposite sides: every way between them crosses, so going the other way round is no fix
    return { value: crossings, basis: { crossings, onCut, at, endsApart: first !== last, a: track.line[0], b: track.line[1] } };
  },
  finding(crossings, who, basis, hint) {
    if (!(crossings > 0)) return null;
    const line = `the line of action from "${basis.a}" to "${basis.b}"`;
    if (basis.onCut) return { level: 'warn', message: `${who}: cuts across ${line} — the two swap sides of the frame, and the viewer loses who is where`, fix: 'fly instead, so the viewer sees the camera go round: cutPast: 180' };
    const other = hint?.do === 'orbit' && hint.swing && !basis.endsApart ? hint.swing - Math.sign(hint.swing) * 360 : null;
    const fix = other !== null && Math.abs(other) <= MOST_ORBIT ? `go the other way round: by: ${one(other)}`
      : hint?.do === 'orbit' ? `stop on the side it starts: a by that keeps it on one side of ${line}` : `end on the side it starts: a to on the same side of ${line}`;
    return { level: 'note', message: `${who}: crosses ${line} while the viewer watches — the accepted way across, but the two swap sides of the frame`, fix };
  },
};

const horizon = {
  name: 'horizon',
  limit: HORIZON_MOST,
  measure(track) {
    let most = 0, at = null;
    for (const s of track.samples) { const roll = horizonRoll(s.look); if (roll !== null && Math.abs(roll) / DEG > most) { most = Math.abs(roll) / DEG; at = s.t; } }
    return { value: most, basis: { at } };
  },
  finding(lean, who, basis) {
    if (!(lean > HORIZON_MOST)) return null;
    return { level: 'warn', message: `${who}: leans the horizon ${one(lean)}° at ${one(basis.at)} s — the ground looks to tip`,
      fix: "keep it level: plan it as {do: 'fly', from, to} — every look planCameraMove gives keeps world up (blending two looks far apart leans)" };
  },
};

/** The critics, in the order they run. */
export const CAMERA_CRITICS_LIST = Object.freeze([inSight, turnSpeed, lineOfAction, horizon]);
/** Their names. */
export const CAMERA_CRITICS = Object.freeze(CAMERA_CRITICS_LIST.map((c) => c.name));
