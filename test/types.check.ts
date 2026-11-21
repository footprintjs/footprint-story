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
import { CABLE, LABEL_PLACES, MOST_HIDES, MOST_OUTLINE, MOST_WIRES, labelHalf, walkWay, held, labelPlace, exitOutline, exitBox, roundOutline, lanesOf, straightRun, bentWire, curveWay, headingOf, arrowHead, cableWay as headWay, rounded as roundWay } from 'footprint-story/isometric';
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
const lanes: (StraightLane | null)[] = lanesOf([['a', 'b'], null]);
const fromEnd: StraightEnd = { middle: [50, 50], box: { x: 0, y: 0, w: 100, h: 100 } }, toEnd: StraightEnd = { middle: [350, 50], outline: [[300, 0], [400, 0], [400, 100], [300, 100]] };
const ran = straightRun(fromEnd, toEnd, lanes[0] ?? undefined);
const bent = ran.why === undefined ? bentWire(ran.start, ran.end, 24, CABLE.head * CABLE.headShort) : null;
const bentCurve = bent ? curveWay([0, 0], bent.corner, bent.tip) : cableWay;
const term: SeenTerm | undefined = seenTerms([[0.2, 0.3, 0.5, 0.6]])[0][0];
export const cablePieces: unknown[] = [labelAt[0], LABEL_PLACES[0], MOST_HIDES, MOST_OUTLINE, MOST_WIRES, exitOutline([[0, 0], [1, 0], [1, 1]], [0.5, 0.2], [1, 0]), exitBox({ x: 0, y: 0, w: 1, h: 1 }, [0.5, 0.5], [0, 1]),
  roundOutline({ cx: 0, cy: 0, rx: 2, ry: 1 }, { cx: 0, cy: 3, rx: 2, ry: 1 })[0].x, bentCurve.at(0.5), arrowHead([1, 0], headingOf([0, 0], [1, 0]))[2][1], onStops([[0, 0], [1, 1]], 0.5), seenAt([[0.2, 0.3, 0.5, 0.6]], 0.4), term?.falling, ran.why];
