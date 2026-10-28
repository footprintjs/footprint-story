// footprint-story/motion — how things move, in a film and on a slide: named eases and springs, named moves
// (entrances, exits, feedback, ambient loops), named changes of picture as data, and how long a picture may sit
// still. Pure: runs anywhere (browser or Node), imports nothing, and loads only when imported. Nothing here draws —
// StoryReel paints on a canvas, StoryDeck animates a page; both read these names.
//
//   moveAt('slam', t)                              → { opacity, x, y, scale, rotate, blur, clip, progress, mask }
//   readTransition({ type: 'push', from: 'left' }, 'click 3')   → { type, family, seconds, ease, sound, p }
//   readPace('lesson')                             → { hold, most, still, spare }

// ease — the ease table by name, and any CSS cubic-bezier
export { EASES, EASE_NAMES, bezier, easeNamed, overshoots, inOut } from './src/motion/ease.js';

// spring — closed-form springs by feel
export { FEELS, FEEL_NAMES, readFeel, spring, settleTime, pop, track } from './src/motion/spring.js';

// moves — named motions, by how they feel and what they are for
export { MOVES, MOVE_NAMES, MOVE_KINDS, MOVE_USES, MOVE_FEELS, MOVE_FEEL_NAMES, MASKS, REST, WORD_GAP, LETTER_GAP, EXIT_SHARE, readMove, moveAt, stagger, movesBy } from './src/motion/moves.js';

// transitions — the editor's changes of picture, as data; settings, the one reader
export { TRANSITIONS, TRANSITION_NAMES, FAMILIES, DIRECTIONS, COMMON, SECONDS, RESERVED, checkTransition, extendTransitions, readTransition } from './src/motion/transitions.js';
export { readSettings, isColor, isBox, SETTING_FLAGS } from './src/motion/settings.js';

// pace — how long a picture may sit still, by the kind of film
export { PACES, PACE_NAMES, readPace } from './src/motion/pace.js';
