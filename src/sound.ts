/** Original, procedural PERAS! score and tactile effects. No audio downloads. */
export type SoundName = 'click' | 'cut' | 'ice' | 'blend' | 'pour' | 'cash' | 'win' | 'serve' | 'upgrade' | 'bird' | 'error';
interface SustainedSound {
  gain: GainNode;
  sources: (OscillatorNode | AudioBufferSourceNode)[];
  nodes: AudioNode[];
}
interface MotorSound extends SustainedSound { pitches: AudioParam[]; filter: BiquadFilterNode }
interface PourSound extends SustainedSound { filter: BiquadFilterNode }
export class Sound {
  enabled = true;
  music = .35;
  sfx = .65;
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextNote = 0;
  private motor: MotorSound | null = null;
  private pouring: PourSound | null = null;

  /** Call from a pointer/keyboard gesture. The constructor is silent. */
  async start() {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    await ctx.resume().catch(() => undefined);
    this.updateVolumes();
    if (this.timer !== null) return;
    this.nextNote = ctx.currentTime + .06;
    this.timer = setInterval(() => this.schedule(), 80);
    this.schedule();
  }
  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.setMotor(false);
    this.setPour(false);
    if (this.context && this.musicBus) this.musicBus.gain.setTargetAtTime(0, this.context.currentTime, .08);
  }
  setVolumes(music: number, sfx: number, muted = false) {
    this.music = Math.max(0, Math.min(1, music)); this.sfx = Math.max(0, Math.min(1, sfx)); this.enabled = !muted;
    this.updateVolumes();
  }
  private updateVolumes() {
    const ctx = this.context; if (!ctx) return;
    this.musicBus?.gain.setTargetAtTime(this.enabled ? this.music * .23 : 0, ctx.currentTime, .04);
    this.effectsBus?.gain.setTargetAtTime(this.enabled ? this.sfx * .4 : 0, ctx.currentTime, .04);
  }
  private ensure(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === 'undefined') return null;
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return null;
    try {
      this.context = new Audio(); this.musicBus = this.context.createGain(); this.effectsBus = this.context.createGain();
      this.musicBus.connect(this.context.destination); this.effectsBus.connect(this.context.destination); this.updateVolumes();
      return this.context;
    } catch { return null; }
  }
  private loopNoise(ctx: AudioContext): AudioBufferSourceNode {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
    return source;
  }
  private ramp(parameter: AudioParam, value: number, seconds = .015) {
    const time = this.context!.currentTime;
    parameter.cancelScheduledValues(time);
    parameter.setTargetAtTime(value, time, seconds);
  }
  /** Sustained motor follows the real held switch. Repeated frame calls reuse one graph. */
  setMotor(active: boolean, power = .75) {
    if (!active || !this.enabled || this.sfx <= 0) {
      if (this.motor && this.context) this.ramp(this.motor.gain.gain, 0);
      return;
    }
    const ctx = this.ensure(); if (!ctx || !this.effectsBus) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const intensity = Number.isFinite(power) ? Math.max(0, Math.min(1, power)) : .75;
    if (!this.motor) {
      const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(this.effectsBus);
      const base = ctx.createOscillator(), harmonic = ctx.createOscillator(), vibration = ctx.createOscillator();
      base.type = 'sawtooth'; base.frequency.value = 112;
      harmonic.type = 'triangle'; harmonic.frequency.value = 225;
      vibration.type = 'sine'; vibration.frequency.value = 8.2;
      const baseGain = ctx.createGain(), harmonicGain = ctx.createGain(), modulation = ctx.createGain(), noiseGain = ctx.createGain();
      baseGain.gain.value = .2; harmonicGain.gain.value = .08; modulation.gain.value = 3.4; noiseGain.gain.value = .23;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1000; filter.Q.value = .6;
      const noise = this.loopNoise(ctx);
      base.connect(baseGain); baseGain.connect(gain); harmonic.connect(harmonicGain); harmonicGain.connect(gain);
      vibration.connect(modulation); modulation.connect(base.frequency); modulation.connect(harmonic.frequency);
      noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(gain);
      const sources = [base, harmonic, vibration, noise]; sources.forEach(source => source.start(ctx.currentTime));
      this.motor = { gain, pitches: [base.frequency, harmonic.frequency], filter, sources,
        nodes: [gain, base, harmonic, vibration, baseGain, harmonicGain, modulation, filter, noiseGain, noise] };
    }
    this.updateVolumes();
    this.ramp(this.motor.pitches[0], 88 + intensity * 47, .025);
    this.ramp(this.motor.pitches[1], 177 + intensity * 92, .025);
    this.ramp(this.motor.filter.frequency, 700 + intensity * 950, .025);
    this.ramp(this.motor.gain.gain, .48 + intensity * .4);
  }
  /** Gentle continuous liquid noise, audible only while the player's pour is flowing. */
  setPour(active: boolean, intensity = .65) {
    if (!active || !this.enabled || this.sfx <= 0) {
      if (this.pouring && this.context) this.ramp(this.pouring.gain.gain, 0, .012);
      return;
    }
    const ctx = this.ensure(); if (!ctx || !this.effectsBus) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const level = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : .65;
    if (!this.pouring) {
      const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(this.effectsBus);
      const noise = this.loopNoise(ctx), filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1250; filter.Q.value = .65;
      const bubble = ctx.createOscillator(), bubblesGain = ctx.createGain(), flutter = ctx.createOscillator(), flutterGain = ctx.createGain();
      bubble.type = 'sine'; bubble.frequency.value = 280; bubblesGain.gain.value = .025;
      flutter.type = 'sine'; flutter.frequency.value = 6.4; flutterGain.gain.value = 52;
      noise.connect(filter); filter.connect(gain);
      bubble.connect(bubblesGain); bubblesGain.connect(gain); flutter.connect(flutterGain); flutterGain.connect(bubble.frequency);
      const sources = [noise, bubble, flutter]; sources.forEach(source => source.start(ctx.currentTime));
      this.pouring = { gain, filter, sources, nodes: [gain, noise, filter, bubble, bubblesGain, flutter, flutterGain] };
    }
    this.updateVolumes();
    this.ramp(this.pouring.filter.frequency, 1050 + level * 950, .025);
    this.ramp(this.pouring.gain.gain, level * .37, .012);
  }
  private tone(frequency: number, when: number, duration: number, amplitude: number, bus: GainNode, type: OscillatorType = 'sine', endFrequency?: number) {
    const ctx = this.context!; const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, when);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), when + duration);
    gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(amplitude, when + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    oscillator.connect(gain); gain.connect(bus); oscillator.start(when); oscillator.stop(when + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  private noise(when: number, duration: number, amplitude: number, frequency: number, type: BiquadFilterType = 'lowpass') {
    const ctx = this.context!; const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate); const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; filter.Q.value = .7;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(.0001, when); gain.gain.linearRampToValueAtTime(amplitude, when + .015); gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.effectsBus!); source.start(when); source.stop(when + duration + .01);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  private marimba(frequency: number, when: number, amplitude = .55) {
    const bus = this.musicBus!;
    this.tone(frequency, when, .62, amplitude, bus);
    this.tone(frequency * 3.99, when, .11, amplitude * .1, bus);
    this.tone(frequency * 2, when, .22, amplitude * .15, bus);
  }
  private schedule() {
    const ctx = this.context; if (!ctx || !this.enabled || ctx.state !== 'running') return;
    this.updateVolumes();
    // A gentle pentatonic melody over C / Am / F / G; original 32-beat phrase.
    const melody = [76, 79, 81, 79, 72, 0, 74, 76, 69, 72, 76, 74, 72, 0, 69, 0,
      77, 76, 72, 69, 72, 0, 76, 79, 74, 76, 79, 81, 79, 0, 74, 0];
    const bass = [48, 45, 41, 43];
    const note = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
    // Recover from background-tab suspension without queuing minutes of notes.
    if (this.nextNote < ctx.currentTime - .5) this.nextNote = ctx.currentTime + .04;
    while (this.nextNote < ctx.currentTime + .22) {
      const index = this.step % melody.length; const when = this.nextNote;
      if (melody[index]) this.marimba(note(melody[index]), when, index % 2 ? .31 : .44);
      if (index % 4 === 0) this.tone(note(bass[Math.floor(index / 8)]), when, .8, .48, this.musicBus!, 'triangle');
      if (index % 2 === 1) this.tone(350, when, .055, .055, this.musicBus!, 'triangle', 90);
      if (this.step % 64 === 40 && this.music > 0) this.bird(when + .08, this.musicBus!, .1);
      this.step++; this.nextNote += .30;
    }
  }
  private bird(when: number, bus: GainNode, gain = .24) {
    this.tone(1900, when, .13, gain, bus, 'sine', 2850);
    this.tone(2400, when + .15, .11, gain * .8, bus, 'sine', 1800);
    this.tone(2200, when + .3, .1, gain * .65, bus, 'sine', 3100);
  }
  play(name: SoundName | string) {
    if (!this.enabled || this.sfx <= 0) return;
    const ctx = this.ensure(); if (!ctx || !this.effectsBus) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    this.updateVolumes(); const when = ctx.currentTime + .015; const bus = this.effectsBus;
    if (name === 'click') { this.tone(720, when, .075, .22, bus, 'sine', 480); }
    else if (name === 'cut') { this.noise(when, .1, .35, 1800); this.tone(150, when, .07, .2, bus, 'triangle', 70); }
    else if (name === 'ice') { [1700, 2200, 2800].forEach((frequency, i) => this.tone(frequency, when + i * .075, .18, .18, bus)); }
    else if (name === 'blend') {
      this.noise(when, 1.4, .28, 850); this.tone(95, when, 1.4, .17, bus, 'sawtooth', 145);
      this.tone(192, when, 1.4, .07, bus, 'triangle', 287);
    } else if (name === 'pour') {
      this.noise(when, .95, .23, 1700, 'bandpass');
      for (let i = 0; i < 6; i++) this.tone(380 + i * 80, when + i * .12, .1, .065, bus, 'sine', 260 + i * 60);
    } else if (name === 'cash' || name === 'serve') {
      this.tone(1175, when, .2, .34, bus); this.tone(1568, when + .1, .42, .3, bus); this.noise(when + .07, .08, .1, 3000);
    } else if (name === 'win' || name === 'upgrade') {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => this.tone(frequency, when + i * .12, .45, .3, bus, 'triangle'));
    } else if (name === 'bird') this.bird(when, bus);
    else if (name === 'error') { this.tone(260, when, .15, .2, bus, 'triangle', 190); this.tone(190, when + .16, .22, .15, bus, 'triangle', 140); }
  }
  async dispose() {
    this.stop();
    for (const graph of [this.motor, this.pouring]) if (graph) {
      graph.sources.forEach(source => { try { source.stop(); } catch { /* Already ended by the audio context. */ } });
      graph.nodes.forEach(node => node.disconnect());
    }
    this.motor = null; this.pouring = null;
    await this.context?.close().catch(() => undefined); this.context = null; this.musicBus = null; this.effectsBus = null;
  }
}
export const sound = new Sound();
