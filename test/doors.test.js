// The eight doors (the record door, Node only and the one that reaches a package, is the last test). The pure door ('footprint-story'), the motion door ('footprint-story/motion'), the storyboard door
// ('footprint-story/storyboard'), the shot door ('footprint-story/shot'), the isometric door ('footprint-story/isometric') and the layout door ('footprint-story/layout') run in a browser: nothing they reach may import a Node module, or every React project
// that bundles them breaks. The voice door
// ('footprint-story/voice') is Node only. The motion door is its own: the pure door never loads it, so a page that
// only captions never pays for motion. Every public symbol has ONE door, and the hand-kept types declare every symbol
// their door hands out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
  const doors = { 'index.js': Object.keys(await import('../index.js')), 'voice.js': Object.keys(await import('../voice.js')), 'motion.js': Object.keys(await import('../motion.js')), 'storyboard.js': Object.keys(await import('../storyboard.js')), 'shot.js': Object.keys(await import('../shot.js')), 'isometric.js': Object.keys(await import('../isometric.js')), 'layout.js': Object.keys(await import('../layout.js')), 'record.js': Object.keys(await import('../record.js')) };
  const all = Object.values(doors).flat();
  assert.deepEqual(all.filter((name, i) => all.indexOf(name) !== i), [], 'a symbol with two doors');
  for (const [door, names] of Object.entries(doors)) {
    const types = readFileSync(path.join(root, door.replace(/\.js$/, '.d.ts')), 'utf8');
    for (const name of names) assert.match(types, new RegExp(`export (?:declare )?(?:function|const) ${name}\\b`), `${door.replace(/\.js$/, '.d.ts')} does not declare ${name}`);
    // and the other way round: the types promise no function or value the door does not hand out
    for (const [, declared] of types.matchAll(/^export (?:declare )?(?:function|const) (\w+)/gm)) assert.ok(names.includes(declared), `${door.replace(/\.js$/, '.d.ts')} declares ${declared}, which ${door} does not export`);
  }
});

test('the record door is Node only and the one door that reaches a package: footprintjs and foottrace, the caller\'s own', () => {
  const record = reach('record.js'), others = [...reach('index.js'), ...reach('voice.js'), ...reach('motion.js'), ...reach('storyboard.js'), ...reach('shot.js'), ...reach('isometric.js'), ...reach('layout.js')];
  for (const [file] of others) assert.ok(!relative(file).startsWith('src/record/'), `${relative(file)}: src/record loads only through its own door`);
  const packages = [...record].flatMap(([, specs]) => specs.filter((s) => !s.startsWith('.') && !NODE.has(s))).map((s) => s.split('/')[0]);
  assert.deepEqual([...new Set(packages)].sort(), ['footprintjs', 'foottrace']);
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), ['footprintjs', 'foottrace']);
  assert.ok(Object.values(pkg.peerDependenciesMeta).every((m) => m.optional === true), 'optional: a page that only captions installs neither');
  assert.equal(pkg.dependencies, undefined);
  for (const [file] of record) assert.ok(relative(file) === 'record.js' || relative(file).startsWith('src/record/') || relative(file) === 'src/said/oneline.js', `${relative(file)}: the record door reaches its own folder and the one-line rule`);
});
