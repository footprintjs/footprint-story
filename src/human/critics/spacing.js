/**
 * The `spacing` critic: how much a fall's or a throw's speed varies along the way (the coefficient of variation of the
 * speed between samples). Gravity spaces a falling thing's drawings wider and wider apart (slow at the top of a throw,
 * fast at the bottom); drawings evenly apart read as a thing slid along a line, not falling (the animators' "slow in
 * and slow out" and "timing", Thomas & Johnston 1981). Under the limit, it reads as linear.
 */
import { speedsOf } from './track.js';

/** The least variation of speed that reads as falling: 5%. Ours. */
export const SPACING_LEAST = 0.05;

export const spacing = Object.freeze({
  name: 'spacing',
  limit: SPACING_LEAST,
  measure(track) {
    const speeds = speedsOf(track.samples).map((s) => s.speed).filter((v) => v > 1e-6);
    if (speeds.length < 2) return null;   // nothing moves: there is no spacing to read
    const mean = speeds.reduce((s, v) => s + v, 0) / speeds.length;
    const value = Math.sqrt(speeds.reduce((s, v) => s + (v - mean) ** 2, 0) / speeds.length) / mean;
    return { value, basis: { mean, least: Math.min(...speeds), most: Math.max(...speeds), steps: speeds.length } };
  },
  finding(value, who) {
    if (!(value < SPACING_LEAST)) return null;
    return { level: 'warn', message: `${who}: its speed varies by only ${(value * 100).toFixed(1)}% along the way — its drawings sit evenly apart, so it reads as slid along a line, not falling`,
      fix: "use do: 'fall' or do: 'throw' (model: 'ballistic') so gravity spaces it, or a higher apex" };
  },
});
