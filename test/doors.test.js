// The ten doors (the record door and the mapflow door, the two that reach a package, are the last tests). The pure door ('footprint-story'), the motion door ('footprint-story/motion'), the storyboard door
// ('footprint-story/storyboard'), the shot door ('footprint-story/shot'), the isometric door ('footprint-story/isometric'), the layout door ('footprint-story/layout') and the human door ('footprint-story/human') run in a browser: nothing they reach may import a Node module, or every React project
// that bundles them breaks. The voice door
// ('footprint-story/voice') is Node only. The motion door is its own: the pure door never loads it, so a page that
// only captions never pays for motion. Every public symbol has ONE door, and the hand-kept types declare every symbol
// their door hands out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// every way a module names another: import/export … from '…', a bare import '…', and import('…')
const specifiers = (file) => [...readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]/gm)].map((m) => m[1] ?? m[2] ?? m[3]);

/** Every file a door reaches, and every specifier each one imports. */
function reach(door) {
  const seen = new Map(), todo = [path.join(root, door)];
  while (todo.length) {
    const file = todo.pop();
    if (seen.has(file)) continue;
    const specs = specifiers(file);
    seen.set(file, specs);
    for (const s of specs) if (s.startsWith('.')) todo.push(path.resolve(path.dirname(file), s));
  }
  return seen;
}

/** Every .js file under a folder of src/, its subfolders too, as a path from the package's root. */
const filesUnder = (dir) => readdirSync(path.join(root, dir)).flatMap((f) => (statSync(path.join(root, dir, f)).isDirectory() ? filesUnder(`${dir}/${f}`) : f.endsWith('.js') ? [`${dir}/${f}`] : []));

const NODE = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const relative = (file) => path.relative(root, file);

test('the pure door, the motion door, the storyboard door, the shot door, the isometric door and the layout door reach no Node module and no package: they run in a browser', () => {
  for (const [file, specs] of [...reach('index.js'), ...reach('motion.js'), ...reach('storyboard.js'), ...reach('shot.js'), ...reach('isometric.js'), ...reach('layout.js')]) {
    for (const s of specs) {
      assert.ok(!NODE.has(s) && !s.startsWith('node:'), `${relative(file)} imports ${s}: the pure door must run in a browser`);
      assert.ok(s.startsWith('.'), `${relative(file)} imports the package ${s}: footprint-story has no dependencies`);
    }
  }
});

test('every source file is behind exactly one door, only the voice door reaches src/voice, only the motion door src/motion', () => {
  const pure = [...reach('index.js').keys()].map(relative), voice = [...reach('voice.js').keys()].map(relative), motion = [...reach('motion.js').keys()].map(relative), board = [...reach('storyboard.js').keys()].map(relative), shot = [...reach('shot.js').keys()].map(relative), iso = [...reach('isometric.js').keys()].map(relative), layout = [...reach('layout.js').keys()].map(relative);
  assert.ok(pure.every((f) => !f.startsWith('src/voice/')), 'src/voice is Node only');
  assert.ok([...pure, ...voice].every((f) => !f.startsWith('src/motion/')), 'src/motion loads only through its own door');
  assert.ok(motion.every((f) => f === 'motion.js' || f.startsWith('src/motion/')), 'the motion door reaches nothing else');
  assert.ok([...pure, ...voice, ...motion].every((f) => !f.startsWith('src/storyboard/')), 'src/storyboard loads only through its own door');
  assert.ok(board.every((f) => f === 'storyboard.js' || f.startsWith('src/storyboard/')), 'the storyboard door reaches nothing else');
  assert.ok([...pure, ...voice, ...motion, ...board].every((f) => !f.startsWith('src/shot/')), 'src/shot loads only through its own door');
  assert.ok(shot.every((f) => f === 'shot.js' || f.startsWith('src/shot/')), 'the shot door reaches nothing else');
  assert.ok([...pure, ...voice, ...motion, ...board, ...shot].every((f) => !f.startsWith('src/isometric/')), 'src/isometric loads only through its own door');
  assert.ok(iso.every((f) => f === 'isometric.js' || f.startsWith('src/isometric/')), 'the isometric door reaches nothing else');
  assert.ok([...pure, ...voice, ...motion, ...board, ...shot, ...iso].every((f) => !f.startsWith('src/layout/')), 'src/layout loads only through its own door');
  assert.ok(layout.every((f) => f === 'layout.js' || f.startsWith('src/layout/')), 'the layout door reaches nothing else');
  const files = ['spoken', 'sentences', 'captions', 'chapters', 'said', 'differs', 'voice', 'motion', 'storyboard', 'shot', 'isometric', 'layout'].flatMap((d) => readdirSync(path.join(root, 'src', d)).filter((f) => f.endsWith('.js')).map((f) => `src/${d}/${f}`));
  for (const f of files) assert.ok(pure.includes(f) || voice.includes(f) || motion.includes(f) || board.includes(f) || shot.includes(f) || iso.includes(f) || layout.includes(f), `${f} is behind no door`);
  for (const f of voice.filter((v) => v.startsWith('src/') && !v.startsWith('src/voice/'))) assert.ok(pure.includes(f), `${f}: a pure file the voice door uses is pure, behind the pure door too`);
});

test('every public symbol has one door, and its types declare it', async () => {
  const doors = { 'index.js': Object.keys(await import('../index.js')), 'voice.js': Object.keys(await import('../voice.js')), 'motion.js': Object.keys(await import('../motion.js')), 'storyboard.js': Object.keys(await import('../storyboard.js')), 'shot.js': Object.keys(await import('../shot.js')), 'isometric.js': Object.keys(await import('../isometric.js')), 'layout.js': Object.keys(await import('../layout.js')), 'record.js': Object.keys(await import('../record.js')), 'mapflow.js': Object.keys(await import('../mapflow.js')), 'human.js': Object.keys(await import('../human.js')) };
  const all = Object.values(doors).flat();
  assert.deepEqual(all.filter((name, i) => all.indexOf(name) !== i), [], 'a symbol with two doors');
  for (const [door, names] of Object.entries(doors)) {
    const types = readFileSync(path.join(root, door.replace(/\.js$/, '.d.ts')), 'utf8');
    for (const name of names) assert.match(types, new RegExp(`export (?:declare )?(?:function|const) ${name}\\b`), `${door.replace(/\.js$/, '.d.ts')} does not declare ${name}`);
    // and the other way round: the types promise no function or value the door does not hand out
    for (const [, declared] of types.matchAll(/^export (?:declare )?(?:function|const) (\w+)/gm)) assert.ok(names.includes(declared), `${door.replace(/\.js$/, '.d.ts')} declares ${declared}, which ${door} does not export`);
  }
});

test('the record door is Node only and reaches footprintjs and foottrace, the caller\'s own', () => {
  const record = reach('record.js'), others = [...reach('index.js'), ...reach('voice.js'), ...reach('motion.js'), ...reach('storyboard.js'), ...reach('shot.js'), ...reach('isometric.js'), ...reach('layout.js'), ...reach('mapflow.js')];
  for (const [file] of others) assert.ok(!relative(file).startsWith('src/record/'), `${relative(file)}: src/record loads only through its own door`);
  const packages = [...record].flatMap(([, specs]) => specs.filter((s) => !s.startsWith('.') && !NODE.has(s))).map((s) => s.split('/')[0]);
  assert.deepEqual([...new Set(packages)].sort(), ['footprintjs', 'foottrace']);
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), ['footprintjs', 'foottrace']);
  assert.ok(Object.values(pkg.peerDependenciesMeta).every((m) => m.optional === true), 'optional: a page that only captions installs neither');
  assert.equal(pkg.dependencies, undefined);
  for (const [file] of record) assert.ok(relative(file) === 'record.js' || relative(file).startsWith('src/record/') || relative(file) === 'src/said/oneline.js', `${relative(file)}: the record door reaches its own folder and the one-line rule`);
});

test('the mapflow door reaches footprintjs alone, its own folder, and the isometric files the map\'s steps compose — no others', () => {
  const flow = reach('mapflow.js'), others = [...reach('index.js'), ...reach('voice.js'), ...reach('motion.js'), ...reach('storyboard.js'), ...reach('shot.js'), ...reach('isometric.js'), ...reach('layout.js'), ...reach('record.js')];
  for (const [file] of others) assert.ok(!relative(file).startsWith('src/mapflow/'), `${relative(file)}: src/mapflow loads only through its own door`);
  const packages = [...flow].flatMap(([, specs]) => specs.filter((s) => !s.startsWith('.'))).map((s) => s.split('/')[0]);
  assert.deepEqual([...new Set(packages)], ['footprintjs'], 'footprintjs, the caller\'s own (an optional peer), and no Node module: a chart runs anywhere footprintjs does');
  // what it may reach of src/isometric is what the steps reach (mapSteps.js and the reader of its input): it composes
  // the one copy of the algorithm, never a second
  const steps = new Set([...reach('src/isometric/mapSteps.js').keys()].map(relative));
  for (const [file] of flow) {
    const f = relative(file);
    assert.ok(f === 'mapflow.js' || f.startsWith('src/mapflow/') || steps.has(f), `${f}: the mapflow door reaches its own folder and the map's steps`);
  }
  assert.ok(steps.has('src/isometric/mapSpec.js') && [...steps].every((f) => f.startsWith('src/isometric/')), 'the steps reach the isometric folder only');
  for (const f of readdirSync(path.join(root, 'src', 'mapflow')).filter((x) => x.endsWith('.js'))) assert.ok(flow.has(path.join(root, 'src', 'mapflow', f)), `src/mapflow/${f} is behind no door`);
});

test('the human door is pure — no Node module, no package — and loads only src/human; no other door reaches src/human, and every file there is behind it', () => {
  const human = reach('human.js'), others = [...reach('index.js'), ...reach('voice.js'), ...reach('motion.js'), ...reach('storyboard.js'), ...reach('shot.js'), ...reach('isometric.js'), ...reach('layout.js'), ...reach('record.js'), ...reach('mapflow.js')];
  for (const [file, specs] of human) {
    assert.ok(relative(file) === 'human.js' || relative(file).startsWith('src/human/'), `${relative(file)}: the human door reaches its own folder only (a page that moves a hand never loads the isometric maths)`);
    for (const s of specs) {
      assert.ok(!NODE.has(s) && !s.startsWith('node:'), `${relative(file)} imports ${s}: the human door must run in a browser`);
      assert.ok(s.startsWith('.'), `${relative(file)} imports the package ${s}: footprint-story/human has no dependencies`);
    }
  }
  for (const [file] of others) assert.ok(!relative(file).startsWith('src/human/'), `${relative(file)}: src/human loads only through its own door`);
  const behind = new Set([...human.keys()].map(relative));
  for (const f of filesUnder('src/human')) assert.ok(behind.has(f), `${f} is behind no door`);
});
