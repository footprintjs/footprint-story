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
  readTransition, extendTransitions, checkTransition, TRANSITIONS, SECONDS, readSettings, isColor, readPace, PACES } from 'footprint-story/motion';
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
