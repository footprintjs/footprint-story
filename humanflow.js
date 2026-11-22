// footprint-story/humanflow — the intent decider built as a footprintjs chart: the steps of footprint-story/human ·
// HUMAN_STEPS, one stage each, so a run's record says what each step read, wrote and decided — why a move was given its
// model and its duration. Needs footprintjs (the caller's: an optional peer), as /mapflow and /record do. See
// src/humanflow/README.md.
export { humanFlow, runHumanFlow } from './src/humanflow/flow.js';
