import {
  CarCustomization,
  CarDamage,
  CarId,
  CarSpec,
  CarUpgrades,
  SpeedUnit,
} from '../types/game';

export const CARS: CarSpec[] = [
  {
    id: 'bmw',
    name: 'BMW M4 Competition',
    subtitle: '3.0L Twin-Turbo Inline-6 · 8-Speed M Steptronic',
    brand: 'BMW M',
    price: 0,
    defaultColor: '#1d4ed8',
    accentColor: '#38bdf8',
    soundProfile: 'i6_turbo',
    idleRpm: 800,
    shiftRpm: 6850,
    maxRpm: 7200,
    gears: 8,
    gearRatios: [5.0, 3.2, 2.14, 1.72, 1.31, 1.0, 0.82, 0.64],
    finalDrive: 3.15,
    stats: {
      topSpeed: 250, // Electronically limited
      zeroToHundred: 3.5,
      acceleration: 74,
      handling: 82,
      braking: 81,
      weight: 1730,
      powerKw: 375,
      dragArea: 0.72,
      electronicallyLimited: true,
    },
    dimensions: {
      length: 4.79,
      width: 1.89,
      height: 1.39,
      wheelbase: 2.86,
      wheelRadius: 0.35,
      wheelWidth: 0.28,
      groundClearance: 0.13,
      cabinOffsetZ: -0.2,
      hoodSlope: 0.14,
    },
  },
  {
    id: 'porsche',
    name: 'Porsche 911 GT3',
    subtitle: '4.0L Naturally Aspirated Flat-6 · 7-Speed PDK',
    brand: 'Porsche',
    price: 3400,
    defaultColor: '#e2e8f0',
    accentColor: '#f59e0b',
    soundProfile: 'flat6_rasp',
    idleRpm: 950,
    shiftRpm: 8650,
    maxRpm: 9000,
    gears: 7,
    gearRatios: [3.75, 2.38, 1.72, 1.34, 1.11, 0.96, 0.84],
    finalDrive: 3.97,
    stats: {
      topSpeed: 318,
      zeroToHundred: 3.4,
      acceleration: 78,
      handling: 95,
      braking: 94,
      weight: 1435,
      powerKw: 375,
      dragArea: 0.64,
    },
    dimensions: {
      length: 4.57,
      width: 1.85,
      height: 1.28,
      wheelbase: 2.46,
      wheelRadius: 0.34,
      wheelWidth: 0.3,
      groundClearance: 0.1,
      cabinOffsetZ: -0.15,
      hoodSlope: 0.22,
    },
  },
  {
    id: 'lamborghini',
    name: 'Lamborghini Huracán',
    subtitle: '5.2L Naturally Aspirated V10 · 7-Speed LDF',
    brand: 'Lamborghini',
    price: 5800,
    defaultColor: '#f59e0b',
    accentColor: '#fde047',
    soundProfile: 'v10_scream',
    idleRpm: 950,
    shiftRpm: 8250,
    maxRpm: 8500,
    gears: 7,
    gearRatios: [3.91, 2.43, 1.75, 1.34, 1.07, 0.87, 0.72],
    finalDrive: 3.85,
    stats: {
      topSpeed: 325,
      zeroToHundred: 2.9,
      acceleration: 88,
      handling: 89,
      braking: 89,
      weight: 1422,
      powerKw: 470,
      dragArea: 0.65,
    },
    dimensions: {
      length: 4.52,
      width: 1.93,
      height: 1.16,
      wheelbase: 2.62,
      wheelRadius: 0.34,
      wheelWidth: 0.31,
      groundClearance: 0.095,
      cabinOffsetZ: 0.18,
      hoodSlope: 0.28,
    },
  },
  {
    id: 'ferrari',
    name: 'Ferrari F8 Tributo',
    subtitle: '3.9L Twin-Turbo V8 · 7-Speed F1 DCT',
    brand: 'Ferrari',
    price: 7600,
    defaultColor: '#dc2626',
    accentColor: '#facc15',
    soundProfile: 'v8_howl',
    idleRpm: 900,
    shiftRpm: 7750,
    maxRpm: 8000,
    gears: 7,
    gearRatios: [3.33, 2.28, 1.73, 1.37, 1.11, 0.91, 0.72],
    finalDrive: 3.9,
    stats: {
      topSpeed: 340,
      zeroToHundred: 2.9,
      acceleration: 89,
      handling: 91,
      braking: 90,
      weight: 1435,
      powerKw: 530,
      dragArea: 0.63,
    },
    dimensions: {
      length: 4.61,
      width: 1.98,
      height: 1.21,
      wheelbase: 2.65,
      wheelRadius: 0.34,
      wheelWidth: 0.31,
      groundClearance: 0.1,
      cabinOffsetZ: 0.12,
      hoodSlope: 0.25,
    },
  },
  {
    id: 'aventador',
    name: 'Lamborghini Aventador SVJ',
    subtitle: '6.5L Naturally Aspirated V12 · 7-Speed ISR',
    brand: 'Lamborghini',
    price: 10500,
    defaultColor: '#84cc16',
    accentColor: '#111827',
    soundProfile: 'v10_scream',
    idleRpm: 980,
    shiftRpm: 8450,
    maxRpm: 8700,
    gears: 7,
    gearRatios: [3.91, 2.44, 1.81, 1.46, 1.19, 0.98, 0.84],
    finalDrive: 3.45,
    stats: {
      topSpeed: 350,
      zeroToHundred: 2.8,
      acceleration: 92,
      handling: 87,
      braking: 91,
      weight: 1525,
      powerKw: 566,
      dragArea: 0.68,
    },
    dimensions: {
      length: 4.94,
      width: 2.09,
      height: 1.14,
      wheelbase: 2.7,
      wheelRadius: 0.35,
      wheelWidth: 0.34,
      groundClearance: 0.09,
      cabinOffsetZ: 0.2,
      hoodSlope: 0.3,
    },
  },
  {
    id: 'bugatti',
    name: 'Bugatti Chiron',
    subtitle: '8.0L Quad-Turbo W16 · 7-Speed DSG',
    brand: 'Bugatti',
    price: 15000,
    defaultColor: '#0284c7',
    accentColor: '#0f172a',
    soundProfile: 'w16_quad',
    idleRpm: 800,
    shiftRpm: 6500,
    maxRpm: 6700,
    gears: 7,
    gearRatios: [3.4, 2.22, 1.65, 1.28, 1.02, 0.82, 0.66],
    finalDrive: 3.12,
    stats: {
      topSpeed: 420, // ~260 mph
      zeroToHundred: 2.4,
      acceleration: 97,
      handling: 79,
      braking: 88,
      weight: 1995,
      powerKw: 1103,
      dragArea: 0.74,
    },
    dimensions: {
      length: 4.54,
      width: 2.04,
      height: 1.21,
      wheelbase: 2.71,
      wheelRadius: 0.36,
      wheelWidth: 0.34,
      groundClearance: 0.11,
      cabinOffsetZ: 0.06,
      hoodSlope: 0.2,
    },
  },
  {
    id: 'hypercar',
    name: 'DK Apex-X Prototype',
    subtitle: '5.0L Twin-Turbo V8 + E-Drive · 9-Speed LST',
    brand: 'DK Motorsport',
    price: 22000,
    unlockNote: 'Unlock with 22,000 pts or beat Level 6',
    isHypercar: true,
    defaultColor: '#10b981',
    accentColor: '#f59e0b',
    soundProfile: 'hyper_v12',
    idleRpm: 1000,
    shiftRpm: 8800,
    maxRpm: 9200,
    gears: 9,
    gearRatios: [4.2, 3.05, 2.32, 1.82, 1.46, 1.19, 0.98, 0.82, 0.69],
    finalDrive: 3.35,
    stats: {
      topSpeed: 440,
      zeroToHundred: 2.2,
      acceleration: 99,
      handling: 96,
      braking: 96,
      weight: 1390,
      powerKw: 1180,
      dragArea: 0.59,
    },
    dimensions: {
      length: 4.68,
      width: 2.02,
      height: 1.12,
      wheelbase: 2.74,
      wheelRadius: 0.35,
      wheelWidth: 0.34,
      groundClearance: 0.085,
      cabinOffsetZ: 0.15,
      hoodSlope: 0.3,
    },
  },
];

export const CAR_MAP: Record<CarId, CarSpec> = CARS.reduce(
  (acc, car) => {
    acc[car.id] = car;
    return acc;
  },
  {} as Record<CarId, CarSpec>
);

export function createDefaultCustomization(car: CarSpec): CarCustomization {
  return {
    paintColor: car.defaultColor,
    paintFinish: 'gloss',
    rimStyle: 'sport5',
    tireStyle: 'street',
    caliperColor: '#ef4444',
    spoiler:
      car.id === 'porsche' || car.id === 'aventador' ? 'swan_neck' : 'stock',
    bodyKit: 'stock',
    windowTint: 'smoke',
    underglow: 'none',
    unlockedItems: [
      `paintColor:${car.defaultColor}`,
      'paintFinish:gloss',
      'rimStyle:sport5',
      'tireStyle:street',
      'caliperColor:#ef4444',
      car.id === 'porsche' || car.id === 'aventador'
        ? 'spoiler:swan_neck'
        : 'spoiler:stock',
      'bodyKit:stock',
      'windowTint:smoke',
      'underglow:none',
    ],
  };
}

export function createDefaultUpgrades(): CarUpgrades {
  return {
    engine: 0,
    turbo: 0,
    tires: 0,
    brakes: 0,
  };
}

export function createDefaultDamage(): CarDamage {
  return {
    body: 0,
    engine: 0,
    tires: 0,
  };
}

/**
 * Computes realistic upgrade and damage-adjusted performance figures.
 * Upgrades apply subtle, authentic percentage gains (+1% per level rather than arcade jumps).
 */
export function getEffectiveCarStats(
  car: CarSpec,
  upgrades: CarUpgrades,
  damage: CarDamage
) {
  const avgDamage = (damage.body + damage.engine + damage.tires) / 300; // 0..1

  // Subtle realistic upgrades: Engine Lv5 -> +5% top speed, Turbo Lv5 -> +6% power/launch
  const engineSpeedGain = 1 + upgrades.engine * 0.01;
  const turboPowerGain = 1 + upgrades.turbo * 0.014;
  const tireGripGain = 1 + upgrades.tires * 0.015;
  const brakeGain = 1 + upgrades.brakes * 0.016;

  // Damage degrades performance realistically
  const damageSpeedPenalty = 1 - (damage.engine * 0.0022 + damage.body * 0.001);
  const damagePowerPenalty = 1 - damage.engine * 0.0028;
  const damageGripPenalty = 1 - damage.tires * 0.0028;

  // BMW M4 Competition retains electronic speed limiter (only slight bump with ECU tune)
  const rawTop =
    car.stats.topSpeed * engineSpeedGain * Math.max(0.68, damageSpeedPenalty);
  const topSpeed = Math.round(rawTop);

  const zeroToHundred = Number(
    (
      car.stats.zeroToHundred /
      (turboPowerGain * Math.max(0.65, damagePowerPenalty))
    ).toFixed(2)
  );

  return {
    topSpeed,
    zeroToHundred,
    powerKw: Math.round(
      car.stats.powerKw *
        (1 + upgrades.engine * 0.012) *
        turboPowerGain *
        Math.max(0.65, damagePowerPenalty)
    ),
    acceleration: Math.min(
      100,
      Math.round(car.stats.acceleration * turboPowerGain * Math.max(0.65, damagePowerPenalty))
    ),
    handling: Math.min(
      100,
      Math.round(car.stats.handling * tireGripGain * Math.max(0.65, damageGripPenalty))
    ),
    braking: Math.min(
      100,
      Math.round(car.stats.braking * brakeGain * Math.max(0.68, damageGripPenalty))
    ),
    weight: Math.max(1180, car.stats.weight - upgrades.engine * 6),
    tireGripMult: tireGripGain * Math.max(0.65, damageGripPenalty),
    brakeMult: brakeGain * Math.max(0.68, damageGripPenalty),
    damageAvg: Math.round(avgDamage * 100),
  };
}

export function formatSpeedValue(kmh: number, unit: SpeedUnit): number {
  return unit === 'mph' ? Math.round(kmh * 0.621371) : Math.round(kmh);
}

export function getSpeedUnitLabel(unit: SpeedUnit): string {
  return unit === 'mph' ? 'MPH' : 'KM/H';
}
