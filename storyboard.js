// footprint-story/storyboard — a story written as plain data on a named shape, for a film and a deck to draw the same way.
// Pure: runs anywhere (browser or Node), imports nothing, and loads only when imported. Nothing here draws: StoryDeck makes
// its pieces and clicks from a board, StoryReel its scenes and recipe.
//
//   storyShapes()                                → [{ name, about, fills }]: the shapes there are, and a worked outline of each
//   storyboardBrief(shape, { conversation })     → { instructions, material }: what a model needs to write one; it holds no model itself
//   storyboardProblems(input, { conversation })  → [{ at, message }]: everything to fix, all at once
//   readStoryboard(input, { conversation })      → the board: checked and frozen, with its scenes
//   storyboardFixBriefs(input, problems, { conversation }) → { instructions, briefs, rest }: one short brief per piece at fault

export { storyShapes, storyboardProblems, readStoryboard } from './src/storyboard/read.js';
export { storyboardBrief } from './src/storyboard/brief.js';
export { storyboardFixBriefs } from './src/storyboard/fixBrief.js';
export { numbersIn } from './src/storyboard/conversation.js';
