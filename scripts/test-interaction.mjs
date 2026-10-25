import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

// Exercise the real interactor and Three's ray/plane math without a browser renderer.
const source = await readFile(new URL('../src/interaction.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const implementation = outputText.replace("from 'three'", `from ${JSON.stringify(import.meta.resolve('three'))}`);
const { WorldInteractor } = await import(`data:text/javascript;base64,${Buffer.from(implementation).toString('base64')}`);
const originalWindow = globalThis.window;
let passed = 0, failed = 0;

class EventSurface {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, values = {}) {
    const event = { type, button: 0, pointerId: 7, pointerType: 'mouse', defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...values };
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
    return event;
  }
  listenerCount() { return [...this.listeners.values()].reduce((count, listeners) => count + listeners.size, 0); }
}
class Canvas extends EventSurface {
  captured = new Set(); captures = []; releases = [];
  bounds = { left: 113, top: 71, width: 900, height: 600, right: 1013, bottom: 671 };
  getBoundingClientRect() { return this.bounds; }
  setPointerCapture(id) { this.captures.push(id); this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) {
    this.releases.push(id); this.captured.delete(id);
    // clear() must remain safe when releasing capture produces a lost-capture event.
    this.emit('lostpointercapture', { pointerId: id });
  }
}
const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-7, message || `${actual} != ${expected}`);
const snapshot = g => ({ ...g, start: g.start.clone(), current: g.current.clone(), delta: g.delta.clone(), world: g.world.clone() });
function fixture() {
  const window = new EventSurface(), canvas = new Canvas(); globalThis.window = window;
  const camera = new THREE.PerspectiveCamera(57, canvas.bounds.width / canvas.bounds.height, .07, 50);
  camera.position.set(2.1, 3.2, 5.3); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
  const targets = {};
  for (const [id, x] of [['fruit', -.8], ['jar', 1.3]]) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(.62, .8, .65), new THREE.MeshBasicMaterial());
    object.position.set(x, 1, 0); object.updateMatrixWorld(true); targets[id] = object;
  }
  let enabled = true; const accepted = new Set(['fruit']), rectangles = new Map(), events = { start: [], move: [], release: [], hover: [], cancel: [] };
  const interactor = new WorldInteractor(canvas, camera, {
    enabled: () => enabled, targets: () => targets, accepts: id => accepted.has(id), bounds: id => rectangles.get(id) || null,
    start: g => events.start.push(snapshot(g)), move: g => events.move.push(snapshot(g)),
    release: (g, drop) => events.release.push({ gesture: snapshot(g), drop }),
    hover: id => events.hover.push(id), cancel: () => events.cancel.push(true),
  });
  function point(id, dx = 0, dy = 0) {
    const p = interactor.project(targets[id]);
    return { clientX: canvas.bounds.left + p.x + dx, clientY: canvas.bounds.top + p.y + dy };
  }
  return { canvas, window, camera, targets, accepted, rectangles, events, interactor, point,
    enable(value) { enabled = value; },
    dispose() { interactor.dispose(); Object.values(targets).forEach(o => { o.geometry.dispose(); o.material.dispose(); }); },
  };
}
function test(name, run) {
  const f = fixture();
  try { run(f); passed++; console.log(`✓ ${name}`); }
  catch (error) { failed++; console.error(`✗ ${name}\n  ${error.message}`); }
  finally { f.dispose(); }
}

try {
  test('a visible label begins the same captured gesture even outside the source mesh', f => {
    const point = f.point('fruit', 150, -70), event = f.canvas.emit('pointermove', point);
    assert.equal(f.events.start.length, 0);
    f.interactor.begin(event, 'fruit');
    assert.equal(event.defaultPrevented, true); assert.deepEqual(f.canvas.captures, [7]);
    const g = f.events.start[0]; assert.equal(g.target, 'fruit'); assert.equal(g.pointerType, 'mouse');
    assert.deepEqual(g.start.toArray(), [point.clientX, point.clientY]); assert.equal(g.distance, 0);
    assert.equal(f.events.release.length, 0, 'pressing a label must not perform a drop');
    f.interactor.begin(event, 'fruit'); assert.equal(f.events.start.length, 1, 'an active gesture cannot begin twice');
  });
  test('mesh picking filters starts but reports the actual destination on release', f => {
    f.canvas.emit('pointerdown', f.point('jar')); assert.equal(f.events.start.length, 0, 'destination is not an accepted source');
    const down = f.canvas.emit('pointerdown', f.point('fruit')); assert(down.defaultPrevented); assert.equal(f.events.start.length, 1);
    f.canvas.emit('pointerup', f.point('jar'));
    assert.equal(f.events.release.length, 1); assert.equal(f.events.release[0].drop, 'jar');
    assert.equal(f.events.cancel.length, 0); assert.equal(f.canvas.hasPointerCapture(7), false);
  });
  test('only the captured pointer moves and releases; release uses its final coordinates', f => {
    const start = f.point('fruit'); f.canvas.emit('pointerdown', start);
    f.canvas.emit('pointermove', { ...f.point('jar'), pointerId: 99 });
    f.canvas.emit('pointerup', { ...f.point('jar'), pointerId: 99 });
    assert.equal(f.events.move.length, 0); assert.equal(f.events.release.length, 0); assert(f.canvas.hasPointerCapture(7));
    const moved = { clientX: start.clientX + 72, clientY: start.clientY + 54 };
    const move = f.canvas.emit('pointermove', moved); assert(move.defaultPrevented);
    const g = f.events.move[0]; close(g.delta.x, 72); close(g.delta.y, 54); close(g.distance, 90 / 600);
    const end = f.point('jar', 1, 2); f.canvas.emit('pointerup', end);
    const released = f.events.release[0].gesture; assert.deepEqual(released.current.toArray(), [end.clientX, end.clientY]);
    assert.deepEqual(f.canvas.releases, [7]); assert.equal(f.events.cancel.length, 0);
    f.canvas.emit('pointerup', end); assert.equal(f.events.release.length, 1, 'one physical release cannot dispatch twice');
  });
  test('disabled mode, rejected materials, and secondary mouse buttons cannot begin a gesture', f => {
    f.enable(false); f.canvas.emit('pointerdown', f.point('fruit'));
    f.interactor.begin(f.canvas.emit('pointermove', f.point('fruit')), 'fruit');
    f.enable(true); f.canvas.emit('pointerdown', { ...f.point('fruit'), button: 2 });
    f.interactor.begin(f.canvas.emit('pointermove', f.point('jar')), 'jar');
    assert.equal(f.events.start.length, 0); assert.equal(f.events.release.length, 0); assert.deepEqual(f.canvas.captures, []);
  });
  test('disabling an in-flight gesture cancels it before another move can mutate gameplay', f => {
    f.canvas.emit('pointerdown', f.point('fruit')); f.enable(false);
    f.canvas.emit('pointermove', f.point('jar')); f.canvas.emit('pointerup', f.point('jar'));
    assert.equal(f.events.cancel.length, 1); assert.equal(f.events.move.length, 0); assert.equal(f.events.release.length, 0);
    assert.equal(f.canvas.hasPointerCapture(7), false);
  });
  test('disabling just before release cancels without requiring an intervening move', f => {
    f.canvas.emit('pointerdown', f.point('fruit')); f.enable(false); f.canvas.emit('pointerup', f.point('jar'));
    assert.equal(f.events.release.length, 0, 'a disabled/read-only scene must never dispatch a drop');
    assert.equal(f.events.cancel.length, 1); assert.equal(f.canvas.hasPointerCapture(7), false);
  });
  test('pointer cancellation and lost capture each cancel once without dropping', f => {
    f.canvas.emit('pointerdown', f.point('fruit')); f.canvas.emit('pointercancel', { pointerId: 7 });
    assert.equal(f.events.cancel.length, 1); assert.equal(f.events.release.length, 0); assert.equal(f.canvas.hasPointerCapture(7), false);
    f.canvas.emit('pointercancel', { pointerId: 7 }); assert.equal(f.events.cancel.length, 1);
    f.canvas.emit('pointerdown', f.point('fruit')); f.canvas.emit('lostpointercapture', { pointerId: 7 });
    assert.equal(f.events.cancel.length, 2); assert.equal(f.events.release.length, 0); assert.equal(f.canvas.hasPointerCapture(7), false);
  });
  test('cancellation from another pointer leaves the captured gesture intact', f => {
    f.canvas.emit('pointerdown', f.point('fruit')); f.canvas.emit('pointercancel', { pointerId: 99 });
    assert.equal(f.events.cancel.length, 0, 'unrelated touch cancellation must not abort the drag');
    assert(f.canvas.hasPointerCapture(7));
    f.canvas.emit('lostpointercapture', { pointerId: 99 }); assert.equal(f.events.cancel.length, 0);
    f.canvas.emit('pointerup', f.point('jar')); assert.equal(f.events.release.length, 1);
  });
  test('dragging follows a screen-aligned plane through the ingredient at nonzero canvas offsets', f => {
    f.canvas.emit('pointerdown', f.point('fruit', 15, -12));
    const start = f.events.start[0], origin = f.targets.fruit.getWorldPosition(new THREE.Vector3()), normal = f.camera.getWorldDirection(new THREE.Vector3());
    close(start.world.clone().sub(origin).dot(normal), 0);
    const moved = f.point('fruit', 104, 61); f.canvas.emit('pointermove', moved); const g = f.events.move[0];
    close(g.world.clone().sub(origin).dot(normal), 0); close(g.world.clone().sub(start.world).dot(normal), 0);
    const projected = g.world.clone().project(f.camera);
    close(f.canvas.bounds.left + (projected.x * .5 + .5) * f.canvas.bounds.width, moved.clientX);
    close(f.canvas.bounds.top + (-projected.y * .5 + .5) * f.canvas.bounds.height, moved.clientY);
    assert(g.world.distanceTo(start.world) > .1, 'screen movement must move the held material in world space');
  });
  test('DOM drop bounds include every painted edge and reject points immediately outside', f => {
    const rect = { left: 500, top: 300, right: 628, bottom: 396, width: 128, height: 96 }; f.rectangles.set('jar', rect);
    const near = (x, y) => f.interactor.near({ current: new THREE.Vector2(x, y) }, 'jar', 1000);
    for (const p of [[500, 300], [628, 300], [500, 396], [628, 396], [564, 300], [564, 396], [500, 348], [628, 348], [564, 348]]) assert(near(...p), `inside/edge ${p} should accept`);
    for (const p of [[499.99, 348], [628.01, 348], [564, 299.99], [564, 396.01]]) assert.equal(near(...p), false, `outside ${p} must reject even with a generous fallback radius`);
  });
  test('drop fallback accounts for canvas offsets and rejects off-camera or missing targets', f => {
    const center = f.point('jar'), at = (x, y) => ({ current: new THREE.Vector2(x, y) });
    assert(f.interactor.near(at(center.clientX, center.clientY), 'jar'));
    assert(f.interactor.near(at(center.clientX + 94.99, center.clientY), 'jar'));
    assert.equal(f.interactor.near(at(center.clientX + 95.01, center.clientY), 'jar'), false);
    f.rectangles.set('jar', { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    assert(f.interactor.near(at(center.clientX, center.clientY), 'jar'), 'hidden/empty DOM bounds use world projection');
    f.targets.jar.position.copy(f.camera.position).addScaledVector(f.camera.getWorldDirection(new THREE.Vector3()), -2);
    assert.equal(f.interactor.project(f.targets.jar).visible, false); assert.equal(f.interactor.near(at(center.clientX, center.clientY), 'jar'), false);
    assert.equal(f.interactor.near(at(center.clientX, center.clientY), 'missing'), false);
  });
  test('window blur and disposal release input ownership and remove every listener', f => {
    const context = f.canvas.emit('contextmenu'); assert(context.defaultPrevented);
    f.canvas.emit('pointerdown', f.point('fruit')); f.window.emit('blur');
    assert.equal(f.events.cancel.length, 1); assert.equal(f.events.release.length, 0); assert.equal(f.canvas.hasPointerCapture(7), false);
    f.canvas.emit('pointerdown', f.point('fruit')); f.interactor.dispose();
    assert.equal(f.events.cancel.length, 2); assert.equal(f.canvas.listenerCount(), 0); assert.equal(f.window.listenerCount(), 0);
    f.canvas.emit('pointerdown', f.point('fruit')); f.window.emit('blur'); assert.equal(f.events.start.length, 2); assert.equal(f.events.cancel.length, 2);
  });
} finally {
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
}
console.log(`\n${passed} interaction checks passed${failed ? `; ${failed} failed` : ''}.`);
if (failed) process.exitCode = 1;
