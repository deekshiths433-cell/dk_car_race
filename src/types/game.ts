export type CarId =
  | 'lamborghini'
  | 'aventador'
  | 'bugatti'
  | 'ferrari'
  | 'porsche'
  | 'bmw'
  | 'hypercar';

export type EngineSoundProfile =
  | 'v10_scream'
  | 'w16_quad'
  | 'v8_howl'
  | 'flat6_rasp'
  | 'i6_turbo'
  | 'hyper_v12';

export type PaintFinish = 'matte' | 'gloss' | 'metallic' | 'chrome';
export type RimStyle = 'sport5' | 'mesh' | 'turbine' | 'forged_y' | 'deep_gold';
export type TireStyle = 'street' | 'semi_slick' | 'racing_white' | 'all_weather';
export type SpoilerStyle = 'stock' | 'gt_carbon' | 'swan_neck' | 'ducktail';
export type BodyKitStyle = 'stock' | 'widebody' | 'carbon_aero';
export type WindowTint = 'clear' | 'smoke' | 'limo' | 'cobalt';
export type UnderglowColor = 'none' | 'cyan' | 'amber' | 'crimson' | 'emerald' | 'violet';
export type SpeedUnit = 'kmh' | 'mph';

export interface CarStats {
  topSpeed: number; // real km/h
  zeroToHundred: number; // real 0-100 km/h in seconds
  acceleration: number; // 1-100 display rating derived from 0-100
  handling: number; // 1-100 rating
  braking: number; // 1-100 rating
  weight: number; // kg
  powerKw: number; // peak engine power in kW
  dragArea: number; // Cd * frontalArea (m^2)
  electronicallyLimited?: boolean;
}

export interface CarDimensions {
  length: number; // meters
  width: number;
  height: number;
  wheelbase: number;
  wheelRadius: number;
  wheelWidth: number;
  groundClearance: number;
  cabinOffsetZ: number; // relative to center
  hoodSlope: number;
}

export interface CarSpec {
  id: CarId;
  name: string;
  subtitle: string;
  brand: string;
  price: number;
  unlockNote?: string;
  isHypercar?: boolean;
  defaultColor: string;
  accentColor: string;
  soundProfile: EngineSoundProfile;
  idleRpm: number;
  shiftRpm: number;
  maxRpm: number;
  gears: number;
  gearRatios: number[]; // length === gears
  finalDrive: number;
  stats: CarStats;
  dimensions: CarDimensions;
}

export interface CarCustomization {
  paintColor: string;
  paintFinish: PaintFinish;
  rimStyle: RimStyle;
  tireStyle: TireStyle;
  caliperColor: string;
  spoiler: SpoilerStyle;
  bodyKit: BodyKitStyle;
  windowTint: WindowTint;
  underglow: UnderglowColor;
  unlockedItems: string[]; // item keys unlocked via purchase or ad
}

export interface CarUpgrades {
  engine: number; // 0..5
  turbo: number; // 0..5
  tires: number; // 0..5
  brakes: number; // 0..5
}

export interface CarDamage {
  body: number; // 0..100
  engine: number; // 0..100
  tires: number; // 0..100
}

export type BiomeId =
  | 'city'
  | 'desert'
  | 'mountain'
  | 'coastal'
  | 'snow'
  | 'neon_night';

export type WeatherType = 'clear' | 'rain' | 'fog' | 'snow';
export type TimeOfDay = 'day' | 'sunset' | 'night';

export interface LevelConfig {
  level: number;
  name: string;
  biome: BiomeId;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  laps: number;
  aiCount: number;
  aiSpeedMultiplier: number;
  turnTightness: number; // 0.3..1.0
  obstacleDensity: number; // 0..1
  trackLengthMeters: number;
  rewardFirst: number;
  rewardSecond: number;
  rewardThird: number;
  rewardParticipation: number;
  description: string;
}

export type QualityLevel = 'low' | 'medium' | 'high';
export type CameraMode = 'chase' | 'hood' | 'cockpit' | 'cinematic';
export type InputDeviceType = 'keyboard' | 'touch' | 'gamepad';
export type HeadlightMode = 'off' | 'low' | 'high';
export type IndicatorMode = 'off' | 'left' | 'right' | 'hazard';

export interface GameSettings {
  quality: QualityLevel;
  speedUnit: SpeedUnit;
  engineVolume: number; // 0..1
  effectsVolume: number; // 0..1
  musicVolume: number; // 0..1
  showControlsHint: boolean;
  cameraSensitivity: number; // 0.5..2
}

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
  type: 'win_races' | 'drift_meters' | 'clean_finish' | 'use_nitro' | 'rain_race';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  reward: number;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  carId: CarId;
  carName: string;
  biome: BiomeId;
  level: number;
  timeMs: number;
  bestLapMs: number;
  date: number;
}

export interface SaveData {
  coins: number;
  selectedCar: CarId;
  unlockedCars: CarId[];
  customizations: Record<CarId, CarCustomization>;
  upgrades: Record<CarId, CarUpgrades>;
  damages: Record<CarId, CarDamage>;
  highestLevelUnlocked: number;
  selectedLevel: number;
  settings: GameSettings;
  dailyStreak: number;
  lastDailyClaimDate: string | null; // YYYY-MM-DD
  dailyMissionsDate: string;
  dailyMissions: DailyMission[];
  achievements: Achievement[];
  leaderboard: LeaderboardEntry[];
  tutorialSeen: boolean;
  totalRaces: number;
  totalWins: number;
  totalDriftMeters: number;
}

export interface RaceTelemetry {
  speedKmh: number;
  rpm: number;
  redlineRpm: number;
  maxRpm: number;
  gear: string; // 'R', 'N', '1'..'9'
  totalGears: number;
  nitro: number; // 0..100
  isBoosting: boolean;
  isDrifting: boolean;
  driftScore: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  raceTimeMs: number;
  currentLapMs: number;
  bestLapMs: number | null;
  headlights: HeadlightMode;
  indicators: IndicatorMode;
  wipersOn: boolean;
  cameraMode: CameraMode;
  damageAvg: number;
  countdownValue: number; // 3, 2, 1, 0 (GO), -1 (racing)
  wrongWay: boolean;
  minimapPoints: Array<{ x: number; y: number }>;
  minimapRacers: Array<{ x: number; y: number; isPlayer: boolean; color: string }>;
  activeInput: InputDeviceType;
  rearMirrorDataUrl?: string;
}

export interface RaceResult {
  level: number;
  biome: BiomeId;
  carId: CarId;
  position: number;
  totalRacers: number;
  raceTimeMs: number;
  bestLapMs: number | null;
  baseReward: number;
  cleanDrivingBonus: number;
  driftBonus: number;
  nitroBonus: number;
  totalPointsEarned: number;
  damageTaken: CarDamage;
  collisionsCount: number;
  driftMeters: number;
}

export type ActiveModal =
  | 'none'
  | 'garage'
  | 'repair'
  | 'levels'
  | 'shop'
  | 'settings'
  | 'extras';

export type ScreenMode = 'home' | 'racing';
