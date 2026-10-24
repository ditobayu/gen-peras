import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Execute the actual shipped engine, with no browser or duplicate test implementation.
const source = await readFile(new URL('../src/engine.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const engine = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const { newGame, RECIPES, FRUITS, UPGRADES, DAY_LENGTH, dailyTarget, unlockedRecipes, unlockedLocations,
  reserveIngredients, completeOrder, makeOrder, restock, buyUpgrade, nextDay, endDay, updateAppearance,
  moveLocation, generateEvent, applyEvent, sellingPrice, fruitPrice, preparationSpeed, demandMultiplier,
  saveGame, loadGame, SAVE_KEY } = engine;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function order(state, id = 'test-order', recipeId = 'mango') { return { ...makeOrder(state), id, recipeId, modifier: 'Biasa' }; }
function serve(state, id, recipeId = 'mango', perfect = true) {
  const customerOrder = order(state, id, recipeId); const result = reserveIngredients(state, recipeId, id);
  assert.equal(result.ok, true); return completeOrder(result.state, customerOrder, recipeId, perfect);
}
let storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key), clear: () => storage.clear(),
};

test('new games have independent inventories, starting money, and eight-minute days', () => {
  const a = newGame(), b = newGame(); a.inventory.mango = 1;
  assert.equal(b.inventory.mango, 12); assert.equal(a.money, 75000); assert.equal(DAY_LENGTH, 480);
  assert.equal(dailyTarget(b), 8); assert.equal(dailyTarget(2), 10); assert.equal(FRUITS.length, 8); assert.equal(RECIPES.length, 8);
});
test('all recipe costs correspond to actual ingredient quantities', () => {
  for (const recipe of RECIPES) {
    const cost = Object.entries(recipe.ingredients).reduce((sum, [fruit, amount]) => sum + FRUITS.find(f => f.id === fruit).unitCost * amount, 0);
    assert.equal(recipe.cost, cost); assert(recipe.price > cost); assert(recipe.steps.length >= 4);
  }
});
test('recipes and Indonesian locations unlock progressively', () => {
  const state = newGame(); assert.equal(unlockedRecipes(state).length, 4); assert.equal(unlockedLocations(state).length, 1);
  assert.equal(unlockedRecipes({ ...state, day: 4 }).length, 8); assert.equal(unlockedLocations({ ...state, day: 7 }).length, 4);
  assert.throws(() => moveLocation(state, 'festival')); assert.equal(moveLocation({ ...state, day: 7 }, 'festival').location, 'festival');
});
test('first customer asks naturally for mango and only available fruit is ordered', () => {
  const state = newGame(); const first = makeOrder(state);
  assert.equal(first.recipeId, 'mango'); assert.match(first.dialogue, /mangga/); assert.equal(first.modifier, 'Biasa');
  const inventory = Object.fromEntries(FRUITS.map(f => [f.id, f.id === 'orange' ? 1 : 0]));
  for (let i = 0; i < 20; i++) assert.equal(makeOrder({ ...state, inventory, totalServed: 1 }).recipeId, 'orange');
  assert.throws(() => makeOrder({ ...state, inventory: Object.fromEntries(FRUITS.map(f => [f.id, 0])) }), /Buah habis/);
});
test('reserving fruit is immutable, atomic, and idempotent by order ID', () => {
  const state = freeze(newGame()); const result = reserveIngredients(state, 'mango', 'abc');
  assert.equal(result.ok, true); assert.equal(result.state.inventory.mango, 11); assert.equal(result.state.costs, 3000); assert.equal(state.inventory.mango, 12);
  const repeated = reserveIngredients(result.state, 'mango', 'abc'); assert.equal(repeated.state, result.state); assert.equal(repeated.ok, true);
  assert.equal(reserveIngredients(result.state, 'orange', 'abc').ok, false);
});
test('stock failures do not deduct any ingredient or money', () => {
  const state = { ...newGame(), day: 4 }; state.inventory.pineapple = 0;
  const result = reserveIngredients(freeze(state), 'tropical', 'no-pineapple');
  assert.equal(result.ok, false); assert.equal(result.state, state); assert.equal(result.state.inventory.mango, 12); assert.equal(result.state.costs, 0);
  assert.equal(reserveIngredients(state, 'unknown').ok, false); assert.equal(reserveIngredients(newGame(), 'tropical').ok, false);
});
test('completed perfect orders earn once and never deduct inventory twice', () => {
  const state = newGame(); const customerOrder = order(state, 'paid'); const reserved = reserveIngredients(state, 'mango', customerOrder.id).state;
  const result = completeOrder(freeze(reserved), customerOrder, 'mango', true);
  assert.equal(result.money, 89000); assert.equal(result.inventory.mango, 11); assert.equal(result.revenue, 14000); assert.equal(result.costs, 3000);
  assert.equal(result.served, 1); assert.equal(result.totalServed, 1); assert(result.reputation > state.reputation);
  assert.equal(completeOrder(result, customerOrder, 'mango', true), result);
  assert.equal(reserveIngredients(result, 'mango', customerOrder.id).ok, false);
});
test('no payout is possible without a reservation for the prepared recipe', () => {
  const state = newGame(); const customerOrder = order(state, 'no-fruit');
  assert.throws(() => completeOrder(state, customerOrder, 'mango', true), /bahan/);
  const reserved = reserveIngredients(state, 'orange', customerOrder.id).state;
  assert.throws(() => completeOrder(reserved, customerOrder, 'mango', true), /bahan/);
});
test('wrong drinks consume their reserved fruit, earn no money, and reduce reputation', () => {
  const state = newGame(); const customerOrder = order(state, 'wrong', 'mango');
  const reserved = reserveIngredients(state, 'orange', customerOrder.id).state;
  const result = completeOrder(reserved, customerOrder, 'orange', true);
  assert.equal(result.money, 75000); assert.equal(result.inventory.orange, 11); assert.equal(result.revenue, 0); assert.equal(result.reputation, 67);
  assert.equal(endDay(result).receipt.satisfaction, 0);
});
test('anonymous reservations are consumed once for backwards-compatible UI use', () => {
  const state = newGame(); const reserved = reserveIngredients(state, 'mango').state;
  const result = completeOrder(reserved, order(state, 'anonymous'), 'mango', false);
  assert.equal(Object.keys(result.reservations).length, 0); assert.equal(result.money, 87000);
  assert.throws(() => completeOrder(result, order(result, 'unreserved'), 'mango', false));
});
test('mixed fruit recipe reserves its three ingredients and cost atomically', () => {
  const state = { ...newGame(), day: 4 }; const result = reserveIngredients(state, 'tropical', 'tropical-order').state;
  assert.equal(result.inventory.mango, 11); assert.equal(result.inventory.pineapple, 11); assert.equal(result.inventory.banana, 11); assert.equal(result.costs, 7600);
});
test('extra-fruit and large-cup requests deduct real extra portions once', () => {
  const state = newGame();
  const extra = reserveIngredients(state, 'mango', 'extra-order', 'Buah ekstra').state;
  assert.equal(extra.inventory.mango, 10); assert.equal(extra.costs, 6000);
  assert.equal(reserveIngredients(extra, 'mango', 'extra-order', 'Buah ekstra').state, extra);
  const complete = completeOrder(extra, order(extra, 'extra-order'), 'mango', true);
  assert.equal(complete.inventory.mango, 10); assert.equal(complete.costs, 6000);
  const tropical = reserveIngredients({ ...state, day: 4 }, 'tropical', 'large-order', 'Gelas besar').state;
  assert.equal(tropical.inventory.mango, 10); assert.equal(tropical.inventory.pineapple, 10); assert.equal(tropical.inventory.banana, 10); assert.equal(tropical.costs, 15200);
});
test('modifier inventory checks remain atomic and prevent partial deductions', () => {
  const state = { ...newGame(), day: 4 }; state.inventory.banana = 1;
  const result = reserveIngredients(state, 'tropical', 'no-large', 'Gelas besar');
  assert.equal(result.ok, false); assert.equal(result.state, state); assert.equal(state.inventory.mango, 12); assert.equal(state.costs, 0);
  const oneMango = { ...state, inventory: { ...state.inventory, mango: 1 } };
  assert.equal(reserveIngredients(oneMango, 'mango', 'no-extra', 'Buah ekstra').ok, false);
});
test('customized reservation quantities and cost survive a reload', () => {
  const state = reserveIngredients(newGame(), 'avocado', 'big-persistent', 'Gelas besar').state;
  saveGame(state); const loaded = loadGame(); assert.deepEqual(loaded, state);
  const result = reserveIngredients(loaded, 'avocado', 'big-persistent', 'Gelas besar');
  assert.equal(result.state.inventory.avocado, 10); assert.equal(result.state.costs, 8000);
});
test('fruit purchases use Rupiah and reject invalid quantities and insufficient funds', () => {
  const state = freeze(newGame()); const result = restock(state, 'mango', 5);
  assert.equal(result.inventory.mango, 17); assert.equal(result.money, 60000); assert.equal(result.costs, 0); assert.equal(state.inventory.mango, 12);
  for (const quantity of [-1, 0, .5, NaN, Infinity, 50]) assert.throws(() => restock(state, 'mango', quantity));
  assert.throws(() => restock({ ...state, money: 1 }, 'mango', 1)); assert.throws(() => restock(state, 'missing-fruit', 1));
});
test('all upgrades charge once, have real effects, and remain immutable', () => {
  let state = freeze({ ...newGame(), money: 1000000 });
  for (const upgrade of UPGRADES) {
    const previous = state; state = buyUpgrade(state, upgrade.id);
    assert.equal(state.money, previous.money - upgrade.price); assert.equal(previous.upgrades.includes(upgrade.id), false);
    assert.throws(() => buyUpgrade(state, upgrade.id));
  }
  assert.equal(preparationSpeed(state), .75); assert.equal(fruitPrice(state, 'mango'), 2550); assert.equal(sellingPrice(state, 'mango'), 13000);
  assert.equal(makeOrder(state).patience, 108); assert.throws(() => buyUpgrade(newGame(), 'missing'));
  assert.throws(() => buyUpgrade({ ...newGame(), money: 0 }, 'blender'));
});
test('price increases affect payment and customer demand', () => {
  const state = { ...newGame(), priceMultiplier: 1.5 }; assert.equal(sellingPrice(state, 'mango'), 18000);
  assert(demandMultiplier(state) < demandMultiplier(newGame()));
  assert.equal(serve(state, 'high-price', 'mango', false).money, 93000);
});
test('daily receipts use consumed ingredient costs and are idempotent', () => {
  let state = newGame(); state = serve(state, 'day1-a'); state = serve(state, 'day1-b', 'orange', false);
  const result = endDay(freeze(state));
  assert.equal(result.receipt.served, 2); assert.equal(result.receipt.revenue, 24000); assert.equal(result.receipt.costs, 5000); assert.equal(result.receipt.profit, 19000);
  assert.equal(result.receipt.satisfaction, 90); assert.equal(result.state.history.length, 1); assert.equal(result.state.dayClosed, true);
  assert.equal(endDay(result.state).state, result.state); assert.equal(result.state.history[0], result.receipt);
  assert.equal(reserveIngredients(result.state, 'mango', 'late').ok, false); assert.throws(() => makeOrder(result.state));
});
test('new days keep business progress and clear only daily counters', () => {
  const state = serve(newGame(), 'old-day'); const result = nextDay(freeze(state));
  assert.equal(result.day, 2); assert.equal(result.history.length, 1); assert.equal(result.money, state.money); assert.equal(result.inventory.mango, 11);
  assert.equal(result.totalServed, 1); assert.equal(result.served, 0); assert.equal(result.revenue, 0); assert.equal(result.costs, 0); assert.equal(result.dayElapsed, 0);
  assert.equal(result.dayClosed, false); assert(result.completedOrderIds.includes('old-day'));
  assert.equal(completeOrder(result, order(result, 'old-day'), 'mango', true), result);
});
test('customization is immutable and long names are safely bounded', () => {
  const state = freeze(newGame()); const result = updateAppearance(state, { name: 'x'.repeat(50), glasses: true, hair: 'bob' });
  assert.equal(result.appearance.name.length, 30); assert.equal(result.appearance.glasses, true); assert.equal(state.appearance.glasses, false);
});
test('events change the economy once and demand modifiers are meaningful', () => {
  const state = freeze(newGame()); const event = { ...generateEvent(state), id: 'tip', moneyDelta: 10000, reputationDelta: 2, demandMultiplier: 1.35, costMultiplier: 1.25 };
  const result = applyEvent(state, event); assert.equal(result.money, 85000); assert.equal(result.reputation, 72);
  assert.equal(fruitPrice(result, 'mango'), 3750); assert(demandMultiplier(result) > demandMultiplier(state)); assert.equal(applyEvent(result, event), result);
});
test('save/load roundtrip retains customization, upgrades, receipts, and completed IDs', () => {
  storage.clear(); assert.equal(loadGame(), null);
  let state = serve(newGame(), 'persisted-order'); state = buyUpgrade(state, 'plants'); state = updateAppearance(state, { name: 'Sari', hair: 'ponytail', glasses: true });
  state = nextDay(state); assert.equal(saveGame(state), true); const loaded = loadGame();
  assert.deepEqual(loaded, state); assert.equal(completeOrder(loaded, order(loaded, 'persisted-order'), 'mango', true), loaded);
});
test('a reserved in-progress order survives reload without a second fruit deduction', () => {
  storage.clear(); const state = reserveIngredients(newGame(), 'mango', 'in-flight').state; saveGame(state);
  const loaded = loadGame(); const repeated = reserveIngredients(loaded, 'mango', 'in-flight'); assert.equal(repeated.state.inventory.mango, 11);
  const completed = completeOrder(repeated.state, order(loaded, 'in-flight'), 'mango', true); assert.equal(completed.money, 89000); assert.equal(completed.inventory.mango, 11);
});
test('corrupt, future-version, and incomplete saves recover without throwing', () => {
  for (const data of ['{bad json', 'null', '{}', '{"version":999,"state":{}}', '{"version":1,"state":{"day":1}}']) {
    storage.set(SAVE_KEY, data); assert.equal(loadGame(), null);
  }
});
test('save loader clamps numeric corruption and ignores unknown equipment', () => {
  const state = newGame(); state.money = -123; state.reputation = 999; state.settings.music = 99; state.inventory.mango = -5; state.priceMultiplier = 99;
  state.upgrades = ['plants', 'plants', 'money-printer']; saveGame(state); const loaded = loadGame();
  assert.equal(loaded.money, 0); assert.equal(loaded.reputation, 100); assert.equal(loaded.settings.music, 1); assert.equal(loaded.inventory.mango, 0); assert.equal(loaded.priceMultiplier, 1.5); assert.deepEqual(loaded.upgrades, ['plants']);
});
test('storage being unavailable never prevents play or throws', () => {
  const working = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.equal(saveGame(newGame()), false); assert.equal(loadGame(), null); globalThis.localStorage = working;
});
test('100 replayed completion attempts cannot create duplicate revenue or inventory loss', () => {
  let state = newGame(); const original = order(state, 'replay-resistant'); state = reserveIngredients(state, 'mango', original.id).state;
  state = completeOrder(state, original, 'mango', true); const expected = structuredClone(state);
  for (let i = 0; i < 100; i++) { saveGame(state); state = completeOrder(loadGame(), original, 'mango', true); }
  assert.deepEqual(state, expected); assert.equal(state.totalServed, 1);
});
console.log(`\n${passed} engine tests passed.`);
