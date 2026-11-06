// narrate — the one narration step a film and a deck share: what each line needs, the voicing of what is missing, and what
// to say about it. Each tool says what its lines are; this owns the rest. Nothing here decides where a voice kit is: it runs
// Python on this machine, so its folder comes from the person running the command, never from a deck's or a film's files.
import { lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { clipFor, pickSteps, refuseCrossedVoices, voiceClips } from './cache.js';
import { chatterboxKit, KIT_PROFILE } from './chatterbox.js';
import { recordedTakes } from './recorded.js';

const MOST_LISTED = 10;
/** Beside the clips: the settings the last voice used, so asking later, with no voice named, finds them. */
const RECIPE = 'recipe.json';

/** What makes a clip's key (key.js), and nothing else a profile holds: its description, consent or reference recording. */
const recipeOf = ({ id, engine, exaggeration, cfgWeight, seed, sentenceGapSeconds, takes }) => ({ id, engine, exaggeration, cfgWeight, seed, sentenceGapSeconds, takes });

const parsed = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

/** The kit's own voice settings. */
function kitProfile(kit) {
  const file = path.join(path.resolve(kit), KIT_PROFILE), profile = parsed(file);
  if (typeof profile?.id !== 'string') throw new Error(`no voice settings at ${file}: a voice kit keeps them there, with an "id" for the voice`);
  return recipeOf(profile);
}

/** The settings kept beside these clips, or null. A cache may have come with someone's folder: a link is never read, and only the key's fields are taken. */
function keptRecipe(cache) {
  const file = path.join(path.resolve(cache), RECIPE);
  if (!lstatSync(file, { throwIfNoEntry: false })?.isFile()) return null;
  const recipe = parsed(file);
  return typeof recipe?.id === 'string' ? recipeOf(recipe) : null;
}

function keepRecipe(cache, profile) {
  const file = path.join(path.resolve(cache), RECIPE);
  mkdirSync(path.dirname(file), { recursive: true });
  rmSync(file, { force: true });   // a new file: nothing at its name, a link included, is written through, even one planted after the rm
  writeFileSync(file, `${JSON.stringify(recipeOf(profile))}\n`, { flag: 'wx' });
}

/**
 * The voice a person named, and the settings its clips are kept under: {engine, profile}. A kit's own voice, or their
 * recordings lined up by the kit's Python; with neither, no engine and the settings last used here, so what was voiced is
 * still found. `kit` runs Python on this machine: take it only from the person's command or a server's start, never from a
 * project's files.
 */
export function narrationVoice({ cache, kit, takes, log } = {}) {
  if (takes && !kit) throw new TypeError('recordings need the voice kit too, whose Python lines them up: name both, the kit and the recordings\' folder');
  if (takes) { const engine = recordedTakes({ kit, takes, log }); return { engine, profile: engine.profile }; }
  if (kit) return { engine: chatterboxKit({ kit }), profile: kitProfile(kit) };
  return { engine: null, profile: keptRecipe(cache) ?? { id: 'default' } };
}

/** Each line's state: lines [{id, text}] ('' says nothing) → {lines: [{n, id, text, state, seconds, clip}], voiced, toVoice, silent, seconds}. */
export function narrationState(lines, { cache, profile }) {
  const read = lines.map(({ id, text }, i) => {
    if (!text) return { n: i + 1, id, text: '', state: 'silent', seconds: 0, clip: null };
    const clip = clipFor(text, { cache, profile });
    return { n: i + 1, id, text, state: clip ? 'voiced' : 'to voice', seconds: clip?.duration ?? 0, clip };
  });
  const count = (state) => read.filter((l) => l.state === state).length;
  return { lines: read, voiced: count('voiced'), toVoice: count('to voice'), silent: count('silent'), seconds: +read.reduce((sum, l) => sum + l.seconds, 0).toFixed(1) };
}

/**
 * The narration of these lines: voices what is missing when given an engine (`only`: "1-3,7", by line number), and with none
 * only reads what is there, so it can be asked at any time for nothing. {…narrationState, ran: clips voiced by this call}.
 */
export async function narrate(lines, { cache, profile, engine = null, only, batch, work, log }) {
  let ran = 0;
  if (engine) {
    const steps = pickSteps(only);   // what can be refused is refused before anything is kept
    refuseCrossedVoices(engine, profile);
    // kept once a clip of this voice stands: an interrupted run's batches are found, and a voice that fails first hides nothing voiced before it
    const keep = () => keepRecipe(cache, profile);
    ({ voiced: ran } = await voiceClips(lines.map((l) => l.text), { cache, profile, engine, only: steps, batch, work, log, onClips: keep }));
    const state = narrationState(lines, { cache, profile });
    if (state.voiced) keep();
    return { ...state, ran };
  }
  return { ...narrationState(lines, { cache, profile }), ran };
}

/** A narration's state in words, short whatever the script's length: what is done, and what to do next. */
export function narrationSummary(report, { noun = 'lines', hint = 'name a voice to read the rest' } = {}) {
  const wanted = report.voiced + report.toVoice, out = [`${report.voiced} of ${wanted} ${noun} voiced · ${report.toVoice} to voice · ${report.silent} silent · ${report.seconds} s so far`];
  if (report.ran) out.push(`voiced ${report.ran} just now`);
  const waiting = report.lines.filter((l) => l.state === 'to voice');
  for (const l of waiting.slice(0, MOST_LISTED)) out.push(`  ${l.n}  ${l.id}: ${l.text.length > 70 ? `${l.text.slice(0, 69)}…` : l.text}`);
  if (waiting.length > MOST_LISTED) out.push(`  … and ${waiting.length - MOST_LISTED} more`);
  if (waiting.length) out.push(`next: ${hint}`);
  return out.join('\n');
}
