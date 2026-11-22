/**
 * Wrappers: the animation principles as a move → a move, over ANY model's move (a reach, a throw, a hanging chain, a
 * tool's own), read by sampleMove like any other.
 *
 *   anticipate(move, { share, by })        a small move opposite first: adds share × the move's seconds before it
 *   followThrough(move, { share, by })     carries on past the end and swings back: adds share × its seconds after
 *   hold(move, { at, seconds })            stops at the move's time `at` for `seconds`: adds `seconds`
 *   overshoot(move, { by, share, feel })   arrives `by` px past the end, then settles back on a spring: adds settleTime(feel)
 *
 * A wrapped move is the move with its plan wrapped, its `reason` carrying the wrapper's words and `wrappers` naming
 * each, innermost first. The wrapped plan is plain frozen data, the inner plan inside it unchanged:
 *
 *   { wrapper: 'anticipate' | 'follow-through' | 'hold' | 'overshoot', seconds, inner, why, basis, …its numbers }
 *
 *   anticipate      { share, by }           by: px, or null for BY_SHARE of the move's straight distance
 *   follow-through  { share, by }
 *   hold            { at, seconds: the plan's }, basis.held: the hold's seconds
 *   overshoot       { share, by, feel, tail }   tail = settleTime(feel); `share` of the inner's end the rise is spread over
 *
 * Every wrapper keeps the inner's start (its sample at 0) and its end (at its seconds) exactly; every other field a
 * sample gives (angle, sx, …) is the inner's; a wrapper moves x and y, and each point of `points` alike.
 * A ROLL STAYS A ROLL: when the model's plan names `turnVector` [Tx, Ty] (its wheel's turn per px of travel, a roll's:
 * turn = T · travel), the turn follows the wrapped path wherever a sample rolls (not `air: 1`, not `rolls: 0`) — the
 * angle gains T · the wrapper's offset, the spin T · the offset's speed. So a wrapped roll, and a tumble that lands
 * into a roll after it lands, still turn distance / radius and roll-slip passes them; a slide's angle stays its own.
 * WHILE A WRAPPER HOLDS ITS MODEL STILL (an anticipation's wind-up, after the end, a hold) the model's own spin is
 * stopped and a sample in flight is marked `air: 0`: held by the hand, it is not falling.
 * The pushes a wrapped move is made of (wrappedPushes, what sampleTrack hands the `jerk` critic) add the speed bells
 * each wrapper makes (ADDED_BELLS: anticipate 2 — the pull back, and its release into the move; follow-through 2 — out
 * past the end, and back; overshoot 1 — back from past the end; a hold 1 — the move cut in two), and none when it makes
 * no motion: its amount (its `by`, or BY_SHARE of the move's distance) under MIN_TRAVEL, no direction of travel to push
 * along, or a hold where the move is still. WHY counted when sampled: a `by` left out is a share of the move's own
 * distance, which only the model's sample knows — so the count is the motion's, never a guess written on the plan.
 * WHY sampleMove reads a wrapped plan (move.js · sampleMove → sampleWrapped), not a wrapper model of its own: a
 * wrapper never plans from an intent, it reshapes a plan, and its inner plan must be sampled by its own model — which
 * only sampleMove can find, by name, a tool's own handed in again. A wrapper model would have to carry the registry.
 * WHY the directions are read when sampling: a wrapper holds only plain data, never the model's code.
 */
import { refuse, shown, stored, isRecord, finite, readNumber, onlyKeys, MOST_SECONDS } from '../read.js';
import { plainCopy } from '../plain.js';
import { checkSettles, settleLeft, settleSeconds } from '../physics/settle.js';
import { FEEL_NAMES } from '../../motion/spring.js';
import { round } from './options.js';

/** A wrapper's usual `by`: this share of the straight distance from the move's start to its end. */
export const BY_SHARE = 0.08;
/** The least travel (px) that shows a direction. WHY: a settled chain still moves by a millionth of a pixel, and a
 *  direction read from that is noise — a wrapper would push it some arbitrary way. Under it, no direction. */
export const MIN_TRAVEL = 0.01;
export const MOST_WRAPPERS = 4;
export const WRAPPER_NAMES = Object.freeze(['anticipate', 'follow-through', 'hold', 'overshoot']);
/** The speed bells each wrapper adds to a move, when it makes motion (wrappedPushes). */
export const ADDED_BELLS = Object.freeze({ anticipate: 2, 'follow-through': 2, overshoot: 1, hold: 1 });

const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** One swing out and back, 0 at both ends and 1 at its peak: sin(πu)·(1 − u), scaled by its own peak. */
const swing = (u) => Math.sin(Math.PI * u) * (1 - u);
const SWING_PEAK = (() => { let m = 0; for (let i = 1; i < 1000; i += 1) m = Math.max(m, swing(i / 1000)); return m; })();

export const isWrapped = (plan) => isRecord(plan) && typeof plan.wrapper === 'string';

/** The plan the model made, under every wrapper. */
export function basePlan(plan) {
  let p = plan;
  for (let depth = 0; isWrapped(p); depth += 1) {
    if (depth >= MOST_WRAPPERS) refuse(`a plan holds at most ${MOST_WRAPPERS} wrappers — this one holds more (or holds itself)`);
    p = p.inner;
  }
  return p;
}

/** The move being wrapped, checked: one planMove made (a plan with its seconds), at most MOST_WRAPPERS deep already. */
function readMove(move, name) {
  if (!isRecord(move) || typeof move.model !== 'string' || !isRecord(move.plan)) refuse(`${name} wraps a move planMove made — not ${shown(move)}`);
  const who = typeof move.who === 'string' ? move.who : 'the move', seconds = stored(move.plan, 'seconds', `${who}'s plan's seconds`);
  if (!(finite(seconds) && seconds >= 0)) refuse(`${who}: ${name} wraps a plan with its seconds (from 0) — not ${shown(seconds)}`);
  let depth = 0;
  for (let p = move.plan; isWrapped(p); p = p.inner) { depth += 1; if (depth > MOST_WRAPPERS) break; }
  if (depth >= MOST_WRAPPERS) refuse(`${who}: its move has ${depth} wrappers already — at most ${MOST_WRAPPERS}: drop one`);
  return { who, seconds };
}

const readOptions = (options, keys, who, name) => {
  if (options === undefined) options = {};
  if (!isRecord(options)) refuse(`${who}: ${name}'s options are {${keys.join(', ')}} — not ${shown(options)}`);
  onlyKeys(options, keys, `${who}: ${name}'s options`);
  return options;
};
const readBy = (o, who, name) => (stored(o, 'by', `${who}: ${name}'s by`) === undefined || o.by === null ? null : readNumber(o, 'by', `${who}: ${name}`, { lo: 0 }));
const byWords = (by) => (by === null ? `${BY_SHARE * 100}% of its distance` : `${round(by, 1)} px`);

/** The move with its plan wrapped: the reason says the wrapper, `wrappers` names each, innermost first. */
function wrapped(move, name, inner, seconds, numbers, why, basis) {
  if (!(seconds <= MOST_SECONDS)) refuse(`${move.who ?? 'the move'}: ${name} would make it ${round(seconds, 1)} s long — a move is at most ${MOST_SECONDS} s: a shorter hold, or fewer wrappers`);
  const plan = { wrapper: name, seconds, inner, ...numbers, why, basis: { ...basis, seconds, innerSeconds: inner.seconds } };
  const out = { ...move, plan, reason: `${move.reason}; then ${name}: ${why}`, wrappers: [...(move.wrappers ?? []), name] };
  return plainCopy(out, `${move.who ?? 'the move'}: ${name}`);
}

export function anticipate(move, options = undefined) {
  const { who, seconds: d } = readMove(move, 'anticipate'), o = readOptions(options, ['share', 'by'], who, 'anticipate');
  const share = readNumber(o, 'share', `${who}: anticipate`, { lo: 0, hi: 0.5, above: true, usual: 0.15 }), by = readBy(o, who, 'anticipate');
  return wrapped(move, 'anticipate', move.plan, d + share * d, { share, by }, `a pull back of ${byWords(by)} over ${round(share * d)} s, released into the move`, { share, by, added: share * d });
}

export function followThrough(move, options = undefined) {
  const { who, seconds: d } = readMove(move, 'followThrough'), o = readOptions(options, ['share', 'by'], who, 'followThrough');
  const share = readNumber(o, 'share', `${who}: followThrough`, { lo: 0, hi: 1, above: true, usual: 0.25 }), by = readBy(o, who, 'followThrough');
  return wrapped(move, 'follow-through', move.plan, d + share * d, { share, by }, `carries on ${byWords(by)} past the end and swings back over ${round(share * d)} s`, { share, by, added: share * d });
}

export function hold(move, options) {
  const { who, seconds: d } = readMove(move, 'hold'), o = readOptions(options, ['at', 'seconds'], who, 'hold');
  const at = readNumber(o, 'at', `${who}: hold`, { lo: 0, hi: d }), held = readNumber(o, 'seconds', `${who}: hold`, { lo: 0, hi: MOST_SECONDS, above: true });
  return wrapped(move, 'hold', move.plan, d + held, { at, held }, `still for ${round(held)} s at ${round(at)} s`, { at, held, added: held });
}

export function overshoot(move, options = undefined) {
  const { who, seconds: d } = readMove(move, 'overshoot'), o = readOptions(options, ['by', 'share', 'feel'], who, 'overshoot');
  const share = readNumber(o, 'share', `${who}: overshoot`, { lo: 0, hi: 0.5, above: true, usual: 0.2 }), by = readBy(o, who, 'overshoot');
  const f = stored(o, 'feel', `${who}: overshoot's feel`) ?? 'default';
  const own = isRecord(f) && Object.keys(f).every((k) => k === 'k' || k === 'd') && finite(stored(f, 'k', `${who}: overshoot's feel.k`)) && finite(stored(f, 'd', `${who}: overshoot's feel.d`)) && f.k > 0 && f.d > 0;
  if (!(FEEL_NAMES.includes(f) || own)) refuse(`${who}: overshoot's feel is a spring's name (${FEEL_NAMES.join(', ')}) or {k, d} above 0 — not ${shown(f)}`);
  const feel = own ? { k: f.k, d: f.d } : f;
  checkSettles(feel, `${who}: overshoot's feel`);
  const tail = settleSeconds(feel);
  return wrapped(move, 'overshoot', move.plan, d + tail, { share, by, feel, tail }, `arrives ${byWords(by)} past the end and settles back over ${round(tail)} s`, { share, by, added: tail });
}

/** The unit direction from a to b, or null when they are under MIN_TRAVEL apart. */
function unit(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  return d >= MIN_TRAVEL ? [dx / d, dy / d] : null;
}

/** The turn per px of travel a rolling plan names (`turnVector`, under every wrapper), or null: a wrapper turns what it moves. */
function turnOf(plan) {
  const T = basePlan(plan).turnVector;
  return Array.isArray(T) && T.length === 2 && finite(T[0]) && finite(T[1]) ? T : null;
}

/** The step a weight's speed is read over (s): its rate by a central difference. */
const RATE_STEP = 1e-6;
const rateOf = (weight, u) => (weight(u + RATE_STEP) - weight(u - RATE_STEP)) / (2 * RATE_STEP);

/**
 * A sample whose model is held still by a wrapper (before an anticipation's release, after the end, in a hold): its own
 * spin stopped, and not in flight — a thing held by the hand is not falling, so spacing and spin read no flight there.
 */
function held(s) {
  const out = { ...s };
  if (finite(s.spin)) out.spin = 0;
  if (s.air === 1) out.air = 0;
  return out;
}

/**
 * When a plan's samples start to roll, in its own time: its model's `turnFrom` (a tumble's landing; 0 for a roll),
 * carried through each wrapper's shift of time (an anticipation's lead; a hold before it).
 */
function rollStart(plan) {
  if (!isWrapped(plan)) return finite(plan.turnFrom) ? plan.turnFrom : 0;
  const r = rollStart(plan.inner);
  if (plan.wrapper === 'anticipate') return r > 0 ? r + plan.share * plan.inner.seconds : 0;
  if (plan.wrapper === 'hold') return r < plan.at ? r : r + plan.held;
  return r;
}

/** Whether a wrapper turns this sample as it moves it: its plan names a turn vector and the sample rolls (not in the air, not sliding). */
const turns = (T, s) => T !== null && finite(s.angle) && s.air !== 1 && s.rolls !== 0;

/**
 * The sample moved by `dir` × `amount` × weight(u): x, y and every point; and, for a rolling sample (turn vector T), its
 * angle turned by T · the offset gained since it began to roll (at the wrapped time `from`: so a tumble's angle runs on
 * unbroken from its landing) and its spin by T · the offset's speed. `still`: its model is held at one of its ends
 * (held). Every other field as it was.
 */
function moved(s0, dir, amount, weight, u, T, still, from = 0) {
  const s = still ? held(s0) : s0, w = weight(u), ox = dir[0] * amount * w, oy = dir[1] * amount * w;
  const out = ox === 0 && oy === 0 ? { ...s } : { ...s, x: s.x + ox, y: s.y + oy };
  if (Array.isArray(s.points) && (ox !== 0 || oy !== 0)) out.points = s.points.map((p) => [p[0] + ox, p[1] + oy]);
  if (turns(T, s)) {
    const w0 = weight(from), gained = amount * (w - w0);
    out.angle = s.angle + (T[0] * dir[0] + T[1] * dir[1]) * gained;
    if (finite(s.spin)) out.spin = s.spin + (T[0] * dir[0] + T[1] * dir[1]) * amount * rateOf(weight, u);
  }
  return out;
}

/** The direction of travel at the start or the end of a plan sampled by `at` over `d` s (two samples), else its start
 *  → its end, else none. */
const wayOf = (at, d, end) => unit(end ? at(d - d / 100) : at(0), end ? at(d) : at(d / 100)) ?? unit(at(0), at(d));
/** How far a wrapper moves the inner: its `by`, or BY_SHARE of the inner's straight distance. */
const amountOf = (plan, at, d) => plan.by ?? BY_SHARE * Math.hypot(at(d).x - at(0).x, at(d).y - at(0).y);

/**
 * The pushes a (wrapped) plan is made of: its model's own (`pushes`, 1 when it names none), and the bells each wrapper
 * adds when it makes motion — its amount at least MIN_TRAVEL along a direction there is (a hold: where the move is not
 * still). sampleTrack hands this to the critics.
 */
export function wrappedPushes(plan, sampleInner) {
  if (!isWrapped(plan)) return plan.pushes ?? 1;
  const inner = plan.inner, d = inner.seconds, at = (u) => sampleWrapped(inner, u, sampleInner), below = wrappedPushes(inner, sampleInner);
  if (plan.wrapper === 'hold') {
    const e = d / 100, moving = plan.at > 0 && plan.at < d && unit(at(Math.max(0, plan.at - e)), at(Math.min(d, plan.at + e))) !== null;
    return below + (moving ? ADDED_BELLS.hold : 0);
  }
  const moves = wayOf(at, d, plan.wrapper !== 'anticipate') !== null && amountOf(plan, at, d) >= MIN_TRAVEL;
  return below + (moves ? ADDED_BELLS[plan.wrapper] : 0);
}

/**
 * A wrapped plan at t, its innermost plan sampled by `sampleInner` (the model's own sample). t is clamped to
 * [0, seconds]; at both ends the inner's own end is given. sampleMove calls it for a wrapped plan.
 */
export function sampleWrapped(plan, t, sampleInner) {
  if (!isWrapped(plan)) return sampleInner(plan, t);
  const inner = plan.inner, d = inner.seconds, at = (u) => sampleWrapped(inner, u, sampleInner);
  const u = t > 0 ? Math.min(t, plan.seconds) : 0;
  if (u <= 0) return at(0);
  if (u >= plan.seconds) return at(d);
  const way = (end) => wayOf(at, d, end), amount = () => amountOf(plan, at, d), T = turnOf(inner);
  switch (plan.wrapper) {
    case 'hold': {
      if (u < plan.at) return at(u);
      if (u >= plan.at + plan.held) return at(u - plan.held);
      return held(at(plan.at));
    }
    case 'anticipate': {
      // wind back opposite the first direction of travel, then release into the move over the same share of it
      const lead = plan.share * d, dir = way(false), s = at(Math.max(0, u - lead));
      const pull = (v) => (v < lead ? smooth(v / lead) : 1 - smooth((v - lead) / lead));
      const r = rollStart(inner), from = r > 0 ? r + lead : 0;
      return dir ? moved(s, [-dir[0], -dir[1]], amount(), pull, u, T, u < lead, from) : s;
    }
    case 'follow-through': {
      if (u <= d) return at(u);
      const dir = way(true), s = at(d), w = (v) => swing(Math.max(0, (v - d) / (plan.seconds - d))) / SWING_PEAK;
      return dir ? moved(s, dir, amount(), w, u, T, true, rollStart(inner)) : s;
    }
    case 'overshoot': {
      // past the end over the inner's last `share`, then back on the spring (physics/settle.js · settleLeft: exactly 0 at the end)
      const dir = way(true), s = at(Math.min(u, d)), w = (v) => (v <= d ? smooth((v - d * (1 - plan.share)) / (d * plan.share)) : settleLeft(v - d, plan.feel));
      return dir ? moved(s, dir, amount(), w, u, T, u > d, rollStart(inner)) : s;
    }
    default: return refuse(`a wrapped plan's wrapper is one of ${WRAPPER_NAMES.join(', ')} — not ${shown(plan.wrapper)}`);
  }
}
