// Procedural audio: every sound effect and the music are synthesised with WebAudio,
// so the game ships with zero audio files and loads instantly.

type Wave = OscillatorType;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Track {
  bpm: number;
  chords: number[][]; // midi notes per bar
  bass: number[]; // root per bar
  scale: number[];
  lead: Wave;
  swing: number;
}

const TRACKS: Record<'menu' | 'lab' | 'boss', Track> = {
  menu: {
    bpm: 92,
    chords: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]],
    bass: [41, 40, 38, 36],
    scale: [72, 74, 76, 77, 79, 81, 84],
    lead: 'triangle',
    swing: 0.18,
  },
  lab: {
    bpm: 116,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]],
    bass: [36, 33, 38, 31],
    scale: [72, 74, 76, 79, 81, 84, 86],
    lead: 'square',
    swing: 0.12,
  },
  boss: {
    bpm: 128,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 56, 59, 64]],
    bass: [33, 29, 31, 28],
    scale: [69, 71, 72, 74, 76, 77, 80, 81],
    lead: 'sawtooth',
    swing: 0.05,
  },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noise!: AudioBuffer;
  private musicVol = 0.6;
  private sfxVol = 0.85;
  private adMuted = false;
  private hidden = false;
  private track: keyof typeof TRACKS | null = null;
  private nextBeat = 0;
  private beatIndex = 0;
  private scheduler: number | null = null;
  private intensity = 0;
  private melodySeed = 1;
  private lastBabble = 0;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      const len = this.ctx.sampleRate * 1.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.track) this.startScheduler();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  /** Platforms require all audio muted during ads. */
  setAdMute(m: boolean): void {
    this.adMuted = m;
    this.applyVolumes();
  }

  setHidden(h: boolean): void {
    this.hidden = h;
    this.applyVolumes();
    if (this.ctx) {
      if (h) void this.ctx.suspend().catch(() => {});
      else if (!this.adMuted) void this.ctx.resume().catch(() => {});
    }
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const off = this.adMuted || this.hidden;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(off ? 0 : this.musicVol * 0.32, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(off ? 0 : this.sfxVol * 0.9, t, 0.02);
  }

  // ───────────────────────── primitives ─────────────────────────

  private env(g: GainNode, t: number, a: number, peak: number, d: number, sustain = 0, r = 0.05): number {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
    if (sustain) g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
    return t + a + d + r;
  }

  private tone(freq: number, dur: number, opts: { wave?: Wave; vol?: number; at?: number; slide?: number; attack?: number; dest?: AudioNode; filter?: number; detune?: number } = {}): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.at ?? 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.wave ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(opts.dest ?? this.sfxGain);
    const end = this.env(g, t, opts.attack ?? 0.005, opts.vol ?? 0.3, dur);
    o.start(t);
    o.stop(end + 0.05);
  }

  private noiseBurst(dur: number, opts: { vol?: number; at?: number; type?: BiquadFilterType; freq?: number; q?: number; sweep?: number; dest?: AudioNode; attack?: number } = {}): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.at ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1000, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
    f.Q.value = opts.q ?? 1;
    const g = this.ctx.createGain();
    src.connect(f);
    f.connect(g);
    g.connect(opts.dest ?? this.sfxGain);
    const end = this.env(g, t, opts.attack ?? 0.005, opts.vol ?? 0.3, dur);
    src.start(t, Math.random() * 0.5);
    src.stop(end + 0.05);
  }

  // ───────────────────────── sound effects ─────────────────────────

  play(name: SfxName, arg = 0): void {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone(880, 0.06, { wave: 'triangle', vol: 0.18 }); this.tone(1320, 0.04, { wave: 'sine', vol: 0.08, at: 0.02 }); break;
      case 'hover': this.tone(1200, 0.03, { wave: 'sine', vol: 0.05 }); break;
      case 'back': this.tone(660, 0.06, { wave: 'triangle', vol: 0.15, slide: 440 }); break;
      case 'pop': this.tone(520, 0.08, { wave: 'sine', vol: 0.25, slide: 1100 }); break;
      case 'bubble': for (let i = 0; i < 4; i++) this.tone(300 + Math.random() * 500, 0.06, { wave: 'sine', vol: 0.12, slide: 900 + Math.random() * 600, at: i * 0.07 }); break;
      case 'fizz': this.noiseBurst(0.9, { freq: 5000, q: 0.6, vol: 0.12, type: 'highpass', attack: 0.05 }); break;
      case 'whoosh': this.noiseBurst(0.35, { freq: 400, sweep: 2500, q: 0.8, vol: 0.18, attack: 0.08 }); break;
      case 'flame': this.noiseBurst(0.6, { freq: 300, sweep: 900, q: 0.5, vol: 0.25, type: 'lowpass', attack: 0.04 }); break;
      case 'ding': this.tone(1568, 0.5, { wave: 'sine', vol: 0.2 }); this.tone(2093, 0.4, { wave: 'sine', vol: 0.1, at: 0.05 }); break;
      case 'stamp': this.noiseBurst(0.09, { freq: 300, q: 0.7, vol: 0.4, type: 'lowpass' }); this.tone(110, 0.12, { wave: 'sine', vol: 0.35, slide: 60 }); break;
      case 'drop': this.tone(900 + arg * 60, 0.12, { wave: 'sine', vol: 0.22, slide: 1800 + arg * 80 }); break;
      case 'zap': this.tone(120, 0.25, { wave: 'sawtooth', vol: 0.12, filter: 2500 }); this.noiseBurst(0.2, { freq: 3000, q: 2, vol: 0.12 }); break;
      case 'clank': this.tone(320, 0.25, { wave: 'square', vol: 0.12, filter: 1800 }); this.tone(480, 0.3, { wave: 'triangle', vol: 0.1 }); this.noiseBurst(0.06, { freq: 2500, vol: 0.2 }); break;
      case 'tick': this.tone(2400, 0.02, { wave: 'square', vol: 0.05 }); break;
      case 'geiger': this.noiseBurst(0.012, { freq: 3500, q: 1, vol: 0.35, type: 'highpass' }); break;
      case 'beep': this.tone(1046, 0.08, { wave: 'square', vol: 0.08, filter: 3000 }); break;
      case 'machine': this.tone(220, 0.6, { wave: 'sawtooth', vol: 0.05, filter: 600, slide: 330 }); break;
      case 'sniff': this.noiseBurst(0.35, { freq: 1500, sweep: 3500, q: 1.5, vol: 0.2, attack: 0.1 }); break;
      case 'cough':
        for (let i = 0; i < 3; i++) this.noiseBurst(0.12, { freq: 600 + i * 80, q: 0.8, vol: 0.35, at: i * 0.18, type: 'bandpass' });
        break;
      case 'squeak': this.tone(1800, 0.08, { wave: 'sine', vol: 0.12, slide: 2600 }); this.tone(2200, 0.06, { wave: 'sine', vol: 0.08, at: 0.09, slide: 1700 }); break;
      case 'tap': this.tone(660, 0.05, { wave: 'triangle', vol: 0.16 }); break;
      case 'perfect':
        [0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(84 + n), 0.25, { wave: 'triangle', vol: 0.12, at: i * 0.05 }));
        break;
      case 'good': this.tone(NOTE(79), 0.15, { wave: 'triangle', vol: 0.14 }); this.tone(NOTE(84), 0.2, { wave: 'triangle', vol: 0.12, at: 0.07 }); break;
      case 'miss': this.tone(220, 0.3, { wave: 'square', vol: 0.08, slide: 110, filter: 1200 }); break;
      case 'explosion':
        this.noiseBurst(1.2, { freq: 800, sweep: 80, q: 0.4, vol: 0.6, type: 'lowpass' });
        this.tone(90, 0.7, { wave: 'sine', vol: 0.5, slide: 30 });
        break;
      case 'cash':
        this.tone(NOTE(88), 0.08, { wave: 'square', vol: 0.06, filter: 4000 });
        this.tone(NOTE(93), 0.25, { wave: 'square', vol: 0.06, at: 0.07, filter: 4000 });
        this.noiseBurst(0.05, { freq: 6000, vol: 0.08, at: 0.02 });
        break;
      case 'coin': this.tone(NOTE(86 + (arg % 5)), 0.08, { wave: 'square', vol: 0.04, filter: 5000 }); break;
      case 'correct':
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone(NOTE(72 + n), 0.3, { wave: 'triangle', vol: 0.14, at: i * 0.07 }));
        break;
      case 'wrong': // sad trombone
        [0, -1, -2, -3].forEach((n, i) => this.tone(NOTE(58 + n), i === 3 ? 0.8 : 0.28, { wave: 'sawtooth', vol: 0.1, at: i * 0.3, filter: 900, slide: i === 3 ? NOTE(54) : undefined }));
        break;
      case 'star': this.tone(NOTE(84 + arg * 4), 0.4, { wave: 'triangle', vol: 0.16 }); this.tone(NOTE(91 + arg * 4), 0.4, { wave: 'sine', vol: 0.1, at: 0.04 }); break;
      case 'fanfare':
        [[0, 0.15], [4, 0.15], [7, 0.15], [12, 0.5]].forEach(([n, d], i) => this.tone(NOTE(72 + n), d, { wave: 'square', vol: 0.08, at: i * 0.14, filter: 3000 }));
        [[0, 0.6]].forEach(() => this.tone(NOTE(48), 0.9, { wave: 'triangle', vol: 0.15, at: 0.42 }));
        break;
      case 'fail':
        [7, 3, 0].forEach((n, i) => this.tone(NOTE(60 + n), 0.35, { wave: 'triangle', vol: 0.14, at: i * 0.22 }));
        break;
      case 'levelup':
        [0, 2, 4, 5, 7, 9, 11, 12].forEach((n, i) => this.tone(NOTE(72 + n), 0.12, { wave: 'square', vol: 0.06, at: i * 0.05, filter: 3500 }));
        break;
      case 'buy': this.play('cash'); this.tone(NOTE(96), 0.3, { wave: 'sine', vol: 0.1, at: 0.15 }); break;
      case 'error': this.tone(180, 0.15, { wave: 'square', vol: 0.08, filter: 900 }); this.tone(150, 0.2, { wave: 'square', vol: 0.08, at: 0.12, filter: 900 }); break;
      case 'appear': this.tone(400, 0.25, { wave: 'sine', vol: 0.15, slide: 900 }); break;
      case 'swoosh': this.noiseBurst(0.25, { freq: 2000, sweep: 600, q: 0.6, vol: 0.12, attack: 0.04 }); break;
      case 'pour': this.noiseBurst(0.6, { freq: 900, sweep: 1500, q: 3, vol: 0.12, attack: 0.08 }); break;
      case 'glow': this.tone(NOTE(76), 0.8, { wave: 'sine', vol: 0.1, attack: 0.2 }); this.tone(NOTE(83), 0.8, { wave: 'sine', vol: 0.07, attack: 0.25 }); break;
      case 'hum': this.tone(60, 0.8, { wave: 'sawtooth', vol: 0.05, filter: 300, attack: 0.2 }); break;
      case 'popbang': this.noiseBurst(0.15, { freq: 1500, q: 0.6, vol: 0.5 }); this.tone(1400, 0.12, { wave: 'sine', vol: 0.2, slide: 2600 }); break;
    }
  }

  /** Animal-Crossing-style gibberish for a character. */
  babble(pitch: number, wave: Wave, count = 1): void {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastBabble < 55) return;
    this.lastBabble = now;
    for (let i = 0; i < count; i++) {
      const f = pitch * (0.85 + Math.random() * 0.4);
      this.tone(f, 0.06, { wave, vol: 0.07, at: i * 0.07, slide: f * (0.9 + Math.random() * 0.25), filter: pitch * 6 });
    }
  }

  // ───────────────────────── music ─────────────────────────

  playMusic(track: keyof typeof TRACKS | null): void {
    if (this.track === track) return;
    this.track = track;
    this.beatIndex = 0;
    this.melodySeed = Math.floor(Math.random() * 1000);
    if (!this.ctx) return;
    if (track) this.startScheduler();
    else this.stopScheduler();
  }

  /** 0 = calm, 1 = panic (speeds the music up a little) */
  setIntensity(v: number): void {
    this.intensity = v;
  }

  private startScheduler(): void {
    if (!this.ctx) return;
    this.stopScheduler();
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.scheduler = window.setInterval(() => this.schedule(), 40);
  }

  private stopScheduler(): void {
    if (this.scheduler !== null) window.clearInterval(this.scheduler);
    this.scheduler = null;
  }

  private rng(n: number): number {
    const x = Math.sin(n * 12.9898 + this.melodySeed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private schedule(): void {
    if (!this.ctx || !this.track || this.hidden) return;
    const tr = TRACKS[this.track];
    const bpm = tr.bpm * (1 + this.intensity * 0.18);
    const eighth = 60 / bpm / 2;
    while (this.nextBeat < this.ctx.currentTime + 0.15) {
      const i = this.beatIndex;
      const step = i % 8; // eighth notes in a bar
      const bar = Math.floor(i / 8) % tr.chords.length;
      const phrase = Math.floor(i / 32) % 2;
      const swingOff = step % 2 === 1 ? eighth * tr.swing : 0;
      const t = this.nextBeat + swingOff - this.ctx.currentTime;
      const chord = tr.chords[bar];
      // drums
      if (step === 0 || step === 4 || (this.track === 'boss' && step === 6)) this.kick(t);
      if (step === 2 || step === 6) this.snare(t, this.track === 'menu' ? 0.05 : 0.09);
      if (this.track !== 'menu' || step % 2 === 0) this.hat(t, step % 2 ? 0.025 : 0.04);
      // bass
      if (step === 0 || step === 3 || step === 5 || (step === 7 && this.rng(i) > 0.5)) {
        const n = tr.bass[bar] + (step === 5 ? 7 : step === 7 ? 12 : 0);
        this.tone(NOTE(n), eighth * 1.4, { wave: 'triangle', vol: 0.32, at: t, dest: this.musicGain, filter: 900 });
      }
      // chord stabs
      if (step === 0 || step === 3 || (step === 6 && this.track !== 'menu')) {
        for (const n of chord) this.tone(NOTE(n), eighth * (step === 0 ? 2.5 : 1.2), { wave: 'sine', vol: 0.045, at: t, dest: this.musicGain, attack: 0.01 });
      }
      // melody
      const r = this.rng(i + phrase * 3);
      if ((step % 2 === 0 && r > 0.35) || r > 0.82) {
        const idx = Math.floor(this.rng(i * 7 + bar) * tr.scale.length);
        const n = tr.scale[idx];
        this.tone(NOTE(n), eighth * 0.9, { wave: tr.lead, vol: tr.lead === 'sine' || tr.lead === 'triangle' ? 0.09 : 0.035, at: t, dest: this.musicGain, filter: 2600 });
      }
      this.nextBeat += eighth;
      this.beatIndex++;
    }
  }

  private kick(at: number): void {
    this.tone(150, 0.18, { wave: 'sine', vol: 0.5, at, slide: 45, dest: this.musicGain });
  }
  private snare(at: number, vol: number): void {
    this.noiseBurst(0.12, { freq: 1800, q: 0.7, vol, at, dest: this.musicGain });
  }
  private hat(at: number, vol: number): void {
    this.noiseBurst(0.03, { freq: 8000, q: 0.5, vol, at, type: 'highpass', dest: this.musicGain });
  }
}

export type SfxName =
  | 'click' | 'hover' | 'back' | 'pop' | 'bubble' | 'fizz' | 'whoosh' | 'flame' | 'ding' | 'stamp' | 'drop' | 'zap'
  | 'clank' | 'tick' | 'geiger' | 'beep' | 'machine' | 'sniff' | 'cough' | 'squeak' | 'tap' | 'perfect' | 'good'
  | 'miss' | 'explosion' | 'cash' | 'coin' | 'correct' | 'wrong' | 'star' | 'fanfare' | 'fail' | 'levelup' | 'buy'
  | 'error' | 'appear' | 'swoosh' | 'pour' | 'glow' | 'hum' | 'popbang';

export const audio = new AudioEngine();
