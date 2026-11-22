/** The critics this package ships, by name. A model names the ones that measure what it made (its `checks`). */
import { jerk } from './jerk.js';
import { arc } from './arc.js';
import { penSpeed } from './penSpeed.js';
import { spacing } from './spacing.js';
import { volume } from './volume.js';
import { contact } from './contact.js';
import { stretch } from './stretch.js';
import { penLifts } from '../strokes/penLifts.js';
import { strokeOrder } from '../strokes/strokeOrder.js';
import { hatchGaps } from '../strokes/hatchGaps.js';
import { pace } from '../strokes/pace.js';
import { rollSlip } from './rollSlip.js';
import { spin } from './spin.js';

export const BUILT_IN_CRITICS = Object.freeze([jerk, penSpeed, arc, spacing, volume, contact, stretch, penLifts, strokeOrder, hatchGaps, pace, rollSlip, spin]);
