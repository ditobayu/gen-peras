import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/sound.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { Sound } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

// Instrument the browser's audio surface to check held controls and release envelopes.
class Parameter {
  value = 0;
  constructor(ctx) { this.ctx = ctx; }
  cancelScheduledValues(time) { this.ctx.log.push({ type: 'cancel', parameter: this, time }); }
  setTargetAtTime(value, time, tau) { this.ctx.log.push({ type: 'target', parameter: this, value, time, tau }); }
  setValueAtTime(value, time) { this.ctx.log.push({ type: 'value', parameter: this, value, time }); }
  linearRampToValueAtTime(value, time) { this.ctx.log.push({ type: 'linear', parameter: this, value, time }); }
  exponentialRampToValueAtTime(value, time) { this.ctx.log.push({ type: 'exponential', parameter: this, value, time }); }
}
class Node {
  connections = []; disconnected = false;
  constructor(ctx) { this.ctx = ctx; }
  connect(to) { this.connections.push(to); return to; }
  disconnect() { this.disconnected = true; }
}
class Gain extends Node { constructor(ctx) { super(ctx); this.gain = new Parameter(ctx); } }
class Source extends Node {
  started = []; stopped = [];
  constructor(ctx) { super(ctx); this.frequency = new Parameter(ctx); }
  start(time) { this.started.push(time); }
  stop(time) { this.stopped.push(time); }
}
class Context {
  static instances = [];
  currentTime = 0; sampleRate = 100; state = 'running'; log = []; sources = []; gains = []; nodes = []; destination = {};
  constructor() { Context.instances.push(this); }
  createGain() { const gain = new Gain(this); this.gains.push(gain); this.nodes.push(gain); return gain; }
  createOscillator() { const source = new Source(this); source.kind = 'oscillator'; this.sources.push(source); this.nodes.push(source); return source; }
  createBufferSource() { const source = new Source(this); source.kind = 'buffer'; this.sources.push(source); this.nodes.push(source); return source; }
  createBiquadFilter() { const filter = new Node(this); filter.frequency = new Parameter(this); filter.Q = new Parameter(this); this.nodes.push(filter); return filter; }
  createBuffer(channels, length) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { getChannelData: channel => data[channel] }; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
  lastTarget() { return this.log.filter(event => event.type === 'target').at(-1); }
}
const oldWindow = globalThis.window;
globalThis.window = { AudioContext: Context };
let passed = 0;
function test(name, run) { try { run(); passed++; console.log(`✓ ${name}`); } catch (error) { console.error(`✗ ${name}`); throw error; } }
const sound = new Sound();
try {
  test('construction and release before a gesture are silent and allocate no audio context', () => {
    sound.setMotor(false); sound.setPour(false); assert.equal(Context.instances.length, 0);
  });
  sound.setMotor(true, .8); const ctx = Context.instances[0]; const motorGain = ctx.lastTarget().parameter;
  test('holding starts one sustained motor graph with looping noise and no fixed stop time', () => {
    assert.equal(ctx.sources.filter(source => source.kind === 'oscillator').length, 3);
    assert.equal(ctx.sources.filter(source => source.kind === 'buffer' && source.loop).length, 1);
    assert(ctx.sources.every(source => source.started.length === 1 && source.stopped.length === 0));
    assert.equal(ctx.lastTarget().parameter, motorGain); assert(ctx.lastTarget().value > 0); assert.equal(ctx.lastTarget().tau, .015);
  });
  test('frame updates change motor power without stacking sounds or stopping after 1.4 seconds', () => {
    const nodes = ctx.nodes.length; ctx.currentTime = 8;
    for (let i = 0; i < 200; i++) sound.setMotor(true, (i % 10) / 10);
    assert.equal(ctx.nodes.length, nodes); assert(ctx.sources.every(source => source.stopped.length === 0)); assert.equal(ctx.lastTarget().parameter, motorGain);
  });
  test('release starts the motor fade immediately and reaches 95% attenuation in 45ms', () => {
    sound.setMotor(false); const release = ctx.lastTarget();
    assert.equal(release.parameter, motorGain); assert.equal(release.value, 0); assert.equal(release.time, ctx.currentTime);
    assert(release.tau * 3 <= .05); // exp(-3), approximately 5% remaining amplitude.
  });
  sound.setPour(true, .7); const pourGain = ctx.lastTarget().parameter;
  test('pouring uses one looping liquid graph and reuses it through tilt changes', () => {
    const nodes = ctx.nodes.length; assert(ctx.sources.filter(source => source.kind === 'buffer' && source.loop).length === 2);
    for (let i = 0; i < 200; i++) sound.setPour(true, (i % 8) / 8);
    assert.equal(ctx.nodes.length, nodes); assert.equal(ctx.lastTarget().parameter, pourGain); assert(ctx.sources.every(source => source.stopped.length === 0));
  });
  test('pour release immediately ramps the liquid to silence without a prerecorded tail', () => {
    sound.setPour(false); const release = ctx.lastTarget(); assert.equal(release.parameter, pourGain); assert.equal(release.value, 0); assert(release.tau * 3 <= .05);
  });
  test('sustained effects respect both volume and mute settings', () => {
    sound.setVolumes(.2, .4, false); const effectsBus = ctx.gains[1].gain;
    assert(ctx.log.some(event => event.type === 'target' && event.parameter === effectsBus && Math.abs(event.value - .16) < 1e-8));
    sound.setVolumes(.2, .4, true); sound.setMotor(true); assert.equal(ctx.lastTarget().parameter, motorGain); assert.equal(ctx.lastTarget().value, 0);
    sound.setPour(true); assert.equal(ctx.lastTarget().parameter, pourGain); assert.equal(ctx.lastTarget().value, 0);
    sound.setVolumes(.2, 0, false); sound.setMotor(true); assert.equal(ctx.lastTarget().value, 0); sound.setPour(true); assert.equal(ctx.lastTarget().value, 0);
  });
  test('stop silences both held effects while preserving reusable graphs', () => {
    sound.setVolumes(.3, .6, false); sound.setMotor(true); sound.setPour(true); const nodes = ctx.nodes.length;
    sound.stop();
    for (const parameter of [motorGain, pourGain]) assert.equal(ctx.log.filter(event => event.type === 'target' && event.parameter === parameter).at(-1).value, 0);
    sound.setMotor(true); sound.setPour(true); assert.equal(ctx.nodes.length, nodes);
  });
  test('ordinary tactile one-shot sounds still play through the same effect volume bus', () => {
    const count = ctx.sources.length; sound.play('cut'); sound.play('cash'); sound.play('win'); assert(ctx.sources.length > count);
    assert(ctx.sources.slice(count).every(source => source.started.length === 1 && source.stopped.length === 1));
  });
  await sound.dispose();
  test('dispose stops and disconnects the sustained graphs and closes the audio context', () => {
    assert.equal(ctx.state, 'closed'); assert(ctx.sources.slice(0, 7).every(source => source.stopped.length === 1 && source.disconnected));
  });
  console.log(`\n${passed} sound lifecycle tests passed. These verify audio controls, not perceived sound quality.`);
} finally {
  await sound.dispose();
  if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
}
