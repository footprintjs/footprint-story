/**
 * The camera move's critics: what still looks wrong on a sampled path, measured and said in words with the fix in the
 * intent's own keys. Each is {name, limit, measure(track, world) → {value, basis} | null, finding(value, who, basis, hint)}:
 * null from `measure` means it cannot say (no scene, no subject, no line, nothing seen at either end); null from `finding`
 * means within its limit.
 *
 *   in-sight       how much less of its subjects the move shows, at its worst moment, than its ends lead you to expect,
 *                  the larger of two drops (shares seen = in frame times not covered, by `check.js · reportOf`): the
 *                  hand-over (the most it shows of any one subject against the most any is owed, each owed its two ends'
 *                  shares blended by progress, by time on a hand path) and each subject's own (the worse of its two ends
 *                  against what it shows)
 *   turn-speed     the fastest the look turns, in degrees a second, against CAMERA_MOVES.comfort (45°/s, ours)
 *   travel-speed   the fastest the target slides across the frame (frame heights a second, against 1) or the subject
 *                  grows or shrinks (a factor a second, against 2×), as a share of its limit (ours, both)
 *   line-of-action how often the two subjects swap sides of the frame (the 180° rule): on a cut, a fault; while the viewer
 *                  watches, the accepted way across, noted
 *   horizon        the most the horizon leans, in degrees (`geom/look.js · horizonRoll`), against 0.5°
 *
 * WHY a blended baseline: a fly from one subject to another starts with the first in view and ends with the second, so
 * neither end says what the middle should show; each subject is owed what its ends make of that moment, and a wall that
 * hides both in the middle is found. WHY the most of any one, not each: a subject's share is not linear in progress — on
 * a clear pan between two balls 8 m apart the second enters the frame late, and judged alone it read as 29% lost; what a
 * viewer needs is something of the subjects in sight. And WHY each one's own as well: two subjects in both shots, one of
 * them hidden whole on the way, kept "the most of any one" high; against the worse of its own ends a subject that enters
 * late owes nothing, and one a wall hides owes all it showed. A shot that is itself hidden is that shot's fault (checkShot says so); what the move
 * hides beyond it is the move's. Two blockers over one part count twice: it says more is hidden, never less.
 */
import { quatAngle, quatRotate } from '../geom/quat.js';
import { horizonRoll } from '../geom/look.js';
import { reportOf } from './check.js';
import { aim } from './lens.js';
import { CAMERA_MOVES, shownAgainst, tenth } from './moveRules.js';
import { LIMITS, paceBetween } from './movePace.js';
import { MOST_LIFT, MOST_MOVE_SECONDS, MOST_ORBIT } from './moveRead.js';

const DEG = Math.PI / 180;
const pct = (v) => `${Math.round(v * 100)}%`;
const ceil1 = (v) => Math.ceil(v * 10 - 1e-9) / 10;

/** The most a move may show of a subject below what its ends lead you to expect: a tenth. Ours. */
export const SIGHT_DROP = 0.1;
/** The most the horizon may lean, in degrees: about what a level eye notices on a wide frame. Ours. */
export const HORIZON_MOST = 0.5;

/** The lens a sample sees through: the camera's own, or turned to the look a hand path gave it. */
function lensOf(world, sample) {
  const lens = aim(sample.camera, world.frame);
  return sample.looked ? { ...lens, right: quatRotate(sample.look, [1, 0, 0]), up: quatRotate(sample.look, [0, 1, 0]), forward: quatRotate(sample.look, [0, 0, -1]) } : lens;
}

/** Each subject at one sample: the share seen (in frame times not covered), the share in frame, and what hides it most. */
const rowsAt = (world, on, sample) => reportOf(world.scene, sample.camera, world.frame, on, lensOf(world, sample)).rows.map((row) => {
  const covered = Math.min(1, row.blockers.reduce((sum, b) => sum + b.share, 0)), inFrame = row.state === 'seen' ? row.inFrame : 0;
  return { name: row.name, seen: inFrame * (1 - covered), inFrame, blocker: row.blockers[0]?.name ?? null };
});

const inSight = {
  name: 'in-sight',
  limit: SIGHT_DROP,
  measure(track, world) {
    if (!world.scene || !world.frame || !track.on?.length) return null;
    const s = track.samples, first = rowsAt(world, track.on, s[0]), last = rowsAt(world, track.on, s[s.length - 1]);
    if (first.every((r) => r.seen === 0) && last.every((r) => r.seen === 0)) return null;   // nothing seen at either end: nothing to lose
    const t0 = s[0].t, span = s[s.length - 1].t - t0;
    let worst = { drop: 0, kind: null, subject: null, seen: null, expected: null, inFrame: null, blocker: null, at: null };
    const keep = (drop, kind, row, expected, at) => { if (drop > worst.drop) worst = { drop, kind, subject: row.name, seen: row.seen, expected, inFrame: row.inFrame, blocker: row.blocker, at }; };
    for (let i = 1; i < s.length - 1; i++) {
      const p = s[i].progress ?? (span > 0 ? (s[i].t - t0) / span : 0), rows = rowsAt(world, track.on, s[i]);
      // the hand-over: the most of any one subject against the most any is owed, each owed its ends blended by progress
      const owed = Math.max(...first.map((r, k) => (1 - p) * r.seen + p * last[k].seen)), best = rows.reduce((a, r) => (r.seen > a.seen ? r : a));
      keep(owed - best.seen, 'hand-over', best, owed, s[i].t);
      // each subject against the worse of its own two ends: 0 for one that enters late, the whole of one a wall hides
      rows.forEach((row, k) => keep(Math.min(first[k].seen, last[k].seen) - row.seen, 'own', row, Math.min(first[k].seen, last[k].seen), s[i].t));
    }
    const { drop, ...basis } = worst;
    return { value: drop, basis: { ...basis, many: track.on.length > 1 } };
  },
  finding(drop, who, basis, hint) {
    if (!(drop > SIGHT_DROP)) return null;
    const what = basis.blocker ? `"${basis.blocker}" covers it` : 'it leaves the frame';
    const most = basis.many && basis.kind === 'hand-over' ? `the most it shows of its subjects is ${pct(basis.seen)} ("${basis.subject}")` : `it shows ${pct(basis.seen)} of "${basis.subject}"`;
    const owed = basis.kind === 'own' && basis.many ? `where both its ends show at least ${pct(basis.expected)}` : `where its ends lead you to expect ${pct(basis.expected)}`;
    const message = `${who}: at ${tenth(basis.at)} s ${most}, ${owed} — ${what} on the way`;
    const helps = (d) => d !== undefined && d !== null && d < drop;
    const fix = helps(hint?.levelDrop) && hint.levelDrop <= SIGHT_DROP ? 'keep it level, its rise is what hides it: lift: 0'
      : helps(hint?.higherDrop) ? `lift it over: lift: ${Math.min(MOST_LIFT, (hint.lift ?? 0) + 15)}`
        : hint?.do === 'fly' && hint.turn > 0 ? `cut instead: cutPast: ${Math.max(0, Math.floor(hint.turn) - 1)}`
          : hint?.do === 'fly' && !basis.blocker ? "frame its ends wider: size: 'wide' on from and to"
          : hint?.do === 'orbit' ? "start from a higher or wider view: from: {from: 'front high', size: 'wide'}"
            : basis.blocker ? `take the path over or round "${basis.blocker}", or cut` : 'keep the subject in frame on the way, or cut';
    return { level: 'warn', message, fix };
  },
};

/**
 * The seconds that bring a measure under its limit: a planned move's own comfort seconds (its limits at planShare, from the
 * same pace the planner read, so following the fix clears the finding), or a hand path's length scaled by how far over it is.
 */
function slower(ratio, basis, hint) {
  const most = Math.max(ratio, hint?.speedRatio ?? 0);   // a hand path's turn and travel fixes agree on the larger
  const need = hint?.comfortSeconds && hint.comfortSeconds > hint.seconds ? hint.comfortSeconds : Math.max(ceil1((basis.seconds * most) / CAMERA_MOVES.planShare), ceil1(basis.seconds + 0.1));
  if (need <= MOST_MOVE_SECONDS) return `slow it: seconds: ${need}`;
  return hint?.do === 'fly' ? `too far to fly at a comfortable pace (${need} s): leave seconds out, and it cuts` : `too far to move at a comfortable pace (${need} s): cut instead`;
}

/** Every step a viewer watches (not a cut, some time passing) of a track, with its seconds. */
function* steps(track) {
  const s = track.samples;
  for (let i = 1; i < s.length; i++) { const dt = s[i].t - s[i - 1].t; if (!s[i].cut && dt > 0) yield [s[i - 1], s[i], dt]; }
}
const lengthOf = (track) => track.samples[track.samples.length - 1].t - track.samples[0].t;

const turnSpeed = {
  name: 'turn-speed',
  limit: CAMERA_MOVES.comfort,
  measure(track) {
    let most = 0, at = null;
    for (const [a, b, dt] of steps(track)) { const rate = quatAngle(a.look, b.look) / DEG / dt; if (rate > most) { most = rate; at = b.t; } }
    return { value: most, basis: { at, seconds: lengthOf(track) } };
  },
  finding(rate, who, basis, hint) {
    if (!(rate > CAMERA_MOVES.comfort)) return null;
    return { level: 'warn', message: `${who}: its look turns ${shownAgainst(rate, CAMERA_MOVES.comfort)}°/s at ${tenth(basis.at)} s, past ${CAMERA_MOVES.comfort}°/s — the picture smears and the viewer loses their place`,
      fix: slower(rate / CAMERA_MOVES.comfort, basis, hint) };
  },
};

const travelSpeed = {
  name: 'travel-speed',
  limit: 1,
  measure(track) {
    let most = 0, basis = { by: null, slide: 0, zoom: 1, at: null, seconds: lengthOf(track) };
    for (const [a, b, dt] of steps(track)) {
      const pace = paceBetween(a.camera, b.camera, a.look, b.look), slide = pace.slide / dt, zoom = pace.zoom / dt, share = Math.max(slide / LIMITS.slide, zoom / LIMITS.zoom);
      if (share > most) { most = share; basis = { ...basis, by: slide / LIMITS.slide >= zoom / LIMITS.zoom ? 'slide' : 'zoom', slide, zoom: Math.exp(zoom), at: b.t }; }
    }
    return { value: most, basis };
  },
  finding(share, who, basis, hint) {
    if (!(share > 1)) return null;
    const message = basis.by === 'slide'
      ? `${who}: its target slides ${shownAgainst(basis.slide, CAMERA_MOVES.slide)} frame heights a second at ${tenth(basis.at)} s, past ${CAMERA_MOVES.slide} — the picture rushes past faster than an eye can follow`
      : `${who}: its subject grows or shrinks ${shownAgainst(basis.zoom, CAMERA_MOVES.zoom)}× a second at ${tenth(basis.at)} s, past ${CAMERA_MOVES.zoom}× — it lurches`;
    return { level: 'warn', message, fix: slower(share, basis, hint) };
  },
};

/**
 * Which of two points is on the left of the frame: 1 when b is right of a, −1 when left, 0 when either is behind the camera
 * or both lie along one line of sight. Read through the sample's look, so a hand path that turns its own way is honoured.
 */
function orderOf(sample, a, b) {
  const right = quatRotate(sample.look, [1, 0, 0]), forward = quatRotate(sample.look, [0, 0, -1]), e = sample.eye;
  const at = (p) => { const d = [p[0] - e[0], p[1] - e[1], p[2] - e[2]], z = d[0] * forward[0] + d[1] * forward[1] + d[2] * forward[2]; return z > 0 ? (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / z : null; };
  const xa = at(a), xb = at(b);
  return xa === null || xb === null || Math.abs(xb - xa) < 1e-12 ? 0 : Math.sign(xb - xa);
}

const lineOfAction = {
  name: 'line-of-action',
  limit: 0,
  measure(track, world) {
    if (!world.scene || !track.line) return null;
    const [a, b] = track.line.map((n) => world.scene.things.find((t) => t.name === n).at);
    if (a[0] === b[0] && a[2] === b[2]) return null;   // one above the other: no line on the ground to keep to one side of
    let last = 0, first = 0, crossings = 0, onCut = false, at = null;
    for (const s of track.samples) {
      const side = orderOf(s, a, b);
      if (side && last && side !== last) { crossings += 1; onCut ||= Boolean(s.cut); at ??= s.t; }
      if (side) { last = side; first ||= side; }
    }
    // ends apart: every way between them swaps the two, so going the other way round is no fix
    return { value: crossings, basis: { crossings, onCut, at, endsApart: first !== last, a: track.line[0], b: track.line[1] } };
  },
  finding(crossings, who, basis, hint) {
    if (!(crossings > 0)) return null;
    const line = `the line of action from "${basis.a}" to "${basis.b}"`;
    if (basis.onCut) return { level: 'warn', message: `${who}: cuts across ${line} — the two swap sides of the frame, and the viewer loses who is where`, fix: 'fly instead, so the viewer sees the camera go round: cutPast: 180' };
    const other = hint?.do === 'orbit' && hint.swing && !basis.endsApart ? hint.swing - Math.sign(hint.swing) * 360 : null;
    const fix = other !== null && Math.abs(other) <= MOST_ORBIT ? `go the other way round: by: ${tenth(other)}`
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
    return { level: 'warn', message: `${who}: leans the horizon ${shownAgainst(lean, HORIZON_MOST)}° at ${tenth(basis.at)} s — the ground looks to tip`,
      fix: "keep it level: plan it as {do: 'fly', from, to} — every look planCameraMove gives keeps world up (blending two looks far apart leans)" };
  },
};

/** The critics, in the order they run. */
export const CAMERA_CRITICS_LIST = Object.freeze([inSight, turnSpeed, travelSpeed, lineOfAction, horizon]);
/** Their names. */
export const CAMERA_CRITICS = Object.freeze(CAMERA_CRITICS_LIST.map((c) => c.name));
