import { EngineSoundProfile, GameSettings } from '../types/game';

interface EngineHarmonicConfig {
  baseHz: number;
  maxHz: number;
  harmonics: number[];
  gains: number[];
  waveforms: OscillatorType[];
  formantHz: number;
  turboGain: number;
  drive: number;
}

const ENGINE_PROFILES: Record<EngineSoundProfile, EngineHarmonicConfig> = {
  v10_scream: {
    baseHz: 48,
    maxHz: 255,
    harmonics: [1, 1.5, 2.5, 5.0],
    gains: [0.42, 0.28, 0.34, 0.22],
    waveforms: ['sawtooth', 'sawtooth', 'triangle', 'sawtooth'],
    formantHz: 1150,
    turboGain: 0.04,
    drive: 18,
  },
  w16_quad: {
    baseHz: 32,
    maxHz: 168,
    harmonics: [1, 2.0, 4.0, 8.0],
    gains: [0.55, 0.35, 0.22, 0.14],
    waveforms: ['sawtooth', 'triangle', 'sawtooth', 'sine'],
    formantHz: 780,
    turboGain: 0.24,
    drive: 24,
  },
  v8_howl: {
    baseHz: 42,
    maxHz: 225,
    harmonics: [1, 2.0, 3.0, 4.0],
    gains: [0.45, 0.36, 0.26, 0.18],
    waveforms: ['sawtooth', 'square', 'sawtooth', 'triangle'],
    formantHz: 980,
    turboGain: 0.12,
    drive: 22,
  },
  flat6_rasp: {
    baseHz: 44,
    maxHz: 235,
    harmonics: [1, 1.5, 3.0, 4.5],
    gains: [0.4, 0.34, 0.3, 0.16],
    waveforms: ['sawtooth', 'triangle', 'sawtooth', 'square'],
    formantHz: 1080,
    turboGain: 0.05,
    drive: 16,
  },
  i6_turbo: {
    baseHz: 38,
    maxHz: 195,
    harmonics: [1, 1.5, 3.0, 6.0],
    gains: [0.48, 0.32, 0.24, 0.12],
    waveforms: ['sawtooth', 'sawtooth', 'triangle', 'sine'],
    formantHz: 850,
    turboGain: 0.18,
    drive: 20,
  },
  hyper_v12: {
    baseHz: 54,
    maxHz: 290,
    harmonics: [1, 2.0, 3.0, 6.0],
    gains: [0.4, 0.32, 0.3, 0.24],
    waveforms: ['sawtooth', 'sawtooth', 'sawtooth', 'triangle'],
    formantHz: 1320,
    turboGain: 0.22,
    drive: 25,
  },
};

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const buffer = new ArrayBuffer(n * 4);
  const curve = new Float32Array(buffer);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private musicBus: GainNode | null = null;

  private engineOscs: OscillatorNode[] = [];
  private engineGains: GainNode[] = [];
  private engineFilter: BiquadFilterNode | null = null;
  private engineShaper: WaveShaperNode | null = null;
  private engineOutGain: GainNode | null = null;

  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;

  private screechSource: AudioBufferSourceNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;

  private windSource: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private hornOscA: OscillatorNode | null = null;
  private hornOscB: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private profile: EngineSoundProfile = 'i6_turbo';
  private isEngineRunning = false;
  private lastThrottle = 0;
  private lastGear = '1';
  private lastBackfireTime = 0;
  private musicTimer: number | null = null;
  private musicStep = 0;

  private volumes = {
    engine: 0.75,
    effects: 0.8,
    music: 0.4,
  };

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);

    this.engineBus = this.ctx.createGain();
    this.engineBus.gain.value = this.volumes.engine;
    this.engineBus.connect(this.masterGain);

    this.effectsBus = this.ctx.createGain();
    this.effectsBus.gain.value = this.volumes.effects;
    this.effectsBus.connect(this.masterGain);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.volumes.music * 0.45;
    this.musicBus.connect(this.masterGain);

    // Pre-generate 2 seconds of white/pinkish noise buffer
    const sampleRate = this.ctx.sampleRate;
    const len = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.98 * b0 + white * 0.08;
      b1 = 0.85 * b1 + white * 0.25;
      data[i] = (b0 + b1 + white * 0.35) * 0.6;
    }
  }

  public applySettings(settings: GameSettings) {
    this.volumes.engine = settings.engineVolume;
    this.volumes.effects = settings.effectsVolume;
    this.volumes.music = settings.musicVolume;

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.engineBus?.gain.setTargetAtTime(settings.engineVolume, now, 0.04);
    this.effectsBus?.gain.setTargetAtTime(settings.effectsVolume, now, 0.04);
    this.musicBus?.gain.setTargetAtTime(settings.musicVolume * 0.45, now, 0.06);
  }

  public startRaceAudio(profile: EngineSoundProfile) {
    this.init();
    if (!this.ctx || !this.engineBus || !this.effectsBus || !this.noiseBuffer) return;
    this.stopRaceAudio();

    this.profile = profile;
    const cfg = ENGINE_PROFILES[profile];
    const now = this.ctx.currentTime;

    // Engine chain: oscillators -> shaper -> formant bandpass/lowpass -> outGain -> engineBus
    this.engineShaper = this.ctx.createWaveShaper();
    this.engineShaper.curve = makeDistortionCurve(cfg.drive);
    this.engineShaper.oversample = '2x';

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = cfg.formantHz;
    this.engineFilter.Q.value = 2.4;

    this.engineOutGain = this.ctx.createGain();
    this.engineOutGain.gain.value = 0.001;

    this.engineShaper.connect(this.engineFilter);
    this.engineFilter.connect(this.engineOutGain);
    this.engineOutGain.connect(this.engineBus);

    this.engineOscs = [];
    this.engineGains = [];
    for (let i = 0; i < cfg.harmonics.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = cfg.waveforms[i];
      osc.frequency.value = cfg.baseHz * cfg.harmonics[i];
      const g = this.ctx.createGain();
      g.gain.value = cfg.gains[i];
      osc.connect(g);
      g.connect(this.engineShaper);
      osc.start(now);
      this.engineOscs.push(osc);
      this.engineGains.push(g);
    }

    // Turbo spool whine
    this.turboOsc = this.ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.value = 1800;
    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.value = 0;
    this.turboOsc.connect(this.turboGain);
    this.turboGain.connect(this.engineBus);
    this.turboOsc.start(now);

    // Tire screech loop
    this.screechSource = this.ctx.createBufferSource();
    this.screechSource.buffer = this.noiseBuffer;
    this.screechSource.loop = true;
    this.screechFilter = this.ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.value = 1450;
    this.screechFilter.Q.value = 4.5;
    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;
    this.screechSource.connect(this.screechFilter);
    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.effectsBus);
    this.screechSource.start(now);

    // Wind rush loop
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = this.noiseBuffer;
    this.windSource.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 450;
    this.windFilter.Q.value = 0.8;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.effectsBus);
    this.windSource.start(now);

    // Dual-tone horn
    this.hornGain = this.ctx.createGain();
    this.hornGain.gain.value = 0;
    this.hornGain.connect(this.effectsBus);
    this.hornOscA = this.ctx.createOscillator();
    this.hornOscA.type = 'sawtooth';
    this.hornOscA.frequency.value = 415;
    this.hornOscB = this.ctx.createOscillator();
    this.hornOscB.type = 'sawtooth';
    this.hornOscB.frequency.value = 523;
    const hornFilter = this.ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.value = 1600;
    this.hornOscA.connect(hornFilter);
    this.hornOscB.connect(hornFilter);
    hornFilter.connect(this.hornGain);
    this.hornOscA.start(now);
    this.hornOscB.start(now);

    this.isEngineRunning = true;
    this.startMusicLoop();
  }

  public updateVehicleAudio(params: {
    rpmRatio: number; // 0.1..1.0
    throttle: number; // 0..1
    speedKmh: number;
    driftIntensity: number; // 0..1
    isBoosting: boolean;
    gear: string;
    hornPressed: boolean;
    paused: boolean;
  }) {
    if (!this.ctx || !this.isEngineRunning) return;
    const now = this.ctx.currentTime;

    if (params.paused) {
      this.engineOutGain?.gain.setTargetAtTime(0, now, 0.05);
      this.turboGain?.gain.setTargetAtTime(0, now, 0.05);
      this.screechGain?.gain.setTargetAtTime(0, now, 0.05);
      this.windGain?.gain.setTargetAtTime(0, now, 0.05);
      this.hornGain?.gain.setTargetAtTime(0, now, 0.03);
      return;
    }

    const cfg = ENGINE_PROFILES[this.profile];
    const rpmNorm = Math.max(0.08, Math.min(1.05, params.rpmRatio));
    const fundamental = cfg.baseHz + (cfg.maxHz - cfg.baseHz) * rpmNorm;

    for (let i = 0; i < this.engineOscs.length; i++) {
      this.engineOscs[i].frequency.setTargetAtTime(
        fundamental * cfg.harmonics[i],
        now,
        0.025
      );
    }

    // Filter opens with throttle & RPM
    const filterFreq = cfg.formantHz * (0.45 + rpmNorm * 0.9 + params.throttle * 0.55);
    this.engineFilter?.frequency.setTargetAtTime(filterFreq, now, 0.03);

    const engineVol = 0.22 + params.throttle * 0.18 + rpmNorm * 0.14 + (params.isBoosting ? 0.08 : 0);
    this.engineOutGain?.gain.setTargetAtTime(engineVol, now, 0.035);

    // Turbo whistle
    if (this.turboOsc && this.turboGain) {
      const turboFreq = 1900 + rpmNorm * 3200 + (params.isBoosting ? 1200 : 0);
      const turboVol = cfg.turboGain * Math.max(0, rpmNorm - 0.35) * (0.4 + params.throttle * 0.6 + (params.isBoosting ? 0.7 : 0));
      this.turboOsc.frequency.setTargetAtTime(turboFreq, now, 0.05);
      this.turboGain.gain.setTargetAtTime(turboVol, now, 0.05);
    }

    // Exhaust pops/backfire when lifting off throttle at high RPM
    if (this.lastThrottle > 0.6 && params.throttle < 0.15 && rpmNorm > 0.55 && now - this.lastBackfireTime > 0.35) {
      this.triggerExhaustPop();
      this.lastBackfireTime = now;
    }
    this.lastThrottle = params.throttle;

    // Gear shift transient
    if (params.gear !== this.lastGear) {
      if (params.gear !== 'N' && this.lastGear !== 'N') {
        this.triggerGearShift(params.gear > this.lastGear);
      }
      this.lastGear = params.gear;
    }

    // Tire screech
    if (this.screechGain && this.screechFilter) {
      const screech = Math.min(0.28, params.driftIntensity * 0.28);
      this.screechGain.gain.setTargetAtTime(screech, now, 0.04);
      this.screechFilter.frequency.setTargetAtTime(1250 + params.driftIntensity * 550, now, 0.04);
    }

    // Wind rush
    if (this.windGain && this.windFilter) {
      const speedRatio = Math.min(1, params.speedKmh / 360);
      this.windGain.gain.setTargetAtTime(speedRatio * speedRatio * 0.18, now, 0.08);
      this.windFilter.frequency.setTargetAtTime(320 + speedRatio * 1100, now, 0.08);
    }

    // Horn
    if (this.hornGain) {
      this.hornGain.gain.setTargetAtTime(params.hornPressed ? 0.24 : 0, now, 0.02);
    }
  }

  public triggerExhaustPop() {
    if (!this.ctx || !this.effectsBus || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const t = now + i * (0.045 + Math.random() * 0.04);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520 + Math.random() * 350;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.effectsBus);
      src.start(t);
      src.stop(t + 0.1);
    }
  }

  public triggerGearShift(upshift: boolean) {
    if (!this.ctx || !this.engineOutGain) return;
    const now = this.ctx.currentTime;
    // Brief ignition cut on upshift, bark on downshift
    if (upshift) {
      this.engineOutGain.gain.setValueAtTime(0.06, now);
      this.engineOutGain.gain.linearRampToValueAtTime(0.32, now + 0.07);
    } else {
      this.triggerExhaustPop();
    }
  }

  public triggerCrash(intensity: number) {
    if (!this.ctx || !this.effectsBus || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const strength = Math.max(0.15, Math.min(1, intensity));

    // Low impact thud
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.45 * strength, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(oscGain);
    oscGain.connect(this.effectsBus);
    osc.start(now);
    osc.stop(now + 0.26);

    // Metallic crunch burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 1.2;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.42 * strength, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.effectsBus);
    src.start(now);
    src.stop(now + 0.34);
  }

  public triggerIndicatorClick(isOnPhase: boolean) {
    if (!this.ctx || !this.effectsBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isOnPhase ? 1650 : 1280, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(g);
    g.connect(this.effectsBus);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  public triggerCountdownBeep(isGo: boolean) {
    if (!this.ctx || !this.effectsBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.42 : 0.2));
    osc.connect(g);
    g.connect(this.effectsBus);
    osc.start(now);
    osc.stop(now + (isGo ? 0.45 : 0.22));
  }

  public triggerUiClick() {
    this.init();
    if (!this.ctx || !this.effectsBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.effectsBus);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  private startMusicLoop() {
    if (this.musicTimer !== null) return;
    const bassNotes = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42];
    const arpNotes = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 349.23];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicBus || this.volumes.music <= 0.01) return;
      if (this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const step = this.musicStep % 8;
      this.musicStep++;

      // Driving synthwave bass pulse
      const bass = this.ctx.createOscillator();
      bass.type = 'sawtooth';
      bass.frequency.setValueAtTime(bassNotes[step], now);
      const bFilter = this.ctx.createBiquadFilter();
      bFilter.type = 'lowpass';
      bFilter.frequency.setValueAtTime(340, now);
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.18, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      bass.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(this.musicBus);
      bass.start(now);
      bass.stop(now + 0.22);

      // Subtle lead arp
      if (step % 2 === 0) {
        const arp = this.ctx.createOscillator();
        arp.type = 'triangle';
        arp.frequency.setValueAtTime(arpNotes[(step / 2) % arpNotes.length], now);
        const aGain = this.ctx.createGain();
        aGain.gain.setValueAtTime(0.08, now);
        aGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        arp.connect(aGain);
        aGain.connect(this.musicBus);
        arp.start(now);
        arp.stop(now + 0.36);
      }
    }, 240);
  }

  public stopRaceAudio() {
    this.isEngineRunning = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }

    const stopNode = (node: OscillatorNode | AudioBufferSourceNode | null) => {
      if (!node) return;
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore already stopped
      }
    };

    this.engineOscs.forEach(stopNode);
    this.engineOscs = [];
    this.engineGains = [];
    stopNode(this.turboOsc);
    stopNode(this.screechSource);
    stopNode(this.windSource);
    stopNode(this.hornOscA);
    stopNode(this.hornOscB);

    this.turboOsc = null;
    this.screechSource = null;
    this.windSource = null;
    this.hornOscA = null;
    this.hornOscB = null;
  }
}

export const soundEngine = new SoundEngine();
