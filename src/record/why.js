// why — where a value of a run came from, read from the run's own record file.
//
//   await whyFromRecord({ file: 'runs/x.record.jsonl', control, key: 'verdict', run: 'run 1' })
//   verdict = "fix"
//   fix (fix#6) [wrote: verdict]
//     verdict (verdict#5) ← [control: there is something to fix]
//       count the errors (errors#3) ← via errors [wrote: errors]
//
// WHY here: StoryDeck and StoryReel each run a footprintjs chart for a check, and each keeps the run's record as a file
// (footprintjs/sinks · fileSink). A run's words say what happened in order; they do not answer "why is this number so".
// The record does: every commit as it was written, the keys each stage had read when it wrote (the executor's
// `writeProvenance: 'reads-prefix'`), and — saved beside it — which decision let each stage run (controlEdges).
// foottrace walks back from the key over that. Nothing is run again, and nothing is guessed. One reader, so a deck and
// a film answer alike and are hardened alike.
//
// The record is a file in a project's folder, so it is read as data anyone may have written:
//   - only as a plain file of at most RECORD_MOST bytes, never through a link (readRecordFile);
//   - its entries checked one by one (readStoredRecord), and it must hold one run — its own log, and one for each chart it
//     mounted: a second run is refused;
//   - before the walk, what the answer would show of it (a stage's name and id, a key) is made one line and cut; a step
//     keeps at most ROWS_MOST rows and READS_MOST keys read (the walk joins the lists of every row that wrote a key), a
//     cut is said, and a step id longer than a run writes is refused (cut, it could become another's);
//   - an edge of the saved control map is used only when it names a step of this record that ran before the step it governs;
//   - a record that is not whole says so FIRST, and then a value it does not find is "not found in what could be read".
// What no record holds is said under every answer: a stage also uses what it is given from outside the run's own state.
//
// footprintjs and foottrace are the caller's (peer dependencies, needed by this door alone): both tools have them.
import { lstatSync } from 'node:fs';
import { readRecordFile } from 'footprintjs/sinks';
import { readStoredRecord, sliceForKey, formatSlice, findLastWriter, commitValueAt, keysReadFromMap, controlDepsFromMap } from 'foottrace';
import { oneLine } from '../said/oneline.js';

/**
 * The most lines an answer holds, the most characters of a name or any other value it shows (`value`), the most
 * characters of the value that was ASKED for (`asked`), the most bytes of a record it reads, the most steps, and the most
 * rows and keys read a step keeps. WHY the asked value has its own, larger bound: it is the answer — a caller asks for one
 * entry by its own key (footprint-story/humanflow · `duration-3`) to see it whole — while every other name is context,
 * kept short. Still one line, and still bounded, since the record is a file anyone may have written.
 */
export const WHY_LIMITS = Object.freeze({ lines: 40, value: 200, asked: 1000, bytes: 8 * 1024 * 1024, steps: 5000, rows: 200, reads: 200 });
const OUTSIDE = '(a stage also uses what it is given from outside the run\'s own state: the record holds what stages read and wrote, and no more)';
const { lines: LINES, value: VALUE, asked: ASKED, bytes: BYTES, steps: STEPS, rows: ROWS, reads: READS } = WHY_LIMITS;

const name = (text) => { const said = oneLine(String(text ?? '')); return said.length > VALUE ? `${said.slice(0, VALUE - 1)}…` : said; };
/** The asked value as the answer's first line shows it: one line, cut at ASKED characters — counted by code point, so
 *  a character outside the basic plane (an emoji) is never split in two at the cut. */
const shown = (value) => { const said = [...oneLine(JSON.stringify(value) ?? String(value))]; return said.length > ASKED ? `${said.slice(0, ASKED - 1).join('')}…` : said.join(''); };

/** A commit as the walk may show it (see the head). `cut.lists` counts the steps shortened. */
function plainCommit(bundle, cut) {
  const text = (key) => (typeof bundle[key] === 'string' ? { [key]: name(bundle[key]) } : {});
  const all = Array.isArray(bundle.trace) ? bundle.trace.filter((row) => row && typeof row === 'object') : [];
  let left = READS, short = all.length > ROWS;
  const rows = all.slice(0, ROWS).map((row) => {
    const keys = Array.isArray(row.readKeys) ? row.readKeys.filter((k) => typeof k === 'string') : null, kept = keys?.slice(0, left) ?? null;
    if (keys) { short ||= kept.length < keys.length; left -= kept.length; }
    return { ...row, ...(typeof row.path === 'string' ? { path: name(row.path) } : {}), ...(kept ? { readKeys: kept.map(name) } : {}) };
  });
  if (short) cut.lists += 1;
  return { ...bundle, ...text('stage'), ...text('stageId'), ...text('stageName'), ...text('runtimeStageId'), trace: rows };
}

/** The keys each stage had read when it wrote, from the record's own rows: {runtimeStageId: [key]}. */
function readsOf(commits) {
  const reads = new Map();
  for (const bundle of commits) for (const row of bundle.trace) for (const key of row.readKeys ?? []) {
    if (!reads.has(bundle.runtimeStageId)) reads.set(bundle.runtimeStageId, new Set());
    reads.get(bundle.runtimeStageId).add(key);
  }
  return Object.fromEntries([...reads].map(([id, keys]) => [id, [...keys]]));
}

/** The saved control edges that are true of this record: the decider is a step of it, and ran before the step it let run. */
function trueEdges(control, commits) {
  const at = new Map(commits.map((bundle, i) => [bundle.runtimeStageId, i])), out = {};
  if (!control || typeof control !== 'object' || Array.isArray(control)) return out;
  for (const [step, edge] of Object.entries(control).slice(0, STEPS)) {
    const i = at.get(name(step)), d = at.get(name(edge?.deciderId));
    if (i !== undefined && d !== undefined && d < i) out[name(step)] = { deciderId: name(edge.deciderId), ...(typeof edge.label === 'string' ? { label: name(edge.label) } : {}) };
  }
  return out;
}

/**
 * Which decision let each step of a run go, as plain data to save beside its record: {step: {deciderId, label?}}.
 * `commitLog`: the run's (executor.getSnapshot().commitLog); `control`: footprintjs/trace · controlDepRecorder(),
 * attached to that run. Give it back to whyFromRecord as `control`.
 */
export function controlEdges(commitLog, control) {
  if (typeof control?.lookup !== 'function') throw new TypeError('controlEdges takes the run\'s control recorder (footprintjs/trace · controlDepRecorder()), which has lookup(runtimeStageId)');
  const out = {};
  for (const bundle of (Array.isArray(commitLog) ? commitLog : []).slice(0, STEPS)) {
    if (typeof bundle?.runtimeStageId !== 'string') continue;
    let edge = null;
    try { edge = control.lookup(bundle.runtimeStageId); } catch { /* a step the recorder cannot answer for has no edge */ }
    if (edge && typeof edge.deciderId === 'string') out[name(bundle.runtimeStageId)] = { deciderId: name(edge.deciderId), ...(typeof edge.label === 'string' ? { label: name(edge.label) } : {}) };
  }
  return out;
}

/** The record file's entries: read only as a plain file of a size a run's record can have, a refusal saying what it is. */
async function entriesOf(file, run) {
  let size;
  try { size = lstatSync(file).size; } catch { throw new Error(`${run}'s record is gone: ${name(file)}`); }
  if (size > BYTES) throw new Error(`${run}'s record is ${Math.round(size / 1e6)} MB, more than a run writes (${BYTES / 1024 / 1024} MB at most): it was changed, and is not read`);
  try { return await readRecordFile(file, { maxBytes: BYTES }); } catch (e) { throw new Error(`${run}'s record cannot be read as a plain file of its own (${name(e?.code ?? e?.message ?? e)}): ${name(file)}`); }
}

/**
 * Why `key` is what it is in a run: its value, then the stage that wrote it, the decision that let that stage run and
 * what each had read, walked back — as text, every line one line. `file`: the run's record; `control`: what
 * controlEdges gave for it (or nothing); `run`: how to call the run in a refusal ("run 1"); `listed`: how a reader
 * lists what each stage wrote, said when no stage wrote `key`; `all`: every line (default: the first 40); `more`: how
 * a reader asks for every line, said when some are left out. `run`, `listed` and `more` are made one line and cut.
 */
export async function whyFromRecord(options) {
  const { file, control = null, key, listed = null, all = false, more = null } = options ?? {}, run = name(typeof options?.run === 'string' && options.run ? options.run : 'this run');
  const asked = typeof key === 'string' ? key.trim() : '';
  if (!asked) throw new Error('why names a value of the run, one of what its stages wrote');
  if (/[.[\]]/.test(asked)) throw new Error(`why names a value by its own name (verdict, errors), not a part of one: ${JSON.stringify(asked.slice(0, 60))}`);
  if (typeof file !== 'string' || !file) throw new Error(`${run} kept no record, so it cannot say why`);
  const { entries, unreadable } = await entriesOf(file, run), logs = [...readStoredRecord(entries).logs.values()];
  // a run writes one log of its own, and one for each chart it mounted (a subflow), under its own address: the walk is over
  // the run's own log. A second log that is no mount of it is a second run: the file was changed.
  const log = logs.find((l) => l.address.drillPath.length === 0);
  if (logs.length && !log) throw new Error(`${run}'s record holds no log of the run's own, only a mounted chart's: it was changed, and is not read`);
  // a mount is named by the step that mounted it: a log under this run's address whose first step is one of the run's own
  const steps = new Set((log?.commitLog ?? []).map((bundle) => bundle.runtimeStageId));
  const under = logs.filter((l) => l !== log && l.address.logRunId === log?.address.logRunId && l.address.drillPath.length > 0);
  if (logs.length > 1 + under.length) throw new Error(`${run}'s record holds ${logs.length - under.length} runs, and a run writes one: it was changed, and is not read`);
  const mounts = under.filter((l) => steps.has(l.address.drillPath[0])), stray = under.length - mounts.length;
  if (!log || !log.commitLog.length) throw new Error(`${run}'s record holds no step: ${name(file)}`);
  if (log.commitLog.length > STEPS) throw new Error(`${run}'s record holds ${log.commitLog.length} steps, more than a run takes (${STEPS} at most): it was changed, and is not read`);
  if (log.commitLog.some((b) => typeof b.runtimeStageId === 'string' && b.runtimeStageId.length > VALUE)) throw new Error(`${run}'s record names a step longer than a run names one (${VALUE} characters at most): it was changed, and is not read`);
  const cut = { lists: 0 }, commits = log.commitLog.map((bundle) => plainCommit(bundle, cut));
  // what is missing from the record is said before anything it answers
  const torn = [...(log.complete ? [] : ['this run did not finish: its record stops where it stopped']), ...(log.gaps.length ? [`${log.gaps.length} of its steps could not be read back`] : []),
    ...(unreadable?.length ? [`${unreadable.length} lines of its record could not be read`] : []),
    ...(cut.lists ? [`${cut.lists} of its steps list more rows or keys read than a run writes, and were cut`] : []),
    ...(stray ? [`${stray} logs in it are under no step of this run, and are not read`] : [])];
  const head = torn.length ? [`(the record is not whole — ${torn.join('; ')}: what follows is what could be read)`] : [];
  if (!findLastWriter(commits, asked)) return [...head, torn.length ? `${name(asked)}: not found in what could be read` : `${name(asked)}: no stage of this run wrote it${typeof listed === 'string' && listed ? ` (${name(listed)})` : ''}`].join('\n');
  const slice = sliceForKey(commits, asked, keysReadFromMap(readsOf(commits)), { controlDeps: controlDepsFromMap(trueEdges(control, commits)) });
  const lines = [...head, `${name(asked)} = ${shown(commitValueAt(commits, commits.length - 1, asked))}`, ...formatSlice(slice).split('\n').filter((line) => !/^SLICE for /.test(line)).map(oneLine)];
  const kept = all ? lines : lines.slice(0, LINES);
  // what this record does not hold is said, so a short answer is not taken for the whole story
  const lacks = [...(commits.some((bundle) => bundle.trace.some((row) => Array.isArray(row.readKeys))) ? [] : ['(this record was written without what each stage had read, so the walk shows who wrote the value and the decisions, not the reads)']),
    ...(mounts.length ? [`(${mounts.length === 1 ? 'a chart this run mounted keeps a log of its own' : `${mounts.length} charts this run mounted keep logs of their own`}: what happened inside is not walked here)`] : [])];
  return [...kept, ...(lines.length > kept.length ? [`… ${lines.length - kept.length} more${typeof more === 'string' && more ? `: ${name(more)}` : ''}`] : []), ...lacks, OUTSIDE].join('\n');
}
