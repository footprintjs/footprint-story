// Compiled, never run (CI: tsc --noEmit): the hand-kept types describe the doors as a caller uses them.
import { spokenMap, autoRules, shownWords, spokenOffset, unsaidDigits, checkSlots, captionChunks, captionCues, captionFile, readCaptions, captionAt,
  FILE_CHUNKS, youtubeChapters, readChapters, clockText, sentences, saidSentences, sentenceStarts, numberWords, normSpeech, SPELL, SAY, findSlot, stamp } from 'footprint-story';
import type { SpokenMap, Piece, Rules, Slot, WordTiming, Track, WordCue, Chapters, ChapterChange } from 'footprint-story';
import { clipKey, clipFor, voiceClips, pickSteps, chatterboxKit, recordedTakes, narrate, narrationState, narrationSummary, narrationVoice } from 'footprint-story/voice';
import type { VoiceEngine, Clip, VoiceProfile, TakeRecord, TrimSettings, Scene } from 'footprint-story/voice';
import { dataLine, readStoryboard, storyboardBrief, storyboardFixBriefs, storyboardProblems, storyShapes, numbersIn } from 'footprint-story/storyboard';
import type { Storyboard, StoryboardBrief, StoryboardFixBrief, StoryboardFixBriefs, StoryScene, StoryBeat, StoryboardProblem, StoryShape, StoryMessage } from 'footprint-story/storyboard';

const slots: Slot[] = [['16.67 ms', 'sixteen point six seven milliseconds']];
const map: SpokenMap = spokenMap('One frame takes 16.67 ms.', { slots: checkSlots('One frame takes 16.67 ms.', slots), rules: autoRules({ spell: { ...SPELL, UI: 'U I' }, say: SAY }) });
const kinds: Piece['kind'][] = map.pieces.map((p) => p.kind);
const shout: Rules = { name: 'shout', apply: (pieces) => pieces.map((p) => (p.kind === 'text' ? { ...p, spoken: p.spoken.toUpperCase() } : p)) };
const words: WordTiming[] = [{ text: 'One', start: 0, end: 0.3 }];
const shown: WordTiming[] = shownWords(map, words);
const at: number | null = spokenOffset(spokenMap('x', { rules: shout }), 0, { end: true });
const digits: string[] = unsaidDigits(map);
const tracks: Track[] = [{ offset: 0, duration: 2, words }];
const chunks: WordCue[] = captionChunks(tracks, FILE_CHUNKS);
const now = captionAt(chunks, 0.1)?.active;
const vtt: string = captionFile(chunks, 'vtt', { offset: 1, lineChars: Infinity }) + captionFile(captionCues([{ start: 0, written: 'A.', spoken: 'A.', clip: { duration: 1, sentences: [0] } }]), 'srt');
const back: { start: number; end: number; text: string }[] = readCaptions(vtt);
const list: Chapters = youtubeChapters(readChapters('0:00 Intro'), { length: 60 });
const change: ChapterChange | undefined = list.changes[0];
if (change?.kind === 'merged') change.into.toUpperCase();
const misc: (string | number | string[] | number[])[] = [clockText(95), sentences('A. B.'), saidSentences(null), sentenceStarts('A.', [{ start: 0 }]), numberWords(42), normSpeech('É'), findSlot('a 2', '2'), stamp(1, '.')];

const profile: VoiceProfile = { id: 'me', seed: 7 };
const engine: VoiceEngine = chatterboxKit({ kit: '../kit', run: () => ({ status: 0 }) });
const clip: Clip | null = clipFor('Hi.', { cache: 'cache', profile });
const timed: WordTiming[] | null | undefined = clip?.words;
const key: string = clipKey('Hi.', profile);
voiceClips(['Hi.'], { cache: 'cache', profile, engine, only: pickSteps('1-3'), batch: 2 }).then((r) => r.voiced + r.todo + r.wanted);

const trim: TrimSettings = { threshold: -50, maxPause: 0.8 };
const takes = recordedTakes({ kit: '../kit', takes: 'takes', trim, run: () => ({ status: 0, stderr: '' }), log: (line) => line.length });
const scenes: Scene[] = [{ id: 'k1', text: 'Hi.' }];
takes.preflight(scenes);
const recorded: VoiceProfile = takes.profile;
voiceClips(['Hi.'], { cache: 'cache', profile: recorded, engine: takes });
const record: TakeRecord | null | undefined = clipFor('Hi.', { cache: 'cache', profile: recorded })?.take;
const low: string | undefined = record?.check.lowWords[0]?.[0];
const capped: number | undefined = record?.trim.pauses[0]?.now;

export { kinds, shown, at, digits, now, back, misc, timed, key, low, capped };

import { easeNamed, EASES, bezier, overshoots, spring, settleTime, track, pop, FEELS, readFeel, moveAt, readMove, movesBy, stagger, MOVES, REST, WORD_GAP,
  readTransition, extendTransitions, checkTransition, TRANSITIONS, SECONDS, readSettings, isColor, readPace, PACES,
  readTurns, turnTimes, writeTurns, MOST_TURNS, MOST_TOGETHER, MOST_TURN_NAME, MOST_TURNS_TEXT, MOST_TURN_SECONDS } from 'footprint-story/motion';
import type { Ease, Feel, Move, MoveValues, Transition, ReadTransition, Pace, SettingSpec } from 'footprint-story/motion';

const curve: Ease = easeNamed('cubic-bezier(0.16, 1, 0.3, 1)');
const eased: number = curve(0.5) + EASES.outExpo(0.5) + bezier(0.2, 0, 0, 1)(0.5) + (overshoots('spring') ? 1 : 0);
const heavy: Feel = readFeel('heavy');
const springs: number = spring(0.2, heavy) + settleTime(FEELS.snappy) + track(1, [[0, 10], [0.5, 20]]) + pop(1, 0.5);
const values: MoveValues = moveAt('slam', 0.1, { feel: 'heavy', start: 0 });
const mask: 'left' | 'right' | 'top' | 'bottom' | 'iris' | null = values.mask;
const mine: Move = readMove({ name: 'nudge-in', kind: 'entrance', feel: 'crisp', uses: ['ui'], seconds: 0.3, ease: 'outQuint', props: { x: [30, 0] } });
const named: string[] = movesBy({ feel: 'heavy', use: 'text' }).map((m) => m.name).concat(Object.keys(MOVES));
const delays: number[] = stagger(['a', 'b'], 'text-reveal-word').map((s) => s.delay + REST.opacity + WORD_GAP);
const push: ReadTransition = readTransition({ type: 'push', from: 'left' }, 'click 3', { frame: [1920, 1080] });
const swirl = { family: 'wipe', seconds: 0.6, ease: 'inOut', sound: null, params: { turns: { number: [1, 4], default: 2 } as SettingSpec }, draw: () => undefined };
const all: Readonly<Record<string, Transition>> = extendTransitions(TRANSITIONS, { swirl }, { extra: ['draw'] });
const checked = checkTransition(swirl, 'swirl', { extra: ['draw'] });
const p = readSettings({ at: { point: true, default: 'centre' } }, {}, 'x', { frame: [10, 20] });
const pace: Pace = readPace({ hold: 1.5, most: 0.2, still: 0.6 });
const motionMisc: unknown[] = [eased, springs, mask, mine, named, delays, push.p, all, checked.params, p, isColor('#fff'), SECONDS[0], PACES.promo.hold, pace.spare];

const chat: StoryMessage[] = [{ id: 'm1', who: 'agent', text: 'it waited 41 minutes' }];
const shapes: readonly StoryShape[] = storyShapes();
const boardProblems: readonly StoryboardProblem[] = storyboardProblems({ shape: shapes[0].name }, { conversation: chat });
const board: Storyboard = readStoryboard('{}');
const firstScene: StoryScene = board.scenes[0];
const beat: StoryBeat = firstScene.beat;
const cardTone: 'ok' | 'warn' | null = beat.kind === 'card' ? beat.tone : null;
const said: readonly string[] = numbersIn(firstScene.narration);
const brief: StoryboardBrief = storyboardBrief('what-we-found', { conversation: chat });
const briefText: string = brief.instructions + (brief.material ?? '');
const fixes: StoryboardFixBriefs = storyboardFixBriefs({ shape: shapes[0].name }, boardProblems, { conversation: chat });
const firstFix: StoryboardFixBrief | undefined = fixes.briefs[0];
const fixText: string = fixes.instructions + (firstFix ? `${firstFix.piece} ${firstFix.left} ${firstFix.material}${firstFix.problems[0]?.at}` : '') + fixes.rest.length + dataLine({ problem: 'x' });
const narrationLines = [{ id: 'one', text: 'A line' }];
const { engine: narrationEngine, profile: narrationProfile } = narrationVoice({ cache: 'c', kit: 'kit' });
const narrationRead: string = narrationSummary(narrationState(narrationLines, { cache: 'c', profile: narrationProfile }), { noun: 'clicks' });
const narrationDone: Promise<{ ran: number; toVoice: number }> = narrate(narrationLines, { cache: 'c', profile: narrationProfile, engine: narrationEngine, only: '1-2' });

import { ROUNDS, HEIGHTS, SIZES, LENSES, MOST_THINGS, readView, readScene, sceneProblems, readShot, shotProblems, readCamera, frameOf, distanceFor, apertureFor, project, unproject, boxOf, checkShot, shotLine } from 'footprint-story/shot';
import type { Scene as ShotScene, Shot, Camera, Frame, ShotReport, ShotProblem, ThingBox, ReadShot, ViewName } from 'footprint-story/shot';

const set: ShotScene = { unit: 'm', things: [{ name: 'door', at: [0, 0, 0], r: 1 }, { name: 'sign', at: [1, 0, 0], size: [1.6, 0.9], normal: [0, 0, 1], back: true }] };
const viewName: ViewName = 'front-left high';
const written: Shot = { on: 'door', from: viewName, size: 'medium', lens: 'long', focus: 'sign', at: ['leak', 'the door'], seconds: 2 };
const asked: ReadShot = readShot(written, set);
const lensCamera: Camera = frameOf(asked, set);
const frame: Frame = [1280, 720];
const landed: number | null = project([0, 0, 0], lensCamera, frame).x;
const box: ThingBox = boxOf(set.things[0], lensCamera, frame);
const report: ShotReport = checkShot(readScene(set), readCamera(lensCamera), frame, asked);
const shotText: string = shotLine(checkShot(set, lensCamera, frame, { on: ['door', 'sign'] }), { label: 'camera[2]' });
const shotIssues: readonly ShotProblem[] = [...sceneProblems(set), ...shotProblems(written, set)];
const shotMisc: unknown[] = [ROUNDS.front, HEIGHTS.high, SIZES.wide, LENSES.normal, MOST_THINGS, readView('low').azimuth, distanceFor(1, 0.4, 1.25), apertureFor(2), unproject(1, 2, 3, lensCamera, frame)[0], landed, box.state, report.faults[0]?.kind, shotText, shotIssues];
export { shotMisc };

import { angleAt, dihedral, wrapAngle, shortestTurn, unwrapAngles, quatFromAxisAngle, quatMultiply, quatNormalize, quatRotate, quatAngle, quatLook, quatForward, quatFromAxes,
  slerp, squad, toSpherical, fromSpherical, greatCircle, lookAt, horizonRoll } from 'footprint-story/geometry';
import type { Quat, Spherical } from 'footprint-story/geometry';
import { CAMERA_MOVE_DOS, MOST_MOVE_SECONDS, MOST_ORBIT, MOST_LIFT, CAMERA_MOVES, CAMERA_MOVE_RULES, CAMERA_MOVE_KINDS,
  MOST_CAMERA_SAMPLES, planCameraMove, sampleCameraMove, cameraTrack, CAMERA_CRITICS, SIGHT_DROP, HORIZON_MOST, checkCameraMove } from 'footprint-story/shot';
import type { CameraMove, CameraSample, CameraTrack, CameraFinding, CameraMoveIntent } from 'footprint-story/shot';

const turnQ: Quat = quatMultiply(quatFromAxisAngle([0, 1, 0], 1), quatNormalize([1, 0, 0, 0]));
const place: Spherical = toSpherical(quatRotate(turnQ, [0, 0, 1]));
const angles: (number | null)[] = [angleAt([1, 0], [0, 0], [0, 1]), dihedral([1, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]), wrapAngle(4), shortestTurn(0, 3), ...unwrapAngles([3, -3]), quatAngle(turnQ, quatLook([0, 0, -1])), horizonRoll(lookAt([0, 0, 5], [0, 0, 0]) ?? turnQ)];
const geomMisc: unknown[] = [quatForward(turnQ), quatFromAxes([1, 0, 0], [0, 1, 0], [0, 0, 1]), slerp(turnQ, [1, 0, 0, 0], 0.5), squad([turnQ, [1, 0, 0, 0], turnQ], 0.3), fromSpherical(place), greatCircle([0, 0, 1], [1, 0, 0], 0.5), angles];
const flyIntent: CameraMoveIntent = { do: 'fly', from: { on: 'door', from: 'front' }, to: lensCamera, cutPast: 160, who: 'shots[1]' };
const moved: CameraMove = planCameraMove(flyIntent, set);
const circled: CameraMove = planCameraMove({ do: 'orbit', around: ['door', 'sign'], by: -90, from: 'front-left high', lift: 5, line: ['door', 'sign'] }, set);
const sampled: CameraSample = sampleCameraMove(moved, 0.5);
const pathOf: CameraTrack = cameraTrack(circled, { rate: 30 });
const found: readonly CameraFinding[] = checkCameraMove(moved, { scene: set, frame, rate: 20 }).findings;
const byHand = checkCameraMove({ samples: [{ t: 0, camera: lensCamera }, { t: 1, camera: lensCamera, look: turnQ }], on: 'door' }, { scene: set, frame }).measures['turn-speed'];
export const moveMisc: unknown[] = [geomMisc, sampled.look, pathOf.samples.length, found[0]?.fix, byHand, CAMERA_MOVE_DOS[0], MOST_MOVE_SECONDS, MOST_ORBIT, MOST_LIFT, CAMERA_MOVES.comfort, CAMERA_MOVE_RULES[0].rule, CAMERA_MOVE_KINDS, MOST_CAMERA_SAMPLES, CAMERA_CRITICS, SIGHT_DROP, HORIZON_MOST, moved.choice.kind, circled.basis.swing];

import type { Turn, TurnTimes } from 'footprint-story/motion';
const order: readonly Turn[] = readTurns(['camera laptop (dns server) w1:1.2', { names: ['db'], takes: 1 }], { where: 'route', isName: (text) => text === 'w1:2' });
const times: TurnTimes = turnTimes(order, { step: 0.35, takes: (turn, index) => (turn.names.includes('camera') ? 1 + index : undefined) });
const orderText: string = writeTurns(order) + times.turns.map((t) => t.at + t.takes).join(' ') + times.last + times.end;
export const turnLimits: number[] = [MOST_TURNS, MOST_TOGETHER, MOST_TURN_NAME, MOST_TURNS_TEXT, MOST_TURN_SECONDS, orderText.length];

import { isometric, readThing, MOST_ISOMETRIC_THINGS, arrange, gridFor, MOST_LINKS } from 'footprint-story/isometric';
import type { IsoGrid, IsoBlock, IsoCylinder, IsoFloor, IsoPoint, IsoThing, IsoBox, IsoArrangement, IsoNamed, IsoPlaced } from 'footprint-story/isometric';
const grid: IsoGrid = isometric({ tile: [120, 60], origin: [960, 240], rise: 70 });
const server: IsoThing = { at: [2, 1], size: [2, 2, 1.5] };
const faces: IsoBlock = grid.block(server);
const round: IsoCylinder = grid.cylinder({ at: [6, 1, 0], size: [2, 2, 1] });
const ground: IsoFloor = isometric().floor({ cols: 8, rows: 6, at: [0, 0] });
const wire: IsoPoint[] = grid.route([0, 3], [3, 1], { first: 'row' });
const bounds: IsoBox = faces.box;
const drawn: { name: string; thing: IsoThing }[] = grid.backToFront([{ name: 'server', thing: server }], (item) => item.thing);
export const isoMisc: unknown[] = [grid.at(1, 2, 3).x, grid.tileAt(10, 20).col, grid.tile[0], grid.origin[1], grid.rise, faces.top[0].y, round.top.rx, ground.lines[0][3], wire.length, bounds.w,
  drawn[0].name, readThing(server).at[2], MOST_ISOMETRIC_THINGS];
const isoNamed: IsoNamed[] = [{ name: 'you', size: [2, 2, 1] }, { name: 'server', size: [2, 2, 1] }];
const arranged: IsoArrangement = arrange(isoNamed, [['you', 'server']], { gap: 1, step: 3, across: true });
const placed: IsoPlaced = arranged.things[0];
const fitted: IsoGrid = gridFor(arranged.things, [0, 220, 1920, 1000], { most: 160, least: 24 });
export const isoArranged: unknown[] = [placed.name, placed.at[2], arranged.cols, arranged.rows, fitted.block(placed).box.w, MOST_LINKS, arrange(isoNamed).things.length];

import { rideSeconds, speedAt, rideProfile, withHold, showStops, hiddenRamps, MOST_EASE } from 'footprint-story/motion';
import type { RideEase, RideStops } from 'footprint-story/motion';
const rideEase: RideEase = [0.15, 0.2];
const rideStops: RideStops = withHold(rideProfile(rideEase, 900), 0.8);
export const rideMisc: unknown[] = [rideSeconds(900, 300, rideEase), speedAt(0.1, rideEase), rideStops[0][1], showStops(0.8, { end: true }), hiddenRamps([[10, 40]], 900, 300, rideEase, { radius: 7 })[0][3], MOST_EASE];

import { hairpins, HAIRPINS, floorUnder, crossesBox, UNDER_CELL, MOST_UNDER_SQUARES, NO_UNDER, floorLabelPlace, MOST_FLOOR_LABEL, FLOOR_LABEL_ICON, MOST_COVER_POINTS, arrangeByGroup, GROUP_MARGIN } from 'footprint-story/isometric';
import type { IsoHairpin, IsoUnder, IsoFloorUnder, FloorLabel, IsoGrouped, IsoGridNumbers } from 'footprint-story/isometric';
import { MOST_OUTLINE_POINTS, MOST_LABEL_LOOKS } from 'footprint-story/isometric';
const numbersOnly: IsoGridNumbers = { tile: [120, 60] };
const pins: IsoHairpin[] = hairpins([[0, 0, 0.3], [1, 0, 0]], ['p', null]);
const under: IsoFloorUnder = floorUnder({ x: 0, y: 0, w: 10, h: 10 }, grid, { lift: 1, most: 512 });
const underAlone: IsoFloorUnder = floorUnder({ x: 0, y: 0, w: 10, h: 10 }, numbersOnly);
const onePort: IsoHairpin[] = hairpins([[0, 0]], ['p']);
const stretch: IsoUnder | undefined = under.stretches ? under.stretches[0] : undefined;
const label: FloorLabel = floorLabelPlace({ at: [0, 0], size: [8, 5] }, grid, 'Production', [[[0, 0], [1, 1]]], { icon: true });
const grouped: IsoGrouped[] = [{ name: 'web', size: [2, 2, 1], group: 'front' }, { name: 'db', size: [2, 2, 1] }];
export const isoDeckHelpers: unknown[] = [pins[0], HAIRPINS.length, under.why, stretch?.at[2], crossesBox([[0, 0], [5, 5]], { x: 1, y: 1, w: 2, h: 2 }), UNDER_CELL, MOST_UNDER_SQUARES, NO_UNDER.far,
  label.matrix[0], label.lines[0], MOST_FLOOR_LABEL, FLOOR_LABEL_ICON, MOST_COVER_POINTS, arrangeByGroup(grouped, [['web', 'db']])[0][2], GROUP_MARGIN, MOST_OUTLINE_POINTS, MOST_LABEL_LOOKS, underAlone.why, onePort.length];

// 0.18.0: a part that differs (the pure door), framing and line breaking (the layout door), a measured name
import { timeWords, analogyWords, differsFactors, foldDiffers, timeProblem, differsStatements, differsLines, differsProblem, differsEnglish, DIFFERS_MOST, DIFFERS_SAID_MOST, DIFFERS_TIME_MOST, DIFFERS_ANALOGY } from 'footprint-story';
import type { DiffersDeclaration, DiffersProblem } from 'footprint-story';
import { frameZoom, wrapWords, narrowestWidth, NARROWEST_STEPS } from 'footprint-story/layout';
import { wordsToFit as fitWords } from 'footprint-story/isometric';
const declared: DiffersDeclaration = { time: 30, scale: 'drawn larger' };
const broken: DiffersProblem | null = differsProblem(declared, differsLines(declared), null);
if (broken?.problem === 'unstated') broken.named.join(', ');
if (broken?.problem === 'contradicts') broken.figure.toUpperCase();
const why: 'not-a-factor' | 'real-time' | 'past-range' | null = timeProblem(30);
const titleLines: string[] = wrapWords(['a', 'b'], 100, (text) => text.length);
export const shared: unknown[] = [timeWords(30), analogyWords('a'), differsFactors(30)[0], foldDiffers(' a '), differsStatements(declared), differsEnglish(declared, ['x'], 'fr'), DIFFERS_MOST, DIFFERS_SAID_MOST, DIFFERS_TIME_MOST, DIFFERS_ANALOGY, why,
  frameZoom([1, 2], [3, 4], { share: 0.7, least: 1, most: 2.5, smallest: 1 }), narrowestWidth(100, titleLines.length, (w) => wrapWords(['a', 'b'], w, (t) => t.length).length), NARROWEST_STEPS,
  fitWords('Load Balancer', [170, 70], { measure: (w) => w.length * 0.55 }), fitWords('Load', [170, 70], { measure: { Load: 2.2 } })];

// 0.19.0: a cable on the frame (from StoryDeck and StoryReel), a value on stops, how much of a packet shows
import { CABLE, LABEL_PLACES, MOST_HIDES, MOST_OUTLINE, MOST_WIRES, labelHalf, walkWay, held, labelPlace, exitOutline, exitBox, roundOutline, lanesOf, straightRun, bentWire, curveWay, headingOf, arrowHead, cableWay as headWay, stopShort, cableLead, rounded as roundWay } from 'footprint-story/isometric';
import type { HeldPoints, HeldRun, StraightLane, StraightEnd } from 'footprint-story/isometric';
import { onStops, seenTerms, seenAt } from 'footprint-story/motion';
import type { SeenTerm } from 'footprint-story/motion';
const cableWay = roundWay([[0, 0], [300, 0]], CABLE.corner * 120);
const halfPlate: [number, number] = labelHalf(5);
const hiding: HeldPoints = held([[100, -50], [200, -50], [200, 50], [100, 50]]);
const crossing: HeldRun = { ...held(walkWay(cableWay)), of: cableWay };
const labelAt: [number, number] = labelPlace(cableWay, halfPlate, [hiding], [crossing], { left: CABLE.looks }, [300, 0]);
const stopped = headWay({ points: [[0, 0], [200, 0], [200, 20]], radius: 30 }, CABLE.head * CABLE.headShort);
const stoppedLength: number = stopped.length;
void stoppedLength;
const pulled: [number, number][] = stopShort([[0, 0], [200, 0]], 14.4);
void pulled;
const leadLength: number = cableLead({ points: [[0, -40], [0, 0], [100, 0]], radius: 20 }, 0, 2).length;
void leadLength;
const lanes: (StraightLane | null)[] = lanesOf([['a', 'b'], null]);
const fromEnd: StraightEnd = { middle: [50, 50], box: { x: 0, y: 0, w: 100, h: 100 } }, toEnd: StraightEnd = { middle: [350, 50], outline: [[300, 0], [400, 0], [400, 100], [300, 100]] };
const ran = straightRun(fromEnd, toEnd, lanes[0] ?? undefined);
const bent = ran.why === undefined ? bentWire(ran.start, ran.end, 24, CABLE.head * CABLE.headShort) : null;
const bentCurve = bent ? curveWay([0, 0], bent.corner, bent.tip) : cableWay;
const term: SeenTerm | undefined = seenTerms([[0.2, 0.3, 0.5, 0.6]])[0][0];
export const cablePieces: unknown[] = [labelAt[0], LABEL_PLACES[0], MOST_HIDES, MOST_OUTLINE, MOST_WIRES, exitOutline([[0, 0], [1, 0], [1, 1]], [0.5, 0.2], [1, 0]), exitBox({ x: 0, y: 0, w: 1, h: 1 }, [0.5, 0.5], [0, 1]),
  roundOutline({ cx: 0, cy: 0, rx: 2, ry: 1 }, { cx: 0, cy: 3, rx: 2, ry: 1 })[0].x, bentCurve.at(0.5), arrowHead([1, 0], headingOf([0, 0], [1, 0]))[2][1], onStops([[0, 0], [1, 1]], 0.5), seenAt([[0.2, 0.3, 0.5, 0.6]], 0.4), term?.falling, ran.why];

// 0.22.0: the break rule is a named choice, the same two names on both doors
import { BREAK_RULES } from 'footprint-story/layout';
import type { BreakRule } from 'footprint-story/layout';
const rule: BreakRule = BREAK_RULES[1];
export const breaking: unknown[] = [wrapWords(['a', 'b'], 100, (t) => t.length, { break: rule }), wrapWords(['a'], 1, (t) => t.length, null), fitWords('Load Balancer', [170, 70], { break: 'fill' })];
// @ts-expect-error — a rule not in BREAK_RULES
wrapWords(['a'], 1, (t) => t.length, { break: 'balanced' });

// 0.23.0: styles — a row of named choices, a paint list as data
import { isoStyle, paintPiece, ISO_STYLE_COLUMNS, ISO_STYLE_CHOICES, USUAL_STYLE, MOST_EFFECTS, MOST_OWN_CHOICES, PAINT_ITEMS, MOST_PAINT_ITEMS, MOST_PAINT_POINTS, mixColour } from 'footprint-story/isometric';
import type { IsoStyle, IsoStyleChoice, PaintItem } from 'footprint-story/isometric';
const chalk: IsoStyleChoice = { column: 'texture', name: 'reel:chalk', options: ['lines'], apply: (items: readonly PaintItem[], { random }) => items.map((it) => ({ ...it, role: random() > 2 ? 'x' : it.role })), clashes: [{ column: 'line', name: 'none', fix: 'use ink' }] };
const look: IsoStyle = isoStyle({ line: { name: 'ink', width: 5 }, texture: 'reel:chalk' }, { choices: [chalk] });
const painted = paintPiece(look, { name: 'a', kind: 'block', at: [0, 0], size: [2, 2, 1] }, isometric({ tile: 100 }), { base: '#d9e4f3', ink: '#14181f' });
const first: PaintItem = painted.items[0];
export const styled: unknown[] = [first.role, painted.box.w, look.row.line, ISO_STYLE_COLUMNS[0], ISO_STYLE_CHOICES.line, USUAL_STYLE.shape, MOST_EFFECTS, MOST_OWN_CHOICES, PAINT_ITEMS, MOST_PAINT_ITEMS, MOST_PAINT_POINTS, mixColour('#000000', '#ffffff', 0.5)];
// @ts-expect-error — a column that is not one
isoStyle({ outline: 'ink' });

// The map's steps (0.24.0) and the map flow door
import { buildIsoMap, ISO_MAP_STEPS, ISO_MAP_POLICIES, ISO_MAP_LIMITS } from 'footprint-story/isometric';
import type { IsoMap, IsoMapSpec, IsoMapPolicy, IsoMapStep } from 'footprint-story/isometric';
import { mapFlow, runMapFlow } from 'footprint-story/mapflow';
const mapSpec: IsoMapSpec = { blocks: [{ name: 'web', size: [2, 2, 1], label: 'Web', who: 'blocks[0] ("web")' }, { name: 'db', kind: 'cylinder', size: [2, 2, 1], at: null }], wires: [{ from: { block: 'web' }, to: { block: 'db', port: null } }], area: [0, 0, 1600, 900], style: { line: 'none' } };
const filmPolicy: IsoMapPolicy = { ...ISO_MAP_POLICIES.film, small: null, hold: 'groups' };
const builtMap: IsoMap = buildIsoMap(mapSpec, filmPolicy);
const firstStep: IsoMapStep = ISO_MAP_STEPS[0];
export const mapped: unknown[] = [builtMap.placed === 'build', builtMap.view.tile[0], builtMap.order[0], builtMap.names[0]?.lines, builtMap.shapes[0].faces[0].role, firstStep.decides?.key, firstStep.run({ blocks: builtMap.blocks }).placed, ISO_MAP_LIMITS.pieces, mapFlow()];
runMapFlow(mapSpec, ISO_MAP_POLICIES.deck, { recorders: [] }).then(({ map, snapshot }) => [map.gridWhy, snapshot.commitLog.length]);
// a deck's inputs (0.25.0): obstacles, keep, a floor's icon, the usual grid, the grid word 'fit', the policy's cover
const deckSpec: IsoMapSpec = { blocks: [{ name: 'web', at: [0, 0], size: [2, 2, 1] }], floors: [{ at: [0, 0], size: [6, 3], label: 'Prod', icon: true }],
  obstacles: [{ name: 'lap', at: [0, 4], size: [2, 1, 0.3], ports: [{ name: 'rj45', at: [2, 0.5, 0] }] }], keep: [{ at: [3, 0, 0], size: [1, 1], name: 'note' }],
  wires: [{ from: { block: 'lap', port: 'rj45' }, to: { block: 'web' } }], usualGrid: { tile: 120, origin: [960, 240] } };
const deckMap: IsoMap = buildIsoMap(deckSpec, { ...ISO_MAP_POLICIES.deck, cover: 'block' });
export const decked: unknown[] = [deckMap.grid === 'usual', deckMap.obstacleShapes[0].outline[0][0], deckMap.policy.cover, deckMap.floors[0].icon, ISO_MAP_LIMITS.keep, buildIsoMap({ ...deckSpec, grid: 'fit', area: [0, 0, 1920, 1080] }, ISO_MAP_POLICIES.deck).gridWhy];
// @ts-expect-error a policy's cover is 'drawn' or 'block'
buildIsoMap(deckSpec, { ...ISO_MAP_POLICIES.deck, cover: 'round' });
// @ts-expect-error the grid word is 'fit'
buildIsoMap({ ...deckSpec, grid: 'fitted' }, ISO_MAP_POLICIES.deck);
// @ts-expect-error — a hold that is not one
buildIsoMap(mapSpec, { ...filmPolicy, hold: 'everything' });
// 0.24.0: a style made again from a built map's record
import { restyle } from 'footprint-story/isometric';
export const again: unknown = restyle(isoStyle({ line: 'none' }), { choices: [] });
// 0.26.0: the human door — laws, paths, models, critics
import { minJerk, minJerkSpeed, minJerkAccel, MIN_JERK_PEAK, FITTS, fittsIndex, fittsSeconds, POWER_LAW, powerLawSpeed, powerLawTimes, powerLawFit, SIGMA_LOGNORMAL, STROKE_SIGMAS,
  lognormalShare, lognormalSpeed, strokeEnd, strokeOffset, strokeBetween, sigmaLognormalAt, TREMOR, MOST_TREMOR_KNOTS, tremorKnots, tremorAt, arcTable, pointAt, shareToDistance,
  distanceToShare, MOST_TABLE_POINTS, catmullRom, MOST_CURVE_POINTS, curvatures, resample, MOST_RESAMPLED, HUMAN_FAMILIES, HUMAN_DOS, HUMAN_MODELS, USUAL_MODELS, planMove, sampleMove,
  sampleTrack, MOST_TRACK_SAMPLES, MIN_JERK_BEND, PEN_SPEED, MOST_STROKES, HUMAN_CRITICS, FINDING_LEVELS, checkMove, JERK_PEAK_SHARE, ARC_LEAST, PEN_SPEED_MOST } from 'footprint-story/human';
import type { HumanModel, HumanCritic, HumanMove, HumanSample, HumanTrack, HumanFinding, LognormalStroke, ArcTable, HumanFamily } from 'footprint-story/human';

const lawNumbers: number[] = [minJerk(0.5), minJerkSpeed(0.5), minJerkAccel(0.2), MIN_JERK_PEAK, FITTS.a + FITTS.b + FITTS.target, fittsIndex(100, 20), fittsSeconds(100), fittsSeconds(100, 20, { a: 0 }),
  POWER_LAW.exponent, powerLawSpeed(0.01, { gain: 2 }), powerLawTimes([0, 1], [0, 0], 1)[1], powerLawFit([1, 2, 3], [3, 2, 1])?.exponent ?? 0, SIGMA_LOGNORMAL.gap, STROKE_SIGMAS, TREMOR.amplitude,
  MOST_TREMOR_KNOTS, tremorAt(tremorKnots(Math.random, 100), 50, 100), MOST_TABLE_POINTS, MOST_CURVE_POINTS, MOST_RESAMPLED, MOST_TRACK_SAMPLES, MIN_JERK_BEND, PEN_SPEED, MOST_STROKES, JERK_PEAK_SHARE, ARC_LEAST, PEN_SPEED_MOST];
const stroke: LognormalStroke = strokeBetween([0, 0], [10, 0], { bend: 0.3 });
const pen = sigmaLognormalAt([stroke], strokeEnd(stroke), [0, 0], strokeEnd(stroke));
const strokeNumbers: number[] = [lognormalShare(0.2, stroke), lognormalSpeed(0.2, stroke), strokeOffset(stroke, 1)[0], pen.vx];
const table: ArcTable = arcTable(catmullRom([[0, 0], [10, 0], [10, 10]], { spacing: 2 }));
const pathNumbers: number[] = [pointAt(table, 3)[0], shareToDistance(table, 0.5), distanceToShare(table, 4), curvatures(resample(table.points, { count: 5 }))[0], resample(table.points, { spacing: 2 }).length];
const chalkPen: HumanModel = { family: 'pen', name: 'reel:chalk', options: ['grit'], checks: ['reel:wide'], plan: (intent, context) => ({ seconds: 1, r: context.random(), who: context.who }), sample: (plan, t) => ({ x: t, y: 0, width: 2 }) };
const wide: HumanCritic = { name: 'reel:wide', limit: 1, measure: (track: HumanTrack) => track.samples.length, finding: (v, who) => (v > 1 ? { level: 'note', message: `${who}: wide`, fix: 'nearer' } : null) };
const move: HumanMove = planMove({ do: 'draw', name: 'w', path: [[0, 0], [5, 5]], model: { name: 'reel:chalk', grit: 2 } }, { models: [chalkPen], critics: [wide], frame: [1920, 1080] });
const penAt: HumanSample = sampleMove(move, 0.5, { models: [chalkPen], critics: [wide] });
const findings: readonly HumanFinding[] = checkMove(move, { models: [chalkPen], critics: [wide], rate: 60 }).findings;
const fam: HumanFamily = HUMAN_DOS.draw;
export const human: unknown[] = [lawNumbers, strokeNumbers, pathNumbers, penAt.x + penAt.y, findings[0]?.fix, fam, HUMAN_FAMILIES, HUMAN_MODELS.reach, USUAL_MODELS.pen, HUMAN_CRITICS, FINDING_LEVELS, sampleTrack(planMove({ do: 'reach', from: [0, 0], to: [1, 1] }), { rate: 30 }).samples[0].t, move.reason];
// @ts-expect-error an intent says what to do in its own words
planMove({ do: 'jump' });
// @ts-expect-error a resample is by spacing or count
resample([[0, 0], [1, 1]], { every: 2 });
// 0.26.0, after review: the move's choice and the plan's basis as data; lists in a sample; a critic's basis
import { curvaturesOver, legGaps, MOST_BEND, BEND_WIDTH, MOST_SAMPLE_LIST, UNSEEDED_KEYS } from 'footprint-story/human';
import type { HumanBasis, HumanSampleValue } from 'footprint-story/human';
const chain: HumanModel = { family: 'hang', name: 'reel:chain', plan: () => ({ seconds: 1, basis: { links: 3, slack: true } }), sample: () => ({ x: 0, y: 0, chain: [[0, 0], [0, 10]], weights: [1, 2] }) };
const chained = planMove({ do: 'hang', model: 'reel:chain' }, { models: [chain] });
const by: 'named' | 'usual' = chained.choice.by;
const basis: HumanBasis | undefined = chained.plan.basis;
const links: HumanSampleValue = sampleMove(chained, 0, { models: [chain] }).chain;
const based: HumanCritic = { name: 'reel:b', limit: 1, measure: () => ({ value: 2, basis: { exponent: 0.3 } }), finding: (v, who, b) => (b && v > 1 ? { level: 'warn', message: who, fix: 'x' } : null) };
export const reviewed: unknown[] = [by, basis, links, based, curvaturesOver([[0, 0], [1, 1], [2, 0]], 1)[1], legGaps([[0, 0], [4, 0], [1, 0]], 2)[0], MOST_BEND + BEND_WIDTH + MOST_SAMPLE_LIST, UNSEEDED_KEYS, checkMove(chained, { models: [chain] }).bases];
// 0.27.0: light physics on the human door — models for throw, fall, hang and settle; wrappers; the physics parts; critics
import { anticipate, followThrough, hold, overshoot, basePlan, isWrapped, BY_SHARE, MIN_TRAVEL, MOST_WRAPPERS, WRAPPER_NAMES, launch, flightAt, headingAt, fallSeconds,
  APEX_SHARE, MIN_APEX, bounces, bounceAt, MIN_BOUNCE, MOST_BOUNCES, runChain, relaxChain, pinAt, MIN_CHAIN_PASSES, CHAIN_REST_SPEED, CHAIN_LENGTH_TOLERANCE, MIN_CHAIN_LINK,
  makeWorld, readWorld, pushOut, collide, depthIn, MOST_BOXES, verletStep, simulate, PHYSICS_STEP, STEPS_PER_FRAME, GRAVITY, MOST_PHYSICS_SECONDS, settleLeft, settleSeconds,
  THROW_KEYS, FALL_KEYS, SQUASH_SECONDS, MOST_CHAIN_LINKS, MOST_CHAIN_SECONDS, MOST_PATH_KEYS, OVERSHOOT_SEEN, SPACING_LEAST, VOLUME_MOST, CONTACT_MOST } from 'footprint-story/human';
import type { HumanWorld, WrappedPlan, WrapperName, SpringFeel, BounceSegment } from 'footprint-story/human';
const thrown: HumanMove = planMove({ do: 'throw', who: 'ball', from: [0, 600], to: [600, 600], boxes: [{ x: 250, y: 300, w: 100, h: 100 }] });
const lively: HumanMove = overshoot(anticipate(thrown, { share: 0.2 }), { by: 12, feel: 'snappy' });
const kept: HumanMove = hold(followThrough(lively), { at: 0.1, seconds: 0.2 });
const names: readonly WrapperName[] = kept.wrappers ?? [];
const wrappedPlan: WrappedPlan | null = isWrapped(kept.plan) ? kept.plan : null;
const ownFeel: SpringFeel = { k: 200, d: 20 };
const world: HumanWorld = makeWorld({ floor: 900, boxes: [{ x: 0, y: 0, w: 10, h: 10 }] });
const bounced = bounces([0, 0], [0, 0], { floor: 100, gravity: GRAVITY, restitution: 0.5, keep: 1 });
const segment: BounceSegment = bounced.segments[0];
const chainRun = runChain({ pin: [0, 0], path: [[1, 10, 0]], points: [0, 0, 0, 10], rest: 10, gravity: GRAVITY, keep: 1, world, steps: 8, settle: false });
const physicsNumbers: number[] = [BY_SHARE, MIN_TRAVEL, MOST_WRAPPERS, launch([0, 0], [10, 0], { apex: 5, gravity: GRAVITY }).seconds, flightAt([0, 0], [1, 1], GRAVITY, 0.1)[1], headingAt([1, 0], GRAVITY, 0.1),
  fallSeconds(0, 0, 100, GRAVITY) ?? 0, APEX_SHARE, MIN_APEX, bounceAt({ ...bounced, landed: bounced.duration, gravity: GRAVITY }, 0.1)[1], MIN_BOUNCE, MOST_BOUNCES, chainRun.frames.length,
  relaxChain([0, 0, 0, 12], 10, [0, 0])[3], pinAt([0, 0], [[1, 10, 0]], 0.5)[0], MIN_CHAIN_PASSES, CHAIN_REST_SPEED, CHAIN_LENGTH_TOLERANCE, MIN_CHAIN_LINK, pushOut(5, 5, world)[0],
  collide([0, 0, 5, 950], world)[3], depthIn(5, 5, world, 1), MOST_BOXES, verletStep([0, 0], [0, 0], [0, GRAVITY], PHYSICS_STEP)[1], simulate({ points: [0, 0] }, (s) => s, { steps: 4 }).steps,
  STEPS_PER_FRAME, MOST_PHYSICS_SECONDS, settleLeft(0.1, ownFeel), settleSeconds('heavy'), SQUASH_SECONDS, MOST_CHAIN_LINKS, MOST_CHAIN_SECONDS, MOST_PATH_KEYS, OVERSHOOT_SEEN,
  SPACING_LEAST, VOLUME_MOST, CONTACT_MOST, segment.at, readWorld({ floor: 1 }, 'me').boxes.length];
const dropModel: HumanModel = { family: ['fall', 'throw'], name: 'reel:drop', plan: () => ({ seconds: 1 }), sample: (plan, t) => ({ x: 0, y: t }) };
export const physics: unknown[] = [names, wrappedPlan, basePlan(kept.plan).seconds, WRAPPER_NAMES, THROW_KEYS, FALL_KEYS, physicsNumbers, dropModel, sampleTrack(kept).plan, checkMove(lively).findings];
// @ts-expect-error a hold says when and for how long
hold(thrown, { seconds: 1 });
// 0.27.0, last round: bells counted from the motion; one settle rule; spacing's upper bound
import { wrappedPushes, checkSettles, SETTLED_WITHIN, SPACING_MOST } from 'footprint-story/human';
export const lastRound: number[] = [wrappedPushes(kept.plan, (p, t) => ({ x: t, y: 0 })), checkSettles('snappy', 'me'), SETTLED_WITHIN, SPACING_MOST];
// the intent decider: steps in one list, planIntents, and the humanflow door
import { planIntents, HUMAN_STEPS, HUMAN_INPUT, CHOOSE_RULES, MOST_INTENTS, SUMMARY_POINTS, PER_INTENT, intentKey } from 'footprint-story/human';
import type { HumanIntentsResult, HumanIntentEntry, HumanStep, ChooseRule, HumanChoice } from 'footprint-story/human';
import { humanFlow, runHumanFlow } from 'footprint-story/humanflow';
const entries: HumanIntentEntry[] = [{ do: 'reach', name: 'hand', from: [0, 0], to: [300, 200], wrap: [{ wrapper: 'anticipate', share: 0.2 }] }, { do: 'throw', from: [0, 500], to: [600, 500] }];
const decided: HumanIntentsResult = planIntents(entries, { frame: [1920, 1080] });
const firstChoice: HumanChoice = decided.choices[0], chooser: HumanStep = HUMAN_STEPS[1], chooseRule: ChooseRule = CHOOSE_RULES[0];
export const intentDecider: unknown[] = [decided.chose === 'own', decided.durations[0].basis?.bits, decided.tracks[0].points[0][1], decided.findings[0]?.fix, firstChoice.rule, chooser.decides?.key, chooseRule.then, HUMAN_INPUT, MOST_INTENTS, SUMMARY_POINTS, humanFlow({ models: [] })];
export const perIntent: unknown[] = [decided['duration-0'].seconds, decided['model-1'].rule, decided['findings-0'][0]?.fix, decided[intentKey('duration', 1)].wrappers, PER_INTENT.duration];
runHumanFlow(entries, { recorders: [], frame: null }).then(({ result, snapshot }) => [result.choseWhy, snapshot.commitLog.length]);
// @ts-expect-error a wrapper that is not one
planIntents([{ do: 'reach', from: [0, 0], to: [1, 1], wrap: [{ wrapper: 'squash' }] }]);
// @ts-expect-error the decider's chart takes no frame: it is the run's input
humanFlow({ frame: [1, 1] });
// 0.30.0: rolling, tumbling and sliding — the roll, slide and tumble families, the glide law, the hand-over rule, the critics
import { glide, glideAt, restSpeed, touchAlong, ROLL_SHAPES, ROLLING_RESISTANCE, MOST_SLOPE, rollTurn, rollingPush, landRoll, KINETIC_FRICTION, STATIC_FRICTION, slidingPush,
  slideDistance, spinAt, faceSpin, ROLL_KEYS, MIN_ROLL_RADIUS, SLIDE_KEYS, MOST_FRICTION, TUMBLE_KEYS, TUMBLE_SHAPES, LANDING_RULES, GROUND_PLANES, MOST_GROUND_SPEED, OFF_LINE,
  ROLL_SLIP_MOST, SPIN_MOST, SPIN_FLOOR } from 'footprint-story/human';
import type { Glide, GlideSegment, LandingRule } from 'footprint-story/human';
const rolled: HumanMove = planMove({ do: 'roll', who: 'ball', from: [0, 490], to: [600, 490], radius: 20, shape: 'disc' });
const slid: HumanMove = planMove({ do: 'slide', from: [0, 0], speed: 500, plane: 'floor', heading: 30 });
const tumbled: HumanMove = planMove({ do: 'tumble', from: [0, 300], to: [400, 500], radius: 10, shape: 'box' });
const glided: Glide = glide({ speed: 280, ...rollingPush({ along: 0, normal: 1960, resistance: ROLLING_RESISTANCE, inertia: ROLL_SHAPES.ball }), most: 30 });
const piece: GlideSegment | undefined = glided.segments[0];
const landingRule: LandingRule | undefined = LANDING_RULES[0];
const rollFamily: HumanFamily = HUMAN_DOS.roll;
const touch = touchAlong([0, 0], [1, 0], makeWorld({ boxes: [{ x: 10, y: -5, w: 5, h: 10 }] }), 2);
export const rolling: unknown[] = [rolled, slid, tumbled, piece?.a, landingRule?.then, rollFamily, touch.box, glideAt(glided, 1).q, restSpeed(1, 2), MOST_SLOPE, rollTurn(1, 2), landRoll(1, 2, 3, 0.4),
  KINETIC_FRICTION + STATIC_FRICTION, slidingPush({ along: 0, normal: 1, kinetic: 0.2, still: 0.3 }).hold, slideDistance(1, 0.2, 1960), spinAt(0, 1, 2), faceSpin(0, 1, 2, 4), ROLL_KEYS, MIN_ROLL_RADIUS,
  SLIDE_KEYS, MOST_FRICTION, TUMBLE_KEYS, TUMBLE_SHAPES, GROUND_PLANES, MOST_GROUND_SPEED + OFF_LINE, ROLL_SLIP_MOST + SPIN_MOST + SPIN_FLOOR, sampleMove(rolled, 1).angle];
// @ts-expect-error a roll's do is 'roll', never 'rolling'
planMove({ do: 'rolling' });
