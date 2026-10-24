/** Original, procedural PERAS! score and tactile effects. No audio downloads. */
export type SoundName = 'click' | 'cut' | 'ice' | 'blend' | 'pour' | 'cash' | 'win' | 'serve' | 'upgrade' | 'bird' | 'error';
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
    this.stop(); await this.context?.close().catch(() => undefined); this.context = null; this.musicBus = null; this.effectsBus = null;
  }
}
export const sound = new Sound();
