import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/SoundEngine';
import { CAR_MAP, CARS } from '../data/cars';
import { BIOME_PALETTES } from '../data/tracks';
import {
  CameraMode,
  CarCustomization,
  CarDamage,
  CarId,
  CarUpgrades,
  GameSettings,
  HeadlightMode,
  IndicatorMode,
  InputDeviceType,
  LevelConfig,
  RaceResult,
  RaceTelemetry,
} from '../types/game';
import { buildCarModel, buildOpponentCarLOD, BuiltCarRig } from './carBuilder';
import { computeAiInput, stepVehiclePhysics, VehicleInput, VehicleState } from './physics';
import { buildProceduralTrack, BuiltTrack } from './trackBuilder';
import { checkWebGLSupport } from './webglSupport';

// Pre-allocated math helpers for zero-GC tick loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export interface RaceSessionConfig {
  carId: CarId;
  customization: CarCustomization;
  upgrades: CarUpgrades;
  damage: CarDamage;
  levelConfig: LevelConfig;
  settings: GameSettings;
}

export interface RaceCallbacks {
  onTelemetry: (t: RaceTelemetry) => void;
  onFinish: (result: RaceResult) => void;
  onPauseRequest: () => void;
}

export class RaceEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private fallback2dCanvas: HTMLCanvasElement | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rearCamera: THREE.PerspectiveCamera;
  private rearTarget: THREE.WebGLRenderTarget | null = null;
  private isSoftwareGl: boolean;
  private maxAnisotropy = 1;

  private track: BuiltTrack | null = null;
  private playerRig: BuiltCarRig | null = null;
  private playerState!: VehicleState;
  private aiRigs: Array<{ lod: THREE.LOD; rig: BuiltCarRig; state: VehicleState }> = [];

  private config: RaceSessionConfig;
  private callbacks: RaceCallbacks;

  // Input state
  private heldKeys = new Set<string>();
  private touchInput: VehicleInput = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    nitro: false,
  };
  private touchHorn = false;
  private activeInput: InputDeviceType = 'keyboard';

  // Car features state
  private headlights: HeadlightMode = 'low';
  private indicators: IndicatorMode = 'off';
  private indicatorBlinkTimer = 0;
  private indicatorPhaseOn = false;
  private wipersOn = false;
  private wiperPhase = 0;
  private cameraMode: CameraMode = 'chase';
  private hornHeld = false;

  // Camera smoothing & shake
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camShake = 0;
  private cinematicAngle = 0;

  // Timing & lifecycle
  private frameId = 0;
  private lastTimestamp = 0;
  private paused = false;
  private disposed = false;
  private countdownTimer = 3.4; // 3..2..1..GO
  private lastCountdownStep = 4;
  private raceElapsedMs = 0;
  private lastTelemetryMs = 0;
  private frameCount = 0;

  // Pooled particle & skid mark buffers
  private skidPool: THREE.Mesh[] = [];
  private skidCursor = 0;
  private skidTimer = 0;

  private particlePool: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
    kind: 'smoke' | 'flame';
  }> = [];
  private particleCursor = 0;

  private weatherPoints: THREE.Points | null = null;
  private weatherPositions: Float32Array | null = null;

  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;

  constructor(
    container: HTMLElement,
    config: RaceSessionConfig,
    callbacks: RaceCallbacks
  ) {
    this.container = container;
    this.config = config;
    this.callbacks = callbacks;

    const support = checkWebGLSupport();
    this.isSoftwareGl = support.isSoftwareGl;
    const quality = config.settings.quality;

    const w = Math.max(320, container.clientWidth);
    const h = Math.max(240, container.clientHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, w / h, 0.25, 950);
    this.rearCamera = new THREE.PerspectiveCamera(68, 2.5, 0.4, 240);

    if (support.supported) {
      try {
        const renderer = new THREE.WebGLRenderer({
          antialias: !this.isSoftwareGl && quality !== 'low',
          powerPreference: 'default',
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        const dprCap = quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1;
        renderer.setPixelRatio(
          this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, dprCap)
        );
        renderer.shadowMap.enabled = !this.isSoftwareGl && quality !== 'low';
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setSize(w, h);
        container.appendChild(renderer.domElement);
        this.renderer = renderer;
        this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

        const pmrem = new THREE.PMREMGenerator(renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();

        if (!this.isSoftwareGl && quality !== 'low') {
          this.rearTarget = new THREE.WebGLRenderTarget(256, 128);
        }
      } catch {
        this.renderer = null;
      }
    }

    if (!this.renderer) {
      const c2d = document.createElement('canvas');
      c2d.width = w;
      c2d.height = h;
      c2d.style.width = '100%';
      c2d.style.height = '100%';
      c2d.style.display = 'block';
      container.appendChild(c2d);
      this.fallback2dCanvas = c2d;
    }

    this.setupLightingAndAtmosphere();
    this.buildWorldAndRacers();
    this.initPools();

    if (this.renderer && !this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();

    // Auto-activate wipers in rain
    this.wipersOn = config.levelConfig.weather === 'rain';
    this.headlights = config.levelConfig.timeOfDay === 'night' ? 'high' : 'low';

    const carSpec = CAR_MAP[config.carId];
    soundEngine.applySettings(config.settings);
    soundEngine.startRaceAudio(carSpec.soundProfile);

    this.lastTimestamp = performance.now();
    this.tick(this.lastTimestamp);
  }

  private setupLightingAndAtmosphere() {
    const lvl = this.config.levelConfig;
    const palette = BIOME_PALETTES[lvl.biome];

    const skyHex =
      lvl.timeOfDay === 'night'
        ? palette.skyNight
        : lvl.timeOfDay === 'sunset'
        ? palette.skySunset
        : palette.skyDay;
    const skyColor = new THREE.Color(skyHex);
    this.scene.background = skyColor;

    const fogDensity =
      lvl.weather === 'fog' ? 0.011 : lvl.weather === 'rain' ? 0.0042 : 0.0022;
    this.scene.fog = new THREE.FogExp2(skyHex, fogDensity);

    // Cool/Warm Contrast Rig
    const hemiSky = lvl.timeOfDay === 'night' ? 0x1e293b : 0x93c5fd;
    const hemiGround = lvl.timeOfDay === 'night' ? 0x090d16 : 0x3f3f46;
    const hemiInt = lvl.timeOfDay === 'night' ? 0.55 : 0.78;
    this.hemiLight = new THREE.HemisphereLight(hemiSky, hemiGround, hemiInt);
    this.scene.add(this.hemiLight);

    const sunColor =
      lvl.timeOfDay === 'sunset'
        ? 0xffb074
        : lvl.timeOfDay === 'night'
        ? 0x93c5fd
        : 0xfffbeb;
    const sunInt = lvl.timeOfDay === 'night' ? 0.9 : 1.75;
    this.sunLight = new THREE.DirectionalLight(sunColor, sunInt);
    this.sunLight.position.set(60, 110, 45);
    this.sunLight.castShadow =
      !this.isSoftwareGl && this.config.settings.quality !== 'low';
    const smSize = this.config.settings.quality === 'high' ? 2048 : 1024;
    this.sunLight.shadow.mapSize.set(smSize, smSize);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 260;
    const d = 65;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  private buildWorldAndRacers() {
    const lvl = this.config.levelConfig;
    this.track = buildProceduralTrack(
      lvl,
      this.config.settings.quality,
      this.maxAnisotropy
    );
    this.scene.add(this.track.group);

    // Spawn grid behind start line (sample 0, moving backward along track)
    const n = this.track.samples.length;
    const playerSpec = CAR_MAP[this.config.carId];

    this.playerRig = buildCarModel(
      playerSpec,
      this.config.customization,
      this.config.damage,
      this.maxAnisotropy,
      {
        isPlayer: true,
        rearMirrorTexture: this.rearTarget?.texture || null,
        isSoftwareGl: this.isSoftwareGl,
      }
    );
    this.scene.add(this.playerRig.root);

    const playerGridSmp = this.track.samples[(n - 4) % n];
    const playerStartPos = playerGridSmp.point
      .clone()
      .addScaledVector(playerGridSmp.right, -2.5);
    const startYaw = Math.atan2(-playerGridSmp.tangent.x, -playerGridSmp.tangent.z);

    this.playerState = {
      isPlayer: true,
      name: 'Player',
      carSpec: playerSpec,
      tireStyle: this.config.customization.tireStyle,
      position: playerStartPos,
      velocity: new THREE.Vector3(),
      yaw: startYaw,
      yawRate: 0,
      speedMs: 0,
      steerAngle: 0,
      pitch: 0,
      roll: 0,
      wheelRotation: 0,
      rpm: playerSpec.idleRpm,
      gearNum: 0,
      shiftTimer: 0,
      gear: 'N',
      nitro: 100,
      isBoosting: false,
      isDrifting: false,
      slipAngleRad: 0,
      driftScore: 0,
      driftMeters: 0,
      nitroUsedSeconds: 0,
      sampleIndex: (n - 4) % n,
      lap: 1,
      nextCheckpoint: 0,
      furthestProgress: 0,
      finished: false,
      finishTimeMs: 0,
      lapStartTimeMs: 0,
      bestLapMs: null,
      collisionsCount: 0,
      damageTaken: { body: 0, engine: 0, tires: 0 },
      aiTargetOffset: 0,
      aiSpeedSkill: 1,
      aiColor: this.config.customization.paintColor,
    };

    // Place initial camera behind player
    this.camPos.copy(playerStartPos).add(new THREE.Vector3(0, 3, 7));
    this.camLook.copy(playerStartPos);

    // Spawn AI Rivals
    const rivalPool = CARS.filter((c) => c.id !== this.config.carId);
    const aiPalette = ['#ef4444', '#38bdf8', '#a855f7', '#eab308', '#10b981'];
    for (let i = 0; i < lvl.aiCount; i++) {
      const rivalSpec = rivalPool[i % rivalPool.length];
      const aiColor = aiPalette[i % aiPalette.length];
      const { lod, rig } = buildOpponentCarLOD(
        rivalSpec,
        aiColor,
        this.maxAnisotropy
      );
      this.scene.add(lod);

      const row = Math.floor((i + 1) / 2);
      const lane = (i + 1) % 2 === 0 ? -2.5 : 2.5;
      const gIdx = (n - 4 - row * 3 + n) % n;
      const smp = this.track.samples[gIdx];
      const pos = smp.point.clone().addScaledVector(smp.right, lane);
      const yaw = Math.atan2(-smp.tangent.x, -smp.tangent.z);

      const aiState: VehicleState = {
        isPlayer: false,
        name: rivalSpec.name,
        carSpec: rivalSpec,
        tireStyle: 'street',
        position: pos,
        velocity: new THREE.Vector3(),
        yaw,
        yawRate: 0,
        speedMs: 0,
        steerAngle: 0,
        pitch: 0,
        roll: 0,
        wheelRotation: 0,
        rpm: rivalSpec.idleRpm,
        gearNum: 0,
        shiftTimer: 0,
        gear: 'N',
        nitro: 100,
        isBoosting: false,
        isDrifting: false,
        slipAngleRad: 0,
        driftScore: 0,
        driftMeters: 0,
        nitroUsedSeconds: 0,
        sampleIndex: gIdx,
        lap: 1,
        nextCheckpoint: 0,
        furthestProgress: -0.02 * (i + 1),
        finished: false,
        finishTimeMs: 0,
        lapStartTimeMs: 0,
        bestLapMs: null,
        collisionsCount: 0,
        damageTaken: { body: 0, engine: 0, tires: 0 },
        aiTargetOffset: (i % 2 === 0 ? -1 : 1) * (1.2 + (i % 3) * 0.9),
        aiSpeedSkill: lvl.aiSpeedMultiplier * (0.94 + (i % 3) * 0.045),
        aiColor,
      };
      lod.position.copy(pos);
      lod.rotation.y = yaw;
      this.aiRigs.push({ lod, rig, state: aiState });
    }
  }

  private initPools() {
    // Skid mark quad pool
    const skidGeo = new THREE.PlaneGeometry(0.32, 1.15);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x090a0c,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const skidMax = this.config.settings.quality === 'low' ? 60 : 140;
    for (let i = 0; i < skidMax; i++) {
      const m = new THREE.Mesh(skidGeo, skidMat);
      m.visible = false;
      this.scene.add(m);
      this.skidPool.push(m);
    }

    // Smoke & Exhaust Flame particle pool
    const pGeo = new THREE.SphereGeometry(0.24, 7, 7);
    const pCount = this.config.settings.quality === 'low' ? 28 : 56;
    for (let i = 0; i < pCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xcbd5e1,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        kind: 'smoke',
      });
    }

    // Weather particles (Rain or Snow)
    const weather = this.config.levelConfig.weather;
    if (weather === 'rain' || weather === 'snow') {
      const count = this.config.settings.quality === 'low' ? 350 : 850;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = Math.random() * 24;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: weather === 'snow' ? 0xf8fafc : 0x93c5fd,
        size: weather === 'snow' ? 0.24 : 0.14,
        transparent: true,
        opacity: weather === 'snow' ? 0.85 : 0.58,
      });
      this.weatherPoints = new THREE.Points(geo, mat);
      this.weatherPoints.frustumCulled = false;
      this.weatherPositions = positions;
      this.scene.add(this.weatherPoints);
    }
  }

  private spawnParticle(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    kind: 'smoke' | 'flame',
    colorHex: number,
    maxLife: number,
    scale: number
  ) {
    const p = this.particlePool[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particlePool.length;
    p.mesh.position.copy(pos);
    p.vel.copy(vel);
    p.life = maxLife;
    p.maxLife = maxLife;
    p.kind = kind;
    p.mesh.scale.setScalar(scale);
    const mat = p.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = kind === 'flame' ? 0.92 : 0.45;
    p.mesh.visible = true;
  }

  private placeSkidMark(worldPos: THREE.Vector3, yaw: number) {
    const m = this.skidPool[this.skidCursor];
    this.skidCursor = (this.skidCursor + 1) % this.skidPool.length;
    m.position.set(worldPos.x, worldPos.y + 0.06, worldPos.z);
    m.rotation.y = yaw;
    m.visible = true;
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('resize', this.onResize);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    this.activeInput = 'keyboard';
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)
    ) {
      e.preventDefault();
    }

    if (e.repeat) return;

    if (code === 'Escape') {
      this.callbacks.onPauseRequest();
      return;
    }
    if (code === 'KeyL') this.cycleHeadlights();
    if (code === 'KeyC') this.cycleCamera();
    if (code === 'KeyQ') this.toggleIndicator('left');
    if (code === 'KeyE') this.toggleIndicator('right');
    if (code === 'KeyZ') this.toggleHazard();
    if (code === 'KeyV') this.toggleWipers();
    if (code === 'KeyR') this.resetPlayerToTrack();

    this.heldKeys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.heldKeys.clear();
  };

  public onResize = () => {
    if (this.disposed) return;
    const w = Math.max(320, this.container.clientWidth);
    const h = Math.max(240, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.renderer) {
      this.renderer.setSize(w, h);
    }
    if (this.fallback2dCanvas) {
      this.fallback2dCanvas.width = w;
      this.fallback2dCanvas.height = h;
    }
  };

  // Public interactive controls for HUD & Mobile buttons
  public setTouchInput(partial: Partial<VehicleInput>, horn = false) {
    this.activeInput = 'touch';
    this.touchInput = { ...this.touchInput, ...partial };
    this.touchHorn = horn;
  }

  public cycleHeadlights() {
    soundEngine.triggerUiClick();
    this.headlights =
      this.headlights === 'low' ? 'high' : this.headlights === 'high' ? 'off' : 'low';
  }

  public cycleCamera() {
    soundEngine.triggerUiClick();
    const order: CameraMode[] = ['chase', 'hood', 'cockpit', 'cinematic'];
    const next = (order.indexOf(this.cameraMode) + 1) % order.length;
    this.cameraMode = order[next];
  }

  public toggleIndicator(side: 'left' | 'right') {
    soundEngine.triggerUiClick();
    this.indicators = this.indicators === side ? 'off' : side;
    this.indicatorBlinkTimer = 0;
    this.indicatorPhaseOn = true;
  }

  public toggleHazard() {
    soundEngine.triggerUiClick();
    this.indicators = this.indicators === 'hazard' ? 'off' : 'hazard';
    this.indicatorBlinkTimer = 0;
    this.indicatorPhaseOn = true;
  }

  public toggleWipers() {
    soundEngine.triggerUiClick();
    this.wipersOn = !this.wipersOn;
  }

  public resetPlayerToTrack() {
    if (!this.track) return;
    const smp = this.track.samples[this.playerState.sampleIndex];
    this.playerState.position.copy(smp.point);
    this.playerState.velocity.set(0, 0, 0);
    this.playerState.yaw = Math.atan2(-smp.tangent.x, -smp.tangent.z);
    this.playerState.yawRate = 0;
    this.playerState.speedMs = 0;
  }

  public setPaused(p: boolean) {
    this.paused = p;
    if (!p) {
      this.lastTimestamp = performance.now();
    }
  }

  public updateSettings(settings: GameSettings) {
    this.config.settings = settings;
    soundEngine.applySettings(settings);
    if (this.renderer) {
      const dprCap = settings.quality === 'high' ? 2 : settings.quality === 'medium' ? 1.5 : 1;
      this.renderer.setPixelRatio(
        this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, dprCap)
      );
    }
  }

  private pollCombinedInput(): VehicleInput {
    let throttle = this.touchInput.throttle;
    let brake = this.touchInput.brake;
    let steer = this.touchInput.steer;
    let handbrake = this.touchInput.handbrake;
    let nitro = this.touchInput.nitro;
    let horn = this.touchHorn;

    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) throttle = 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) brake = 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) steer += 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) steer -= 1;
    if (this.heldKeys.has('Space')) handbrake = true;
    if (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight')) nitro = true;
    if (this.heldKeys.has('KeyH')) horn = true;

    // Gamepad API polling
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads?.[0];
    if (pad) {
      const axisX = Math.abs(pad.axes[0] || 0) > 0.12 ? -pad.axes[0] : 0;
      const rt = pad.buttons[7]?.value || 0;
      const lt = pad.buttons[6]?.value || 0;
      const aBtn = pad.buttons[0]?.pressed;
      const xBtn = pad.buttons[2]?.pressed;
      const bBtn = pad.buttons[1]?.pressed;
      const yBtn = pad.buttons[3]?.pressed;
      if (Math.abs(axisX) > 0.12 || rt > 0.1 || lt > 0.1 || aBtn || bBtn || xBtn) {
        this.activeInput = 'gamepad';
        if (Math.abs(axisX) > 0.12) steer = axisX;
        if (rt > 0.1) throttle = rt;
        if (lt > 0.1) brake = lt;
        if (aBtn) nitro = true;
        if (bBtn) handbrake = true;
        if (yBtn) horn = true;
      }
    }

    this.hornHeld = horn;
    return {
      throttle: THREE.MathUtils.clamp(throttle, 0, 1),
      brake: THREE.MathUtils.clamp(brake, 0, 1),
      steer: THREE.MathUtils.clamp(steer, -1, 1),
      handbrake,
      nitro,
    };
  }

  private tick = (now: number) => {
    if (this.disposed) return;

    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.frameCount++;

    if (!this.paused && this.track && this.playerRig) {
      this.stepSimulation(dt);
    } else if (this.paused) {
      soundEngine.updateVehicleAudio({
        rpmRatio: 0.1,
        throttle: 0,
        speedKmh: 0,
        driftIntensity: 0,
        isBoosting: false,
        gear: 'N',
        hornPressed: false,
        paused: true,
      });
    }

    this.renderFrame();

    if (this.renderer && this.isSoftwareGl) {
      this.afterDraw(() => this.tick(performance.now()));
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void) {
    if (!this.renderer) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private stepSimulation(dt: number) {
    if (!this.track || !this.playerRig) return;

    // 3-2-1-GO Countdown
    if (this.countdownTimer > -0.8) {
      this.countdownTimer -= dt;
      const stepVal = Math.ceil(this.countdownTimer);
      if (stepVal >= 0 && stepVal < this.lastCountdownStep && stepVal <= 3) {
        this.lastCountdownStep = stepVal;
        soundEngine.triggerCountdownBeep(stepVal === 0);
      }
    }

    const canDrive = this.countdownTimer <= 0;
    if (canDrive && !this.playerState.finished) {
      this.raceElapsedMs += dt * 1000;
    }

    const rawInput = this.pollCombinedInput();
    const playerInput: VehicleInput = canDrive
      ? rawInput
      : { throttle: rawInput.throttle * 0.1, brake: 0, steer: 0, handbrake: true, nitro: false };

    // Step Player Physics
    const { impactIntensity } = stepVehiclePhysics(
      this.playerState,
      playerInput,
      this.track,
      this.config.levelConfig,
      this.config.levelConfig.weather,
      this.config.upgrades,
      this.config.damage,
      dt,
      this.raceElapsedMs
    );

    if (impactIntensity > 0.08) {
      soundEngine.triggerCrash(impactIntensity);
      this.camShake = Math.min(0.65, this.camShake + impactIntensity * 0.45);
    }

    // Step AI Rivals & Car-to-Car Collisions
    for (let i = 0; i < this.aiRigs.length; i++) {
      const ai = this.aiRigs[i];
      const aiInput = canDrive
        ? computeAiInput(ai.state, this.track, this.playerState.furthestProgress)
        : { throttle: 0, brake: 0, steer: 0, handbrake: true, nitro: false };

      stepVehiclePhysics(
        ai.state,
        aiInput,
        this.track,
        this.config.levelConfig,
        this.config.levelConfig.weather,
        { engine: 1, turbo: 1, tires: 1, brakes: 1 },
        { body: 0, engine: 0, tires: 0 },
        dt,
        this.raceElapsedMs
      );

      // Player-AI bumper collision
      const dx = this.playerState.position.x - ai.state.position.x;
      const dz = this.playerState.position.z - ai.state.position.z;
      const minSep = 2.4;
      const dSq = dx * dx + dz * dz;
      if (dSq > 0.001 && dSq < minSep * minSep) {
        const d = Math.sqrt(dSq);
        const nx = dx / d;
        const nz = dz / d;
        const overlap = minSep - d;
        this.playerState.position.x += nx * overlap * 0.55;
        this.playerState.position.z += nz * overlap * 0.55;
        ai.state.position.x -= nx * overlap * 0.45;
        ai.state.position.z -= nz * overlap * 0.45;

        const relSpeed = Math.abs(this.playerState.speedMs - ai.state.speedMs);
        if (relSpeed > 3) {
          const hit = Math.min(1, relSpeed / 22);
          soundEngine.triggerCrash(hit);
          this.camShake = Math.min(0.5, this.camShake + hit * 0.3);
          this.playerState.collisionsCount++;
          this.playerState.damageTaken.body = Math.min(
            100,
            this.playerState.damageTaken.body + hit * 7
          );
          this.playerState.velocity.multiplyScalar(0.86);
        }
      }

      // Sync AI 3D LOD transform
      ai.lod.position.copy(ai.state.position);
      ai.lod.rotation.y = ai.state.yaw;
      ai.rig.bodyGroup.rotation.x = ai.state.pitch;
      ai.rig.bodyGroup.rotation.z = ai.state.roll;
      ai.rig.wheelSteerGroups[0].rotation.y = ai.state.steerAngle;
      ai.rig.wheelSteerGroups[1].rotation.y = ai.state.steerAngle;
      for (let w = 0; w < 4; w++) {
        ai.rig.wheelSpinMeshes[w].rotation.x = ai.state.wheelRotation;
      }
      ai.rig.brakeLightMat.emissiveIntensity = aiInput.brake > 0.1 ? 3.0 : 0.7;
    }

    // Sync Player 3D Rig
    this.syncPlayerRig(playerInput, dt);

    // Update Shadow Light to follow player
    if (this.sunLight) {
      this.sunLight.position.set(
        this.playerState.position.x + 55,
        this.playerState.position.y + 95,
        this.playerState.position.z + 40
      );
      this.sunLight.target.position.copy(this.playerState.position);
    }

    // Update Particles & Weather
    this.updateParticlesAndWeather(playerInput, dt);

    // Update Camera
    this.updateCamera(dt);

    // Update Sound Engine
    const driftInt = this.playerState.isDrifting
      ? THREE.MathUtils.clamp(this.playerState.slipAngleRad * 1.8, 0.2, 1)
      : 0;
    soundEngine.updateVehicleAudio({
      rpmRatio: this.playerState.rpm / this.playerState.carSpec.maxRpm,
      throttle: playerInput.throttle,
      speedKmh: this.playerState.speedMs * 3.6,
      driftIntensity: driftInt,
      isBoosting: this.playerState.isBoosting,
      gear: this.playerState.gear,
      hornPressed: this.hornHeld,
      paused: false,
    });

    // Check Race Completion
    if (this.playerState.finished) {
      this.finishRace();
      return;
    }

    // Emit Telemetry at ~20Hz to React HUD (without causing heavy React churn)
    const nowMs = performance.now();
    if (nowMs - this.lastTelemetryMs >= 50) {
      this.lastTelemetryMs = nowMs;
      this.emitTelemetry();
    }
  }

  private syncPlayerRig(input: VehicleInput, dt: number) {
    if (!this.playerRig) return;
    const p = this.playerState;

    this.playerRig.root.position.copy(p.position);
    this.playerRig.root.rotation.y = p.yaw;
    this.playerRig.bodyGroup.rotation.x = p.pitch;
    this.playerRig.bodyGroup.rotation.z = p.roll;

    // Front wheel steering + 4 wheel spinning + cockpit steering wheel
    this.playerRig.wheelSteerGroups[0].rotation.y = p.steerAngle;
    this.playerRig.wheelSteerGroups[1].rotation.y = p.steerAngle;
    for (let w = 0; w < 4; w++) {
      this.playerRig.wheelSpinMeshes[w].rotation.x = p.wheelRotation;
    }
    this.playerRig.steeringWheel.rotation.z = p.steerAngle * 2.2;

    // Headlights
    const hlInt = this.headlights === 'high' ? 3.2 : this.headlights === 'low' ? 1.6 : 0;
    this.playerRig.headlightMats.forEach((m) => (m.emissiveIntensity = hlInt));
    const beamOpacity = this.headlights === 'high' ? 0.22 : this.headlights === 'low' ? 0.11 : 0;
    this.playerRig.headlightBeams.forEach((b) => {
      b.visible = this.headlights !== 'off';
      (b.material as THREE.MeshBasicMaterial).opacity = beamOpacity;
    });
    if (this.playerRig.headlightSpotLeft && this.playerRig.headlightSpotRight) {
      const spotInt = this.headlights === 'high' ? 16 : this.headlights === 'low' ? 7 : 0;
      this.playerRig.headlightSpotLeft.intensity = spotInt;
      this.playerRig.headlightSpotRight.intensity = spotInt;
    }

    // Brake lights
    this.playerRig.brakeLightMat.emissiveIntensity =
      input.brake > 0.1 || input.handbrake ? 3.6 : this.headlights !== 'off' ? 0.9 : 0.35;

    // Indicators / Hazard blinking + relay click
    if (this.indicators !== 'off') {
      this.indicatorBlinkTimer += dt;
      if (this.indicatorBlinkTimer >= 0.38) {
        this.indicatorBlinkTimer = 0;
        this.indicatorPhaseOn = !this.indicatorPhaseOn;
        soundEngine.triggerIndicatorClick(this.indicatorPhaseOn);
      }
      const leftActive =
        (this.indicators === 'left' || this.indicators === 'hazard') &&
        this.indicatorPhaseOn;
      const rightActive =
        (this.indicators === 'right' || this.indicators === 'hazard') &&
        this.indicatorPhaseOn;
      this.playerRig.leftIndicatorMat.emissiveIntensity = leftActive ? 3.5 : 0;
      this.playerRig.rightIndicatorMat.emissiveIntensity = rightActive ? 3.5 : 0;
    } else {
      this.playerRig.leftIndicatorMat.emissiveIntensity = 0;
      this.playerRig.rightIndicatorMat.emissiveIntensity = 0;
    }

    // Windshield wipers sweep
    if (this.wipersOn) {
      this.wiperPhase += dt * 5.2;
      const sweep = (Math.sin(this.wiperPhase) * 0.5 + 0.5) * 1.15;
      this.playerRig.wiperLeft.rotation.z = sweep;
      this.playerRig.wiperRight.rotation.z = sweep;
    } else {
      this.playerRig.wiperLeft.rotation.z = THREE.MathUtils.damp(
        this.playerRig.wiperLeft.rotation.z,
        0,
        8,
        dt
      );
      this.playerRig.wiperRight.rotation.z = THREE.MathUtils.damp(
        this.playerRig.wiperRight.rotation.z,
        0,
        8,
        dt
      );
    }

    // Visibility tweaks for Hood / Cockpit cameras
    this.playerRig.rearMirrorScreen.visible = this.cameraMode === 'cockpit';
  }

  private updateParticlesAndWeather(input: VehicleInput, dt: number) {
    const p = this.playerState;

    // Skid marks when drifting
    if (p.isDrifting) {
      this.skidTimer += dt;
      if (this.skidTimer >= 0.03) {
        this.skidTimer = 0;
        const hw = p.carSpec.dimensions.width * 0.42;
        const rearZ = p.carSpec.dimensions.wheelbase * 0.5;
        _quat.setFromAxisAngle(_v3.set(0, 1, 0), p.yaw);
        _v1.set(-hw, 0, rearZ).applyQuaternion(_quat).add(p.position);
        this.placeSkidMark(_v1, p.yaw);
        _v1.set(hw, 0, rearZ).applyQuaternion(_quat).add(p.position);
        this.placeSkidMark(_v1, p.yaw);

        // Tire drift smoke
        _v2.set((Math.random() - 0.5) * 1.5, 1.4, (Math.random() - 0.5) * 1.5);
        this.spawnParticle(_v1, _v2, 'smoke', 0xdbeafe, 0.55, 0.9);
      }
    }

    // Nitro / Exhaust Flames
    if (p.isBoosting && this.playerRig && this.frameCount % 2 === 0) {
      _quat.setFromAxisAngle(_v3.set(0, 1, 0), p.yaw);
      const ex = this.playerRig.exhaustPositions[0];
      _v1.copy(ex).applyQuaternion(_quat).add(p.position);
      _v2.set(0, 0.2, 6).applyQuaternion(_quat);
      this.spawnParticle(_v1, _v2, 'flame', 0x38bdf8, 0.14, 0.75);
      const exR = this.playerRig.exhaustPositions[3];
      _v1.copy(exR).applyQuaternion(_quat).add(p.position);
      this.spawnParticle(_v1, _v2, 'flame', 0xf59e0b, 0.14, 0.75);
    }

    // Engine damage smoke when damage > 35%
    const totalEngineDmg = this.config.damage.engine + p.damageTaken.engine;
    if (totalEngineDmg > 35 && this.frameCount % 6 === 0) {
      _quat.setFromAxisAngle(_v3.set(0, 1, 0), p.yaw);
      _v1.set(0, 0.75, -1.3).applyQuaternion(_quat).add(p.position);
      _v2.set((Math.random() - 0.5) * 0.8, 2.5, (Math.random() - 0.5) * 0.8);
      this.spawnParticle(_v1, _v2, 'smoke', 0x334155, 0.85, 1.15);
    }

    // Step active particles
    for (let i = 0; i < this.particlePool.length; i++) {
      const pt = this.particlePool[i];
      if (!pt.mesh.visible) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.mesh.visible = false;
        continue;
      }
      pt.mesh.position.addScaledVector(pt.vel, dt);
      const frac = pt.life / pt.maxLife;
      (pt.mesh.material as THREE.MeshBasicMaterial).opacity =
        pt.kind === 'flame' ? frac * 0.9 : frac * 0.42;
      if (pt.kind === 'smoke') {
        pt.mesh.scale.addScalar(dt * 2.2);
      }
    }

    // Weather particles following player
    if (this.weatherPoints && this.weatherPositions) {
      const isSnow = this.config.levelConfig.weather === 'snow';
      const fallSpeed = isSnow ? 5.5 : 28;
      const arr = this.weatherPositions;
      const px = p.position.x;
      const py = p.position.y;
      const pz = p.position.z;

      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= fallSpeed * dt;
        if (isSnow) arr[i] += Math.sin(this.raceElapsedMs * 0.002 + i) * 1.5 * dt;
        if (arr[i + 1] < py - 1) {
          arr[i] = px + (Math.random() - 0.5) * 55;
          arr[i + 1] = py + 18 + Math.random() * 10;
          arr[i + 2] = pz + (Math.random() - 0.5) * 55;
        }
      }
      (this.weatherPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate =
        true;
    }

    // Suppress unused warning
    void input;
  }

  private updateCamera(dt: number) {
    const p = this.playerState;
    const sens = this.config.settings.cameraSensitivity;
    _quat.setFromAxisAngle(_v3.set(0, 1, 0), p.yaw);

    // Dynamic speed FOV widening
    const speedRatio = Math.min(1, p.speedMs / 100);
    const targetFov =
      this.cameraMode === 'cockpit'
        ? 72 + speedRatio * 10
        : 62 + speedRatio * 15 + (p.isBoosting ? 5 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 'chase') {
      const dist = 6.2 + speedRatio * 1.1;
      _v1.set(0, 2.35, dist).applyQuaternion(_quat).add(p.position);
      _v2.set(0, 0.85, -9).applyQuaternion(_quat).add(p.position);
      this.camPos.lerp(_v1, 1 - Math.exp(-9 * sens * dt));
      this.camLook.lerp(_v2, 1 - Math.exp(-12 * sens * dt));
    } else if (this.cameraMode === 'hood') {
      _v1.set(0, 1.12, -0.55).applyQuaternion(_quat).add(p.position);
      _v2.set(0, 0.9, -22).applyQuaternion(_quat).add(p.position);
      this.camPos.copy(_v1);
      this.camLook.copy(_v2);
    } else if (this.cameraMode === 'cockpit') {
      _v1.set(-0.34, 0.98, 0.08).applyQuaternion(_quat).add(p.position);
      _v2.set(-0.32, 0.92, -20).applyQuaternion(_quat).add(p.position);
      this.camPos.copy(_v1);
      this.camLook.copy(_v2);
    } else {
      // Cinematic sweeping replay camera
      this.cinematicAngle += dt * 0.65;
      const rad = 7.5 + Math.sin(this.cinematicAngle * 0.7) * 2.2;
      _v1.set(
        p.position.x + Math.cos(this.cinematicAngle) * rad,
        p.position.y + 2.6 + Math.sin(this.cinematicAngle * 0.5) * 1.0,
        p.position.z + Math.sin(this.cinematicAngle) * rad
      );
      this.camPos.lerp(_v1, 1 - Math.exp(-5 * dt));
      this.camLook.lerp(p.position, 1 - Math.exp(-8 * dt));
    }

    // Apply crash shake decay
    if (this.camShake > 0.002) {
      this.camera.position.set(
        this.camPos.x + (Math.random() - 0.5) * this.camShake,
        this.camPos.y + (Math.random() - 0.5) * this.camShake,
        this.camPos.z + (Math.random() - 0.5) * this.camShake
      );
      this.camShake *= Math.exp(-10 * dt);
    } else {
      this.camera.position.copy(this.camPos);
    }
    this.camera.lookAt(this.camLook);

    // Position Rear-View Camera looking backwards (+Z in car local space)
    _v1.set(0, 1.25, 0.8).applyQuaternion(_quat).add(p.position);
    _v2.set(0, 1.05, 32).applyQuaternion(_quat).add(p.position);
    this.rearCamera.position.copy(_v1);
    this.rearCamera.lookAt(_v2);
  }

  private renderFrame() {
    if (!this.renderer) {
      this.render2DFallbackFrame();
      return;
    }

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // 1. Render cockpit rear-view mirror RenderTarget (throttled on medium)
    const shouldRenderMirrorTarget =
      this.rearTarget &&
      !this.isSoftwareGl &&
      this.cameraMode === 'cockpit' &&
      (this.config.settings.quality === 'high' || this.frameCount % 2 === 0);

    if (shouldRenderMirrorTarget && this.rearTarget) {
      this.renderer.setRenderTarget(this.rearTarget);
      this.renderer.render(this.scene, this.rearCamera);
      this.renderer.setRenderTarget(null);
    }

    // 2. Main full-viewport render
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, w, h);
    this.renderer.render(this.scene, this.camera);

    // 3. Live HUD Top-Center Rear-View Mirror inset (using scissor viewport, zero readback!)
    const showHudMirror =
      !this.isSoftwareGl &&
      this.config.settings.quality !== 'low' &&
      this.cameraMode !== 'cinematic' &&
      w >= 640;

    if (showHudMirror) {
      const mirrorW = Math.min(240, Math.round(w * 0.22));
      const mirrorH = Math.round(mirrorW * 0.28);
      const mx = Math.round((w - mirrorW) / 2);
      const my = h - mirrorH - 14;
      this.rearCamera.aspect = mirrorW / mirrorH;
      this.rearCamera.updateProjectionMatrix();

      this.renderer.setScissorTest(true);
      this.renderer.setScissor(mx, my, mirrorW, mirrorH);
      this.renderer.setViewport(mx, my, mirrorW, mirrorH);
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.rearCamera);
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
    }
  }

  private render2DFallbackFrame() {
    const canvas = this.fallback2dCanvas;
    if (!canvas || !this.track) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const palette = BIOME_PALETTES[this.config.levelConfig.biome];
    ctx.fillStyle = palette.groundColor;
    ctx.fillRect(0, 0, w, h);

    const p = this.playerState;
    const pxPerMeter = 6.5;

    ctx.save();
    ctx.translate(w * 0.5, h * 0.62);
    ctx.rotate(p.yaw);
    ctx.scale(pxPerMeter, pxPerMeter);
    ctx.translate(-p.position.x, -p.position.z);

    // Draw road ribbon
    ctx.strokeStyle = palette.roadColor;
    ctx.lineWidth = this.track.roadHalfWidth * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.track.samples.forEach((s, idx) => {
      if (idx === 0) ctx.moveTo(s.point.x, s.point.z);
      else ctx.lineTo(s.point.x, s.point.z);
    });
    ctx.closePath();
    ctx.stroke();

    // Dashed centerline
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 0.25;
    ctx.setLineDash([2.5, 2.5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw obstacles
    ctx.fillStyle = '#f97316';
    for (const obs of this.track.obstacles) {
      ctx.beginPath();
      ctx.arc(obs.position.x, obs.position.z, obs.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw all cars
    const drawCar2d = (state: VehicleState, color: string) => {
      ctx.save();
      ctx.translate(state.position.x, state.position.z);
      ctx.rotate(-state.yaw);
      ctx.fillStyle = color;
      ctx.fillRect(-0.95, -2.2, 1.9, 4.4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-0.7, -0.7, 1.4, 1.8);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(-0.75, -2.25, 0.45, 0.2);
      ctx.fillRect(0.3, -2.25, 0.45, 0.2);
      ctx.restore();
    };

    for (const ai of this.aiRigs) {
      drawCar2d(ai.state, ai.state.aiColor);
    }
    drawCar2d(p, this.config.customization.paintColor);

    ctx.restore();
  }

  private getSortedRacers(): VehicleState[] {
    const all = [this.playerState, ...this.aiRigs.map((a) => a.state)];
    all.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTimeMs - b.finishTimeMs;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.furthestProgress - a.furthestProgress;
    });
    return all;
  }

  private emitTelemetry() {
    if (!this.track) return;
    const sorted = this.getSortedRacers();
    const position = sorted.findIndex((r) => r.isPlayer) + 1;

    // Minimap dots normalized to track bounds
    const { minX, maxX, minZ, maxZ } = this.track.bounds;
    const pad = 25;
    const span = Math.max(1, maxX - minX + pad * 2, maxZ - minZ + pad * 2);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    const toMini = (pos: THREE.Vector3) => ({
      x: 0.5 + (pos.x - cx) / span,
      y: 0.5 + (pos.z - cz) / span,
    });

    const minimapRacers = [
      { ...toMini(this.playerState.position), isPlayer: true, color: '#f59e0b' },
      ...this.aiRigs.map((a) => ({
        ...toMini(a.state.position),
        isPlayer: false,
        color: a.state.aiColor,
      })),
    ];

    // Wrong way check
    const smp = this.track.samples[this.playerState.sampleIndex];
    _forward.set(-Math.sin(this.playerState.yaw), 0, -Math.cos(this.playerState.yaw));
    const wrongWay =
      this.playerState.speedMs > 5 && _forward.dot(smp.tangent) < -0.35;

    const p = this.playerState;
    const combinedDmg =
      (Math.min(100, this.config.damage.body + p.damageTaken.body) +
        Math.min(100, this.config.damage.engine + p.damageTaken.engine) +
        Math.min(100, this.config.damage.tires + p.damageTaken.tires)) /
      3;

    this.callbacks.onTelemetry({
      speedKmh: Math.round(p.speedMs * 3.6),
      rpm: Math.round(p.rpm),
      redlineRpm: p.carSpec.shiftRpm,
      maxRpm: p.carSpec.maxRpm,
      gear: p.gear,
      totalGears: p.carSpec.gears,
      nitro: Math.round(p.nitro),
      isBoosting: p.isBoosting,
      isDrifting: p.isDrifting,
      driftScore: Math.round(p.driftScore),
      lap: p.lap,
      totalLaps: this.config.levelConfig.laps,
      position,
      totalRacers: sorted.length,
      raceTimeMs: this.raceElapsedMs,
      currentLapMs: this.raceElapsedMs - p.lapStartTimeMs,
      bestLapMs: p.bestLapMs,
      headlights: this.headlights,
      indicators: this.indicators,
      wipersOn: this.wipersOn,
      cameraMode: this.cameraMode,
      damageAvg: Math.round(combinedDmg),
      countdownValue:
        this.countdownTimer > 0
          ? Math.ceil(this.countdownTimer)
          : this.countdownTimer > -0.7
          ? 0
          : -1,
      wrongWay,
      minimapPoints: this.track.minimapPoints,
      minimapRacers,
      activeInput: this.activeInput,
    });
  }

  private finishRace() {
    this.paused = true;
    soundEngine.stopRaceAudio();

    const sorted = this.getSortedRacers();
    const position = sorted.findIndex((r) => r.isPlayer) + 1;
    const lvl = this.config.levelConfig;
    const p = this.playerState;

    const baseReward =
      position === 1
        ? lvl.rewardFirst
        : position === 2
        ? lvl.rewardSecond
        : position === 3
        ? lvl.rewardThird
        : lvl.rewardParticipation;

    const cleanDrivingBonus = Math.max(0, 350 - p.collisionsCount * 75);
    const driftBonus = Math.min(800, Math.round(p.driftScore * 0.15));
    const nitroBonus = Math.min(350, Math.round(p.nitroUsedSeconds * 35));

    const totalPointsEarned =
      baseReward + cleanDrivingBonus + driftBonus + nitroBonus;

    this.callbacks.onFinish({
      level: lvl.level,
      biome: lvl.biome,
      carId: this.config.carId,
      position,
      totalRacers: sorted.length,
      raceTimeMs: p.finishTimeMs || this.raceElapsedMs,
      bestLapMs: p.bestLapMs,
      baseReward,
      cleanDrivingBonus,
      driftBonus,
      nitroBonus,
      totalPointsEarned,
      damageTaken: {
        body: Math.round(p.damageTaken.body),
        engine: Math.round(p.damageTaken.engine),
        tires: Math.round(p.damageTaken.tires),
      },
      collisionsCount: p.collisionsCount,
      driftMeters: Math.round(p.driftMeters),
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('resize', this.onResize);

    soundEngine.stopRaceAudio();

    this.playerRig?.dispose();
    this.aiRigs.forEach((a) => a.rig.dispose());
    this.track?.dispose();
    this.rearTarget?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    if (this.fallback2dCanvas && this.fallback2dCanvas.parentNode === this.container) {
      this.container.removeChild(this.fallback2dCanvas);
    }
    void _euler;
  }
}
