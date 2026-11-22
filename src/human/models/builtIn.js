/**
 * The models this package ships, and the one each family uses when an intent names none (the usual). A family with
 * no usual model yet refuses an intent that names none, saying how to hand one in.
 */
import { minJerkModel } from './minJerk.js';
import { powerLawModel } from './powerLawPen.js';
import { sigmaLognormalModel } from './sigmaLetter.js';
import { ballisticModel } from './ballistic.js';
import { bounceModel } from './bounce.js';
import { verletModel } from './verlet.js';
import { springModel } from './spring.js';
import { rollModel } from './roll.js';
import { slideModel } from './slide.js';
import { tumbleModel } from './tumble.js';

export const BUILT_IN_MODELS = Object.freeze([minJerkModel, powerLawModel, sigmaLognormalModel, ballisticModel, bounceModel, verletModel, springModel, rollModel, slideModel, tumbleModel]);
export const USUAL_MODELS = Object.freeze({ reach: 'min-jerk', pen: 'power-law', letter: 'sigma-lognormal', throw: 'ballistic', fall: 'ballistic', hang: 'verlet', settle: 'spring', roll: 'no-slip', slide: 'coulomb', tumble: 'free-spin' });
