/**
 * A move checked by the critics its model names: each measures the sampled track, and says in words what is wrong
 * and the fix. WHY: "does this look human" is answered by a number and a sentence, never by looking at frames.
 *
 *   checkMove(move, {models, critics, rate})  → {measures: {critic: number | null}, findings: [{critic, level, message, fix}]}
 */
import { refuse, shown, stored, isRecord, finite } from '../read.js';
import { modelsWith } from '../models/registry.js';
import { sampleTrack } from '../models/move.js';
import { readFinding } from './registry.js';

/** The move's checks run over its sampled track: the numbers, and a finding for each past its limit. Frozen. */
export function checkMove(move, settings = undefined) {
  const track = sampleTrack(move, settings);
  const models = modelsWith(isRecord(settings) ? stored(settings, 'models', "checkMove's models") : undefined, isRecord(settings) ? stored(settings, 'critics', "checkMove's critics") : undefined);
  const measures = {}, findings = [];
  for (const name of models.byName.get(move.model).checks) {
    const critic = models.critics.byName.get(name), value = critic.measure(track);
    if (value !== null && !finite(value)) refuse(`the critic "${name}" measures a finite number, or null when it cannot say — not ${shown(value)}`);
    measures[name] = value;
    const f = value === null ? null : readFinding(critic.finding(value, track.who), name);
    if (f) findings.push(f);
  }
  return Object.freeze({ measures: Object.freeze(measures), findings: Object.freeze(findings) });
}
