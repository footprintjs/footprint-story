/**
 * The camera check: what a camera sees of a subject, read from the scene and the camera, no pixels. Each fault is a row in
 * one table and names its fix, so a tool that keeps a record can show which rule spoke.
 */
import { deepFreeze, orRefuse, readAll } from './fields.js';
import { AT_CAMERA, aim, dot, sub } from './lens.js';
import { boxFor, solidOf } from './solid.js';
import { blockersOf, shareInFrame, sidesPast } from './sight.js';
import { namesFrom, sceneFrom } from './scene.js';
import { cameraFrom, frameFrom } from './camera.js';
import { lensWord, sizeWord, viewOf } from './views.js';

/** Below this share of the frame's height a subject is too small to read: half of a wide shot, a choice and not a measurement. */
const TOO_SMALL = 0.1;
const EDGE_ON = Math.sin(15 * Math.PI / 180), SOFT_PX = 0.5, FOUR = 1e4;
const round = (v) => Math.round(v * FOUR) / FOUR;

/** The faults one subject can have, each that holds. `fix` is what the line says to do. */
const FAULTS = [
  { kind: 'behind', fix: 'turn the camera to it', when: (r) => r.state === 'behind' },
  { kind: 'inside', fix: 'pull back', when: (r) => r.state === 'inside' },
  { kind: 'crosses', fix: 'pull back', when: (r) => r.state === 'crosses' },
  { kind: 'off-frame', fix: 'aim at it', when: (r) => r.state === 'seen' && r.inFrame === 0 },
  { kind: 'cut-off', fix: 'pull back or aim at it', when: (r) => r.state === 'seen' && r.inFrame > 0 && r.inFrame < 1 },
  { kind: 'edge-on', fix: 'turn the view to its face', when: (r) => r.state === 'seen' && r.facing === 'edge-on' },
  { kind: 'back', fix: 'go round to its face', when: (r) => r.state === 'seen' && r.facing === 'back' },
  { kind: 'blocked', fix: 'move the view or lift it', when: (r) => r.state === 'seen' && r.inFrame > 0 && r.blockers.length > 0 },
  { kind: 'soft', fix: 'focus on it or narrow the aperture', when: (r) => r.state === 'seen' && r.inFrame > 0 && r.blur > SOFT_PX },
];

function facingOf(lens, { n, thing }) {
  if (!n) return null;
  const to = sub(lens.eye, thing.at), toward = dot(n, to) / Math.hypot(...to);
  if (Math.abs(toward) < EDGE_ON) return 'edge-on';
  return toward < 0 && !thing.back ? 'back' : 'face';
}

/** A thin lens: a point at this depth spreads to this radius in pixels. The same law a depth blur in a flat film follows. */
const blurAt = (lens, camera, depth) => (camera.focus > AT_CAMERA ? camera.aperture * lens.k * Math.abs(1 / depth - 1 / camera.focus) : 0);

function rowOf(lens, camera, subject, others) {
  const { solid, box } = subject, name = solid.thing.name;
  if (box.state !== 'seen') return { name, state: box.state, depth: round(box.depth), inFrame: 0, height: 0, sides: [], blockers: [], blur: 0, facing: null, area: false };
  const inFrame = shareInFrame(lens, solid, box), height = (box.y1 - box.y0) / lens.h, sides = sidesPast(lens, box);
  const seen = inFrame > 0 ? blockersOf(lens, subject, others) : [];
  return { name, state: 'seen', depth: round(box.depth), inFrame: round(inFrame), height: round(height), sides, blockers: seen.map((b) => ({ name: b.name, share: round(b.share) })), blur: round(blurAt(lens, camera, box.depth)), facing: facingOf(lens, solid), area: box.x1 > box.x0 && box.y1 > box.y0 };
}

const union = (boxes) => boxes.reduce((a, b) => ({ y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) }));

function reportOf(scene, camera, frame, names) {
  const lens = aim(camera, frame), all = scene.things.map((t) => { const solid = solidOf(t); return { solid, box: boxFor(lens, solid) }; });
  const subjects = names.map((n) => all.find((a) => a.solid.thing.name === n)), rows = subjects.map((s) => rowOf(lens, camera, s, all));
  const seen = subjects.filter((s) => s.box.state === 'seen').map((s) => s.box), seenRows = rows.filter((r) => r.state === 'seen'), view = viewOf(camera.azimuth, camera.elevation);
  const height = seen.length ? round((union(seen).y1 - union(seen).y0) / lens.h) : 0, worst = seenRows.reduce((a, b) => (b.inFrame < a.inFrame ? b : a), seenRows[0]);
  const blockers = seenRows.flatMap((r) => r.blockers.map((b) => ({ ...b, of: r.name }))).sort((a, b) => b.share - a.share || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.of < b.of ? -1 : 1));
  const faults = rows.flatMap((r) => FAULTS.filter((q) => q.when(r)).map((q) => ({ kind: q.kind, on: r.name, fix: q.fix })));
  // Size is the whole subject's: twenty small things can fill a frame together.
  if (seenRows.some((r) => r.area && r.inFrame > 0) && height < TOO_SMALL) faults.push({ kind: 'too-small', on: names.length === 1 ? names[0] : null, fix: 'move closer or use a longer lens' });
  return { on: names, from: view.name, exactView: view.exact, depth: seenRows.length ? round(seenRows.reduce((m, r) => m + r.depth, 0) / seenRows.length) : null, unit: scene.unit, lens: lensWord(camera.focal),
    inFrame: worst ? worst.inFrame : 0, height, size: seenRows.some((r) => r.area) ? sizeWord(height) : null, blockers, blur: seenRows.reduce((m, r) => Math.max(m, r.blur), 0), rows, faults, ok: faults.length === 0 };
}

/**
 * What `camera` sees of what `shot` is on: frozen {on, from, exactView, depth, unit, lens, inFrame, height, size, blockers, blur, rows, faults, ok}.
 * `shot` is a read shot or just {on}. Throws, listing every problem at once.
 */
export const checkShot = (scene, camera, frame, shot) => deepFreeze(orRefuse(readAll((f) => {
  const s = sceneFrom(scene, f, 'scene'), c = cameraFrom(camera, f), size = frameFrom(frame, f);
  const on = shot !== null && typeof shot === 'object' && Object.hasOwn(shot, 'on') ? shot.on : undefined;
  const names = s && on !== undefined ? namesFrom(on, s, f, 'on') : on === undefined ? f.say('on', 'must name the thing the shot is on: pass a read shot or {on}') : null;
  return s && c && size && names && !f.problems.length ? reportOf(s, c, size, names) : null;
}), 'camera check'));
