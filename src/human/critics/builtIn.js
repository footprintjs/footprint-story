/** The critics this package ships, by name. A model names the ones that measure what it made (its `checks`). */
import { jerk } from './jerk.js';
import { arc } from './arc.js';
import { penSpeed } from './penSpeed.js';

export const BUILT_IN_CRITICS = Object.freeze([jerk, penSpeed, arc]);
