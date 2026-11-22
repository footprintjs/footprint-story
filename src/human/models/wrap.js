/**
 * Wrappers: the animation principles as a move → a move, over ANY model's move (a reach, a throw, a hanging chain, a
 * tool's own), read by sampleMove like any other.
 *
 *   anticipate(move, { share, by })        a small move opposite first: adds share × the part it winds up for before it
 *                                          (the move's seconds, or its model's `opening`: a tumble's flight)
 *   followThrough(move, { share, by })     carries on past the end and swings back: adds share × its seconds after;
 *                                          it leaves the end at the speed the move arrives with (further than `by`
 *                                          when that speed alone carries it further), and ends still
 *   hold(move, { at, seconds })            stops at the move's time `at` for `seconds`: adds `seconds`
 *   overshoot(move, { by, share, feel })   arrives `by` px past the end, then settles back on a spring that also carries
 *                                          the speed the move arrives with: adds settleTime(feel)
 *
 * A wrapped move is the move with its plan wrapped, its `reason` carrying the wrapper's words and `wrappers` naming
 * each, innermost first. The wrapped plan is plain frozen data, the inner plan inside it unchanged:
 *
 *   { wrapper: 'anticipate' | 'follow-through' | 'hold' | 'overshoot', seconds, inner, why, basis, …its numbers }
 *
 *   anticipate      { share, by, lead }     by: px, or null for BY_SHARE of the move's straight distance; lead: its seconds
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
 * A WRAPPER RESPECTS ITS PLAN'S WORLD (the floor and boxes its model's plan names, with its radius): each offset is
 * cut back along itself to where the body first touches one (keptShare), so a wind-up, a follow-through or an
 * overshoot never drives it into the floor or a box. A chain's points move with its middle.
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
import { checkSettles, settleCarry, settleLeft, settleSeconds } from '../physics/settle.js';
import { FEEL_NAMES } from '../../motion/spring.js';
import { round } from './options.js';
import { readWorld, touchAlong } from '../physics/collide.js';

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
/** The peak of a shape on (0, 1), read at a thousand points. */
const peakOf = (f) => { let m = 0; for (let i = 1; i < 1000; i += 1) m = Math.max(m, f(i / 1000)); return m; };
/** One swing out and back from rest, 0 at both ends and still at both, with no push at its start: sin³(πu)·(1 − u). */
const swing = (u) => Math.sin(Math.PI * u) ** 3 * (1 - u);
const SWING_PEAK = peakOf(swing);
/** A carry out and back that starts at speed 1 (per unit of u) with no push or brake (no acceleration) and ends still:
 *  u − 3u³ + 2u⁴ = u·(1 − u)²·(1 + 2u). WHY no acceleration at the start: a carry that brakes at once loses a fifth of
 *  its speed in its first frame, which reads as a jolt at the hand-over. */
const carryOn = (u) => u - 3 * u ** 3 + 2 * u ** 4;
const CARRY_PEAK = peakOf(carryOn);

/**
 * The speed the inner move arrives with, along `dir` (px a second, at least 0), read over its last instant. WHY: a
 * wrapper that carries on past the end must start at that speed — a jump in speed there is a kink the eye sees (and
 * the spin critic, on a roll).
 */
function arrivalSpeed(at, d, dir) {
  if (!(d > 0)) return 0;
  const e = Math.min(1e-3, d / 1000), a = at(d - e), b = at(d);
  return Math.max(0, ((b.x - a.x) * dir[0] + (b.y - a.y) * dir[1]) / e);
}

/**
 * A follow-through's offset at x (0 to 1 over its time `span`), in px: out and back, starting at the speed `speed` it
 * arrives with, unpushed, and ending still. A share λ = speed·span·CARRY_PEAK / by of it is the carry (carryOn), the rest
 * the swing from rest (swing), so it leaves at exactly `speed` and reaches about `by`; when the speed alone carries it further than
 * `by` (λ > 1), it is all carry — a move that arrives fast follows through further than asked, never stops dead.
 */
function followOffset(x, by, speed, span) {
  const u = Math.min(1, Math.max(0, x)), carried = speed * span * CARRY_PEAK, share = by > 0 ? carried / by : Infinity;
  if (share >= 1) return speed * span * carryOn(u);
  return by * ((1 - share) * (swing(u) / SWING_PEAK) + share * (carryOn(u) / CARRY_PEAK));
}

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

/**
 * The seconds an anticipation winds up for: the move's seconds, unless its model names an `opening` — a tumble's
 * flight, not the roll after it lands, so its wind-up is sized by the throw. That opening is carried through the
 * wrappers inside: an anticipation's lead comes before it, a hold inside it lengthens it, a follow-through or an
 * overshoot (after the end) leaves it.
 */
function openingOf(plan) {
  const base = basePlan(plan);
  if (!(finite(base.opening) && base.opening > 0 && base.opening <= base.seconds)) return plan.seconds;
  const carry = (p) => {
    if (!isWrapped(p)) return p.opening;
    const o = carry(p.inner);
    if (p.wrapper === 'anticipate') return p.lead + o;
    if (p.wrapper === 'hold') return p.at < o ? o + p.held : o;
    return o;
  };
  return carry(plan);
}

export function anticipate(move, options = undefined) {
  const { who, seconds: d } = readMove(move, 'anticipate'), o = readOptions(options, ['share', 'by'], who, 'anticipate');
  const share = readNumber(o, 'share', `${who}: anticipate`, { lo: 0, hi: 0.5, above: true, usual: 0.15 }), by = readBy(o, who, 'anticipate');
  const opening = openingOf(move.plan), lead = share * opening, of = opening < d ? ` (a share of its ${round(opening)} s opening)` : '';
  return wrapped(move, 'anticipate', move.plan, d + lead, { share, by, lead }, `a pull back of ${byWords(by)} over ${round(lead)} s${of}, released into the move`, { share, by, added: lead, opening });
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
  if (plan.wrapper === 'anticipate') return r > 0 ? r + plan.lead : 0;
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
function moved(s0, dir, amount, weight, u, { T, still = false, from = 0, at = null, shift = 0, world = null, radius = 0 }) {
  const s = still ? held(s0) : s0, w = weight(u), k = keptShare(s, dir, amount * w, world, radius), ox = dir[0] * amount * w * k, oy = dir[1] * amount * w * k;
  const out = ox === 0 && oy === 0 ? { ...s } : { ...s, x: s.x + ox, y: s.y + oy };
  if (Array.isArray(s.points) && (ox !== 0 || oy !== 0)) out.points = s.points.map((p) => [p[0] + ox, p[1] + oy]);
  if (turns(T, s)) {
    // the offset gained since it began to roll, each end cut as it was drawn, so the angle runs on unbroken
    const w0 = weight(from), k0 = w0 === 0 || !at ? 1 : keptShare(at(Math.max(0, from - shift)), dir, amount * w0, world, radius);
    const along = T[0] * dir[0] + T[1] * dir[1];
    out.angle = s.angle + along * amount * (w * k - w0 * k0);
    if (finite(s.spin)) out.spin = s.spin + along * amount * k * rateOf(weight, u);
  }
  return out;
}

/** The world a plan names (its model's, under every wrapper) and its body's radius: {world, radius}, or no world. */
function worldOf(plan, who) {
  const base = basePlan(plan);
  if (!isRecord(base.world)) return { world: null, radius: 0 };
  return { world: readWorld(base.world, `${who}: its plan's world`), radius: finite(base.radius) && base.radius > 0 ? base.radius : 0 };
}

/**
 * How much of an offset `length` px along `dir` a sample keeps, 0 to 1: THE WORLD RULE — a wrapper's offset is cut back
 * along itself to where the body (its middle, `radius` wide) first touches the floor or a box of its plan's world, never
 * turned aside. A body already in something keeps the whole offset (the contact critic says so); a world-less plan too.
 * WHY cut, not turned: a turned wind-up would pull a different way than the move it winds up for.
 */
function keptShare(s, dir, length, world, radius) {
  if (!world || !(Math.abs(length) > 0)) return 1;
  const way = length > 0 ? dir : [-dir[0], -dir[1]], size = Math.abs(length);
  let room = Infinity;
  const box = touchAlong([s.x, s.y], way, world, radius);
  if (box.inside === null) room = box.distance;
  if (world.floor !== null && way[1] > 0 && s.y + radius <= world.floor) room = Math.min(room, (world.floor - radius - s.y) / way[1]);
  return Math.min(1, room / size);
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
  // a wrapper that holds its model still from the start (a wind-up, a hold at 0) holds its first sample too
  if (u <= 0) return plan.wrapper === 'anticipate' || (plan.wrapper === 'hold' && plan.at === 0) ? held(at(0)) : at(0);
  // after a follow-through or an overshoot its model has been held at its end: the end sample is held too
  if (u >= plan.seconds) return plan.wrapper === 'follow-through' || plan.wrapper === 'overshoot' ? held(at(d)) : at(d);
  const way = (end) => wayOf(at, d, end), amount = () => amountOf(plan, at, d), T = turnOf(inner), { world, radius } = worldOf(inner, 'the move');
  switch (plan.wrapper) {
    case 'hold': {
      if (u < plan.at) return at(u);
      if (u >= plan.at + plan.held) return at(u - plan.held);
      return held(at(plan.at));
    }
    case 'anticipate': {
      // wind back opposite the first direction of travel, then release into the move over the same share of it
      const lead = plan.lead, dir = way(false), s = at(Math.max(0, u - lead));
      const pull = (v) => (v < lead ? smooth(v / lead) : 1 - smooth((v - lead) / lead));
      const r = rollStart(inner), from = r > 0 ? r + lead : 0;
      return dir ? moved(s, [-dir[0], -dir[1]], amount(), pull, u, { T, still: u < lead, from, at, shift: lead, world, radius }) : s;
    }
    case 'follow-through': {
      if (u <= d) return at(u);
      const dir = way(true), s = at(d);
      if (!dir) return s;
      const span = plan.seconds - d, speed = arrivalSpeed(at, d, dir), by = amount(), px = (v) => followOffset((v - d) / span, by, speed, span);
      return moved(s, dir, 1, px, u, { T, still: true, from: rollStart(inner), at, world, radius });
    }
    case 'overshoot': {
      // past the end over the inner's last `share`, then back on the spring (physics/settle.js · settleLeft: exactly 0 at the end)
      // past it, the spring also carries the speed the move arrives with (settleCarry), so it never stops dead at the end
      const dir = way(true), s = at(Math.min(u, d));
      if (!dir) return s;
      const by = amount(), speed = u > d ? arrivalSpeed(at, d, dir) : 0;
      const px = (v) => (v <= d ? by * smooth((v - d * (1 - plan.share)) / (d * plan.share)) : by * settleLeft(v - d, plan.feel) + speed * settleCarry(v - d, plan.feel));
      return moved(s, dir, 1, px, u, { T, still: u > d, from: rollStart(inner), at, world, radius });
    }
    default: return refuse(`a wrapped plan's wrapper is one of ${WRAPPER_NAMES.join(', ')} — not ${shown(plan.wrapper)}`);
  }
}
