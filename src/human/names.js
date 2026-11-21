/**
 * The names a strategy may have, as the isometric styles name their choices: this package's are lower case with no
 * prefix (`min-jerk`); a tool's own carry its prefix (`reel:chalk-pen`). WHY a prefix: the record names the strategy
 * that made a move, and a tool's own can never be taken for this package's, nor shadow one.
 */
export const BUILT_IN_NAME = /^[a-z][a-z0-9-]{0,31}$/;
export const OWN_NAME = /^[a-z][a-z0-9-]{0,15}:[a-z][a-z0-9-]{0,31}$/;
/** The most strategies of one kind a tool may hand in. */
export const MOST_OWN = 64;
