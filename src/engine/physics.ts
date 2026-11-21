import * as THREE from 'three';
import { getEffectiveCarStats } from '../data/cars';
import {
  CarDamage,
  CarSpec,
  CarUpgrades,
  LevelConfig,
  TireStyle,
  WeatherType,
} from '../types/game';
import { BuiltTrack, TrackSample } from './trackBuilder';

export interface VehicleInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (right) .. +1 (left)
  handbrake: boolean;
  nitro: boolean;
}

export interface VehicleState {
  isPlayer: boolean;
  name: string;
  carSpec: CarSpec;
  tireStyle: TireStyle;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  yawRate: number;
  speedMs: number;
  steerAngle: number;
  pitch: number; // weight transfer pitch
  roll: number; // lateral body roll
  wheelRotation: number;
  rpm: number;
  gearNum: number; // -1 = R, 0 = N, 1..gears
  shiftTimer: number;
  gear: string;
  nitro: number; // 0..100
  isBoosting: boolean;
  isDrifting: boolean;
  slipAngleRad: number;
  driftScore: number;
  driftMeters: number;
  nitroUsedSeconds: number;
  sampleIndex: number;
  lap: number; // 1..totalLaps
  nextCheckpoint: number; // 0..3
  furthestProgress: number; // continuous lap + frac
  finished: boolean;
  finishTimeMs: number;
  lapStartTimeMs: number;
  bestLapMs: number | null;
  collisionsCount: number;
  damageTaken: CarDamage;
  // AI specific
  aiTargetOffset: number;
  aiSpeedSkill: number;
  aiColor: string;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _delta = new THREE.Vector3();

function getTireCompoundGrip(tireStyle: TireStyle, weather: WeatherType): number {
  if (weather === 'snow') {
    switch (tireStyle) {
      case 'all_weather':
        return 0.78;
      case 'street':
        return 0.66;
      case 'semi_slick':
        return 0.58;
      case 'racing_white':
        return 0.52;
    }
  }
  if (weather === 'rain') {
    switch (tireStyle) {
      case 'all_weather':
        return 0.92;
      case 'street':
        return 0.84;
      case 'semi_slick':
        return 0.78;
      case 'racing_white':
        return 0.72;
    }
  }
  // Dry asphalt
  switch (tireStyle) {
    case 'racing_white':
      return 1.22;
    case 'semi_slick':
      return 1.15;
    case 'street':
      return 1.04;
    case 'all_weather':
      return 0.96;
  }
}

export function findClosestSampleIndex(
  track: BuiltTrack,
  pos: THREE.Vector3,
  hintIndex: number
): number {
  const n = track.samples.length;
  let bestIdx = hintIndex % n;
  let bestDistSq = Infinity;

  const window = 32;
  for (let offset = -window; offset <= window; offset++) {
    const idx = (hintIndex + offset + n) % n;
    const p = track.samples[idx].point;
    const dx = pos.x - p.x;
    const dz = pos.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      bestIdx = idx;
    }
  }

  if (bestDistSq > 40 * 40) {
    for (let idx = 0; idx < n; idx++) {
      const p = track.samples[idx].point;
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = idx;
      }
    }
  }

  return bestIdx;
}

export function stepVehiclePhysics(
  v: VehicleState,
  input: VehicleInput,
  track: BuiltTrack,
  config: LevelConfig,
  weather: WeatherType,
  upgrades: CarUpgrades,
  baseDamage: CarDamage,
  dt: number,
  raceElapsedMs: number
): { impactIntensity: number } {
  let impactIntensity = 0;

  const combinedDamage: CarDamage = {
    body: Math.min(100, baseDamage.body + v.damageTaken.body),
    engine: Math.min(100, baseDamage.engine + v.damageTaken.engine),
    tires: Math.min(100, baseDamage.tires + v.damageTaken.tires),
  };

  const eff = getEffectiveCarStats(v.carSpec, upgrades, combinedDamage);
  const topSpeedMs = (eff.topSpeed / 3.6) * (v.isPlayer ? 1 : v.aiSpeedSkill);
  const mass = eff.weight;

  // Tire compound + weather + upgrade + damage grip coefficient (mu)
  const mu = getTireCompoundGrip(v.tireStyle, weather) * eff.tireGripMult;

  _forward.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
  _right.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));

  const forwardSpeed = v.velocity.dot(_forward);
  const lateralSpeed = v.velocity.dot(_right);
  const absFwd = Math.abs(forwardSpeed);

  // Nitro boost: short thrust boost, capped near real Vmax (+4% max)
  const canBoost = input.nitro && v.nitro > 1.5 && input.throttle > 0.1;
  v.isBoosting = canBoost;
  if (canBoost) {
    v.nitro = Math.max(0, v.nitro - 28 * dt);
    v.nitroUsedSeconds += dt;
  } else {
    v.nitro = Math.min(100, v.nitro + (v.isDrifting ? 13 : 3.8) * dt);
  }

  // Real Gear Selection & RPM Calculation
  const spec = v.carSpec;
  const wheelR = spec.dimensions.wheelRadius;
  const wheelOmega = absFwd / wheelR; // rad/s

  if (v.shiftTimer > 0) {
    v.shiftTimer = Math.max(0, v.shiftTimer - dt);
  }

  if (forwardSpeed < -0.8 || (absFwd < 1.5 && input.brake > 0.2 && input.throttle < 0.05)) {
    v.gearNum = -1;
    v.gear = 'R';
  } else if (absFwd < 0.8 && input.throttle < 0.05) {
    v.gearNum = 0;
    v.gear = 'N';
  } else {
    if (v.gearNum <= 0) v.gearNum = 1;
    const gIdx = v.gearNum - 1;
    const ratio = spec.gearRatios[gIdx] * spec.finalDrive;
    const rawRpm = (wheelOmega * ratio * 60) / (2 * Math.PI);
    const launchSlipRpm = absFwd < 14 ? spec.idleRpm + (1 - absFwd / 14) * 2600 * input.throttle : 0;
    const calcRpm = Math.max(spec.idleRpm, rawRpm, launchSlipRpm);

    // Upshift / Downshift hysteresis based on real shift points
    if (v.shiftTimer <= 0) {
      if (calcRpm >= spec.shiftRpm && v.gearNum < spec.gears && input.throttle > 0.1) {
        v.gearNum++;
        v.shiftTimer = 0.085;
      } else if (v.gearNum > 1) {
        const lowerRatio = spec.gearRatios[v.gearNum - 2] * spec.finalDrive;
        const lowerGearRpm = (wheelOmega * lowerRatio * 60) / (2 * Math.PI);
        if (calcRpm < spec.idleRpm + (spec.shiftRpm - spec.idleRpm) * 0.36 && lowerGearRpm < spec.shiftRpm * 0.88) {
          v.gearNum--;
          v.shiftTimer = 0.075;
        }
      }
    }
    v.gear = String(v.gearNum);
  }

  // Compute final RPM for current gear
  if (v.gearNum <= 0) {
    const revTarget = v.gearNum === -1 ? spec.idleRpm + absFwd * 170 : spec.idleRpm + input.throttle * 2600;
    v.rpm = THREE.MathUtils.damp(v.rpm, Math.min(spec.maxRpm, revTarget), 10, dt);
  } else {
    const activeRatio = spec.gearRatios[v.gearNum - 1] * spec.finalDrive;
    const mechanicalRpm = (wheelOmega * activeRatio * 60) / (2 * Math.PI);
    const clutchRpm = absFwd < 12 ? spec.idleRpm + input.throttle * 2400 * (1 - absFwd / 12) : 0;
    const targetRpm = THREE.MathUtils.clamp(
      Math.max(spec.idleRpm, mechanicalRpm, clutchRpm),
      spec.idleRpm,
      spec.maxRpm
    );
    v.rpm = THREE.MathUtils.damp(v.rpm, targetRpm, 18, dt);
  }

  // Realistic Acceleration Curve (Launch calibrated to real 0-100 km/h, tapering with P/v and aero drag)
  // Average 0-100 acceleration in m/s^2: (27.778 m/s) / zeroToHundred
  const targetLaunchAccel = (27.778 / eff.zeroToHundred) * 1.12;
  const maxLaunchForce = mass * targetLaunchAccel;
  const tractionForceCap = mass * 9.81 * mu * 1.26; // AWD/RWD launch traction limit

  const rpmFrac = (v.rpm - spec.idleRpm) / Math.max(1000, spec.maxRpm - spec.idleRpm);
  // Realistic engine torque curve: strong midrange, slight taper near redline
  const torqueShape =
    rpmFrac < 0.68
      ? 0.78 + (rpmFrac / 0.68) * 0.22
      : 1.0 - ((rpmFrac - 0.68) / 0.32) * 0.14;

  const gearMult =
    v.gearNum > 0
      ? spec.gearRatios[v.gearNum - 1] / spec.gearRatios[0]
      : 0.8;

  // Power-limited force P / v guarantees realistic diminishing acceleration at high speed
  const powerWatts = eff.powerKw * 1000 * (canBoost ? 1.18 : 1.0);
  const powerForce = powerWatts / Math.max(8, absFwd);
  const gearedLaunchForce = maxLaunchForce * (0.45 + 0.55 * gearMult) * torqueShape * (canBoost ? 1.16 : 1.0);

  let driveForce = Math.min(gearedLaunchForce, powerForce, tractionForceCap);
  if (v.shiftTimer > 0) {
    driveForce *= 0.25; // Brief DCT/ISR shift torque cut
  }

  // Electronic speed limiter & aerodynamic terminal velocity cap
  // Nitro can push max +3.5% beyond Vmax, never far beyond real top speed
  const maxAllowedSpeed = topSpeedMs * (canBoost ? 1.035 : 1.0);
  if (forwardSpeed >= maxAllowedSpeed * 0.985) {
    const overFrac = THREE.MathUtils.clamp(
      (forwardSpeed - maxAllowedSpeed * 0.985) / Math.max(1, maxAllowedSpeed * 0.025),
      0,
      1
    );
    driveForce *= 1 - overFrac;
  }

  let longForce = 0;
  if (input.throttle > 0) {
    longForce += input.throttle * driveForce;
  }

  // Speed-, weight-, and tire-dependent braking force
  const maxBrakeAccel = 9.81 * mu * 1.08 * eff.brakeMult; // ~10.5 - 12.8 m/s^2 on dry asphalt
  if (input.brake > 0) {
    if (forwardSpeed > 1.0) {
      longForce -= input.brake * mass * maxBrakeAccel;
    } else {
      // Reverse gear
      if (forwardSpeed > -20) {
        longForce -= input.brake * mass * 6.5;
      }
    }
  }

  // Aerodynamic drag calibrated against car's real top speed + rolling resistance
  // At Vmax, aero drag balances peak wheel power: CdA_eff calibrated cleanly
  const aeroForce =
    0.5 * 1.225 * spec.stats.dragArea * forwardSpeed * absFwd * 1.05;
  const rollForce = 0.015 * mass * 9.81 * Math.sign(forwardSpeed);
  longForce -= aeroForce + (absFwd > 0.2 ? rollForce : 0);

  if (input.handbrake) {
    longForce -= Math.sign(forwardSpeed) * mass * 6.5;
  }

  const longAccel = longForce / mass;

  // Weight-, speed-, and tire-dependent steering & turning radius
  const speedRatio = Math.min(1, absFwd / 55);
  const weightAgility = THREE.MathUtils.clamp(1550 / mass, 0.78, 1.12);
  const handlingFactor = (0.72 + (eff.handling / 100) * 0.48) * mu * weightAgility;

  // Higher speed reduces max steering wheel lock to prevent twitchy spinouts
  const maxSteerAngle = THREE.MathUtils.lerp(0.56, 0.16, Math.pow(speedRatio, 0.75));
  const targetSteer = input.steer * maxSteerAngle;
  v.steerAngle = THREE.MathUtils.damp(v.steerAngle, targetSteer, 11, dt);

  // Physical bicycle/lateral-G yaw limit: yawRate_max = a_lat_max / v
  const maxLateralAccel = 9.81 * mu * 1.08 * weightAgility * (1 + speedRatio * 0.25);
  const turnSign = forwardSpeed >= -0.5 ? 1 : -1;
  const geomYawRate = (absFwd / Math.max(2.2, spec.dimensions.wheelbase)) * Math.tan(v.steerAngle);
  const gripLimitedYawRate =
    absFwd > 2 ? Math.min(Math.abs(geomYawRate), maxLateralAccel / absFwd) * Math.sign(geomYawRate) : geomYawRate;

  const targetYawRate =
    gripLimitedYawRate *
    handlingFactor *
    turnSign *
    (input.handbrake ? 1.42 : 1.0);
  v.yawRate = THREE.MathUtils.damp(v.yawRate, targetYawRate, 10, dt);
  v.yaw += v.yawRate * dt;

  _forward.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
  _right.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));

  const newForward = THREE.MathUtils.clamp(
    forwardSpeed + longAccel * dt,
    -22,
    maxAllowedSpeed * 1.01
  );

  // Lateral traction (weight & tire dependent)
  const lateralGripRate = (3.8 + (eff.handling / 100) * 4.4) * mu * weightAgility;
  const activeLateralGrip = input.handbrake ? lateralGripRate * 0.26 : lateralGripRate;
  const newLateral = lateralSpeed * Math.exp(-activeLateralGrip * dt);

  v.velocity.copy(_forward).multiplyScalar(newForward).addScaledVector(_right, newLateral);
  v.position.addScaledVector(v.velocity, dt);
  v.speedMs = v.velocity.length();

  // Slip angle & Drift detection
  v.slipAngleRad =
    v.speedMs > 4 ? Math.atan2(Math.abs(newLateral), Math.max(1, Math.abs(newForward))) : 0;
  v.isDrifting =
    v.speedMs > 12 &&
    (v.slipAngleRad > 0.16 || (input.handbrake && Math.abs(v.steerAngle) > 0.08));
  if (v.isDrifting) {
    const dist = v.speedMs * dt;
    v.driftMeters += dist;
    v.driftScore += dist * (1 + v.slipAngleRad * 3) * 2.5;
  }

  // Suspension pitch & roll (heavier cars squat/roll slightly deeper)
  const weightRollScale = mass / 1500;
  const targetPitch = THREE.MathUtils.clamp(-longAccel * 0.003 * weightRollScale, -0.055, 0.055);
  const targetRoll = THREE.MathUtils.clamp(
    v.yawRate * (v.speedMs / 36) * 0.055 * weightRollScale,
    -0.075,
    0.075
  );
  v.pitch = THREE.MathUtils.damp(v.pitch, targetPitch, 9, dt);
  v.roll = THREE.MathUtils.damp(v.roll, targetRoll, 9, dt);

  // Wheel rotation
  v.wheelRotation -= (newForward * dt) / Math.max(0.25, wheelR);

  // Track spatial projection & boundary/obstacle collisions
  const prevIdx = v.sampleIndex;
  const sIdx = findClosestSampleIndex(track, v.position, prevIdx);
  v.sampleIndex = sIdx;
  const smp: TrackSample = track.samples[sIdx];

  v.position.y = THREE.MathUtils.damp(v.position.y, smp.point.y, 18, dt);

  _delta.subVectors(v.position, smp.point);
  const lateralDist = _delta.dot(smp.right);

  const wallLimit = track.barrierHalfWidth - 1.1;
  if (Math.abs(lateralDist) > wallLimit) {
    const sign = Math.sign(lateralDist);
    const excess = Math.abs(lateralDist) - wallLimit;
    v.position.addScaledVector(smp.right, -sign * excess);

    const vOut = v.velocity.dot(smp.right) * sign;
    if (vOut > 2.5) {
      impactIntensity = Math.min(1, vOut / 28);
      v.velocity.addScaledVector(smp.right, -sign * vOut * 1.35);
      v.velocity.multiplyScalar(0.76);
      if (v.isPlayer) {
        v.collisionsCount++;
        v.damageTaken.body = Math.min(100, v.damageTaken.body + impactIntensity * 12);
        v.damageTaken.tires = Math.min(100, v.damageTaken.tires + impactIntensity * 5);
      }
    }
  }

  if (Math.abs(lateralDist) > track.roadHalfWidth) {
    v.velocity.multiplyScalar(Math.max(0.85, 1 - 1.4 * dt));
  }

  for (let i = 0; i < track.obstacles.length; i++) {
    const obs = track.obstacles[i];
    if (obs.hitCooldown > 0) {
      obs.hitCooldown = Math.max(0, obs.hitCooldown - dt);
      continue;
    }
    const dx = v.position.x - obs.position.x;
    const dz = v.position.z - obs.position.z;
    const minDist = obs.radius + 1.1;
    if (dx * dx + dz * dz < minDist * minDist) {
      obs.hitCooldown = 1.5;
      impactIntensity = Math.max(impactIntensity, Math.min(1, v.speedMs / 30));
      v.velocity.multiplyScalar(0.62);
      if (v.isPlayer) {
        v.collisionsCount++;
        v.damageTaken.body = Math.min(100, v.damageTaken.body + 6);
        v.damageTaken.engine = Math.min(100, v.damageTaken.engine + 4);
        v.damageTaken.tires = Math.min(100, v.damageTaken.tires + 5);
      }
      obs.mesh.rotation.z = 0.8;
    }
  }

  // Checkpoints & Laps
  if (!v.finished) {
    const cpCount = track.checkpoints.length;
    if (v.nextCheckpoint < cpCount) {
      const targetCp = track.checkpoints[v.nextCheckpoint];
      if (Math.abs(sIdx - targetCp.sampleIndex) < 18) {
        v.nextCheckpoint++;
      }
    } else {
      if (sIdx < 16 || sIdx > track.samples.length - 10) {
        if (sIdx < 16) {
          const lapTime = raceElapsedMs - v.lapStartTimeMs;
          if (lapTime > 4000) {
            v.bestLapMs = v.bestLapMs === null ? lapTime : Math.min(v.bestLapMs, lapTime);
          }
          v.lapStartTimeMs = raceElapsedMs;
          if (v.lap >= config.laps) {
            v.finished = true;
            v.finishTimeMs = raceElapsedMs;
          } else {
            v.lap++;
            v.nextCheckpoint = 0;
          }
        }
      }
    }

    const lapFrac = sIdx / track.samples.length;
    const effectiveFrac = v.nextCheckpoint === 0 && lapFrac > 0.85 ? lapFrac - 1 : lapFrac;
    v.furthestProgress = Math.max(v.furthestProgress, v.lap - 1 + effectiveFrac);
  }

  return { impactIntensity };
}

export function computeAiInput(
  ai: VehicleState,
  track: BuiltTrack,
  playerProgress: number
): VehicleInput {
  const n = track.samples.length;
  const lookAhead = 10 + Math.floor((ai.speedMs / 40) * 8);
  const targetIdx = (ai.sampleIndex + lookAhead) % n;
  const farIdx = (ai.sampleIndex + lookAhead * 2) % n;

  const targetSmp = track.samples[targetIdx];
  const farSmp = track.samples[farIdx];

  const targetPosX = targetSmp.point.x + targetSmp.right.x * ai.aiTargetOffset;
  const targetPosZ = targetSmp.point.z + targetSmp.right.z * ai.aiTargetOffset;

  const dx = targetPosX - ai.position.x;
  const dz = targetPosZ - ai.position.z;
  const desiredYaw = Math.atan2(-dx, -dz);
  let angleDiff = desiredYaw - ai.yaw;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const steer = THREE.MathUtils.clamp(angleDiff * 2.2, -1, 1);
  const turnDot = targetSmp.tangent.dot(farSmp.tangent);
  const sharpTurn = turnDot < 0.88 && ai.speedMs > 28;

  const gap = playerProgress - ai.furthestProgress;
  const rubber = THREE.MathUtils.clamp(1 + gap * 0.4, 0.88, 1.12);

  return {
    throttle: sharpTurn ? 0.35 : Math.min(1, 0.92 * rubber),
    brake: turnDot < 0.76 && ai.speedMs > 32 ? 0.6 : 0,
    steer,
    handbrake: false,
    nitro: gap > 0.08 && Math.abs(angleDiff) < 0.15 && ai.nitro > 35,
  };
}
