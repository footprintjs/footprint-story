/**
 * A move checked by the critics its model names: each measures the sampled track, and says in words what is wrong
 * and the fix. WHY: "does this look human" is answered by a number and a sentence, never by looking at frames.
 *
 *   checkMove(move, {models, critics, rate})  → {measures: {critic: number | null}, bases: {critic: {…numbers} | null},
 *                                                (the track sampled at `rate`, or, left out, at the rate the move's own
 *                                                motion sets — models/resolve.js: no step over 30° or 16 px)
 *                                                findings: [{critic, level, message, fix, basis}]}
 *
 * A critic's measure gives a number, null (it cannot say), or {value, basis}: the number and the others it read on the
 * way (pen-speed: the free fit's exponent beside the error), a flat record that lands on the record as data.
 */
import { refuse, shown, stored, isRecord, finite } from '../read.js';
import { modelsWith } from '../models/registry.js';
import { sampleTrack } from '../models/move.js';
import { readFinding } from './registry.js';
import { plainCopy } from '../plain.js';

/** A critic's basis: a flat record of numbers, words or true/false, frozen; null when it gave none. */
function readBasis(basis, name) {
  if (basis === undefined || basis === null) return null;
  const copy = plainCopy(basis, `the critic "${name}"'s basis`);
  if (!isRecord(copy) || !Object.values(copy).every((v) => v === null || typeof v !== 'object')) refuse(`the critic "${name}"'s basis is a flat record of the numbers it read — not ${shown(basis)}`);
  return copy;
}

/** The move's checks run over its sampled track: the numbers, and a finding for each past its limit. Frozen. */
export function checkMove(move, settings = undefined) {
  const track = sampleTrack(move, settings);
  const models = modelsWith(isRecord(settings) ? stored(settings, 'models', "checkMove's models") : undefined, isRecord(settings) ? stored(settings, 'critics', "checkMove's critics") : undefined);
  const measures = {}, bases = {}, findings = [];
  for (const name of models.byName.get(move.model).checks) {
    const critic = models.critics.byName.get(name), got = critic.measure(track);
    const value = isRecord(got) ? got.value : got, basis = isRecord(got) ? readBasis(got.basis, name) : null;
    if (value !== null && !finite(value)) refuse(`the critic "${name}" measures a finite number, {value, basis}, or null when it cannot say — not ${shown(value)}`);
    measures[name] = value;
    bases[name] = basis;
    // a built-in critic that cannot say may still say why in a note (spin: a track too fast to read)
    const f = value === null ? (typeof critic.note === 'function' ? readFinding(critic.note(basis, track.who), name) : null) : readFinding(critic.finding(value, track.who, basis), name);
    if (f) findings.push(Object.freeze({ ...f, basis }));
  }
  return Object.freeze({ measures: Object.freeze(measures), bases: Object.freeze(bases), findings: Object.freeze(findings) });
}
