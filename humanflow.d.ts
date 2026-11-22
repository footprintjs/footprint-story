import type { CombinedRecorder, FlowChart, RecordSinkOption, RuntimeSnapshot } from 'footprintjs';
import type { HumanIntentsResult, HumanIntentEntry, HumanModel, HumanCritic, HumanPoint } from './human.js';

/** The intent decider as a footprintjs chart: read, then one stage per step of HUMAN_STEPS (`choose` a decider, its branches the plan). Run it with input {humanIntents, humanFrame}. A tool's own models and critics are handed in here: code is never the run's state. */
export function humanFlow(settings?: { readonly models?: readonly HumanModel[] | null; readonly critics?: readonly HumanCritic[] | null } | null): FlowChart;
/**
 * The intent decider run with `writeProvenance: 'reads-prefix'`: `models`, `critics` and `frame` as planIntents takes
 * them; `sink` a record sink (footprintjs/sinks · fileSink; the caller closes it), `recorders` combined recorders to
 * attach (footprintjs/trace · controlDepRecorder). Gives the result — equal to planIntents' — and the run's snapshot.
 * Rejects with planIntents' words for intents it refuses.
 */
export function runHumanFlow(intents: readonly HumanIntentEntry[], options?: {
  readonly models?: readonly HumanModel[] | null; readonly critics?: readonly HumanCritic[] | null; readonly frame?: HumanPoint | null;
  readonly sink?: RecordSinkOption; readonly recorders?: readonly CombinedRecorder[];
} | null): Promise<{ readonly result: HumanIntentsResult; readonly snapshot: RuntimeSnapshot }>;
