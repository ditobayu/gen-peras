import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Run the actual TypeScript implementation; the temporary ES modules keep test failures readable.
const temporary = await mkdtemp(join(tmpdir(), 'peras-preparation-'));
const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
await writeFile(join(temporary, 'engine.mjs'), transpile(await readFile(new URL('../src/engine.ts', import.meta.url), 'utf8')));
await writeFile(join(temporary, 'preparation.mjs'), transpile(await readFile(new URL('../src/preparation.ts', import.meta.url), 'utf8')).replaceAll("from './engine'", "from './engine.mjs'"));
const { createPreparation, reducePreparation: reduce, tickPreparation: tick, serializePrep, restorePrep, preparationQuality, blendQualityAt, PREP_TIMING } = await import(pathToFileURL(join(temporary, 'preparation.mjs')).href);
const { newGame, reserveIngredients, completeOrder, makeOrder } = await import(pathToFileURL(join(temporary, 'engine.mjs')).href);
let passed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-8, message ?? `${actual} != ${expected}`);
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function select(recipe = 'mango', modifier = 'Biasa') {
  let prep = createPreparation(recipe, modifier);
  for (const fruit of prep.requiredFruits) prep = reduce(prep, { type: 'PICK_FRUIT', fruit });
  return prep;
}
function cut(recipe = 'mango', modifier = 'Biasa') {
  let prep = select(recipe, modifier);
  for (let i = 0; i < 3; i++) { prep = reduce(prep, { type: 'SLICE', distance: .2, id: `cut-${i}` }); prep = tick(prep, .4); }
  return prep;
}
function load(recipe = 'mango', modifier = 'Biasa') {
  let prep = cut(recipe, modifier);
  prep = tick(reduce(prep, { type: 'LOAD_PORTION', id: 'load-1' }), .7);
  prep = tick(reduce(prep, { type: 'LOAD_PORTION', id: 'load-2' }), .7);
  if (modifier !== 'Tanpa es') prep = tick(reduce(prep, { type: 'ADD_ICE', id: 'ice' }), .7);
  return tick(reduce(prep, { type: 'ADD_LIQUID', id: 'liquid' }), .7);
}
function blend(seconds = 3.6, recipe = 'mango', modifier = 'Biasa') {
  let prep = reduce(load(recipe, modifier), { type: 'BLEND_START' });
  prep = tick(prep, seconds); return reduce(prep, { type: 'BLEND_STOP' });
}
function filled(fill = .93, seconds = 3.6, recipe = 'mango', modifier = 'Biasa') {
  let prep = reduce(blend(seconds, recipe, modifier), { type: 'POUR_START', tilt: .65 });
  const rate = (.65 - .2) / .8 * .44;
  prep = tick(prep, fill / rate);
  prep = reduce(prep, { type: 'POUR_STOP' });
  return prep;
}
function assertMass(prep) {
  close(prep.fill + prep.spilled + prep.remaining * prep.totalVolume, prep.totalVolume, 'liquid mass must be conserved');
  assert(prep.fill >= 0 && prep.fill <= 1); assert(prep.remaining >= 0 && prep.remaining <= 1); assert(prep.spilled >= 0);
}

try {
  test('waiting never selects, slices, loads, blends, pours, or serves a drink', () => {
    const fresh = tick(createPreparation('mango'), 60); assert.equal(fresh.phase, 'select'); assert.deepEqual(fresh.selectedFruits, []);
    const selected = tick(select(), 60); assert.equal(selected.phase, 'cut'); assert.equal(selected.cuts, 0);
    const cutFruit = tick(cut(), 60); assert.equal(cutFruit.phase, 'load'); assert.equal(cutFruit.loadedPortions, 0);
    const loaded = tick(load(), 60); assert.equal(loaded.phase, 'blend'); assert.equal(loaded.blendSeconds, 0);
    const blended = tick(blend(), 60); assert.equal(blended.phase, 'pour'); assert.equal(blended.fill, 0);
    const ready = reduce(filled(), { type: 'FINISH_POUR' }); assert.equal(tick(ready, 60).phase, 'ready');
  });
  test('fruit picking is immutable, recipe-specific, and deduplicated', () => {
    const prep = freeze(createPreparation('mango')); assert.equal(reduce(prep, { type: 'PICK_FRUIT', fruit: 'orange' }), prep);
    const picked = reduce(prep, { type: 'PICK_FRUIT', fruit: 'mango', id: 'single-pick' });
    assert.equal(picked.phase, 'cut'); assert.deepEqual(prep.selectedFruits, []); assert.deepEqual(picked.selectedFruits, ['mango']);
    assert.equal(reduce(picked, { type: 'PICK_FRUIT', fruit: 'mango', id: 'single-pick' }), picked);
    assert.equal(reduce(picked, { type: 'PICK_FRUIT', fruit: 'mango' }), picked);
  });
  test('multiingredient recipes require every fruit type before cutting', () => {
    let prep = createPreparation('tropical'); assert.deepEqual(prep.requiredFruits, ['mango', 'pineapple', 'banana']);
    prep = reduce(prep, { type: 'PICK_FRUIT', fruit: 'pineapple' }); assert.equal(prep.phase, 'select');
    prep = reduce(prep, { type: 'PICK_FRUIT', fruit: 'mango' }); assert.equal(prep.phase, 'select');
    assert.equal(reduce(prep, { type: 'SLICE', distance: 1 }), prep);
    prep = reduce(prep, { type: 'PICK_FRUIT', fruit: 'banana' }); assert.equal(prep.phase, 'cut');
  });
  test('three real slicing gestures are required, with a forgiving minimum distance', () => {
    let prep = select();
    for (const distance of [0, -.5, .079, NaN, Infinity]) assert.equal(reduce(prep, { type: 'SLICE', distance }), prep);
    prep = reduce(prep, { type: 'SLICE', distance: .08, id: 'slice-a' }); assert.equal(prep.cuts, 1);
    assert.equal(reduce(prep, { type: 'SLICE', distance: .5 }), prep);
    prep = tick(prep, .2); assert(prep.gesture > 0 && prep.gesture < 1);
    assert.equal(reduce(prep, { type: 'SLICE', distance: .5, id: 'slice-a' }), prep);
    prep = reduce(prep, { type: 'SLICE', distance: .5 }); prep = tick(prep, .2);
    prep = reduce(prep, { type: 'SLICE', distance: .5 }); assert.equal(prep.cuts, 3); assert.equal(prep.phase, 'load');
    assert.equal(reduce(prep, { type: 'SLICE', distance: .5 }), prep);
  });
  test('loading needs two group drops plus ice and liquid, with visible transfer progress', () => {
    let prep = reduce(cut(), { type: 'LOAD_PORTION', id: 'group-a' }); assert.equal(prep.loadedPortions, 1); assert.equal(prep.transfer, 0);
    assert.equal(reduce(prep, { type: 'LOAD_PORTION' }), prep); prep = tick(prep, .3); assert(prep.transfer > 0 && prep.transfer < 1);
    assert.equal(reduce(prep, { type: 'LOAD_PORTION', id: 'group-a' }), prep);
    prep = tick(reduce(prep, { type: 'LOAD_PORTION', id: 'group-b' }), .7); assert.equal(prep.loadedPortions, 2); assert.equal(prep.phase, 'load');
    assert.equal(reduce(prep, { type: 'LOAD_PORTION' }), prep);
    prep = tick(reduce(prep, { type: 'ADD_ICE' }), .7); assert.equal(prep.phase, 'load');
    assert.equal(reduce(prep, { type: 'ADD_ICE' }), prep);
    prep = reduce(prep, { type: 'ADD_LIQUID' }); assert.equal(prep.phase, 'blend'); assert.equal(prep.liquidType, 'water');
    assert.equal(prep.blendHeld, false); assert.equal(prep.blendSeconds, 0);
  });
  test('no-ice orders skip ice and milk recipes can use water for no-milk preferences', () => {
    const noIce = load('mango', 'Tanpa es'); assert.equal(noIce.phase, 'blend'); assert.equal(noIce.iceAdded, false);
    const avocado = load('avocado'); assert.equal(avocado.liquidType, 'milk');
    const dairyFree = load('avocado', 'Tanpa susu'); assert.equal(dairyFree.liquidType, 'water');
    const correct = reduce(filled(.93, 3.6, 'avocado', 'Tanpa susu'), { type: 'FINISH_POUR' });
    assert(preparationQuality({ ...correct, liquidType: 'milk' }) < .8);
  });
  test('blending runs only while held, supports partial pulses, and release decides the stage', () => {
    let prep = load(); prep = reduce(prep, { type: 'BLEND_START' }); prep = tick(prep, .45);
    prep = reduce(prep, { type: 'BLEND_STOP' }); assert.equal(prep.phase, 'blend'); close(prep.blendSeconds, .45);
    const waiting = tick(prep, 20); close(waiting.blendSeconds, .45); assert.equal(waiting.phase, 'blend');
    prep = tick(reduce(waiting, { type: 'BLEND_START' }), 2.9); assert.equal(prep.phase, 'blend'); assert.equal(prep.blendQuality, 'perfect');
    prep = reduce(prep, { type: 'BLEND_STOP' }); assert.equal(prep.phase, 'pour'); assert.equal(prep.blendHeld, false); close(prep.blendSeconds, 3.35);
  });
  test('an indefinitely held blender never transitions automatically and eventually overblends', () => {
    const prep = tick(reduce(load(), { type: 'BLEND_START' }), 20);
    assert.equal(prep.phase, 'blend'); assert.equal(prep.blendHeld, true); assert.equal(prep.blendQuality, 'over');
    assert.equal(blendQualityAt(1.1), 'chunky'); assert.equal(blendQualityAt(2), 'almost'); assert.equal(blendQualityAt(3.6), 'perfect'); assert.equal(blendQualityAt(6.6), 'over');
  });
  test('pouring is controlled by hold and tilt, with no flow under the threshold', () => {
    let prep = blend(); prep = tick(reduce(prep, { type: 'POUR_START', tilt: .1 }), 3);
    assert.equal(prep.fill, 0); assert.equal(prep.remaining, 1); assert.equal(prep.phase, 'pour');
    prep = tick(reduce(prep, { type: 'POUR_TILT', tilt: .65 }), 2); assert(prep.fill > .45 && prep.fill < .55); assertMass(prep);
    prep = reduce(prep, { type: 'POUR_STOP' }); assert.equal(prep.pouringHeld, false); assert.equal(prep.tilt, 0);
    const tail = tick(prep, .4); assert(tail.fill > prep.fill); assert(tail.fill - prep.fill < .02); assertMass(tail);
    const stopped = tick(tail, 10); assert(stopped.fill - tail.fill < .0001); assert.equal(stopped.phase, 'pour');
  });
  test('a normal pour reaches the target in approximately four seconds', () => {
    const prep = tick(reduce(blend(), { type: 'POUR_START', tilt: .65 }), 3.75);
    assert(prep.fill >= .88 && prep.fill <= .98); assert.equal(prep.phase, 'pour'); assertMass(prep);
    const ready = reduce(prep, { type: 'FINISH_POUR' }); assert.equal(ready.phase, 'ready'); assert.equal(ready.pouringHeld, false); assert.equal(ready.flow, 0);
  });
  test('partial pours resume from the remaining jar without resetting cup volume', () => {
    let prep = tick(reduce(blend(), { type: 'POUR_START', tilt: .65 }), 1);
    prep = tick(reduce(prep, { type: 'POUR_STOP' }), .4); const before = prep.fill;
    prep = tick(reduce(prep, { type: 'POUR_START', tilt: .5 }), 1); assert(prep.fill > before); assert(prep.remaining < 1); assertMass(prep);
    assert.equal(prep.phase, 'pour');
  });
  test('finish is explicit, rejects nearly empty cups, and ready waits indefinitely', () => {
    let prep = filled(.2); assert.equal(reduce(prep, { type: 'FINISH_POUR' }), prep);
    prep = filled(.5); const ready = reduce(prep, { type: 'FINISH_POUR' }); assert.equal(ready.phase, 'ready');
    assert.equal(tick(ready, 60).phase, 'ready'); assert.equal(reduce(ready, { type: 'FINISH_POUR' }), ready);
  });
  test('overpouring catches only cup capacity and sends the extra juice into visible spill', () => {
    const prep = tick(reduce(blend(), { type: 'POUR_START', tilt: 1 }), 40);
    close(prep.fill, 1); close(prep.spilled, .15); assert.equal(prep.remaining, 0); assert.equal(prep.flow, 0); assert.equal(prep.phase, 'pour'); assertMass(prep);
    const empty = tick(prep, 60); assert.equal(empty.spilled, prep.spilled); assert.equal(empty.fill, prep.fill); assertMass(empty);
  });
  test('volume is conserved across varying frame sizes and repeated hold/release gestures', () => {
    let prep = blend();
    for (let i = 0; i < 500; i++) {
      if (i % 37 === 0) prep = reduce(prep, { type: 'POUR_START', tilt: .2 + (i % 17) / 20 });
      if (i % 53 === 0) prep = reduce(prep, { type: 'POUR_STOP' });
      prep = tick(prep, .001 + (i % 11) * .004); assertMass(prep);
    }
  });
  test('negative, infinite, and invalid input cannot create invalid volumes or elapsed time', () => {
    const prep = freeze(blend());
    for (const dt of [0, -1, NaN, Infinity]) assert.equal(tick(prep, dt), prep);
    assert.equal(reduce(prep, { type: 'POUR_TILT', tilt: NaN }), prep);
    const positive = tick(reduce(prep, { type: 'POUR_START', tilt: 999 }), 60); assert.equal(positive.tilt, 1); assertMass(positive);
    const negative = tick(reduce(prep, { type: 'POUR_START', tilt: -999 }), 60); assert.equal(negative.fill, 0); assertMass(negative);
  });
  test('perfect, early, overblended, underfilled and spilled drinks get different quality', () => {
    const perfect = reduce(filled(.93), { type: 'FINISH_POUR' }); const early = reduce(filled(.93, 1.1), { type: 'FINISH_POUR' });
    const over = reduce(filled(.93, 10), { type: 'FINISH_POUR' }); const under = reduce(filled(.45), { type: 'FINISH_POUR' });
    const spill = reduce(tick(reduce(blend(), { type: 'POUR_START', tilt: 1 }), 20), { type: 'FINISH_POUR' });
    assert(perfect.quality > .99); for (const average of [early, over, under, spill]) assert(average.quality < .86);
    assert.equal(preparationQuality(perfect, 'orange', 'Biasa'), 0); assert(preparationQuality(perfect, 'mango', 'Es ekstra') < .8);
  });
  test('serve input owns the full handoff, exposes react once, and never serves twice', () => {
    const ready = reduce(filled(), { type: 'FINISH_POUR' }); const serve = reduce(ready, { type: 'SERVE', id: 'serve-gesture' });
    assert.equal(serve.phase, 'serve'); assert.equal(reduce(serve, { type: 'SERVE' }), serve);
    const halfway = tick(serve, 1.3); assert.equal(halfway.phase, 'serve'); close(halfway.animation, .5);
    const react = tick(halfway, 1.3); assert.equal(react.phase, 'react'); assert.equal(react.animation, 0);
    assert.equal(tick(react, 1).phase, 'react'); const done = tick(react, 1.6); assert.equal(done.phase, 'done'); assert.equal(reduce(done, { type: 'SERVE' }), done);
    assert.equal(tick(serve, 60).phase, 'react', 'a background frame must expose the payout checkpoint');
  });
  test('save/restore preserves cut/load/blend progress and always releases held controls', () => {
    let prep = tick(reduce(load(), { type: 'BLEND_START' }), 1.4); const restored = restorePrep(serializePrep(prep), 'mango');
    assert.equal(restored.phase, 'blend'); close(restored.blendSeconds, 1.4); assert.equal(restored.blendHeld, false); assert.equal(restored.pouringHeld, false);
    close(tick(restored, 30).blendSeconds, 1.4); assert.equal(restored.loadedPortions, 2); assert.equal(restored.cuts, 3);
    prep = reduce(restored, { type: 'BLEND_START' }); assert.equal(reduce(tick(prep, 2), { type: 'BLEND_STOP' }).phase, 'pour');
    const partial = reduce(tick(select(), .5), { type: 'SLICE', distance: .1 }); assert.equal(restorePrep(serializePrep(partial)).cuts, 1);
  });
  test('restoring a partial pour stops all flow while retaining the physical mixture', () => {
    const prep = tick(reduce(blend(), { type: 'POUR_START', tilt: .7 }), 1.5); const restored = restorePrep(serializePrep(prep));
    assert.equal(restored.phase, 'pour'); close(restored.fill, prep.fill); close(restored.remaining, prep.remaining); assert.equal(restored.flow, 0); assert.equal(restored.tilt, 0); assert.equal(restored.pouringHeld, false); assertMass(restored);
    const waited = tick(restored, 60); close(waited.fill, restored.fill); close(waited.remaining, restored.remaining);
  });
  test('react saves can resume and business payout remains idempotent', () => {
    const ready = reduce(filled(), { type: 'FINISH_POUR' }); const react = tick(reduce(ready, { type: 'SERVE' }), PREP_TIMING.serve);
    const restored = restorePrep(serializePrep(react)); assert.equal(restored.phase, 'react');
    const business = newGame(); const customer = { ...makeOrder(business), id: 'hands-on-paid', recipeId: 'mango' };
    const reserved = reserveIngredients(business, 'mango', customer.id).state;
    const paid = completeOrder(reserved, customer, 'mango', restored.quality >= .86); assert.equal(paid.money, 89000);
    assert.equal(completeOrder(paid, customer, 'mango', true), paid); assert.equal(tick(restored, 1.6).phase, 'done');
  });
  test('legacy loaded/blended/ready states migrate without touching reserved business inventory', () => {
    const business = reserveIngredients(newGame(), 'mango', 'legacy-order').state;
    const loaded = restorePrep(undefined, 'mango', 'Biasa', 'loaded'); assert.equal(loaded.phase, 'blend'); assert.equal(loaded.loadedPortions, 2); assert.equal(loaded.blendHeld, false);
    const blended = restorePrep(undefined, 'mango', 'Biasa', 'blended'); assert.equal(blended.phase, 'pour'); assert.equal(blended.blendQuality, 'perfect');
    const ready = restorePrep(undefined, 'mango', 'Biasa', 'ready'); assert.equal(ready.phase, 'ready'); close(ready.fill, .93); assertMass(ready);
    assert.equal(restorePrep('loaded', 'mango').phase, 'blend'); assert.equal(business.inventory.mango, 11); assert.equal(business.costs, 3000);
  });
  test('corrupt, incompatible, mismatched and unknown saves are rejected or recovered safely', () => {
    for (const raw of ['{bad', '{}', 'null', 1, { version: 99, preparation: load() }, { version: 99, phase: 'ready', recipeId: 'mango' }, { version: 1, phase: 'ready', recipeId: 'unknown' }]) assert.equal(restorePrep(raw), null);
    assert.equal(restorePrep(serializePrep(load()), 'orange'), null); assert.equal(restorePrep('loaded'), null); assert.equal(restorePrep(undefined, 'unknown', 'Biasa', 'loaded'), null);
    const inconsistent = restorePrep({ ...load(), phase: 'ready', selectedFruits: [], fill: 500, spilled: -5, remaining: -1, pouringHeld: true });
    assert.equal(inconsistent.phase, 'select'); assert.equal(inconsistent.fill, 0); assert.equal(inconsistent.spilled, 0); assert.equal(inconsistent.remaining, 1); assert.equal(inconsistent.pouringHeld, false);
  });
  test('reset makes a fresh preparation without changing the old immutable state', () => {
    const prep = freeze(filled()); const reset = reduce(prep, { type: 'RESET', recipeId: 'tropical', modifier: 'Gelas besar' });
    assert.equal(reset.phase, 'select'); assert.equal(reset.fill, 0); assert.equal(reset.remaining, 1); assert.deepEqual(reset.selectedFruits, []); assert.equal(reset.recipeId, 'tropical'); assert.equal(prep.phase, 'pour');
    assert.throws(() => createPreparation('unknown'));
  });
  console.log(`\n${passed} preparation tests passed.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
