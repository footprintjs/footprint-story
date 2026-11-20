// The Chatterbox kit adapter — one adapter of the voice port ({ name, synthesize(scenes, { work }) }). Moved from
// StoryDeck 0.2.0 (voice.js · chatterboxKit). Bring another (a cloud voice, a test fake) with the same shape.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { failure, QUIET_STDOUT } from './spawn.js';

/** Where a kit keeps its voice's settings. */
export const KIT_PROFILE = 'voices/me.voice.json';
/**
 * How long a kit may take, in minutes: so long to load its model, and so long for each scene it voices. A kit that
 * hangs (a model that never loads, a device that stalls) would hold its host for ever: past the limit it is stopped,
 * and the refusal says how to give it longer. Generous: a clone on a laptop voices a scene in a minute or two. The
 * kit's own process is stopped; a process it started itself is not.
 */
export const KIT_MINUTES = Object.freeze({ start: 10, scene: 10 });
/** The longest any one run of the kit may take, in minutes, however many scenes it is given. */
const DAY = 24 * 60;

/**
 * The adapter for a local voice kit (a StoryReel-style folder): its Python environment runs Chatterbox on a
 * storyboard of scenes and writes timings.json (each scene's audio, duration and aligned words). Nothing is
 * uploaded. `kit` holds .venv-voice/, scripts/voice/tts_chatterbox.py, voices/<profile>.voice.json and the
 * profile's reference recording.
 */
export function chatterboxKit({ kit, python = '.venv-voice/bin/python', script = 'scripts/voice/tts_chatterbox.py', profile = KIT_PROFILE, device = 'mps', env = process.env, run = spawnSync, minutes = KIT_MINUTES }) {
  const plain = minutes !== null && typeof minutes === 'object' && !Array.isArray(minutes) && Object.keys(minutes).every((key) => key === 'start' || key === 'scene');
  const limit = { ...KIT_MINUTES, ...(plain ? minutes : {}) };
  if (!plain || ![limit.start, limit.scene].every((n) => typeof n === 'number' && n > 0 && n <= DAY)) throw new Error(`chatterboxKit: minutes is { start, scene }, how long the kit may take to load and for each scene, each above 0 and at most a day (${KIT_MINUTES.start} and ${KIT_MINUTES.scene}) — not ${JSON.stringify(minutes)}`);
  kit = path.resolve(kit);   // the kit runs in its own folder: every path it is handed is absolute
  return {
    name: 'chatterbox',
    synthesize(scenes, { work }) {
      const dir = path.resolve(work), board = path.join(dir, 'storyboard.json'), allowed = Math.min(DAY, limit.start + limit.scene * scenes.length);
      writeFileSync(board, JSON.stringify({ scenes: scenes.map((s) => ({ id: s.id, narration: s.text })) }, null, 1));
      const done = run(path.resolve(kit, python), [script, '--storyboard', board, '--profile', profile, '--device', device, '--out', dir],
        { cwd: kit, stdio: QUIET_STDOUT, env: { ...env, HF_HUB_OFFLINE: env.HF_HUB_OFFLINE ?? '1' }, timeout: Math.max(1, Math.ceil(allowed * 60_000)), killSignal: 'SIGKILL' });
      if (done?.error?.code === 'ETIMEDOUT') throw new Error(`the voice kit did not finish in ${allowed} minutes (${limit.start} to load and ${limit.scene} for each of ${scenes.length} scene${scenes.length === 1 ? '' : 's'}) and was stopped, in ${kit} — run it again, or give it longer: chatterboxKit({ minutes: { start, scene } })`);
      const why = failure(done);
      if (why) throw new Error(`the voice kit failed (${why}) in ${kit}`);
      const timings = JSON.parse(readFileSync(path.join(dir, 'timings.json'), 'utf8'));
      return timings.scenes.map((s) => ({ id: s.id, audio: path.join(dir, s.audio), duration: s.duration, ...(s.words && { words: s.words }) }));
    },
  };
}
