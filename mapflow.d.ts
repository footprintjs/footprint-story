import type { CombinedRecorder, FlowChart, RecordSinkOption, RuntimeSnapshot } from 'footprintjs';
import type { IsoMap, IsoMapPolicy, IsoMapSettings, IsoMapSpec, IsoStyleChoice } from './isometric.js';

/**
 * The map flow as a footprintjs chart: read, then one stage per step of ISO_MAP_STEPS (a decider for place and for grid).
 * Built with the tool's own style choices (`settings.choices`, as buildIsoMap takes them: code is never the run's input).
 * Run it with input {mapSpec, mapPolicy}.
 */
export function mapFlow(settings?: IsoMapSettings | null): FlowChart;
/**
 * The map flow run with `writeProvenance: 'reads-prefix'`: `choices` the tool's own style choices (as buildIsoMap's settings), `sink` a record sink (footprintjs/sinks · fileSink; the
 * caller closes it), `recorders` combined recorders to attach (footprintjs/trace · controlDepRecorder). Gives the map —
 * equal to buildIsoMap's — and the run's snapshot. Rejects with buildIsoMap's words for a spec or policy it refuses.
 */
export function runMapFlow(spec: IsoMapSpec, policy: IsoMapPolicy, options?: { readonly choices?: readonly IsoStyleChoice[] | null; readonly sink?: RecordSinkOption; readonly recorders?: readonly CombinedRecorder[] } | null): Promise<{ readonly map: IsoMap; readonly snapshot: RuntimeSnapshot }>;
