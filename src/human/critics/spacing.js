/**
 * The `spacing` critic: how much of its gravity a fall or a throw shows — the median of its vertical acceleration (the
 * second difference of y over time) over the gravity its plan names (GRAVITY when it names none). Gravity spaces a
 * falling thing's drawings wider and wider apart down the frame; drawings evenly apart read as a thing slid along a
 * line, not falling (the animators' "timing", Thomas & Johnston 1981). Under the limit, it reads as slid; over
 * SPACING_MOST, as thrown down.
 * WHY the vertical acceleration and not the variation of speed: a fast sideways throw keeps a near-even speed and still
 * falls exactly as it should; its vertical acceleration is its gravity whatever its speed across. WHY the median: a
 * landing is a spike of acceleration upward, and a bounce lands many times; the flights between are most of the track.
 */
import { basePlan } from '../models/wrap.js';
import { GRAVITY } from '../physics/step.js';
import { finite } from '../read.js';

/** The least share of its gravity a fall's drawings must show to read as falling: a half; and the most: twice — faster
 *  than that it reads as thrown down, not falling (a tool's own fall, or a track drawn by hand). Ours. */
export const SPACING_LEAST = 0.5;
export const SPACING_MOST = 2;

export const spacing = Object.freeze({
  name: 'spacing',
  limit: SPACING_LEAST,
  measure(track) {
    const s = track.samples, accel = [];
    for (let i = 1; i + 1 < s.length; i += 1) {
      const a = s[i - 1], b = s[i], c = s[i + 1];
      if (!(b.t > a.t && c.t > b.t)) continue;
      accel.push((2 * ((c.y - b.y) / (c.t - b.t) - (b.y - a.y) / (b.t - a.t))) / (c.t - a.t));
    }
    if (accel.length < 3) return null;   // too short a track to read an acceleration
    accel.sort((x, y) => x - y);
    const median = accel.length % 2 ? accel[(accel.length - 1) / 2] : (accel[accel.length / 2 - 1] + accel[accel.length / 2]) / 2;
    const named = track.plan ? basePlan(track.plan).gravity : undefined, gravity = finite(named) && named > 0 ? named : GRAVITY;
    return { value: median / gravity, basis: { acceleration: median, gravity, steps: accel.length } };
  },
  finding(value, who, basis) {
    if (value > SPACING_MOST) {
      return { level: 'warn', message: `${who}: its drawings fall at ${(value * 100).toFixed(0)}% of its gravity (${Math.round(basis.acceleration)} of ${Math.round(basis.gravity)} px/s²) — faster than twice its gravity, it reads as thrown down, not falling`,
        fix: "let gravity space it: do: 'fall' (model: 'ballistic'), or name the gravity it falls under (model: {name: 'ballistic', gravity: …})" };
    }
    if (!(value < SPACING_LEAST)) return null;
    return { level: 'warn', message: `${who}: its drawings fall at ${(value * 100).toFixed(0)}% of its gravity (${Math.round(basis.acceleration)} of ${Math.round(basis.gravity)} px/s²) — evenly spaced, it reads as slid along a line, not falling`,
      fix: "use do: 'fall' or do: 'throw' (model: 'ballistic') so gravity spaces it" };
  },
});
