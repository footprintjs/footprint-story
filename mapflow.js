// footprint-story/mapflow — an isometric map built as a footprintjs chart: the steps of footprint-story/isometric ·
// ISO_MAP_STEPS, one stage each, so a run's record says what each step read, wrote and decided. The one door besides
// /record that needs footprintjs (the caller's: an optional peer). See src/mapflow/README.md.
export { mapFlow, runMapFlow } from './src/mapflow/flow.js';
