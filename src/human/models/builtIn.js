/**
 * The models this package ships, and the one each family uses when an intent names none (the usual). A family with
 * no usual model yet refuses an intent that names none, saying how to hand one in.
 */
import { minJerkModel } from './minJerk.js';
import { powerLawModel } from './powerLawPen.js';
import { sigmaLognormalModel } from './sigmaLetter.js';

export const BUILT_IN_MODELS = Object.freeze([minJerkModel, powerLawModel, sigmaLognormalModel]);
export const USUAL_MODELS = Object.freeze({ reach: 'min-jerk', pen: 'power-law', letter: 'sigma-lognormal' });
