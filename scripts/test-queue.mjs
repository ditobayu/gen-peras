import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const engineUrl = moduleUrl(await readFile(new URL('../src/engine.ts', import.meta.url), 'utf8'));
const engine = await import(engineUrl);
const queueSource = await readFile(new URL('../src/queue.ts', import.meta.url), 'utf8');
const queueModule = await import(moduleUrl(queueSource.replace("from './engine'", `from '${engineUrl}'`)));
const { newGame, FRUITS, CUSTOMERS, makeOrder, reserveIngredients, completeOrder, endDay, nextDay, restock, recipeIngredients } = engine;
const { createOrderQueue, advanceOrderQueue, CUSTOMER_QUEUE_SIZE } = queueModule;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
const emptyInventory = () => Object.fromEntries(FRUITS.map(fruit => [fruit.id, 0]));
const originalRandom = Math.random;
Math.random = () => 0; // Even repeated identical RNG results cannot repeat a person already in line.

test('a real three-person queue has distinct people and preserves the first mango greeting', () => {
  const queue = createOrderQueue(freeze(newGame()));
  assert.equal(queue.length, CUSTOMER_QUEUE_SIZE);
  assert.equal(new Set(queue.map(order => order.customer.id)).size, CUSTOMER_QUEUE_SIZE);
  assert.equal(new Set(queue.map(order => order.id)).size, CUSTOMER_QUEUE_SIZE);
  assert.equal(queue[0].customer.id, 'raka');
  assert.equal(queue[0].recipeId, 'mango');
  assert.match(queue[0].dialogue, /mangga/);
});
test('paid completion promotes the exact waiting order and replenishes with another person', () => {
  let state = newGame();
  const queue = freeze(createOrderQueue(state)), head = queue[0];
  state = reserveIngredients(state, head.recipeId, head.id, head.modifier).state;
  state = completeOrder(state, head, head.recipeId, true);
  const next = advanceOrderQueue(freeze(state), queue, head.id);
  assert.equal(next[0], queue[1]);
  assert.equal(next[1], queue[2]);
  assert(!next.some(order => order.id === head.id));
  assert(!next.some(order => order.customer.id === head.customer.id));
  assert.equal(new Set(next.map(order => order.customer.id)).size, CUSTOMER_QUEUE_SIZE);
  assert.equal(state.totalServed, 1);
});
test('a repeated completion callback cannot skip the newly promoted customer', () => {
  const state = freeze(newGame()), queue = freeze(createOrderQueue(state));
  const next = freeze(advanceOrderQueue(state, queue, queue[0].id));
  assert.deepEqual(advanceOrderQueue(state, next, queue[0].id), next);
  assert.deepEqual(advanceOrderQueue(state, next, 'stale-animation'), next);
});
test('an impatient customer leaves while the next waiting person advances', () => {
  const state = freeze(newGame()), queue = freeze(createOrderQueue(state));
  const next = advanceOrderQueue(state, queue, queue[0].id);
  assert.equal(next[0].id, queue[1].id);
  assert.equal(next[1].id, queue[2].id);
  assert(!next.some(order => order.customer.id === queue[0].customer.id));
  assert.equal(state.totalServed, 0);
});
test('reloading during preparation keeps every waiting order and canonical customer identity', () => {
  const state = freeze(newGame()), queue = createOrderQueue(state);
  const restored = createOrderQueue(state, JSON.parse(JSON.stringify(queue)));
  assert.deepEqual(restored, queue);
  assert.equal(restored[1].customer, CUSTOMERS.find(customer => customer.id === queue[1].customer.id));
});
test('reloading after payment removes the paid head and keeps the visible next customers', () => {
  let state = newGame();
  const queue = createOrderQueue(state), head = queue[0];
  state = reserveIngredients(state, head.recipeId, head.id, head.modifier).state;
  state = completeOrder(state, head, head.recipeId, true);
  const restored = createOrderQueue(freeze(state), JSON.parse(JSON.stringify(queue)));
  assert.equal(restored[0].id, queue[1].id);
  assert.equal(restored[1].id, queue[2].id);
  assert(!restored.some(order => order.id === head.id || order.customer.id === head.customer.id));
});
test('corrupt queue entries and duplicate people or order IDs are repaired', () => {
  const state = freeze(newGame()), valid = createOrderQueue(state)[0];
  const saved = [null, {}, { ...valid, id: 'bad-customer', customer: { id: 'unknown' } }, { ...valid, id: 'bad-recipe', recipeId: 'tropical' }, { ...valid, id: 'bad-time', patience: Infinity }, valid, valid, { ...valid, id: 'same-person' }];
  const restored = createOrderQueue(state, saved);
  assert.equal(restored.length, CUSTOMER_QUEUE_SIZE);
  assert.equal(restored[0].id, valid.id);
  assert.equal(new Set(restored.map(order => order.id)).size, CUSTOMER_QUEUE_SIZE);
  assert.equal(new Set(restored.map(order => order.customer.id)).size, CUSTOMER_QUEUE_SIZE);
});
test('stock depletion preserves reserved orders and waiting intent without inventing ingredients', () => {
  const state = newGame(), queue = createOrderQueue(state);
  const reserved = reserveIngredients(state, queue[0].recipeId, queue[0].id).state;
  const depleted = freeze({ ...reserved, inventory: emptyInventory() });
  const restored = createOrderQueue(depleted, JSON.parse(JSON.stringify(queue)));
  assert.deepEqual(restored, queue);
  assert.equal(reserveIngredients(depleted, queue[0].recipeId, queue[0].id).state, depleted);
  const next = advanceOrderQueue(depleted, restored, restored[0].id);
  assert.equal(next.length, 2);
  assert.equal(next[0].id, queue[1].id);
  const refilled = createOrderQueue(restock(depleted, 'mango', 1), next);
  assert.equal(refilled.length, CUSTOMER_QUEUE_SIZE);
  assert.equal(refilled[0].id, queue[1].id);
  assert.deepEqual(createOrderQueue({ ...state, inventory: emptyInventory() }), []);
});
test('closed days have no queue and order generation obeys explicit customer exclusions', () => {
  const state = newGame(), queue = createOrderQueue(state), closed = endDay(state).state;
  assert.deepEqual(createOrderQueue(closed, queue), []);
  assert.deepEqual(advanceOrderQueue(closed, queue, queue[0].id), []);
  assert.equal(makeOrder(state, ['raka']).customer.id, 'nia');
  assert.throws(() => makeOrder(state, CUSTOMERS.map(customer => customer.id)), /mengantre/);
});
test('twelve paid cycles retain the next people, modifiers, and exactly-once payments across reloads', () => {
  let state = { ...newGame(), day: 4, inventory: Object.fromEntries(FRUITS.map(fruit => [fruit.id, 100])) };
  const modifiers = ['Buah ekstra', 'Gelas besar', 'Tanpa es', 'Tanpa susu', 'Es ekstra', 'Sedikit gula'];
  let queue = createOrderQueue(state).map((order, index) => ({ ...order, modifier: modifiers[index] }));
  for (let cycle = 0; cycle < 12; cycle++) {
    const departing = queue[0], expectedNext = queue[1], expectedThird = queue[2], before = state;
    const reserved = reserveIngredients(state, departing.recipeId, departing.id, departing.modifier);
    assert.equal(reserved.ok, true);
    for (const [fruit, amount] of Object.entries(recipeIngredients(departing.recipeId, departing.modifier))) assert.equal(reserved.state.inventory[fruit], before.inventory[fruit] - amount);
    state = completeOrder(reserved.state, departing, departing.recipeId, true);
    assert.equal(state.totalServed, cycle + 1);
    assert.equal(completeOrder(state, departing, departing.recipeId, true), state);
    state = JSON.parse(JSON.stringify(state));
    queue = createOrderQueue(state, JSON.parse(JSON.stringify(queue)));
    assert.equal(queue[0].id, expectedNext.id);
    assert.equal(queue[0].modifier, expectedNext.modifier);
    assert.equal(queue[1].id, expectedThird.id);
    assert.equal(queue[1].modifier, expectedThird.modifier);
    assert.equal(new Set(queue.map(order => order.id)).size, CUSTOMER_QUEUE_SIZE);
    assert.equal(new Set(queue.map(order => order.customer.id)).size, CUSTOMER_QUEUE_SIZE);
    assert.deepEqual(advanceOrderQueue(state, queue, departing.id), queue);
    queue[2] = { ...queue[2], modifier: modifiers[cycle % modifiers.length] };
  }
});
test('a legacy one-order session keeps its active identity and modifier when a queue is added', () => {
  const state = { ...newGame(), day: 4 };
  const legacyOrder = { ...makeOrder(state), modifier: 'Gelas besar' };
  const queue = createOrderQueue(state, [JSON.parse(JSON.stringify(legacyOrder))]);
  assert.equal(queue[0].id, legacyOrder.id);
  assert.equal(queue[0].modifier, legacyOrder.modifier);
  assert.equal(queue.length, CUSTOMER_QUEUE_SIZE);
  assert.equal(new Set(queue.map(order => order.customer.id)).size, CUSTOMER_QUEUE_SIZE);
});
test('closing a day discards waiting orders and the next day starts with fresh order identities', () => {
  const state = newGame(), queue = createOrderQueue(state), closed = endDay(state).state;
  assert.deepEqual(createOrderQueue(closed, JSON.parse(JSON.stringify(queue))), []);
  const fresh = createOrderQueue(nextDay(closed));
  assert.equal(fresh.length, CUSTOMER_QUEUE_SIZE);
  assert(!fresh.some(order => queue.some(previous => previous.id === order.id)));
});

Math.random = originalRandom;
console.log(`\n${passed} queue tests passed.`);
