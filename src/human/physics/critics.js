/**
 * Critics: each measures one thing on a sampled track and says, in words, what still looks wrong and the fix in the
 * intent's own keys (docs/design/2026-11-human-motion.md · "A critic").
 *
 *   { name, limit, measure(track) → number, finding(value, who) → { level, message, fix } | null }
 *
 *   spacing   how much the speed varies along a fall or a throw (its coefficient of variation). Under SPACING_LIMIT
 *             the drawings sit evenly apart: it reads as linear, not falling.
 *   volume    the largest change of area (sx · sy − 1) a squash or a stretch makes. Over VOLUME_LIMIT it reads as rubber.
 *   contact   how deep (px) a body goes into the floor or a box. Over CONTACT_LIMIT it passes through what it should not.
 *
 * A track is plain data: `{ who, samples: [{ t, x, y, sx?, sy?, points? }], world: { floor, boxes }, radius }`, the
 * times rising. `trackOf(plan, sample, { rate })` makes one from a plan, at `rate` samples a second, the end included.
 * `finding` gives null when the value is within the limit — a critic that has nothing to say says nothing.
 * WHY the fix names the intent's keys: whoever wrote the entry (a person or a model) fixes it in one edit, without
 * looking at a frame.
 */
import { basePlan, sampleWrapped } from './wrap.js';
import { depthIn } from './collide.js';
import { finite, frozen, num, refuse, shown, stored } from './read.js';

export const SPACING_LIMIT = 0.05;
export const VOLUME_LIMIT = 0.1;
export const CONTACT_LIMIT = 0.5;
/** The most samples a track holds: 30 s at 240 a second. */
export const MOST_SAMPLES = 7200;

const pct = (v) => `${Math.round(v * 100)}%`;
const px = (v) => `${Math.round(v * 10) / 10} px`;

/** A track, checked: samples with rising times and finite places; the world and the radius as a plan gives them. */
function readTrack(track, name) {
  if (!track || typeof track !== 'object' || Array.isArray(track)) refuse(`the ${name} critic measures a track {who, samples, world, radius} (trackOf(plan, sample)) — not ${shown(track)}`);
  const who = typeof stored(track, 'who', 'the track\'s who') === 'string' ? track.who : 'the track';
  const samples = stored(track, 'samples', `${who}: its track's samples`);
  if (!Array.isArray(samples) || samples.length > MOST_SAMPLES) refuse(`${who}: its track's samples are a list of at most ${MOST_SAMPLES} {t, x, y} — not ${shown(samples)}`);
  let last = -Infinity;
  samples.forEach((s, i) => {
    const t = s && stored(s, 't', `${who}: its samples[${i}].t`), x = s && stored(s, 'x', `${who}: its samples[${i}].x`), y = s && stored(s, 'y', `${who}: its samples[${i}].y`);
    if (!(finite(t) && finite(x) && finite(y) && t > last)) refuse(`${who}: its samples[${i}] is {t, x, y}, finite, each t after the one before — not ${shown([t, x, y])}`);
    last = t;
  });
  return { who, samples };
}

/** The coefficient of variation of the speed between samples (0: perfectly even); 1 when it hardly moves. */
function measureSpacing(track) {
  const { samples } = readTrack(track, 'spacing');
  const speeds = [];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1], b = samples[i], v = Math.hypot(b.x - a.x, b.y - a.y) / (b.t - a.t);
    if (v > 1e-6) speeds.push(v);
  }
  if (speeds.length < 2) return 1;   // nothing moves: nothing reads as linear
  const mean = speeds.reduce((s, v) => s + v, 0) / speeds.length;
  return Math.sqrt(speeds.reduce((s, v) => s + (v - mean) ** 2, 0) / speeds.length) / mean;
}

function measureVolume(track) {
  const { who, samples } = readTrack(track, 'volume');
  let most = 0;
  samples.forEach((s, i) => {
    const sx = stored(s, 'sx', `${who}: its samples[${i}].sx`) ?? 1, sy = stored(s, 'sy', `${who}: its samples[${i}].sy`) ?? 1;
    if (!(finite(sx) && finite(sy) && sx > 0 && sy > 0)) refuse(`${who}: its samples[${i}]'s sx and sy are scales above 0 — not ${shown([sx, sy])}`);
    most = Math.max(most, Math.abs(sx * sy - 1));
  });
  return most;
}

function measureContact(track) {
  const { who, samples } = readTrack(track, 'contact');
  const world = stored(track, 'world', `${who}: its track's world`) ?? { floor: null, boxes: [] };
  const radius = num(stored(track, 'radius', `${who}: its track's radius`), { who, key: 'radius', lo: 0, fallback: 0, unit: ' px' });
  if (!world || typeof world !== 'object' || !Array.isArray(world.boxes) || !(world.floor === null || finite(world.floor))) refuse(`${who}: its track's world is {floor, boxes}, as a plan gives it — not ${shown(world)}`);
  let deepest = 0;
  for (const s of samples) {
    deepest = Math.max(deepest, depthIn(s.x, s.y, world, radius));
    if (Array.isArray(s.points)) for (const p of s.points) deepest = Math.max(deepest, depthIn(p[0], p[1], world, 0));
  }
  return deepest;
}

export const spacing = Object.freeze({
  name: 'spacing', limit: SPACING_LIMIT, measure: measureSpacing,
  finding: (value, who) => (value >= SPACING_LIMIT ? null : Object.freeze({ level: 'warn',
    message: `${who}: its speed varies by only ${pct(value)} along the way — the drawings sit evenly apart, so it reads as linear, not falling`,
    fix: "use do: 'fall' or do: 'throw' so gravity spaces it (slow at the top, fast at the bottom), or give a higher apex" })),
});

export const volume = Object.freeze({
  name: 'volume', limit: VOLUME_LIMIT, measure: measureVolume,
  finding: (value, who) => (value <= VOLUME_LIMIT ? null : Object.freeze({ level: 'warn',
    message: `${who}: its squash changes its area by ${pct(value)} — it reads as rubber, not as a body with mass`,
    fix: 'keep its area: sy = 1 / sx when it squashes (the bounce model\'s squash does), or a smaller squash' })),
});

export const contact = Object.freeze({
  name: 'contact', limit: CONTACT_LIMIT, measure: measureContact,
  finding: (value, who) => (value <= CONTACT_LIMIT ? null : Object.freeze({ level: 'error',
    message: `${who}: it goes ${px(value)} into the floor or a box — it passes through something solid`,
    fix: 'give what it meets in the intent (floor: <y>, boxes: [...]) so it lands or bounces there, or raise its path (apex: a larger number, or to: above the box)' })),
});

/** Every critic this package ships, for a registry. */
export const PHYSICS_CRITICS = Object.freeze([spacing, volume, contact]);

/**
 * A plan's track: samples every 1/rate s from 0, its end included, through `sample` (the model's own, or for a
 * wrapped plan sampleWrapped over it); the world and radius of the plan the model made. Plain frozen data.
 */
export function trackOf(plan, sample, { rate = 60 } = {}) {
  const base = basePlan(plan), who = typeof base?.who === 'string' ? base.who : 'the plan';
  if (typeof sample !== 'function') refuse(`${who}: trackOf samples a plan with its model's sample(plan, t) — not ${shown(sample)}`);
  num(rate, { who, key: "trackOf's rate", lo: 1, hi: 240, unit: ' samples a second' });
  const duration = plan?.duration;
  if (!(finite(duration) && duration >= 0 && duration * rate < MOST_SAMPLES)) refuse(`${who}: trackOf takes a plan with a duration (s) of at most ${MOST_SAMPLES} samples at rate ${rate} — not ${shown(duration)}`);
  const n = Math.ceil(duration * rate - 1e-9), samples = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i === n ? duration : i / rate;
    if (i > 0 && !(t > samples[samples.length - 1].t)) continue;
    samples.push({ t, ...sampleWrapped(plan, t, sample) });
  }
  return frozen({ who, samples, world: base.world ?? { floor: null, boxes: [] }, radius: base.radius ?? 0 });
}
