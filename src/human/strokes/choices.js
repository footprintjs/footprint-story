/**
 * Every isometric style choice the human door ships, in one list: what a tool hands `isoStyle`, `buildIsoMap` or
 * `runMapFlow` under `choices` so that any style or look naming a "human:" choice builds. WHY one list: a tool that
 * names its own list must change it for every choice added here (0.35.0 added `human:grain`, for the look
 * "paper-grain"); one that hands this list in takes each new one as it comes.
 */
import { sketchyLine, hatchTexture } from './styleChoices.js';
import { grainTexture } from './grain.js';

export const HUMAN_STYLE_CHOICES = Object.freeze([sketchyLine, hatchTexture, grainTexture]);
