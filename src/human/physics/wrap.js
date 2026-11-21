/**
 * Wrappers: the animation principles as a plan → a plan, over ANY model's plan (one with a `duration` and a sampler).
 *
 *   anticipate(plan, { share, by })        a small move opposite first: adds share × the inner's duration before it
 *   followThrough(plan, { share, by })     carries on past the end and swings back: adds share × the inner's duration after it
 *   hold(plan, { at, seconds })            stops at the inner's time `at` for `seconds`: adds `seconds`
 *   overshoot(plan, { by, share, feel })   arrives `by` px past the end, then settles back on a spring: adds settleTime(feel)
 *   sampleWrapped(plan, t, sampleInner)    a wrapped plan at t; `sampleInner(innerPlan, t)` is the model's own sample
 *
 * A wrapped plan is plain frozen data, the inner plan inside it unchanged:
 *
 *   { wrapper: 'anticipate' | 'follow-through' | 'hold' | 'overshoot', duration, inner, …the wrapper's numbers }
 *
 *   anticipate      { share, by }           by: px, or null for BY_SHARE of the move's straight distance
 *   follow-through  { share, by }
 *   hold            { at, seconds }
 *   overshoot       { share, by, feel, tail }   tail = settleTime(feel); share of the inner's end the rise is spread over
 *
 * Wrappers nest (at most MOST_WRAPPERS deep): the outermost is the last applied, so the plan records every wrapper in
 * order. Every wrapper keeps the inner's start (its sample at 0) and its end (its sample at its duration) exactly, and
 * every other field a sample gives (angle, sx, …) is the inner's; a wrapper moves x and y, and each of `points` alike.
 * WHY the directions are read when sampling, not when wrapping: a wrapper is handed only the plan (plain data), never
 * the model's code, so any model's plan wraps the same way — the direction of travel is two samples of the inner.
 */
import { finite, frozen, MOST_SECONDS, num, readKeys, refuse, shown, stored } from './read.js';
import { readSettleFeel, settleLeft, settleSeconds } from './settle.js';

/** A wrapper's usual `by`: this share of the straight distance from the inner's start to its end. */
export const BY_SHARE = 0.08;
/** The least travel (px) that shows a direction. WHY: a settled chain still moves by a millionth of a pixel, and a
 * direction read from that is noise — a wrapper would push it 5 px some arbitrary way. Under it, no direction. */
export const MIN_TRAVEL = 0.01;
export const MOST_WRAPPERS = 4;
export const WRAPPER_NAMES = Object.freeze(['anticipate', 'follow-through', 'hold', 'overshoot']);

const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** One swing out and back, 0 at both ends and 1 at its peak: sin(πu)·(1 − u), scaled by its own peak. */
const swing = (u) => Math.sin(Math.PI * u) * (1 - u);
const SWING_PEAK = (() => { let m = 0; for (let i = 1; i < 1000; i += 1) m = Math.max(m, swing(i / 1000)); return m; })();

export const isWrapped = (plan) => !!plan && typeof plan === 'object' && typeof plan.wrapper === 'string';

/** The plan the model made, under every wrapper. */
export function basePlan(plan) {
  let p = plan;
  for (let depth = 0; isWrapped(p); depth += 1) {
    if (depth >= MOST_WRAPPERS) refuse(`a plan holds at most ${MOST_WRAPPERS} wrappers — this one holds more (or holds itself)`);
    p = p.inner;
  }
  return p;
}

/** The plan being wrapped, checked: an object with a finite duration ≥ 0, at most MOST_WRAPPERS deep already. */
function readInner(plan, name) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) refuse(`${name} wraps a plan {duration, …} a model made — not ${shown(plan)}`);
  const base = basePlan(plan), who = typeof base?.who === 'string' ? base.who : 'the plan';
  const duration = stored(plan, 'duration', `${who}: its plan's duration`);
  if (!(finite(duration) && duration >= 0)) refuse(`${who}: ${name} wraps a plan with a duration (s, from 0) — not ${shown(duration)}`);
  let depth = 0;
  for (let p = plan; isWrapped(p); p = p.inner) depth += 1;   // bounded: basePlan above refused a deeper one
  if (depth >= MOST_WRAPPERS) refuse(`${who}: its plan has ${depth} wrappers already — at most ${MOST_WRAPPERS}: drop one`);
  return { who, duration };
}

const readBy = (v, who, name) => (v === undefined || v === null ? null : num(v, { who, key: `${name}'s by`, lo: 0, unit: ' px' }));

const wrapped = (wrapper, inner, duration, numbers) => frozen({ wrapper, duration, inner, ...numbers });

export function anticipate(plan, options = {}) {
  const { who, duration } = readInner(plan, 'anticipate'), get = readKeys(options, ['share', 'by'], who, "anticipate's options");
  const share = num(get('share'), { who, key: "anticipate's share", lo: 0, hi: 0.5, open: 'lo', fallback: 0.15, unit: ' (of the move\'s time)' });
  return wrapped('anticipate', plan, duration + share * duration, { share, by: readBy(get('by'), who, 'anticipate') });
}

export function followThrough(plan, options = {}) {
  const { who, duration } = readInner(plan, 'followThrough'), get = readKeys(options, ['share', 'by'], who, "followThrough's options");
  const share = num(get('share'), { who, key: "followThrough's share", lo: 0, hi: 1, open: 'lo', fallback: 0.25, unit: ' (of the move\'s time)' });
  return wrapped('follow-through', plan, duration + share * duration, { share, by: readBy(get('by'), who, 'followThrough') });
}

export function hold(plan, options) {
  const { who, duration } = readInner(plan, 'hold'), get = readKeys(options, ['at', 'seconds'], who, "hold's options");
  const at = num(get('at'), { who, key: "hold's at", lo: 0, hi: duration, unit: ' s (a time within the move)' });
  const seconds = num(get('seconds'), { who, key: "hold's seconds", lo: 0, hi: MOST_SECONDS, open: 'lo' });
  return wrapped('hold', plan, duration + seconds, { at, seconds });
}

export function overshoot(plan, options = {}) {
  const { who, duration } = readInner(plan, 'overshoot'), get = readKeys(options, ['by', 'share', 'feel'], who, "overshoot's options");
  const share = num(get('share'), { who, key: "overshoot's share", lo: 0, hi: 0.5, open: 'lo', fallback: 0.2, unit: ' (of the move\'s end the rise is spread over)' });
  const f = get('feel') ?? 'default';
  const okFeel = typeof f === 'string' || (f && typeof f === 'object' && !Array.isArray(f) && Object.keys(f).every((k) => k === 'k' || k === 'd') && finite(stored(f, 'k', `${who}: overshoot's feel.k`)) && finite(stored(f, 'd', `${who}: overshoot's feel.d`)) && f.k > 0 && f.d > 0);
  if (!okFeel) refuse(`${who}: overshoot's feel is a spring's name (snappy, default, heavy, playful) or {k, d} above 0 — not ${shown(f)}`);
  let feel;
  try { feel = readSettleFeel(f); } catch (e) { refuse(`${who}: overshoot's feel — ${e.message}`); }
  const tail = settleSeconds(feel);
  return wrapped('overshoot', plan, duration + tail, { share, by: readBy(get('by'), who, 'overshoot'), feel, tail });
}

/** The unit direction from a to b, or null when they are under MIN_TRAVEL apart (a hundredth of a pixel). */
function unit(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  return d >= MIN_TRAVEL ? [dx / d, dy / d] : null;
}

/** The sample moved by (ox, oy): x, y and every point; every other field as it was. */
function moved(s, ox, oy) {
  if (ox === 0 && oy === 0) return s;
  const out = { ...s, x: s.x + ox, y: s.y + oy };
  if (Array.isArray(s.points)) out.points = Object.freeze(s.points.map((p) => Object.freeze([p[0] + ox, p[1] + oy])));
  return Object.freeze(out);
}

/**
 * A wrapped plan at t. `sampleInner(plan, t)` samples the plan the model made (the model's own `sample`); a plan with
 * no wrapper is handed to it as it is. t is clamped to [0, duration]; at both ends the inner's own end is given.
 */
export function sampleWrapped(plan, t, sampleInner) {
  if (typeof sampleInner !== 'function') refuse(`sampleWrapped samples a plan with the model's own sample(plan, t) — not ${shown(sampleInner)}`);
  if (!isWrapped(plan)) return sampleInner(plan, t);
  const inner = plan.inner, d = inner.duration, at = (u) => sampleWrapped(inner, u, sampleInner);
  const u = t > 0 ? Math.min(t, plan.duration) : 0;
  if (u <= 0) return at(0);
  if (u >= plan.duration) return at(d);
  // the direction of travel at the start or the end (two samples of the inner), else start → end, else none
  const way = (end) => {
    const e = d / 100, a = end ? at(d - e) : at(0), b = end ? at(d) : at(e);
    return unit(a, b) ?? unit(at(0), at(d));
  };
  const amount = () => plan.by ?? BY_SHARE * Math.hypot(at(d).x - at(0).x, at(d).y - at(0).y);
  switch (plan.wrapper) {
    case 'hold': return u < plan.at ? at(u) : u < plan.at + plan.seconds ? at(plan.at) : at(u - plan.seconds);
    case 'anticipate': {
      // wind back opposite the first direction of travel, then release into the move over the same share of it
      const lead = plan.share * d, dir = way(false);
      const pull = u < lead ? smooth(u / lead) : 1 - smooth((u - lead) / lead);
      const s = at(Math.max(0, u - lead));
      return dir ? moved(s, -dir[0] * amount() * pull, -dir[1] * amount() * pull) : s;
    }
    case 'follow-through': {
      if (u <= d) return at(u);
      const dir = way(true), w = swing((u - d) / (plan.duration - d)) / SWING_PEAK, s = at(d);
      return dir ? moved(s, dir[0] * amount() * w, dir[1] * amount() * w) : s;
    }
    case 'overshoot': {
      // past the end over the inner's last `share`, then back on the spring (settle.js · settleLeft: exactly 0 at the end)
      const dir = way(true);
      const w = u <= d ? smooth((u - d * (1 - plan.share)) / (d * plan.share)) : settleLeft(u - d, plan.feel);
      const s = at(Math.min(u, d));
      return dir ? moved(s, dir[0] * amount() * w, dir[1] * amount() * w) : s;
    }
    default: return refuse(`a wrapped plan's wrapper is one of ${WRAPPER_NAMES.join(', ')} — not ${shown(plan.wrapper)}`);
  }
}

/** The wrappers as named strategies, for a registry: {name, options, wrap(plan, options) → plan}. */
export const PHYSICS_WRAPPERS = Object.freeze([
  Object.freeze({ name: 'anticipate', options: Object.freeze(['share', 'by']), wrap: anticipate }),
  Object.freeze({ name: 'follow-through', options: Object.freeze(['share', 'by']), wrap: followThrough }),
  Object.freeze({ name: 'hold', options: Object.freeze(['at', 'seconds']), wrap: hold }),
  Object.freeze({ name: 'overshoot', options: Object.freeze(['by', 'share', 'feel']), wrap: overshoot }),
]);
